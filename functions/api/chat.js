
const SYSTEM_PROMPT = `
You are Glow Beauty AI, a friendly and professional AI assistant for a beauty clinic.

YOUR ROLE:
- Welcome customers and answer general beauty and skincare questions.
- Provide helpful, general educational information about skincare, beauty routines, ingredients, skin types and treatment concepts.
- Answer clinic-specific questions only when verified clinic information is available.
- Communicate naturally, clearly and professionally.

GENERAL BEAUTY QUESTIONS:
- Answer general skincare and beauty education questions normally.
- Examples include sunscreen, moisturising, dry skin, oily skin, sensitive skin, skincare routines, ingredients and general treatment explanations.
- You may explain what a treatment such as HydraFacial generally involves if asked.
- Do not imply that the clinic provides a treatment just because you explain it.
- For medical concerns, avoid diagnosis and recommend consulting a qualified dermatologist or healthcare professional.
- Never claim guaranteed results.

VERIFIED CLINIC INFORMATION:
- The clinic's verified treatment list, service catalogue, prices, discounts, packages and opening hours are not connected.
- Never guess or assume that the clinic offers a particular treatment.
- If asked what the clinic offers, whether it provides a specific service, or about clinic prices, explain that verified information is not available.
- Never invent clinic contact details, policies or opening hours.

BOOKING LIMITATIONS:
- Online booking and the clinic appointment calendar are NOT connected.
- You cannot check availability, reserve appointments, reschedule or cancel bookings.
- For booking requests, explain that online booking is not connected and direct the customer to contact the clinic.

OTHER LIMITATIONS:
- The customer enquiry database is not connected.
- You cannot contact clinic employees, forward enquiries, save enquiries or arrange callbacks.
- Never claim an enquiry has been submitted or that clinic staff will contact the customer.
- Never request phone numbers, email addresses or other personal details.

RESPONSE STYLE:
- Friendly, concise and professional.
- Usually answer in 1–4 short paragraphs.
- Answer the actual question instead of repeating generic disclaimers.
- Do not use clinic-service disclaimers for general beauty education questions.
- Be transparent whenever clinic-specific information is unavailable.
`;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function containsEmail(text) {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text);
}

function containsPhoneNumber(text) {
  const matches = text.match(
    /(?:\+?\d[\d\s().-]{7,}\d)/g
  ) || [];

  return matches.some(
    value => value.replace(/\D/g, "").length >= 10
  );
}

function redactPersonalInformation(text) {
  return text
    .replace(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      "[email redacted]"
    )
    .replace(
      /(?:\+?\d[\d\s().-]{7,}\d)/g,
      value =>
        value.replace(/\D/g, "").length >= 10
          ? "[phone number redacted]"
          : value
    );
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Only explicit appointment-related requests trigger this response.
function isBookingRequest(text) {
  const patterns = [
    /\b(book|booking|reserve|reservation|reschedule|cancel)\b.{0,60}\b(appointment|slot|session|visit)\b/,
    /\b(appointment|slot|session|visit)\b.{0,60}\b(book|booking|reserve|reservation|reschedule|cancel)\b/,
    /\b(check|confirm)\b.{0,40}\b(appointment|booking|availability|available slots?|time slots?)\b/,
    /\b(available slots?|availability|time slots?)\b/,
    /\b(make|schedule)\b.{0,30}\b(an appointment|a booking|a reservation)\b/,
    /\bcan i (come|visit|book|schedule)\b/,
    /\bwhen can i (book|visit|come in)\b/
  ];

  return patterns.some(pattern => pattern.test(text));
}

// Detect explicit clinic-specific service questions.
// General skincare education and treatment explanations are allowed.
function isClinicServiceQuestion(text) {
  const patterns = [
    /\bwhat (services|treatments|procedures) do you offer\b/,
    /\bwhat (services|treatments|procedures) does (the )?clinic offer\b/,
    /\bwhich (services|treatments|procedures) are available\b/,
    /\bdoes (the )?clinic (offer|provide|perform|have)\b/,
    /\bdo you (offer|provide|perform|have)\b/,
    /\bis (the )?clinic offering\b/,
    /\bdo you have (hydrafacial|hydra facial|botox|fillers?|laser treatments?|chemical peels?)\b/,
    /\bis (hydrafacial|hydra facial|botox|filler|laser treatment|chemical peel) available (at|in) (your|the) clinic\b/,
    /\bwhat is your (service|treatment) menu\b/,
    /\bshow me your (service|treatment) list\b/
  ];

  return patterns.some(pattern => pattern.test(text));
}

// Pricing questions are clinic-specific even if they mention a general treatment.
function isPricingQuestion(text) {
  const patterns = [
    /\b(price|prices|pricing|cost|costs|charge|charges|fee|fees)\b/,
    /\bhow much\b/,
    /\bwhat does .{1,80} cost\b/,
    /\bhow expensive\b/,
    /\bdiscounts?\b/,
    /\b(packages?|offers?)\b.{0,40}\b(price|cost|discount|fee)\b/
  ];

  return patterns.some(pattern => pattern.test(text));
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.GROQ_API_KEY) {
      return jsonResponse(
        { error: "Groq API key is not configured." },
        500
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        { error: "Invalid JSON request body." },
        400
      );
    }

    const messages = body.messages;

    if (
      !Array.isArray(messages) ||
      messages.length === 0 ||
      messages.length > 20
    ) {
      return jsonResponse(
        { error: "Please provide between 1 and 20 messages." },
        400
      );
    }

    for (const message of messages) {
      if (
        !message ||
        !["user", "assistant"].includes(message.role) ||
        typeof message.content !== "string" ||
        message.content.trim().length === 0 ||
        message.content.length > 4000
      ) {
        return jsonResponse(
          { error: "Invalid message format." },
          400
        );
      }
    }

    const latestUserMessage = [...messages]
      .reverse()
      .find(message => message.role === "user");

    if (!latestUserMessage) {
      return jsonResponse(
        { error: "A customer message is required." },
        400
      );
    }

    const customerText = latestUserMessage.content.trim();
    const normalizedText = normalizeText(customerText);

    // Privacy protection.
    if (
      containsEmail(customerText) ||
      containsPhoneNumber(customerText)
    ) {
      return jsonResponse({
        success: true,
        reply:
          "For your privacy, please don't share phone numbers or email addresses in this chat. The secure enquiry system is not connected yet. Please contact the clinic directly for assistance."
      });
    }

    // Booking protection.
    if (isBookingRequest(normalizedText)) {
      return jsonResponse({
        success: true,
        reply:
          "Online booking is not connected yet, so I can't check availability, reserve a slot or confirm an appointment. Please contact the clinic directly to arrange your booking."
      });
    }

    // Clinic service and pricing protection.
    if (
      isClinicServiceQuestion(normalizedText) ||
      isPricingQuestion(normalizedText)
    ) {
      return jsonResponse({
        success: true,
        reply:
          "I don't have the clinic's verified treatment list or pricing yet, so I can't confirm which services are offered or quote a price. Please contact the clinic directly for accurate details."
      });
    }

    // Send the conversation to Groq for general beauty questions.
    // Redact contact details from earlier messages as well.
    const safeMessages = messages.map(message => ({
      role: message.role,
      content: redactPersonalInformation(
        message.content.trim()
      )
    }));

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT
            },
            ...safeMessages
          ],
          temperature: 0.2,
          max_tokens: 400
        })
      }
    );

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();

      console.error(
        "Groq API error:",
        groqResponse.status,
        errorText
      );

      return jsonResponse(
        { error: "The AI service is temporarily unavailable." },
        502
      );
    }

    const result = await groqResponse.json();
    const reply = result?.choices?.[0]?.message?.content;

    if (
      typeof reply !== "string" ||
      reply.trim().length === 0
    ) {
      return jsonResponse(
        { error: "The AI returned an empty response." },
        502
      );
    }

    return jsonResponse({
      success: true,
      reply: reply.trim()
    });

  } catch (error) {
    console.error("Chat API error:", error);

    return jsonResponse(
      { error: "An unexpected server error occurred." },
      500
    );
  }
}
