
(() => {
  "use strict";

  const client = window.glowSupabaseClient;

  const countElement = document.getElementById("customerCount");
  const listElement = document.getElementById("customerList");
  const statusElement = document.getElementById("customerStatus");
  const refreshButton = document.getElementById("refreshCustomers");

  if (!client || !countElement || !listElement || !statusElement) {
    console.error("Customer dashboard elements or Supabase client are missing.");
    return;
  }

  let loading = false;

  function clearCustomerData(message = "Sign in to view customer records.") {
    countElement.textContent = "—";
    listElement.replaceChildren();

    const messageElement = document.createElement("p");
    messageElement.className = "text-sm text-gray-500 py-4";
    messageElement.textContent = message;

    listElement.appendChild(messageElement);
    statusElement.textContent = "";
  }

  function formatDate(value) {
    if (!value) return "Date unavailable";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Date unavailable";
    }

    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(date);
  }

  function renderCustomers(customers) {
    listElement.replaceChildren();

    if (!customers.length) {
      const empty = document.createElement("p");
      empty.className = "text-sm text-gray-500 py-4";
      empty.textContent = "No customer records have been added yet.";
      listElement.appendChild(empty);
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

      const email = document.createElement("p");
      email.className = "text-xs text-gray-500 mt-1 break-all";
      email.textContent = customer.email || "No email provided";

      const date = document.createElement("p");
      date.className = "text-xs text-gray-400 mt-1";
      date.textContent = "Registered " + formatDate(customer.created_at);

      details.append(name, email, date);
      row.appendChild(details);
      listElement.appendChild(row);
    });
  }

  async function loadCustomers() {
    if (loading) return;

    loading = true;
    refreshButton.disabled = true;
    countElement.textContent = "Loading...";
    statusElement.textContent = "Fetching customer records...";

    try {
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

      countElement.textContent = String(countResult.count ?? 0);

      renderCustomers(listResult.data || []);

      statusElement.textContent =
        "Showing the latest " +
        Math.min((listResult.data || []).length, 5) +
        " customer records.";

    } catch (error) {
      console.error("Customer data loading failed:", error);

      countElement.textContent = "Unavailable";
      listElement.replaceChildren();

      const errorMessage = document.createElement("p");
      errorMessage.className = "text-sm text-red-600 py-4";
      errorMessage.textContent =
        "Customer data could not be loaded. Check the admin SELECT permission for the customers table.";

      listElement.appendChild(errorMessage);
      statusElement.textContent = "Database query failed.";

    } finally {
      loading = false;
      refreshButton.disabled = false;
    }
  }

  refreshButton.addEventListener("click", loadCustomers);

  client.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION") {
      if (session) {
        loadCustomers();
      } else {
        clearCustomerData();
      }
      return;
    }

    if (event === "SIGNED_IN" && session) {
      loadCustomers();
    }

    if (event === "SIGNED_OUT") {
      clearCustomerData();
    }
  });

})();
