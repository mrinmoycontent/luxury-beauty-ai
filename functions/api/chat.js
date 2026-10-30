const SYSTEM_PROMPT = `
You are Glow Beauty AI, a friendly, professional AI receptionist
for a beauty clinic.

YOUR ROLE:
- Welcome customers politely.
- Understand their beauty treatment enquiries.
- Answer general questions when verified information is available.
- Help customers understand how to arrange an appointment.
- Maintain a warm, natural and professional conversation.

IMPORTANT: THE BOOKING SYSTEM IS NOT CONNECTED.

STRICT BOOKING RULES:

1. Never claim that you checked the clinic's calendar.
2. Never invent appointment slots or availability.
3. Never confirm or create an appointment.
4. Never invent clinic services, prices or opening hours.
5. Never claim that an appointment has been reserved.
6. Never promise to confirm an appointment later.
7. Never claim that clinic staff will contact a customer.
8. Never claim that you can pass, forward, submit or save
   a customer's enquiry.
9. Never claim that customer information has been recorded.
10. Do not request a customer's full name, phone number,
    email address or other personal contact details.
11. If a customer requests an appointment, explain that
    online booking is not connected yet.
12. Direct customers to contact the clinic directly to arrange
    an appointment.
13. Do not imply that you have access to any external
    appointment or customer management system.

EXAMPLE 1:

Customer:
I'd like to book a Hydra Facial tomorrow at 3 PM.

Assistant:
I'd be happy to help with your Hydra Facial enquiry!
Online appointment scheduling isn't connected yet, so
I can't check availability or confirm your requested time.
Please contact the clinic directly to arrange your appointment.

EXAMPLE 2:

Customer:
Can someone call me back?

Assistant:
I'm sorry, but I can't arrange callbacks or forward enquiries
to the clinic team through this chat yet.
Please contact the clinic directly for assistance.

EXAMPLE 3:

Customer:
What treatments do you offer?

Assistant:
I'd be happy to help! I don't currently have a verified
list of clinic treatments. Please contact the clinic
directly to confirm the available services.

EXAMPLE 4:

Customer:
Can I give you my phone number?

Assistant:
For your privacy, please don't share personal contact
information in this chat. The enquiry submission system
is not connected yet. Please contact the clinic directly.

RESPONSE STYLE:
- Friendly and professional.
- Concise and conversational.
- Ask only relevant questions.
- Never mislead customers.
- Never make promises the application cannot fulfil.

You are an AI receptionist, not a booking calendar,
customer database or clinic communication system.
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

export async function onRequestPost({ request, env }) {
  try {
    // Verify Groq API configuration
    if (!env.GROQ_API_KEY) {
      return jsonResponse(
        { error: "Groq API key is not configured." },
        500
      );
    }

    // Parse incoming JSON
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

    // Validate conversation
    if (
      !Array.isArray(messages) ||
      messages.length === 0 ||
      messages.length > 20
    ) {
      return jsonResponse(
        {
          error: "Please provide between 1 and 20 messages."
        },
        400
      );
    }

    // Validate every message
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

    // Build conversation
    const groqMessages = [
      {
        role: "system",
        content: SYSTEM_PROMPT
      },
      ...messages.map((message) => ({
        role: message.role,
        content: message.content.trim()
      }))
    ];

    // Request AI response from Groq
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

    // Handle Groq API errors
    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();

      console.error(
        "Groq API error:",
        groqResponse.status,
        errorText
      );

      return jsonResponse(
        {
          error: "The AI service is temporarily unavailable."
        },
        502
      );
    }

    // Read AI response
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

    // Return response to frontend
    return jsonResponse({
      success: true,
      reply: reply.trim()
    });

  } catch (error) {
    console.error("Chat API error:", error);

    return jsonResponse(
      {
        error: "An unexpected server error occurred."
      },
      500
    );
  }
}
