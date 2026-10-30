
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Backend health-check API
    if (url.pathname === "/api/health") {
      if (request.method !== "GET") {
        return Response.json(
          {
            ok: false,
            error: "Method not allowed. Use GET."
          },
          {
            status: 405,
            headers: { Allow: "GET" }
          }
        );
      }

      return Response.json({
        ok: true,
        service: "Luxury Beauty AI API",
        status: "healthy",
        timestamp: new Date().toISOString()
      });
    }

    // Serve the existing dashboard
    return env.ASSETS.fetch(request);
  }
};
