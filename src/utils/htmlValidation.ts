export function validateStandaloneHtmlDocument(value: string): string {
  const html = value.trim();
  if (!html) throw new Error("The model did not return revised HTML.");
  if (!/^<!doctype html>|^<html[\s>]/i.test(html)) {
    throw new Error("The model did not return a complete standalone HTML document.");
  }
  if (/<script\b[^>]*\bsrc\s*=|<link\b[^>]*\bhref\s*=|@import\s+url|url\(\s*["']?https?:\/\//i.test(stripEmbeddedJson(html))) {
    throw new Error("The revised HTML appears to include external dependencies. Ask for a fully self-contained local file.");
  }

  const dataScript = html.match(/<script\b(?=[^>]*\bid=["']walkthrough-data["'])(?=[^>]*\btype=["']application\/json["'])[^>]*>([\s\S]*?)<\/script>/i);
  if (dataScript) {
    try {
      JSON.parse(dataScript[1]);
    } catch {
      throw new Error("The revised HTML broke the embedded walkthrough JSON, so it was not applied.");
    }
  }

  const runnableScripts = stripEmbeddedJson(html).match(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const scriptTag of runnableScripts) {
    const body = scriptTag.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "");
    if (!body.trim()) continue;
    try {
      new Function(body);
    } catch {
      throw new Error("The revised HTML contains invalid JavaScript, so it was not applied.");
    }
  }

  return html;
}

export function isStandaloneHtmlUsable(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    validateStandaloneHtmlDocument(value);
    return true;
  } catch {
    return false;
  }
}

function stripEmbeddedJson(html: string): string {
  return html.replace(/<script[^>]*type=["']application\/json["'][\s\S]*?<\/script>/gi, "");
}
