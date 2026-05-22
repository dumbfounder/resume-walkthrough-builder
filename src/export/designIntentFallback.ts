const readableLightPalette: Record<string, string> = {
  "--bg": "#f6f8fc",
  "--paper": "#ffffff",
  "--text": "#1f1f1f",
  "--muted": "#5f6368",
  "--accent": "#1a73e8",
  "--accent-soft": "#e8f0fe",
  "--border": "#dfe3eb",
  "--gold": "#fbbc04",
  "--warning": "#b06000",
  "--risk": "#d93025",
  "--stripe": "linear-gradient(90deg, #1a73e8 0%, #4285f4 45%, rgba(26,115,232,0) 100%)"
};

export function applyDesignIntentFallback(html: string, instruction: string): { html: string; applied: boolean } {
  const intent = selectIntent(instruction);
  if (intent !== "readable-light") return { html, applied: false };

  let next = html;
  for (const [cssVar, value] of Object.entries(readableLightPalette)) {
    next = replaceCssVariable(next, cssVar, value);
  }
  return { html: next, applied: next !== html };
}

function selectIntent(instruction: string): "none" | "readable-light" {
  const text = instruction.toLowerCase();
  const asksGoogle = /\bgoogle\b|\bmaterial\b/.test(text);
  const asksReadable = /\breadable\b|\bimpossible to read\b|\bhard to read\b|\beasy to digest\b|\beasier to read\b/.test(text);
  const asksLight = /\blight\b|\bwhite\b|\bbright\b/.test(text);
  const asksDark = /\bdark\b|\bmidnight\b|\bblack\b|\bnight\b/.test(text);

  if (asksDark && !asksGoogle) return "none";
  if (asksGoogle || asksReadable || asksLight) return "readable-light";
  return "none";
}

function replaceCssVariable(html: string, variable: string, value: string): string {
  const pattern = new RegExp(`(${escapeRegExp(variable)}\\s*:\\s*)([^;]+)(;)`, "g");
  if (!pattern.test(html)) return html;
  pattern.lastIndex = 0;
  return html.replace(pattern, `$1${value}$3`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
