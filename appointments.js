
(() => {
  "use strict";

  const client = window.glowSupabaseClient;

  const list = document.getElementById("appointmentList");
  const statusMessage = document.getElementById("appointmentStatus");
  const totalElement = document.getElementById("appointmentTotal");
  const pendingElement = document.getElementById("appointmentPending");
  const refreshButton = document.getElementById("refreshAppointments");

  if (!client || !list || !statusMessage ||
      !totalElement || !pendingElement || !refreshButton) {
    console.error("Appointment dashboard elements or Supabase client are missing.");
    return;
  }

  const allowedStatuses = [
    "pending",
    "confirmed",
    "completed",
    "cancelled"
  ];

  let loading = false;

  function formatDate(value) {
    if (!value) return "Date unavailable";

    const date = new Date(value + "T00:00:00");

    if (Number.isNaN(date.getTime())) return "Date unavailable";

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
    date.setHours(Number(parts[0]), Number(parts[1]), 0, 0);

    return new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).format(date);
  }

  function statusClass(status) {
    const styles = {
      pending: "bg-amber-100 text-amber-800",
      confirmed: "bg-green-100 text-green-800",
      completed: "bg-blue-100 text-blue-800",
      cancelled: "bg-red-100 text-red-800"
    };

    return styles[status] || "bg-gray-100 text-gray-700";
  }

  function createText(tag, className, value) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = value;
    return element;
  }

  function renderAppointments(appointments, customers) {
    list.replaceChildren();

    const customerMap = new Map(
      customers.map(customer => [customer.id, customer])
    );

    if (!appointments.length) {
      list.appendChild(
        createText(
          "p",
          "text-sm text-gray-500 py-8 text-center",
          "No appointment requests have been submitted yet."
        )
      );
      return;
    }

    appointments.forEach(appointment => {
      const customer = customerMap.get(appointment.customer_id) || {};

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
          customer.full_name || "Customer"
        )
      );

      details.appendChild(
        createText(
          "p",
          "text-xs text-gray-500 mt-1 break-all",
          customer.email || "Email unavailable"
        )
      );

      if (customer.phone) {
        details.appendChild(
          createText("p", "text-xs text-gray-500 mt-1", customer.phone)
        );
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

      if (appointment.notes) {
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

      updateButton.addEventListener("click", async () => {
        const newStatus = select.value;

        if (!allowedStatuses.includes(newStatus)) return;

        updateButton.disabled = true;
        updateButton.textContent = "Saving...";

        try {
          const { error } = await client
            .from("appointments")
            .update({ status: newStatus })
            .eq("id", appointment.id);

          if (error) throw error;

          statusMessage.textContent = "Appointment status updated.";
          await loadAppointments();

        } catch (error) {
          console.error("Appointment update failed:", error);
          statusMessage.textContent =
            "Could not update status. Check the appointments UPDATE permission.";

          updateButton.disabled = false;
          updateButton.textContent = "Update";
        }
      });

      controls.append(select, updateButton);
      card.appendChild(controls);
      list.appendChild(card);
    });
  }

  async function loadAppointments() {
    if (loading) return;

    loading = true;
    refreshButton.disabled = true;
    statusMessage.textContent = "Fetching appointment records...";

    try {
      const { data: appointments, error: appointmentError } = await client
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

      const records = appointments || [];

      totalElement.textContent = String(records.length);

      pendingElement.textContent = String(
        records.filter(item => item.status === "pending").length
      );

      renderAppointments(records, customers);

      statusMessage.textContent =
        "Showing " + records.length + " appointment request(s).";

    } catch (error) {
      console.error("Appointment loading failed:", error);

      list.replaceChildren(
        createText(
          "p",
          "text-sm text-red-600 py-4",
          "Appointment records could not be loaded. Check the appointments and customers SELECT permissions."
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

  refreshButton.addEventListener("click", loadAppointments);

  client.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
      if (session) loadAppointments();
      return;
    }

    if (event === "SIGNED_OUT") {
      list.replaceChildren();
      totalElement.textContent = "—";
      pendingElement.textContent = "—";
      statusMessage.textContent = "Sign in to view appointments.";
    }
  });

})();
