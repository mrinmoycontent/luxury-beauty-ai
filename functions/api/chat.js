
const SYSTEM_PROMPT = `
You are Glow Beauty AI, a friendly and professional AI receptionist for a beauty clinic.

VERIFIED INFORMATION RULE:
- The clinic's verified treatment list, service catalogue, prices, discounts, packages and opening hours are not connected yet.
- Never guess, infer or assume that the clinic offers a particular treatment or service.
- Never use general beauty industry knowledge to claim that this clinic offers something.
- Do not suggest example treatments unless the customer mentions them first.
- If asked about a treatment, service, price, discount, package or opening hours, explain that verified clinic information is not available in this chat.
- Never say a treatment is popular, commonly offered or likely available as a substitute for confirming clinic availability.
- Never invent clinic contact details.

YOUR ROLE:
- Welcome customers.
- Answer general beauty-related questions when appropriate.
- Answer clinic-specific questions only when verified information is provided.
- Communicate naturally and professionally.

SYSTEM LIMITATIONS:
- The clinic booking calendar is NOT connected.
- The customer enquiry database is NOT connected.
- You cannot contact clinic employees.
- You cannot forward, submit, record or save enquiries.
- You cannot arrange callbacks.
- You cannot check appointment availability.
- You cannot confirm appointments.

STRICT RULES:
1. Never invent appointment availability.
2. Never confirm or reserve appointments.
3. Never claim that an enquiry was forwarded or saved.
4. Never promise that clinic staff will contact a customer.
5. Never claim to have checked a calendar or external system.
6. Never request phone numbers, email addresses or other personal details.
7. Never invent services, prices, opening hours, discounts or clinic policies.
8. For booking requests, explain that online booking is not connected and direct the customer to contact the clinic.
9. Never repeat customers' personal contact information.
10. Do not add speculative examples or unnecessary general facts to clinic-specific answers.

RESPONSE STYLE:
- Friendly, concise and professional.
- Usually respond in 1–3 short sentences.
- Be transparent when information is unavailable.
- Never make promises the application cannot fulfil.
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

// Detect email addresses.
function containsEmail(text) {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text);
}

// Detect phone numbers containing at least 10 digits.
function containsPhoneNumber(text) {
  const matches = text.match(
    /(?:\+?\d[\d\s().-]{7,}\d)/g
  ) || [];

  return matches.some(
    value => value.replace(/\D/g, "").length >= 10
  );
}

// Remove contact details before sending conversation history to Groq.
function redactPersonalInformation(text) {
  return text
    .replace(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      "[email redacted]"
    )
    .replace(
      /(?:\+?\d[\d\s().-]{7,}\d)/g,
      (value) =>
        value.replace(/\D/g, "").length >= 10
          ? "[phone number redacted]"
          : value
    );
}

// Detect appointment and booking requests.
function isBookingRequest(text) {
  return /\b(book|booking|appointment|appointments|reserve|reservation|reservations|availability|available slot|time slot|schedule|reschedule|cancel my appointment|confirm my appointment|confirm the booking)\b/i.test(text);
}

// Detect clinic service and pricing questions.
// These receive a fixed response without using Groq.
function isClinicServiceOrPricingRequest(text) {
  return /\b(service|services|treatment|treatments|facial|facials|hydrafacial|hydra facial|waxing|skincare|skin care|body treatment|body treatments|laser|peel|peels|botox|filler|fillers|price|prices|pricing|cost|costs|charge|charges|discount|discounts|package|packages|menu|offered|offer|available at this clinic|does the clinic|do you provide|what do you offer|what does the clinic offer)\b/i.test(text);
}

export async function onRequestPost({ request, env }) {
  try {
    // Check Groq configuration.
    if (!env.GROQ_API_KEY) {
      return jsonResponse(
        { error: "Groq API key is not configured." },
        500
      );
    }

    // Parse request.
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

    // Validate conversation.
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

    // Validate each message.
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

    // Find the latest customer message.
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

    // PRIVACY PROTECTION.
    // Do not send messages containing contact details to Groq.
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

    // BOOKING PROTECTION.
    // This fixed response does not consume a Groq API request.
    if (isBookingRequest(customerText)) {
      return jsonResponse({
        success: true,
        reply:
          "Online booking is not connected yet, so I can't check availability, reserve a slot or confirm an appointment. Please contact the clinic directly to arrange your booking."
      });
    }

    // SERVICE AND PRICING PROTECTION.
    // Do not let the AI guess clinic-specific information.
    // This fixed response does not consume a Groq API request.
    if (isClinicServiceOrPricingRequest(customerText)) {
      return jsonResponse({
        success: true,
        reply:
          "I don't have the clinic's verified treatment list or pricing yet, so I can't confirm which services are offered or quote a price. Please contact the clinic directly for accurate details."
      });
    }

    // Redact personal information in earlier conversation messages.
    const safeMessages = messages.map(message => ({
      role: message.role,
      content: redactPersonalInformation(
        message.content.trim()
      )
    }));

    // Prepare Groq conversation.
    const groqMessages = [
      {
        role: "system",
        content: SYSTEM_PROMPT
      },
      ...safeMessages
    ];

    // Call the existing Groq API.
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
          messages: groqMessages,
          temperature: 0.2,
          max_tokens: 400
        })
      }
    );

    // Handle Groq errors.
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

    // Parse Groq response.
    const result = await groqResponse.json();

    const reply =
      result?.choices?.[0]?.message?.content;

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
