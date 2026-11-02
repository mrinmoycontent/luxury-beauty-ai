
export async function onRequestPost({ request, env }) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  };

  const response = (status, body) =>
    new Response(JSON.stringify(body), { status, headers });

  try {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return response(500, {
        success: false,
        message: "Booking service is not configured."
      });
    }

    const contentType = request.headers.get("Content-Type") || "";
    if (!contentType.includes("application/json")) {
      return response(415, {
        success: false,
        message: "JSON content type is required."
      });
    }

    const data = await request.json();

    const fullName = String(data.full_name || "").trim();
    const email = String(data.email || "").trim().toLowerCase();
    const phone = String(data.phone || "").trim();
    const service = String(data.service_name || "").trim();
    const appointmentDate = String(data.appointment_date || "").trim();
    const appointmentTime = String(data.appointment_time || "").trim();
    const notes = String(data.notes || "").trim();

    if (
      !fullName || fullName.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      !/^[+0-9()\-\s]{7,20}$/.test(phone) ||
      !service || service.length > 150 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(appointmentTime) ||
      notes.length > 1000
    ) {
      return response(400, {
        success: false,
        message: "Please provide valid booking details."
      });
    }

    const selectedDate = new Date(`${appointmentDate}T00:00:00Z`);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (
      Number.isNaN(selectedDate.getTime()) ||
      selectedDate.toISOString().slice(0, 10) !== appointmentDate ||
      selectedDate < today
    ) {
      return response(400, {
        success: false,
        message: "Please select a valid future date."
      });
    }

    const supabaseUrl = env.SUPABASE_URL.replace(/\/$/, "");
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

    const dbHeaders = {
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
      "Content-Type": "application/json"
    };

    // Find an existing customer by email.
    const customerSearch = await fetch(
      `${supabaseUrl}/rest/v1/customers?email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
      { headers: dbHeaders }
    );

    if (!customerSearch.ok) {
      throw new Error("Could not look up customer.");
    }

    const existingCustomers = await customerSearch.json();
    let customerId;

    if (existingCustomers.length > 0) {
      customerId = existingCustomers[0].id;
    } else {
      // Create a new customer.
      const customerCreate = await fetch(
        `${supabaseUrl}/rest/v1/customers`,
        {
          method: "POST",
          headers: {
            ...dbHeaders,
            "Prefer": "return=representation"
          },
          body: JSON.stringify({
            full_name: fullName,
            email,
            phone
          })
        }
      );

      if (!customerCreate.ok) {
        throw new Error("Could not create customer.");
      }

      const createdCustomers = await customerCreate.json();

      if (!createdCustomers.length) {
        throw new Error("Customer creation returned no record.");
      }

      customerId = createdCustomers[0].id;
    }

    // Create the appointment request as pending.
    const bookingCreate = await fetch(
      `${supabaseUrl}/rest/v1/appointments`,
      {
        method: "POST",
        headers: {
          ...dbHeaders,
          "Prefer": "return=representation"
        },
        body: JSON.stringify({
          customer_id: customerId,
          service_name: service,
          appointment_date: appointmentDate,
          appointment_time: appointmentTime,
          status: "pending",
          notes: notes || null
        })
      }
    );

    if (!bookingCreate.ok) {
      throw new Error("Could not save appointment.");
    }

    const bookings = await bookingCreate.json();

    if (!bookings.length) {
      throw new Error("Booking creation returned no record.");
    }

    return response(201, {
      success: true,
      message: "Your appointment request has been submitted. The clinic will contact you to confirm it.",
      booking: {
        id: bookings[0].id,
        status: bookings[0].status,
        appointment_date: bookings[0].appointment_date,
        appointment_time: bookings[0].appointment_time,
        service_name: bookings[0].service_name
      }
    });

  } catch (error) {
    console.error("Booking API error:", error);

    return response(500, {
      success: false,
      message: "We could not submit your appointment request. Please try again later."
    });
  }
}
