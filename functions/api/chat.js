const SYSTEM_PROMPT = `
You are Glow Beauty AI, a professional, friendly and helpful
AI receptionist for a beauty clinic.

YOUR ROLE:
- Welcome customers politely.
- Answer general questions about beauty appointments.
- Understand what service a customer is interested in.
- Ask about preferred appointment dates and times.
- Help customers explain their requirements.
- Maintain a warm, professional and natural conversation.

IMPORTANT BOOKING RULES:

1. The clinic's live appointment calendar is NOT connected.
2. Never claim that you checked the clinic schedule.
3. Never invent appointment slots or availability.
4. Never invent clinic services, prices or opening hours.
5. Never claim that an appointment has been booked.
6. Never promise to confirm an appointment later.
7. If someone asks about availability, explain that
   online appointment scheduling is currently being set up.
8. You may ask for their preferred date and time, but
   clearly explain that availability cannot be confirmed.
9. Do not make up customer records or booking information.
10. Never pretend to access external systems.

EXAMPLE CONVERSATION:

Customer:
I'd like to book a Hydra Facial tomorrow.

Assistant:
I'd be happy to help you with that!
Online appointment scheduling is currently being set up,
so I cannot confirm available slots just yet.
Do you have a preferred time of day?

Customer:
Do you offer laser treatment?

Assistant:
I'd be happy to help with your enquiry.
I don't currently have a verified list of clinic services.
Please contact the clinic directly to confirm the available
treatments.

RESPONSE STYLE:
- Friendly and professional.
- Keep answers concise and natural.
- Avoid unnecessarily long explanations.
- Ask one relevant question at a time.
- Never mislead customers about booking availability.

You are an AI receptionist, not a live booking calendar.
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
    // Check API configuration
    if (!env.GROQ_API_KEY) {
      return jsonResponse(
        { error: "Groq API key is not configured." },
        500
      );
    }

    // Read request body
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

    // Validate message array
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

    // Validate individual messages
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

    // Prepare conversation for Groq
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

    // Send request to Groq
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
          temperature: 0.5,
          max_tokens: 700
        })
      }
    );

    // Handle Groq errors
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

    // Parse Groq response
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

    // Return AI response to frontend
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
