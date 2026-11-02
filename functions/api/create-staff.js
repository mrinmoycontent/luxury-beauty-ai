const ADMIN_USER_ID = "f28c8ccc-6aeb-46db-b388-a1238030544d";

const ALLOWED_ORIGIN = "https://luxury-beauty-ai-5zz.pages.dev";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

export async function onRequestPost({ request, env }) {
  try {
    if (request.headers.get("Origin") !== ALLOWED_ORIGIN) {
      return json({ error: "Request not allowed." }, 403);
    }

    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: "Server configuration is incomplete." }, 500);
    }

    const authorization = request.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return json({ error: "Administrator login required." }, 401);
    }

    const token = authorization.slice(7);
    const baseUrl = env.SUPABASE_URL.replace(/\/$/, "");
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

    // Verify the current user's access token with Supabase.
    const verifyResponse = await fetch(`${baseUrl}/auth/v1/user`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${token}`
      }
    });

    if (!verifyResponse.ok) {
      return json({ error: "Your session is invalid. Please sign in again." }, 401);
    }

    const currentUser = await verifyResponse.json();

    // Only the original system administrator can create staff accounts.
    if (currentUser.id !== ADMIN_USER_ID) {
      return json({ error: "Only the system administrator can create accounts." }, 403);
    }

    const body = await request.json();

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (
      name.length < 2 ||
      name.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      password.length < 12
    ) {
      return json({
        error: "Enter a valid name, email and password of at least 12 characters."
      }, 400);
    }

    // Create the account securely on the server.
    const createResponse = await fetch(`${baseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: false,
        user_metadata: {
          full_name: name
        },
        app_metadata: {
          role: "staff"
        }
      })
    });

    const result = await createResponse.json();

    if (!createResponse.ok) {
      return json({
        error: result.msg || result.message || result.error_description ||
          "Unable to create the account. Check whether this email is already registered."
      }, createResponse.status);
    }

    return json({
      success: true,
      message: "Staff account created successfully.",
      user: {
        id: result.id,
        email: result.email,
        name
      }
    }, 201);

  } catch (error) {
    console.error("Staff account creation error:", error);
    return json({ error: "An unexpected server error occurred." }, 500);
  }
}
