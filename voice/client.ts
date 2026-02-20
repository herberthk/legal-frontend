Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);

    // Serve index.html at root
    if (url.pathname === "/") {
      return new Response(Bun.file("./index.html"));
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log("Server running at http://localhost:3000");
