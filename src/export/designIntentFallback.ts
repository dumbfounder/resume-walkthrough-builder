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
  next = upsertDesignOverride(next, readableLightOverrideCss());
  return { html: next, applied: next !== html };
}

export function canApplyDesignIntentLocally(instruction: string): boolean {
  return selectIntent(instruction) !== "none";
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

function upsertDesignOverride(html: string, css: string): string {
  const style = `<style id="design-intent-override">\n${css}\n</style>`;
  const existing = /<style\b[^>]*\bid=["']design-intent-override["'][^>]*>[\s\S]*?<\/style>/i;
  if (existing.test(html)) return html.replace(existing, style);
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${style}\n</head>`);
  return `${style}\n${html}`;
}

function readableLightOverrideCss(): string {
  return `
:root {
  --bg: #f6f8fc !important;
  --paper: #ffffff !important;
  --text: #202124 !important;
  --muted: #5f6368 !important;
  --accent: #1a73e8 !important;
  --accent-soft: #e8f0fe !important;
  --border: #dfe3eb !important;
  --gold: #fbbc04 !important;
  --warning: #b06000 !important;
  --risk: #d93025 !important;
  --stripe: linear-gradient(90deg, #1a73e8 0%, #4285f4 45%, rgba(26,115,232,0) 100%) !important;
}
body,
.artifact-shell,
.resume-stage,
.resume-wrap,
.walkthrough-wrap {
  background: #f6f8fc !important;
  color: #202124 !important;
}
.topbar,
.resume-document,
.launch-note,
.tour-popover,
.brief-view,
.insight,
.target-brief,
.resume-only-panel {
  background: #ffffff !important;
  color: #202124 !important;
  border-color: #dfe3eb !important;
  box-shadow: 0 18px 48px rgba(60, 64, 67, .16) !important;
}
.brand span,
.resume-head span,
.resume-contact,
.resume-section h2,
.tour-actions span,
.launch-note p,
.insight p,
.resume-summary,
.resume-line.dim {
  color: #5f6368 !important;
}
.brand strong,
.resume-head p,
.tour-kicker,
.tour-kicker em,
.launch-note strong,
.insight strong {
  color: #1a73e8 !important;
}
.resume-head h1,
.resume-line,
.tour-popover h2,
.resume-document h1,
.resume-document h2,
.resume-document h3 {
  color: #202124 !important;
}
.controls button.active,
.dot.active,
.start-button,
.tour-actions button:last-child {
  background: #1a73e8 !important;
  border-color: #1a73e8 !important;
  color: #ffffff !important;
}
.controls button,
.dot,
.tour-actions button {
  background: #ffffff !important;
  color: #202124 !important;
  border-color: #dfe3eb !important;
}
.resume-line mark {
  background: #fce8b2 !important;
  color: #202124 !important;
  box-shadow: 0 0 0 4px rgba(251, 188, 4, .24) !important;
}
.tour-active .resume-line.dim {
  opacity: .46 !important;
}
`;
}
