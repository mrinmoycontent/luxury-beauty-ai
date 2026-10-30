export async function onRequestGet(context) {
  return Response.json({
    ok: true,
    service: "Luxury Beauty AI API",
    status: "healthy",
    timestamp: new Date().toISOString()
  });
}

export async function onRequest(context) {
  if (context.request.method !== "GET") {
    return Response.json(
      { ok: false, error: "Method not allowed" },
      { status: 405 }
    );
  }

  return onRequestGet(context);
}
