
(() => {
  "use strict";

  const form = document.getElementById("bookingForm");
  const status = document.getElementById("bookingStatus");
  const submitButton = document.getElementById("submitBooking");
  const dateInput = document.getElementById("appointmentDate");

  if (!form || !status || !submitButton || !dateInput) return;

  const today = new Date();
  const localToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
  ].join("-");

  dateInput.min = localToday;

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const data = new FormData(form);

    // Reject submissions that fill the hidden honeypot.
    if (String(data.get("website") || "").trim()) {
      status.textContent = "Your request could not be submitted.";
      return;
    }

    const payload = {
      full_name: String(data.get("full_name") || "").trim(),
      email: String(data.get("email") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      service_name: String(data.get("service_name") || "").trim(),
      appointment_date: String(data.get("appointment_date") || ""),
      appointment_time: String(data.get("appointment_time") || ""),
      notes: String(data.get("notes") || "").trim()
    };

    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";
    status.textContent = "";

    try {
      const response = await fetch("/api/book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to submit your request.");
      }

      form.reset();
      dateInput.min = localToday;

      status.textContent =
        "Thank you! Your appointment request has been received. The clinic will contact you to confirm it.";

      status.className = "text-sm text-center text-green-700";

    } catch (error) {
      status.textContent =
        error.message || "Something went wrong. Please try again.";

      status.className = "text-sm text-center text-red-600";

    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Submit Appointment Request";
    }
  });
})();
