
export async function onRequestGet(context) {
  const { request, env } = context;

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://luxury-beauty-ai-5zz.pages.dev",
    "Cache-Control": "no-store"
  };

  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date");

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response(
        JSON.stringify({ error: "A valid date is required." }),
        { status: 400, headers }
      );
    }

    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/rpc/get_available_slots`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ p_date: date })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Could not retrieve availability.", details: data }),
        { status: 500, headers }
      );
    }

    return new Response(
      JSON.stringify({ date, slots: data }),
      { status: 200, headers }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Server error retrieving availability." }),
      { status: 500, headers }
    );
  }
}
