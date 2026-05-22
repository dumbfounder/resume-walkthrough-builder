import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const distDir = join(root, "dist");
const port = Number(process.env.PORT || 4173);
const sitePassword = process.env.SITE_PASSWORD || "AIROCKS";
const cookieName = "resume_builder_auth";
const cookieValue = Buffer.from(`ok:${sitePassword}`).toString("base64url");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

createServer(async (req, res) => {
  try {
    if (req.url === "/healthz") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.url === "/login" && req.method === "POST") {
      await handleLogin(req, res);
      return;
    }

    if (!isAuthorized(req)) {
      sendLogin(res);
      return;
    }

    if (req.url === "/api/ai-health") {
      sendJson(res, 200, {
        ok: true,
        service: "resume-walkthrough-builder-ai-proxy",
        routes: ["/api/openai-responses", "/api/anthropic-messages"],
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (req.url === "/api/openai-responses") {
      await proxyOpenAi(req, res);
      return;
    }

    if (req.url === "/api/anthropic-messages") {
      await proxyAnthropic(req, res);
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : "Server error" });
  }
}).listen(port, () => {
  console.log(`Resume Walkthrough Builder listening on ${port}`);
});

async function handleLogin(req, res) {
  const body = await readBody(req);
  const params = new URLSearchParams(body.toString("utf8"));
  if (params.get("password") === sitePassword) {
    res.statusCode = 303;
    res.setHeader("Set-Cookie", `${cookieName}=${cookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
    res.setHeader("Location", "/");
    res.end();
    return;
  }
  sendLogin(res, true);
}

function isAuthorized(req) {
  return String(req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .some((part) => part === `${cookieName}=${cookieValue}`);
}

function sendLogin(res, failed = false) {
  res.statusCode = 401;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Resume Walkthrough Builder</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3efe7;color:#20262d;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
form{width:min(420px,calc(100vw - 32px));border:1px solid #ded6ca;border-radius:20px;background:#fffdf8;box-shadow:0 24px 80px rgba(32,38,45,.14);padding:26px}
p:first-child{margin:0 0 6px;color:#245f65;font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
h1{margin:0 0 12px;font-size:30px;line-height:1.05}
label{display:grid;gap:8px;color:#59626c;font-size:14px;font-weight:750}
input{border:1px solid #ded6ca;border-radius:12px;padding:12px;font:inherit}
button{margin-top:14px;border:0;border-radius:999px;background:#245f65;color:white;padding:11px 16px;font:inherit;font-weight:850;cursor:pointer}
.error{color:#9f4038;font-weight:750}
</style>
</head>
<body>
<form method="post" action="/login">
<p>Private site</p>
<h1>Resume Walkthrough Builder</h1>
${failed ? '<p class="error">Incorrect password.</p>' : ""}
<label>Password<input type="password" name="password" autofocus autocomplete="current-password"></label>
<button type="submit">Open</button>
</form>
</body>
</html>`);
}

async function proxyOpenAi(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: { message: "Method not allowed" } });
  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: req.headers.authorization || ""
    },
    body: await readBody(req)
  });
  await pipeUpstream(upstream, res);
}

async function proxyAnthropic(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: { message: "Method not allowed" } });
  const apiKey = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: await readBody(req)
  });
  await pipeUpstream(upstream, res);
}

async function pipeUpstream(upstream, res) {
  const text = await upstream.text();
  res.statusCode = upstream.status;
  res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
  res.end(text);
}

async function serveStatic(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(decodeURIComponent(requested)).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(distDir, safePath);
  if (!filePath.startsWith(distDir)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(distDir, "index.html");
  }
  const ext = extname(filePath);
  res.statusCode = 200;
  res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
  createReadStream(filePath).pipe(res);
}

function sendJson(res, status, value) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(value));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}
