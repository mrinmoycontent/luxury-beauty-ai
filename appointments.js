(() => {
  "use strict";

  const client = window.glowSupabaseClient;
  const ADMIN_USER_ID = "f28c8ccc-6aeb-46db-b388-a1238030544d";

  const list = document.getElementById("appointmentList");
  const statusMessage = document.getElementById("appointmentStatus");
  const totalElement = document.getElementById("appointmentTotal");
  const pendingElement = document.getElementById("appointmentPending");
  const refreshButton = document.getElementById("refreshAppointments");

  const allowedStatuses = [
    "pending",
    "confirmed",
    "completed",
    "cancelled"
  ];

  if (
    !client ||
    !list ||
    !statusMessage ||
    !totalElement ||
    !pendingElement ||
    !refreshButton
  ) {
    console.error("Appointment dashboard elements or Supabase client are missing.");
    return;
  }

  let loading = false;
  let activeUserId = null;
  let activeRole = null;
  let currentRecords = [];

  function formatDate(value) {
    if (!value) return "Date unavailable";

    const date = new Date(value + "T00:00:00");

    if (Number.isNaN(date.getTime())) {
      return "Date unavailable";
    }

    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(date);
  }

  function formatTime(value) {
    if (!value) return "Time unavailable";

    const parts = value.split(":");

    if (parts.length < 2) return value;

    const date = new Date();

    date.setHours(
      Number(parts[0]),
      Number(parts[1]),
      0,
      0
    );

    return new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).format(date);
  }

  function statusClass(status) {
    return {
      pending: "bg-amber-100 text-amber-800",
      confirmed: "bg-green-100 text-green-800",
      completed: "bg-blue-100 text-blue-800",
      cancelled: "bg-red-100 text-red-800"
    }[status] || "bg-gray-100 text-gray-700";
  }

  function createText(tag, className, value) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = value ?? "";
    return element;
  }

  function updateSummary(records) {
    totalElement.textContent = String(records.length);

    pendingElement.textContent = String(
      records.filter(item => item.status === "pending").length
    );
  }

  async function saveStatus(appointment, newStatus, button, select) {
    if (!allowedStatuses.includes(newStatus)) return;

    button.disabled = true;
    select.disabled = true;
    button.textContent = "Saving...";

    try {
      if (activeUserId === ADMIN_USER_ID) {
        const { error } = await client
          .from("appointments")
          .update({ status: newStatus })
          .eq("id", appointment.id);

        if (error) throw error;

      } else if (activeRole === "staff") {
        const { data, error } = await client.rpc(
          "staff_update_appointment_status",
          {
            p_appointment_id: appointment.id,
            p_new_status: newStatus
          }
        );

        if (error) throw error;

        if (data !== true) {
          throw new Error("Appointment not found or update not authorised.");
        }

      } else {
        throw new Error("This account is not authorised to update appointments.");
      }

      statusMessage.textContent = "Appointment status updated.";

      await loadAppointments();

    } catch (error) {
      console.error("Appointment update failed:", error);

      statusMessage.textContent =
        error.message || "Could not update appointment status.";

      button.disabled = false;
      select.disabled = false;
      button.textContent = "Update";
    }
  }

  function renderAppointments(records, isAdmin) {
    list.replaceChildren();

    if (!records.length) {
      list.appendChild(
        createText(
          "p",
          "text-sm text-gray-500 py-8 text-center",
          "No appointment requests have been submitted yet."
        )
      );

      return;
    }

    records.forEach(appointment => {
      const card = document.createElement("div");

      card.className =
        "bg-white border border-gray-100 rounded-xl p-4 space-y-3";

      const top = document.createElement("div");
      top.className = "flex justify-between items-start gap-3";

      const details = document.createElement("div");
      details.className = "min-w-0";

      details.appendChild(
        createText(
          "p",
          "font-semibold text-sm text-gray-900",
          appointment.customer_name || "Customer"
        )
      );

      // Only admin receives and renders customer contact details.
      if (isAdmin) {
        details.appendChild(
          createText(
            "p",
            "text-xs text-gray-500 mt-1 break-all",
            appointment.customer_email || "Email unavailable"
          )
        );

        if (appointment.customer_phone) {
          details.appendChild(
            createText(
              "p",
              "text-xs text-gray-500 mt-1",
              appointment.customer_phone
            )
          );
        }
      }

      const badge = createText(
        "span",
        "text-[10px] uppercase font-semibold px-3 py-1 rounded-full whitespace-nowrap " +
          statusClass(appointment.status),
        appointment.status || "unknown"
      );

      top.append(details, badge);
      card.appendChild(top);

      card.appendChild(
        createText(
          "p",
          "text-sm font-semibold mt-2",
          appointment.service_name || "Service not specified"
        )
      );

      card.appendChild(
        createText(
          "p",
          "text-xs text-gray-500",
          formatDate(appointment.appointment_date) +
            " · " +
            formatTime(appointment.appointment_time)
        )
      );

      // Private notes are shown only to admin.
      if (isAdmin && appointment.notes) {
        card.appendChild(
          createText(
            "p",
            "text-xs text-gray-600 bg-gray-50 rounded-lg p-3",
            "Notes: " + appointment.notes
          )
        );
      }

      const controls = document.createElement("div");

      controls.className =
        "flex gap-2 items-center pt-2 border-t border-gray-100";

      const select = document.createElement("select");

      select.className =
        "flex-1 min-w-0 rounded-lg border border-gray-200 p-2 text-xs bg-white";

      allowedStatuses.forEach(value => {
        const option = document.createElement("option");

        option.value = value;
        option.textContent =
          value.charAt(0).toUpperCase() + value.slice(1);

        option.selected = value === appointment.status;

        select.appendChild(option);
      });

      const updateButton = document.createElement("button");

      updateButton.type = "button";

      updateButton.className =
        "bg-black text-white rounded-lg px-4 py-2 text-xs font-semibold";

      updateButton.textContent = "Update";

      updateButton.addEventListener("click", () => {
        saveStatus(
          appointment,
          select.value,
          updateButton,
          select
        );
      });

      controls.append(select, updateButton);
      card.appendChild(controls);
      list.appendChild(card);
    });
  }

  async function loadAppointments() {
    if (loading || !activeUserId) return;

    loading = true;
    refreshButton.disabled = true;

    statusMessage.textContent = "Fetching appointment records...";

    try {
      let records = [];

      const isAdmin = activeUserId === ADMIN_USER_ID;

      if (isAdmin) {
        // Admin retains full appointment information.
        const { data: appointments, error: appointmentError } =
          await client
            .from("appointments")
            .select(
              "id, customer_id, service_name, appointment_date, appointment_time, status, notes, created_at"
            )
            .order("appointment_date", { ascending: true })
            .order("appointment_time", { ascending: true });

        if (appointmentError) throw appointmentError;

        const customerIds = [
          ...new Set(
            (appointments || [])
              .map(item => item.customer_id)
              .filter(Boolean)
          )
        ];

        let customers = [];

        if (customerIds.length) {
          const { data, error } = await client
            .from("customers")
            .select("id, full_name, email, phone")
            .in("id", customerIds);

          if (error) throw error;

          customers = data || [];
        }

        const customerMap = new Map(
          customers.map(customer => [customer.id, customer])
        );

        records = (appointments || []).map(item => {
          const customer = customerMap.get(item.customer_id) || {};

          return {
            ...item,
            customer_name: customer.full_name || "Customer",
            customer_email: customer.email || "",
            customer_phone: customer.phone || ""
          };
        });

      } else if (activeRole === "staff") {
        // Staff receives only the restricted RPC response.
        const { data, error } = await client.rpc(
          "staff_list_appointments"
        );

        if (error) throw error;

        records = (data || []).map(item => ({
          ...item,
          customer_name: item.customer_name
        }));

      } else {
        throw new Error("This account is not authorised to view appointments.");
      }

      currentRecords = records;

      updateSummary(records);
      renderAppointments(records, isAdmin);

      statusMessage.textContent =
        `Showing ${records.length} appointment request(s).`;

    } catch (error) {
      console.error("Appointment loading failed:", error);

      list.replaceChildren(
        createText(
          "p",
          "text-sm text-red-600 py-4",
          "Appointment records could not be loaded. Check the Supabase permissions and staff access functions."
        )
      );

      totalElement.textContent = "—";
      pendingElement.textContent = "—";

      statusMessage.textContent = "Database query failed.";

    } finally {
      loading = false;
      refreshButton.disabled = false;
    }
  }

  function applySession(session) {
    const user = session?.user;

    if (!user) {
      activeUserId = null;
      activeRole = null;
      currentRecords = [];

      list.replaceChildren();

      totalElement.textContent = "—";
      pendingElement.textContent = "—";

      statusMessage.textContent = "Sign in to view appointments.";

      return;
    }

    activeUserId = user.id;
    activeRole = user.app_metadata?.role || null;

    loadAppointments();
  }

  refreshButton.addEventListener("click", loadAppointments);

  client.auth.onAuthStateChange((event, session) => {
    if (
      ["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED", "SIGNED_OUT"].includes(event)
    ) {
      applySession(session);
    }
  });

  // Handles the case where INITIAL_SESSION fired before this file loaded.
  client.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error("Could not read appointment dashboard session:", error);
      return;
    }

    if (!activeUserId && data.session) {
      applySession(data.session);
    }
  });

})();
