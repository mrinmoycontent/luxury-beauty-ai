
const SYSTEM_PROMPT = `You are the AI receptionist for Glow Beauty AI, a luxury beauty clinic.

Be warm, professional, concise and helpful.
Never invent clinic services, prices, opening hours or appointment availability.
Never claim an appointment has been booked.
Collect appointment preferences as requests only, pending clinic confirmation.
If clinic information is unavailable, explain that honestly.`;

export async function onRequestPost({ request, env }) {
  if (!env.GROQ_API_KEY) {
    return Response.json(
      { error: "GROQ_API_KEY is not configured." },
      { status: 503 }
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON request." },
      { status: 400 }
    );
  }

  if (
    !body ||
    !Array.isArray(body.messages) ||
    body.messages.length === 0 ||
    body.messages.length > 20
  ) {
    return Response.json(
      { error: "Please provide 1 to 20 messages." },
      { status: 400 }
    );
  }

  const messages = [];

  for (const item of body.messages) {
    if (
      !item ||
      !["user", "assistant"].includes(item.role) ||
      typeof item.content !== "string" ||
      !item.content.trim() ||
      item.content.length > 4000
    ) {
      return Response.json(
        { error: "Invalid message format." },
        { status: 400 }
      );
    }

    messages.push({
      role: item.role,
      content: item.content.trim()
    });
  }

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages
          ],
          temperature: 0.6,
          max_completion_tokens: 500
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Groq API error:", result.error?.message || response.status);

      return Response.json(
        { error: "The AI service could not process your request." },
        { status: 502 }
      );
    }

    const reply = result.choices?.[0]?.message?.content;

    if (typeof reply !== "string" || !reply.trim()) {
      return Response.json(
        { error: "No AI response received." },
        { status: 502 }
      );
    }

    return Response.json({ reply: reply.trim() });

  } catch (error) {
    console.error("Chat API error:", error);

    return Response.json(
      { error: "Unable to connect to the AI service." },
      { status: 502 }
    );
  }
}
