
const ALLOWED_ORIGINS = new Set([
  "https://luxury-beauty-ai-5zz.pages.dev"
]);

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");

  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin",
    "Access-Control-Allow-Origin": "https://luxury-beauty-ai-5zz.pages.dev"
  };

  const response = (status, body) =>
    new Response(JSON.stringify(body), { status, headers });

  try {
    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
      return response(403, { success: false, message: "Request not allowed." });
    }

    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return response(500, { success: false, message: "Booking service is not configured." });
    }

    if (!(request.headers.get("Content-Type") || "").includes("application/json")) {
      return response(415, { success: false, message: "JSON content type is required." });
    }

    const data = await request.json();

    if (String(data.website || "").trim()) {
      return response(400, { success: false, message: "Invalid request." });
    }

    const fullName = String(data.full_name || "").trim();
    const email = String(data.email || "").trim().toLowerCase();
    const phone = String(data.phone || "").trim();
    const service = String(data.service_name || "").trim();
    const appointmentDate = String(data.appointment_date || "").trim();
    const appointmentTime = String(data.appointment_time || "").trim();
    const notes = String(data.notes || "").trim();

    if (
      !fullName || fullName.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
      !/^[+0-9()\-\s]{7,20}$/.test(phone) ||
      !service || service.length > 150 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(appointmentTime) ||
      notes.length > 1000
    ) {
      return response(400, { success: false, message: "Please provide valid booking details." });
    }

    const selectedDate = new Date(`${appointmentDate}T00:00:00Z`);
    if (
      Number.isNaN(selectedDate.getTime()) ||
      selectedDate.toISOString().slice(0, 10) !== appointmentDate
    ) {
      return response(400, { success: false, message: "Please select a valid date." });
    }

    const supabaseUrl = env.SUPABASE_URL.replace(/\/$/, "");
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

    const dbHeaders = {
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
      "Content-Type": "application/json"
    };

    // Find the customer by email.
    const customerSearch = await fetch(
      `${supabaseUrl}/rest/v1/customers?email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
      { headers: dbHeaders }
    );

    if (!customerSearch.ok) throw new Error("Customer lookup failed.");

    const existingCustomers = await customerSearch.json();
    let customerId;

    if (existingCustomers.length) {
      customerId = existingCustomers[0].id;

      const customerUpdate = await fetch(
        `${supabaseUrl}/rest/v1/customers?id=eq.${encodeURIComponent(customerId)}`,
        {
          method: "PATCH",
          headers: dbHeaders,
          body: JSON.stringify({ full_name: fullName, phone })
        }
      );

      if (!customerUpdate.ok) throw new Error("Customer update failed.");
    } else {
      const customerCreate = await fetch(`${supabaseUrl}/rest/v1/customers`, {
        method: "POST",
        headers: { ...dbHeaders, "Prefer": "return=representation" },
        body: JSON.stringify({ full_name: fullName, email, phone })
      });

      if (!customerCreate.ok) throw new Error("Customer creation failed.");

      const created = await customerCreate.json();
      if (!created.length) throw new Error("Customer record was not returned.");
      customerId = created[0].id;
    }

    // The database function checks and reserves the slot atomically.
    const bookingResponse = await fetch(
      `${supabaseUrl}/rest/v1/rpc/create_booking_if_available`,
      {
        method: "POST",
        headers: dbHeaders,
        body: JSON.stringify({
          p_customer_id: customerId,
          p_service_name: service,
          p_appointment_date: appointmentDate,
          p_appointment_time: `${appointmentTime}:00`,
          p_notes: notes || null
        })
      }
    );

    const bookingResult = await bookingResponse.json();

    if (!bookingResponse.ok) {
      console.error("Booking RPC error:", bookingResult);
      throw new Error("The booking could not be processed.");
    }

    if (!bookingResult || bookingResult.success !== true) {
      return response(409, {
        success: false,
        message: bookingResult?.message || "That slot is no longer available. Please select another time."
      });
    }

    return response(201, {
      success: true,
      message: "Your appointment request has been submitted. The clinic will contact you to confirm it.",
      booking: bookingResult
    });

  } catch (error) {
    console.error("Booking API error:", error);
    return response(500, {
      success: false,
      message: "We could not submit your appointment request. Please try again later."
    });
  }
}
