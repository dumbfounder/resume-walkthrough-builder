import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function openAiProxyPlugin() {
  async function handle(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: { message: "Method not allowed" } }));
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    try {
      const upstream = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: req.headers.authorization || ""
        },
        body: Buffer.concat(chunks)
      });
      const text = await upstream.text();
      res.statusCode = upstream.status;
      res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
      res.end(text);
    } catch (error) {
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: {
            message: error instanceof Error ? error.message : "Could not reach OpenAI."
          }
        })
      );
    }
  }

  return {
    name: "local-openai-responses-proxy",
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use("/api/openai-responses", handle);
    },
    configurePreviewServer(server: import("vite").PreviewServer) {
      server.middlewares.use("/api/openai-responses", handle);
    }
  };
}

export default defineConfig({
  plugins: [react(), openAiProxyPlugin()],
  server: {
    host: "127.0.0.1",
    port: 5173
  }
});
