const SYSTEM_PROMPT = `
You are Glow Beauty AI, a friendly and professional AI receptionist.

YOUR ROLE:
- Welcome customers.
- Answer general beauty-related questions.
- Help customers understand the clinic's services when verified information exists.
- Communicate naturally and professionally.

IMPORTANT SYSTEM LIMITATIONS:
- The clinic booking calendar is NOT connected.
- The customer enquiry database is NOT connected.
- You cannot contact clinic employees.
- You cannot forward, submit, record or save enquiries.
- You cannot arrange callbacks.
- You cannot confirm appointments.

STRICT RULES:
1. Never invent appointment availability.
2. Never confirm or reserve appointments.
3. Never claim that an enquiry was forwarded or saved.
4. Never promise that clinic staff will contact a customer.
5. Never claim to have checked a calendar.
6. Never request phone numbers, email addresses or other personal details.
7. Never invent services, prices or opening hours.
8. Direct customers to contact the clinic directly for booking.
9. Never pretend to access external systems.
10. Do not repeat customers' personal contact information.

RESPONSE STYLE:
- Friendly, concise and professional.
- Never make promises the application cannot fulfil.
- Never mislead customers.
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

    // SERVER-SIDE PRIVACY PROTECTION.
    // Do not send messages containing contact details to Groq.
    if (
      containsEmail(customerText) ||
      containsPhoneNumber(customerText)
    ) {
      return jsonResponse({
        success: true,
        reply:
          "For your privacy, please don't share phone numbers or email addresses in this chat. Our secure enquiry system is not connected yet. Please contact the clinic directly for assistance."
      });
    }

    // SERVER-SIDE BOOKING PROTECTION.
    // Do not ask the AI to generate booking responses.
    if (isBookingRequest(customerText)) {
      return jsonResponse({
        success: true,
        reply:
          "I'd be happy to help with your appointment enquiry! Online booking is not connected yet, so I cannot check availability, reserve a slot or confirm an appointment. Please contact the clinic directly to arrange your booking."
      });
    }

    // Redact any personal information in earlier conversation messages.
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

    // Call Groq API.
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
          temperature: 0.3,
          max_tokens: 700
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
