import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { appendFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const root = fileURLToPath(new URL(".", import.meta.url));
const distDir = join(root, "dist");
const dataDir = process.env.DATA_DIR || join(root, "data");
const sessionsDir = join(dataDir, "work-sessions");
const s3Bucket = process.env.SESSION_S3_BUCKET || "";
const s3Prefix = String(process.env.SESSION_S3_PREFIX || "resume-work-sessions").replace(/^\/+|\/+$/g, "");
const s3Client = s3Bucket
  ? new S3Client({
      region: process.env.AWS_REGION || process.env.SESSION_S3_REGION || "us-east-1",
      endpoint: process.env.SESSION_S3_ENDPOINT || undefined,
      forcePathStyle: process.env.SESSION_S3_FORCE_PATH_STYLE === "true"
    })
  : null;
const port = Number(process.env.PORT || 4173);
const notifyTo = process.env.LOGIN_NOTIFY_TO || "chris@searchles.com";
const magicLinkFrom = process.env.MAGIC_LINK_FROM || "Resume Walkthrough Builder <noreply@resume-walkthrough-builder.local>";
const cookieName = "resume_builder_session";
const tokenTtlMs = 15 * 60 * 1000;
const sessionTtlSeconds = Number(process.env.SESSION_TTL_SECONDS || 45 * 24 * 60 * 60);
const cookieSecret = process.env.COOKIE_SECRET || process.env.SENDGRID_API_KEY || "local-dev-cookie-secret-change-me";
const pendingTokens = new Map();

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

    const authorizedSession = getAuthorizedSession(req);
    if (!authorizedSession) {
      sendLogin(res);
      return;
    }

    if (url.pathname === "/api/session" && req.method === "GET") {
      sendJson(res, 200, {
        ok: true,
        email: authorizedSession.email,
        loggedInAt: authorizedSession.loggedInAt,
        sessionTtlSeconds
      });
      return;
    }

    if (url.pathname === "/api/work-session" && req.method === "POST") {
      await saveWorkSession(req, res, authorizedSession);
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
  const metadata = {
    email: record.email,
    loggedInAt: new Date().toISOString(),
    loginIp: requestIp(req),
    loginUserAgent: String(req.headers["user-agent"] || ""),
    requestIp: record.requestedIp,
    requestUserAgent: record.requestedUserAgent
  };
  const session = signSession(metadata);
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

function getAuthorizedSession(req) {
  const session = String(req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  if (!session) return null;
  return verifySession(session);
}

function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function signSession(metadata) {
  const payload = {
    ...metadata,
    exp: Math.floor(Date.now() / 1000) + sessionTtlSeconds
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", cookieSecret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifySession(value) {
  const [encoded, signature] = String(value || "").split(".");
  if (!encoded || !signature) return null;
  const expected = createHmac("sha256", cookieSecret).update(encoded).digest("base64url");
  if (!safeEqual(expected, signature)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload || typeof payload.email !== "string") return null;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      email: payload.email,
      loggedInAt: typeof payload.loggedInAt === "string" ? payload.loggedInAt : "",
      loginIp: typeof payload.loginIp === "string" ? payload.loginIp : "",
      loginUserAgent: typeof payload.loginUserAgent === "string" ? payload.loginUserAgent : "",
      requestIp: typeof payload.requestIp === "string" ? payload.requestIp : "",
      requestUserAgent: typeof payload.requestUserAgent === "string" ? payload.requestUserAgent : ""
    };
  } catch {
    return null;
  }
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

async function saveWorkSession(req, res, authorizedSession) {
  if (!String(req.headers["content-type"] || "").includes("application/json")) {
    sendJson(res, 415, { error: "Expected application/json" });
    return;
  }

  const body = await readBody(req, 2_500_000);
  let payload;
  try {
    payload = JSON.parse(body.toString("utf8"));
  } catch {
    sendJson(res, 400, { error: "Invalid JSON" });
    return;
  }

  const projectId = safeId(payload.projectId || "default");
  const savedAt = new Date().toISOString();
  const record = {
    version: 1,
    projectId,
    savedAt,
    email: authorizedSession.email,
    userAgent: String(req.headers["user-agent"] || ""),
    ip: requestIp(req),
    summary: summarizeDraft(payload.state),
    state: sanitizeStudioState(payload.state)
  };

  await writeWorkSessionRecord(authorizedSession.email, projectId, record);

  sendJson(res, 200, {
    ok: true,
    savedAt,
    projectId,
    email: authorizedSession.email
  });
}

async function writeWorkSessionRecord(email, projectId, record) {
  const userId = safeId(email);
  if (s3Client && s3Bucket) {
    const latestKey = `${s3Prefix}/${userId}/${projectId}.latest.json`;
    const logKey = `${s3Prefix}/${userId}/${projectId}.jsonl`;
    const previousLog = await readS3Text(logKey);
    await Promise.all([
      s3Client.send(
        new PutObjectCommand({
          Bucket: s3Bucket,
          Key: latestKey,
          Body: `${JSON.stringify(record, null, 2)}\n`,
          ContentType: "application/json; charset=utf-8"
        })
      ),
      s3Client.send(
        new PutObjectCommand({
          Bucket: s3Bucket,
          Key: logKey,
          Body: `${previousLog}${JSON.stringify(record)}\n`,
          ContentType: "application/x-ndjson; charset=utf-8"
        })
      )
    ]);
    return;
  }

  if (process.env.RENDER) {
    throw new Error("Durable session storage is not configured. Set SESSION_S3_BUCKET and AWS credentials.");
  }

  mkdirSync(sessionsDir, { recursive: true });
  const userDir = join(sessionsDir, userId);
  mkdirSync(userDir, { recursive: true });
  const latestPath = safeJoin(userDir, `${projectId}.latest.json`);
  const logPath = safeJoin(userDir, `${projectId}.jsonl`);
  await Promise.all([
    writeFile(latestPath, `${JSON.stringify(record, null, 2)}\n`),
    appendFile(logPath, `${JSON.stringify(record)}\n`)
  ]);
}

async function readS3Text(key) {
  try {
    const response = await s3Client.send(new GetObjectCommand({ Bucket: s3Bucket, Key: key }));
    return await response.Body.transformToString();
  } catch (error) {
    const name = error && typeof error === "object" ? error.name : "";
    if (name === "NoSuchKey" || name === "NotFound") return "";
    throw error;
  }
}

function sanitizeStudioState(state) {
  if (!state || typeof state !== "object") return null;
  const {
    openaiApiKey: _openaiApiKey,
    anthropicApiKey: _anthropicApiKey,
    isGenerating: _isGenerating,
    isRevising: _isRevising,
    error: _error,
    ...safeState
  } = state;
  return {
    ...safeState,
    openaiApiKey: "",
    anthropicApiKey: "",
    saveKey: false,
    isGenerating: false,
    isRevising: false,
    error: ""
  };
}

function summarizeDraft(state) {
  const inputs = state?.inputs || {};
  const walkthrough = state?.walkthrough || null;
  return {
    resumeChars: String(inputs.resumeText || "").length,
    aboutChars: String(inputs.aboutText || "").length,
    targetChars: String(inputs.targetText || "").length,
    hasWalkthrough: Boolean(walkthrough),
    candidateName: String(walkthrough?.candidateName || walkthrough?.polishedResume?.name || "").slice(0, 120),
    targetTitle: String(walkthrough?.targetTitle || "").slice(0, 160),
    stepCount: Array.isArray(walkthrough?.steps) ? walkthrough.steps.length : 0,
    selectedMode: String(state?.selectedMode || "")
  };
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

async function readBody(req, maxBytes = 20_000_000) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  for (const chunk of chunks) {
    total += chunk.length;
    if (total > maxBytes) throw new Error("Request body too large");
  }
  return Buffer.concat(chunks);
}

function safeId(value) {
  const id = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return id || "default";
}

function safeJoin(base, filename) {
  const target = resolve(base, filename);
  const allowedBase = resolve(base);
  if (!target.startsWith(`${allowedBase}/`) && target !== allowedBase) {
    throw new Error("Unsafe storage path");
  }
  return target;
}

function escapeHtml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
