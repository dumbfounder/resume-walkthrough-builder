import { randomBytes, timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const distDir = join(root, "dist");
const port = Number(process.env.PORT || 4173);
const notifyTo = process.env.LOGIN_NOTIFY_TO || "chris@searchles.com";
const magicLinkFrom = process.env.MAGIC_LINK_FROM || "Resume Walkthrough Builder <noreply@resume-walkthrough-builder.local>";
const cookieName = "resume_builder_session";
const tokenTtlMs = 15 * 60 * 1000;
const sessionTtlSeconds = 7 * 24 * 60 * 60;
const pendingTokens = new Map();
const sessions = new Set();

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
    const url = new URL(req.url || "/", requestBaseUrl(req));

    if (url.pathname === "/healthz") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url.pathname === "/login" && req.method === "POST") {
      await handleLoginRequest(req, res);
      return;
    }

    if (url.pathname === "/magic") {
      await handleMagicLink(req, res, url);
      return;
    }

    if (!isAuthorized(req)) {
      sendLogin(res);
      return;
    }

    if (url.pathname === "/api/ai-health") {
      sendJson(res, 200, {
        ok: true,
        service: "resume-walkthrough-builder-ai-proxy",
        routes: ["/api/openai-responses", "/api/anthropic-messages"],
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (url.pathname === "/api/openai-responses") {
      await proxyOpenAi(req, res);
      return;
    }

    if (url.pathname === "/api/anthropic-messages") {
      await proxyAnthropic(req, res);
      return;
    }

    await serveStatic(url, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: error instanceof Error ? error.message : "Server error" });
  }
}).listen(port, () => {
  console.log(`Resume Walkthrough Builder listening on ${port}`);
});

async function handleLoginRequest(req, res) {
  const body = await readBody(req);
  const params = new URLSearchParams(body.toString("utf8"));
  const email = normalizeEmail(params.get("email"));

  if (!email) {
    sendLogin(res, "Enter a valid email address.");
    return;
  }

  cleanupExpiredTokens();
  const token = randomBytes(32).toString("base64url");
  pendingTokens.set(token, {
    email,
    expiresAt: Date.now() + tokenTtlMs,
    requestedIp: requestIp(req),
    requestedUserAgent: String(req.headers["user-agent"] || "")
  });

  const link = new URL("/magic", requestBaseUrl(req));
  link.searchParams.set("token", token);

  await sendEmail({
    to: email,
    subject: "Your Resume Walkthrough Builder login link",
    text: `Open this link to sign in. It expires in 15 minutes:\n\n${link.toString()}`,
    html: `<p>Open this link to sign in. It expires in 15 minutes:</p><p><a href="${escapeHtml(link.toString())}">${escapeHtml(link.toString())}</a></p>`
  });

  sendLogin(res, "", "Check your email for a magic login link.");
}

async function handleMagicLink(req, res, url) {
  cleanupExpiredTokens();
  const token = url.searchParams.get("token") || "";
  const record = pendingTokens.get(token);
  if (!record || record.expiresAt < Date.now()) {
    sendLogin(res, "That login link is invalid or expired. Request a new one.");
    return;
  }

  pendingTokens.delete(token);
  const session = randomBytes(32).toString("base64url");
  sessions.add(session);
  res.statusCode = 303;
  res.setHeader("Set-Cookie", `${cookieName}=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${sessionTtlSeconds}`);
  res.setHeader("Location", "/");
  res.end();

  await sendLoginNotification(req, record.email, record);
}

async function sendLoginNotification(req, email, record) {
  const now = new Date().toISOString();
  const ip = requestIp(req);
  const userAgent = String(req.headers["user-agent"] || "");
  await sendEmail({
    to: notifyTo,
    subject: `Resume Walkthrough Builder login: ${email}`,
    text: [
      "A user logged in to Resume Walkthrough Builder.",
      "",
      `Email: ${email}`,
      `Login time: ${now}`,
      `Login IP: ${ip}`,
      `Login user agent: ${userAgent}`,
      `Request IP: ${record.requestedIp}`,
      `Request user agent: ${record.requestedUserAgent}`
    ].join("\n"),
    html: `<p>A user logged in to Resume Walkthrough Builder.</p>
<ul>
<li><strong>Email:</strong> ${escapeHtml(email)}</li>
<li><strong>Login time:</strong> ${escapeHtml(now)}</li>
<li><strong>Login IP:</strong> ${escapeHtml(ip)}</li>
<li><strong>Login user agent:</strong> ${escapeHtml(userAgent)}</li>
<li><strong>Request IP:</strong> ${escapeHtml(record.requestedIp)}</li>
<li><strong>Request user agent:</strong> ${escapeHtml(record.requestedUserAgent)}</li>
</ul>`
  });
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function isAuthorized(req) {
  const session = String(req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  if (!session) return false;
  return [...sessions].some((known) => safeEqual(known, session));
}

function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [token, record] of pendingTokens.entries()) {
    if (record.expiresAt < now) pendingTokens.delete(token);
  }
}

function sendLogin(res, error = "", message = "") {
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
form{width:min(440px,calc(100vw - 32px));border:1px solid #ded6ca;border-radius:20px;background:#fffdf8;box-shadow:0 24px 80px rgba(32,38,45,.14);padding:26px}
p:first-child{margin:0 0 6px;color:#245f65;font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
h1{margin:0 0 12px;font-size:30px;line-height:1.05}
.hint{color:#59626c;line-height:1.45}
label{display:grid;gap:8px;color:#59626c;font-size:14px;font-weight:750}
input{border:1px solid #ded6ca;border-radius:12px;padding:12px;font:inherit}
button{margin-top:14px;border:0;border-radius:999px;background:#245f65;color:white;padding:11px 16px;font:inherit;font-weight:850;cursor:pointer}
.error{color:#9f4038;font-weight:750}.message{color:#245f65;font-weight:750}
</style>
</head>
<body>
<form method="post" action="/login">
<p>Private site</p>
<h1>Resume Walkthrough Builder</h1>
<p class="hint">Enter your email and we will send a one-time login link.</p>
${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
${message ? `<p class="message">${escapeHtml(message)}</p>` : ""}
<label>Email<input type="email" name="email" autofocus autocomplete="email" required></label>
<button type="submit">Send magic link</button>
</form>
</body>
</html>`);
}

async function sendEmail({ to, subject, text, html }) {
  if (process.env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({ from: magicLinkFrom, to, subject, text, html })
    });
    if (!response.ok) throw new Error(`Resend email failed: ${response.status} ${await response.text()}`);
    return;
  }

  if (process.env.SENDGRID_API_KEY) {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: parseFromAddress(magicLinkFrom),
        subject,
        content: [
          { type: "text/plain", value: text },
          { type: "text/html", value: html }
        ]
      })
    });
    if (!response.ok) throw new Error(`SendGrid email failed: ${response.status} ${await response.text()}`);
    return;
  }

  console.warn(`No email provider configured. Intended email to ${to}: ${subject}\n${text}`);
}

function parseFromAddress(value) {
  const match = String(value).match(/^(.*?)<([^>]+)>$/);
  if (!match) return { email: String(value).trim() };
  return { name: match[1].trim(), email: match[2].trim() };
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

async function serveStatic(url, res) {
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

function requestIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
}

function requestBaseUrl(req) {
  if (process.env.PUBLIC_APP_URL) return process.env.PUBLIC_APP_URL;
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || `localhost:${port}`).split(",")[0].trim();
  return `${proto}://${host}`;
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

function escapeHtml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
