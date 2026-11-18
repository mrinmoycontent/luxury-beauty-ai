(() => {
  "use strict";

  const client = window.glowSupabaseClient;
  const ADMIN_USER_ID = "f28c8ccc-6aeb-46db-b388-a1238030544d";

  const countElement = document.getElementById("customerCount");
  const listElement = document.getElementById("customerList");
  const statusElement = document.getElementById("customerStatus");
  const refreshButton = document.getElementById("refreshCustomers");

  if (!client || !countElement || !listElement || !statusElement || !refreshButton) {
    console.error("Customer dashboard elements or Supabase client are missing.");
    return;
  }

  let loading = false;
  let activeUserId = null;
  let activeRole = null;

  function setMessage(message, isError = false) {
    listElement.replaceChildren();
    const p = document.createElement("p");
    p.className = isError
      ? "text-sm text-red-600 py-4"
      : "text-sm text-gray-500 py-4";
    p.textContent = message;
    listElement.appendChild(p);
  }

  function formatDate(value) {
    if (!value) return "Date unavailable";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Date unavailable";

    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(date);
  }

  function renderCustomers(customers, isAdmin) {
    listElement.replaceChildren();

    if (!customers.length) {
      setMessage("No customer records have been added yet.");
      return;
    }

    customers.forEach(customer => {
      const row = document.createElement("div");
      row.className =
        "flex items-center justify-between gap-3 py-4 border-b border-gray-100 last:border-0";

      const details = document.createElement("div");
      details.className = "min-w-0";

      const name = document.createElement("p");
      name.className = "text-sm font-semibold text-gray-900 truncate";
      name.textContent = customer.full_name || "Unnamed customer";

      details.appendChild(name);

      // Contact details are displayed only to the administrator.
      if (isAdmin) {
        const email = document.createElement("p");
        email.className = "text-xs text-gray-500 mt-1 break-all";
        email.textContent = customer.email || "No email provided";

        const date = document.createElement("p");
        date.className = "text-xs text-gray-400 mt-1";
        date.textContent = "Registered " + formatDate(customer.created_at);

        details.append(email, date);
      }

      row.appendChild(details);
      listElement.appendChild(row);
    });
  }

  async function loadCustomers() {
    if (loading || !activeUserId) return;

    loading = true;
    refreshButton.disabled = true;
    countElement.textContent = "Loading...";
    statusElement.textContent = "Fetching customer records...";

    try {
      let customers = [];
      let total = 0;

      if (activeUserId === ADMIN_USER_ID) {
        const [countResult, listResult] = await Promise.all([
          client
            .from("customers")
            .select("id", { count: "exact", head: true }),

          client
            .from("customers")
            .select("id, full_name, email, created_at")
            .order("created_at", { ascending: false })
            .limit(5)
        ]);

        if (countResult.error) throw countResult.error;
        if (listResult.error) throw listResult.error;

        total = countResult.count ?? 0;
        customers = listResult.data || [];

        renderCustomers(customers, true);

        statusElement.textContent =
          `Showing the latest ${customers.length} customer records.`;

      } else if (activeRole === "staff") {
        const { data, error } = await client.rpc("staff_list_customers");

        if (error) throw error;

        customers = data || [];
        total = customers.length;

        renderCustomers(customers, false);

        statusElement.textContent =
          `Showing ${customers.length} customer name(s). Contact details are restricted.`;

      } else {
        throw new Error("This account is not authorised to view customer records.");
      }

      countElement.textContent = String(total);

    } catch (error) {
      console.error("Customer data loading failed:", error);

      countElement.textContent = "Unavailable";

      setMessage(
        "Customer data could not be loaded. Check the Supabase permissions and staff access function.",
        true
      );

      statusElement.textContent = "Database query failed.";

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

      countElement.textContent = "—";
      setMessage("Sign in to view customer records.");
      statusElement.textContent = "";

      return;
    }

    activeUserId = user.id;
    activeRole = user.app_metadata?.role || null;

    loadCustomers();
  }

  refreshButton.addEventListener("click", loadCustomers);

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
      console.error("Could not read customer dashboard session:", error);
      return;
    }

    if (!activeUserId && data.session) {
      applySession(data.session);
    }
  });

})();
