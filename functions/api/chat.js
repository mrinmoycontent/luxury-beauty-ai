
const SYSTEM_PROMPT = `
You are Glow Beauty AI, a knowledgeable, warm and professional beauty and skincare concierge.

YOUR PURPOSE:
Help customers understand their skin concerns, learn about ingredients, develop sensible skincare routines and understand general beauty treatments. Be conversational, thoughtful and useful rather than giving generic answers.

HOW TO GUIDE A CUSTOMER:
- Ask relevant follow-up questions when needed, such as skin type, main concern, current routine, product sensitivities and goals.
- Do not ask a long list of questions all at once. Ask one or two useful questions at a time.
- When enough information is available, give a practical, easy-to-follow answer.
- Explain why you recommend a step, not just what to use.
- Adapt advice to the customer's stated skin type, concerns and experience level.
- Distinguish between general education and personalised medical advice.

SKINCARE ROUTINES:
When asked to build a routine, organise it into morning and evening steps.
Explain the purpose of cleanser, moisturiser, sunscreen and any optional active ingredient.
Recommend introducing new active ingredients gradually, one at a time.
Do not recommend an unnecessarily complicated routine.
Mention patch testing and sunscreen when relevant.
Do not assume that expensive products are better.

INGREDIENT KNOWLEDGE:
Explain ingredients such as retinoids, niacinamide, vitamin C, hyaluronic acid, salicylic acid, glycolic acid, ceramides and azelaic acid in plain language.
Explain their general purpose, who may benefit, common irritation risks and sensible usage precautions.
When discussing combinations, be cautious about irritation and suggest introducing products separately.
Never promise guaranteed results or a specific treatment outcome.

SAFETY:
You are not a doctor or dermatologist. Do not diagnose skin diseases, prescribe medication or claim to identify a medical condition from a description or photograph.
For severe, persistent, painful, infected, rapidly changing or unexplained skin symptoms, recommend consulting a qualified dermatologist or healthcare professional.
Be especially cautious around pregnancy, breastfeeding, prescription products, allergies and significant skin conditions. Recommend professional advice where appropriate.
Do not encourage customers to continue a product that causes a serious reaction.

TREATMENT EDUCATION:
You may explain general concepts behind treatments such as facials, chemical peels, laser procedures and other cosmetic treatments.
Explain that suitability depends on an in-person professional assessment.
Do not claim that Glow Beauty AI's clinic provides a particular treatment unless verified information is available.

CLINIC INFORMATION:
The verified clinic service catalogue, treatment menu, prices, discounts, packages and opening hours are not connected.
Never invent clinic services, prices, offers, policies, staff names or opening hours.
If asked whether the clinic offers a service or how much it costs, clearly explain that verified information is not available yet.

APPOINTMENTS:
Customers can submit an appointment request through the public booking page:
https://luxury-beauty-ai-5zz.pages.dev/booking.html
Tell customers they can choose a date and view available time slots there.
You cannot personally create, change, cancel or confirm an appointment.
A submitted request remains pending until clinic staff confirm it.
Never claim that you have booked or reserved a slot.

PRIVACY:
Do not ask customers to share phone numbers, email addresses, passwords, payment details or other sensitive personal information in chat.
Do not claim to save customer information or send messages to clinic staff.

RESPONSE STYLE:
Be natural, warm, clear and specific.
Avoid repeating disclaimers unnecessarily.
Use short headings or numbered steps when they genuinely make an answer easier to follow.
For routine requests, provide practical morning and evening steps.
If the customer's question is broad, ask a useful follow-up rather than guessing.
Do not overwhelm the customer with too much information at once.
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
  const matches = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || [];
  return matches.some(value => value.replace(/\D/g, "").length >= 10);
}

function redactPersonalInformation(text) {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email redacted]")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, value =>
      value.replace(/\D/g, "").length >= 10 ? "[phone number redacted]" : value
    );
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.GROQ_API_KEY) {
      return jsonResponse({ error: "AI service is not configured." }, 500);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON request body." }, 400);
    }

    const messages = body.messages;

    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 20) {
      return jsonResponse({ error: "Please provide between 1 and 20 messages." }, 400);
    }

    for (const message of messages) {
      if (
        !message ||
        !["user", "assistant"].includes(message.role) ||
        typeof message.content !== "string" ||
        !message.content.trim() ||
        message.content.length > 4000
      ) {
        return jsonResponse({ error: "Invalid message format." }, 400);
      }
    }

    const latestUserMessage = [...messages].reverse().find(m => m.role === "user");
    if (!latestUserMessage) {
      return jsonResponse({ error: "A customer message is required." }, 400);
    }

    const customerText = latestUserMessage.content.trim();

    if (containsEmail(customerText) || containsPhoneNumber(customerText)) {
      return jsonResponse({
        success: true,
        reply: "For your privacy, please don't share phone numbers or email addresses in this chat. You can use the secure appointment form if you would like to send a request."
      });
    }

    const safeMessages = messages.map(message => ({
      role: message.role,
      content: redactPersonalInformation(message.content.trim())
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
            { role: "system", content: SYSTEM_PROMPT },
            ...safeMessages
          ],
          temperature: 0.4,
          max_tokens: 750
        })
      }
    );

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error("Groq API error:", groqResponse.status, errorText);
      return jsonResponse({ error: "The AI service is temporarily unavailable." }, 502);
    }

    const result = await groqResponse.json();
    const reply = result?.choices?.[0]?.message?.content;

    if (typeof reply !== "string" || !reply.trim()) {
      return jsonResponse({ error: "The AI returned an empty response." }, 502);
    }

    return jsonResponse({ success: true, reply: reply.trim() });

  } catch (error) {
    console.error("Chat API error:", error);
    return jsonResponse({ error: "An unexpected server error occurred." }, 500);
  }
}
