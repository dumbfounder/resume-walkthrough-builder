import type { OverlayWalkthroughModel, StudioInputs } from "../types/overlay";

export function buildOverlayHtml(model: OverlayWalkthroughModel, inputs: StudioInputs): string {
  const payload = {
    model,
    resumeText: inputs.resumeText,
    aboutText: inputs.aboutText,
    targetText: inputs.targetText,
    resumeTemplate: inputs.resumeTemplate,
    exportedAt: new Date().toISOString()
  };
  const title = [model.candidateName || "Resume", model.targetTitle || "Walkthrough"].filter(Boolean).join(" - ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(title)}</title>
<style>${exportCss()}</style>
</head>
<body>
<div id="walkthrough-root"></div>
<script id="walkthrough-data" type="application/json">${escapeScriptJson(JSON.stringify(payload))}</script>
<script>${exportJs()}</script>
</body>
</html>`;
}

function exportCss(): string {
  return `
:root {
  --bg: #e9e4dc;
  --paper: #fffdf8;
  --text: #1f252c;
  --muted: #69727c;
  --accent: #245f65;
  --accent-soft: #e3f0ee;
  --border: #ded6ca;
  --gold: #f7e6a2;
  --warning: #9a6a1f;
  --risk: #9f4038;
  --stripe: linear-gradient(#245f65, #b8892f);
  --popover-width: 410px;
  --resume-padding: clamp(38px, 6vw, 68px);
  --resume-line-size: 14.7px;
  --resume-line-gap: 7px;
  --resume-radius: 0px;
  --panel-radius: 20px;
  --headline-size: clamp(34px, 5vw, 54px);
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 8%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 32%),
    linear-gradient(135deg, color-mix(in srgb, var(--paper) 45%, var(--bg)), var(--bg));
  color: var(--text);
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.45;
}
button { font: inherit; }
.artifact-shell {
  min-height: 100vh;
  padding: clamp(18px, 3vw, 42px);
  background:
    radial-gradient(circle at 12% 8%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 32%),
    linear-gradient(135deg, color-mix(in srgb, var(--paper) 54%, var(--bg)), var(--bg));
}
.topbar {
  position: fixed;
  top: 18px;
  left: 50%;
  z-index: 20;
  width: min(1080px, calc(100% - 36px));
  transform: translateX(-50%);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  align-items: center;
  border: 1px solid color-mix(in srgb, var(--border) 82%, var(--text));
  border-radius: var(--topbar-radius, 18px);
  background: color-mix(in srgb, var(--paper) 94%, transparent);
  box-shadow: 0 18px 50px color-mix(in srgb, var(--text) 14%, transparent);
  padding: 12px 14px 12px 18px;
  backdrop-filter: blur(16px);
}
.brand {
  display: grid;
  min-width: 0;
  gap: 3px;
  color: var(--muted);
  font-size: 13px;
}
.brand strong {
  color: var(--accent);
  letter-spacing: .14em;
  text-transform: uppercase;
  font-size: 12px;
}
.controls {
  display: flex;
  gap: 8px;
  align-items: center;
}
.controls button,
.dot,
.start-button {
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--paper) 94%, transparent);
  color: var(--text);
  min-width: 116px;
  padding: 10px 16px;
  font-weight: 700;
  cursor: pointer;
}
.controls button.active,
.dot.active,
.start-button {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--paper);
}
.resume-stage {
  position: relative;
  width: min(850px, 100%);
  margin: 76px auto 0;
}
.resume-document {
  position: relative;
  min-height: 1060px;
  background: var(--paper);
  border: 1px solid color-mix(in srgb, var(--border) 72%, var(--text));
  box-shadow: 0 30px 100px color-mix(in srgb, var(--text) 18%, transparent);
  border-radius: var(--resume-radius);
  padding: var(--resume-padding);
  transition: transform .5s ease, filter .5s ease;
}
.resume-document::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 9px;
  background: var(--stripe);
}
.resume-document.source-version::before {
  background: linear-gradient(#8a8176, #c9c0b2);
}
.resume-document.source-version {
  box-shadow: 0 22px 70px color-mix(in srgb, var(--text) 12%, transparent);
}
.source-version .resume-head p {
  color: var(--muted);
}
.source-version .resume-line {
  color: var(--text);
}
.resume-document.template-modern-classic,
.resume-document.template-technical-leader,
.resume-document.template-founder-operator,
.resume-document.template-board-memo {
  border-color: color-mix(in srgb, var(--border) 78%, var(--text));
  box-shadow: 0 22px 70px color-mix(in srgb, var(--text) 12%, transparent);
}
.resume-document.template-modern-classic::before,
.resume-document.template-technical-leader::before,
.resume-document.template-founder-operator::before,
.resume-document.template-board-memo::before {
  background: var(--stripe);
}
.tour-active .resume-document {
  transform: translateX(-7%);
}
.resume-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(180px, 280px);
  gap: 24px;
  align-items: flex-start;
  padding-bottom: 22px;
  margin-bottom: 22px;
  border-bottom: 1px solid color-mix(in srgb, var(--text) 24%, transparent);
}
.resume-head p {
  margin: 0 0 8px;
  color: var(--accent);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: .1em;
  text-transform: uppercase;
}
.resume-head h1 {
  margin: 0;
  font-size: var(--headline-size);
  line-height: 1.02;
}
.resume-head span {
  max-width: 280px;
  color: var(--muted);
  text-align: right;
  font-size: 14px;
}
.resume-contact {
  margin: -8px 0 18px;
  color: var(--muted);
  font-size: 13px;
}
.resume-summary {
  margin: 0 0 22px;
  color: var(--text);
  font-size: 15px;
  line-height: 1.52;
}
.resume-section {
  margin-top: 20px;
}
.resume-section h2 {
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 12px;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.resume-line {
  margin: 0 0 var(--resume-line-gap);
  color: var(--text);
  font-size: var(--resume-line-size);
  line-height: 1.5;
  transition: opacity .28s ease, filter .28s ease, transform .28s ease;
}
.tour-active .resume-line.dim {
  opacity: .2;
  filter: grayscale(.25);
}
.tour-active .resume-line.focus {
  position: relative;
  z-index: 3;
  opacity: 1;
  transform: scale(1.012);
}
.resume-line mark {
  border-radius: 7px;
  background: var(--gold);
  color: var(--text);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--gold) 42%, transparent), 0 14px 35px color-mix(in srgb, var(--text) 16%, transparent);
  padding: 1px 3px;
}
.launch-note {
  position: fixed;
  right: clamp(18px, 4vw, 46px);
  bottom: clamp(18px, 4vw, 42px);
  z-index: 18;
  width: min(360px, calc(100% - 36px));
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border));
  border-radius: 18px;
  background: color-mix(in srgb, var(--paper) 94%, transparent);
  box-shadow: 0 20px 70px color-mix(in srgb, var(--text) 16%, transparent);
  padding: 16px;
  transition: opacity .28s ease, transform .28s ease;
}
.tour-active .launch-note,
.mode-brief .launch-note {
  opacity: 0;
  pointer-events: none;
  transform: translateY(10px);
}
.launch-note strong {
  display: block;
  margin-bottom: 4px;
}
.launch-note p {
  margin: 0 0 12px;
  color: var(--muted);
  font-size: 14px;
}
.tour-popover {
  position: fixed;
  top: 50%;
  right: clamp(18px, 5vw, 72px);
  z-index: 12;
  width: min(var(--popover-width), calc(100% - 36px));
  transform: translateY(-50%) translateX(18px);
  opacity: 0;
  pointer-events: none;
  border: 1px solid color-mix(in srgb, var(--accent) 38%, var(--border));
  border-radius: var(--panel-radius);
  background: color-mix(in srgb, var(--paper) 97%, transparent);
  box-shadow: 0 28px 100px color-mix(in srgb, var(--text) 25%, transparent);
  padding: 18px;
  transition: opacity .35s ease, transform .35s ease;
}
.tour-active .tour-popover {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(-50%) translateX(0);
}
.tour-popover::before {
  content: "";
  position: absolute;
  left: -12px;
  top: 76px;
  width: 22px;
  height: 22px;
  background: color-mix(in srgb, var(--paper) 97%, transparent);
  border-left: 1px solid color-mix(in srgb, var(--accent) 38%, var(--border));
  border-bottom: 1px solid color-mix(in srgb, var(--accent) 38%, var(--border));
  transform: rotate(45deg);
}
.tour-actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--text) 12%, transparent);
}
.tour-actions span {
  color: var(--muted);
  font-size: 13px;
  font-weight: 800;
}
.tour-actions div {
  display: flex;
  gap: 8px;
}
.tour-actions button {
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--paper) 94%, transparent);
  color: var(--text);
  padding: 7px 12px;
  cursor: pointer;
}
.tour-actions button:last-child {
  border-color: var(--accent);
  background: var(--accent);
  color: white;
}
.tour-actions button:disabled {
  cursor: not-allowed;
  opacity: .45;
}
.tour-kicker {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.tour-kicker em {
  border-radius: 999px;
  background: var(--accent-soft);
  padding: 3px 9px;
  color: var(--accent);
  font-style: normal;
}
.tour-popover h2 {
  margin: 12px 0 10px;
  font-size: clamp(25px, 3vw, 36px);
  line-height: 1.05;
}
.tour-narrative {
  color: var(--text);
  font-size: 17px;
}
.tour-insights {
  display: grid;
  gap: 9px;
}
.insight {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--paper) 88%, var(--accent-soft));
  padding: 12px;
}
.insight strong {
  display: block;
  margin-bottom: 5px;
  font-size: 13px;
}
.insight p {
  margin: 0;
  color: var(--text);
  font-size: 14px;
}
.insight.caveat {
  border-left: 4px solid var(--warning);
}
.tour-source {
  margin: 12px 0;
  border-left: 4px solid var(--accent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--accent-soft) 74%, var(--paper));
  padding: 11px 12px;
}
.tour-source span {
  display: block;
  margin-bottom: 5px;
  color: var(--accent);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.tour-source p {
  margin: 0;
  color: var(--text);
  font-size: 14px;
}
.dots {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.dot {
  width: 34px;
  height: 34px;
  padding: 0;
}
.brief-view {
  display: none;
  width: min(860px, 100%);
  margin: 92px auto 0;
}
.mode-brief .resume-stage,
.mode-brief .tour-popover {
  display: none;
}
.mode-brief .brief-view {
  display: grid;
  gap: 16px;
}
.brief-view section {
  border: 1px solid var(--border);
  border-radius: 18px;
  background: color-mix(in srgb, var(--paper) 92%, transparent);
  box-shadow: 0 18px 60px color-mix(in srgb, var(--text) 10%, transparent);
  padding: 24px;
}
.brief-view h2,
.brief-view h3 {
  margin: 0 0 8px;
}
.brief-view p,
.brief-view li {
  color: var(--text);
}
.empty-resume {
  color: var(--muted);
}
.topbar {
  position: sticky;
  top: 14px;
  left: auto;
  z-index: 30;
  width: min(90vw, 1600px);
  transform: none;
  margin: 0 auto 18px;
  border-radius: var(--topbar-radius, 18px);
}
.resume-stage {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: clamp(18px, 2.4vw, 32px);
  align-items: start;
  width: min(90vw, 1600px);
  margin: 0 auto;
}
.resume-wrap {
  min-width: 0;
}
.walkthrough-wrap {
  position: sticky;
  top: 92px;
  display: grid;
  gap: 14px;
  align-content: start;
  align-self: start;
  min-width: 0;
  max-height: calc(100dvh - 112px);
}
.tour-active .resume-document {
  transform: none;
}
.launch-note {
  position: relative;
  right: auto;
  bottom: auto;
  width: 100%;
  margin: 0;
}
.resume-first .launch-note {
  display: none;
}
.resume-first.prompt-visible .launch-note {
  display: block;
}
.tour-active .launch-note,
.mode-brief .launch-note {
  display: none;
}
.tour-popover {
  position: relative;
  top: auto;
  right: auto;
  width: 100%;
  max-height: calc(100dvh - 112px);
  overflow: auto;
  transform: translateY(12px);
}
.tour-active .tour-popover {
  transform: none;
}
.resume-first .tour-popover {
  display: none;
}
@media (max-width: 980px) {
  .topbar {
    position: static;
    width: auto;
    transform: none;
    border-radius: 18px;
    align-items: flex-start;
    flex-direction: column;
  }
  .resume-stage,
  .brief-view {
    margin-top: 20px;
  }
  .tour-active .resume-document {
    transform: none;
  }
  .tour-popover {
    position: sticky;
    top: 12px;
    right: auto;
    width: 100%;
    margin-top: 18px;
    transform: none;
  }
  .tour-active .tour-popover {
    transform: none;
  }
  .tour-popover::before {
    display: none;
  }
}
@media (max-width: 680px) {
  .artifact-shell {
    padding: 12px;
  }
  .resume-document {
    min-height: 0;
    padding: 28px 22px;
  }
  .resume-head {
    display: block;
  }
  .resume-head span {
    display: block;
    max-width: none;
    margin-top: 8px;
    text-align: left;
  }
  .controls {
    flex-wrap: wrap;
  }
}
@media (max-width: 720px) {
  html,
  body,
  #walkthrough-root {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
  }
  #walkthrough-root * {
    max-width: 100%;
  }
  .artifact-shell {
    width: 100%;
    max-width: 100vw;
    margin: 0 auto;
    overflow-x: hidden;
    padding: 10px 10px max(22px, env(safe-area-inset-bottom));
  }
  .tour-active .artifact-shell {
    height: 100dvh;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    padding-bottom: max(10px, env(safe-area-inset-bottom));
    overflow: hidden;
  }
  .topbar {
    position: sticky;
    top: 8px;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
    width: 100%;
    margin-bottom: 10px;
    border-radius: 16px;
    padding: 10px;
    overflow: hidden;
  }
  .tour-active .topbar {
    position: relative;
    top: 0;
  }
  .brand {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .brand span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .controls {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    width: 100%;
    gap: 7px;
  }
  .controls [data-print] {
    grid-column: 1 / -1;
  }
  .controls button {
    min-width: 0;
    min-height: 42px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .resume-stage {
    display: block;
    width: 100%;
    max-width: none;
    overflow-x: hidden;
  }
  .resume-first .resume-stage {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
  }
  .resume-first .walkthrough-wrap {
    position: relative;
    top: auto;
    order: -1;
    max-height: none;
  }
  .tour-active .resume-stage {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
    gap: 10px;
    height: 100%;
    max-width: calc(100vw - 20px);
    min-height: 0;
    overflow: hidden;
  }
  .resume-wrap,
  .walkthrough-wrap,
  .resume-document {
    width: 100%;
    max-width: none;
    min-width: 0;
    overflow-x: hidden;
  }
  .tour-active .resume-wrap,
  .tour-active .walkthrough-wrap {
    position: relative;
    top: auto;
    height: 100%;
    max-height: 100%;
    min-height: 0;
    overflow: hidden;
  }
  .tour-active .resume-wrap {
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }
  .tour-active .walkthrough-wrap {
    display: block;
  }
  .resume-document {
    min-height: 0;
    padding: 28px 20px 30px 24px;
  }
  .tour-active .resume-line.dim,
  .tour-active .resume-section h2 {
    opacity: .36;
  }
  .tour-popover {
    width: 100%;
    height: 100%;
    max-height: none;
    overflow: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }
  .tour-popover h2 {
    font-size: 26px;
    overflow-wrap: anywhere;
  }
  .tour-actions {
    position: sticky;
    top: 0;
    z-index: 2;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
    background: color-mix(in srgb, var(--paper) 97%, transparent);
    margin: -18px -18px 12px;
    padding: 12px 18px;
  }
  .tour-actions div {
    display: grid;
    grid-template-columns: 1fr 1fr;
    width: 100%;
  }
  .dots {
    display: none;
  }
}
@media print {
  body { background: #fff; }
  .topbar,
  .launch-note,
  .tour-popover,
  .brief-view {
    display: none !important;
  }
  .artifact-shell {
    padding: 0;
  }
  .resume-stage {
    width: 100%;
    margin: 0;
  }
  .resume-document {
    min-height: 0;
    box-shadow: none;
    border: 0;
    padding: 0;
  }
  .resume-line {
    opacity: 1 !important;
    filter: none !important;
    transform: none !important;
  }
}`;
}

function exportJs(): string {
  return `
(function () {
  const data = JSON.parse(document.getElementById("walkthrough-data").textContent);
  const model = data.model || {};
  const steps = model.steps || [];
  const design = normalizeDesign(model.exportDesign || {});
  let active = 0;
  let mode = "walk";
  let tourActive = false;
  let promptVisible = false;
  let followFocusedEvidence = false;
  const root = document.getElementById("walkthrough-root");
  let timer = window.setTimeout(function () {
    promptVisible = true;
    render();
  }, 3000);

  function esc(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function cleanHeading(line) {
    return String(line || "").replace(/[:|]/g, "").replace(/\\s+/g, " ").trim();
  }
  function isHeading(line, index, currentLength) {
    const clean = cleanHeading(line);
    const known = /^(summary|profile|experience|professional experience|work experience|projects|selected projects|education|skills|technical skills|leadership|certifications|publications|awards)$/i;
    return known.test(clean) || (/^[A-Z][A-Z\\s/&+-]{2,}$/.test(line) && line.length < 42 && (index > 1 || currentLength > 2));
  }
  function parseSections(text, aboutText) {
    const lines = String(text || "").replace(/\\r/g, "").split("\\n").map(line => line.trim()).filter(Boolean);
    const sections = [];
    let current = { heading: "", lines: [] };
    lines.forEach((line, index) => {
      if (isHeading(line, index, current.lines.length)) {
        if (current.heading || current.lines.length) sections.push(current);
        current = { heading: cleanHeading(line), lines: [] };
      } else {
        current.lines.push(line);
      }
    });
    if (current.heading || current.lines.length) sections.push(current);
    const contextLines = String(aboutText || "").split(/\\n+/).map(line => line.trim()).filter(Boolean);
    if (contextLines.length) sections.push({ heading: "Additional Context", lines: contextLines });
    return sections;
  }
  function rawResumeTitle() {
    const firstLine = String(data.resumeText || "").replace(/\\r/g, "").split("\\n").map(line => line.trim()).find(Boolean);
    return firstLine || model.candidateName || "Starting resume";
  }
  function resumeSections(usePolished) {
    const polished = model.polishedResume || {};
    if (usePolished && Array.isArray(polished.sections) && polished.sections.length) return polished.sections;
    return parseSections(data.resumeText, "");
  }
  function normalize(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").replace(/\\s+/g, " ").trim();
  }
  function focusQuery(step) {
    const anchor = String(step.resumeAnchor || "").trim();
    if (anchor) return anchor;
    const quote = String(step.evidenceQuote || "").trim();
    if (quote && quote !== "Needs source evidence") return quote;
    return "";
  }
  function lineMatches(line, query) {
    if (!query) return false;
    const normalizedLine = normalize(line);
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return false;
    if (normalizedLine.includes(normalizedQuery)) return true;
    const words = normalizedQuery.split(" ").filter(word => word.length > 3);
    if (words.length < 3) return false;
    return words.filter(word => normalizedLine.includes(word)).length >= Math.min(4, words.length);
  }
  function highlightLine(line, query, isFocused) {
    const escaped = esc(line);
    if (!isFocused || !query) return escaped;
    const index = line.toLowerCase().indexOf(query.toLowerCase());
    if (index >= 0) {
      return esc(line.slice(0, index)) + "<mark>" + esc(line.slice(index, index + query.length)) + "</mark>" + esc(line.slice(index + query.length));
    }
    return "<mark>" + escaped + "</mark>";
  }
  function naturalTitle(value) {
    return String(value || "")
      .replace(/\\bexecutive pattern\\b/gi, "career context")
      .replace(/\\bstrategic signal\\b/gi, "relevant signal")
      .replace(/\\bleadership archetype\\b/gi, "leadership experience")
      .replace(/\\bfit vector\\b/gi, "fit")
      .replace(/\\bproof point\\b/gi, "evidence")
      .replace(/\\bmental model\\b/gi, "starting point");
  }
  function templateClass() {
    const value = String(data.resumeTemplate || "executiveBriefing");
    return "template-" + value.replace(/[A-Z]/g, letter => "-" + letter.toLowerCase());
  }
  function detailBlocks(step) {
    if (Array.isArray(step.detailBlocks) && step.detailBlocks.length) {
      return step.detailBlocks.filter(block => block && (block.title || block.body));
    }
    return [
      { title: "Why this matters", body: step.whyItMatters, kind: "standard" },
      { title: "How this connects", body: step.fitLanguage, kind: "standard" },
      { title: "Where to be careful", body: step.caveat, kind: "caveat" }
    ].filter(block => String(block.body || "").trim());
  }
  function renderResume(step) {
    const usePolished = tourActive;
    const sections = resumeSections(usePolished);
    const query = usePolished ? focusQuery(step) : "";
    const hasFocus = sections.some(section => section.lines.some(line => lineMatches(line, query)));
    if (!sections.length) return '<p class="empty-resume">No resume text was embedded.</p>';
    return sections.map(section => {
      return '<section class="resume-section">' +
        (section.heading ? '<h2>' + esc(section.heading) + '</h2>' : '') +
        section.lines.map(line => {
          const focused = lineMatches(line, query);
          const cls = tourActive && hasFocus ? (focused ? "resume-line focus" : "resume-line dim") : "resume-line";
          return '<p class="' + cls + '">' + highlightLine(line, query, focused && tourActive) + '</p>';
        }).join("") +
      '</section>';
    }).join("");
  }
  function render() {
    const step = steps[active] || {};
    const usePolished = tourActive;
    const resumeLabel = usePolished ? "Resume" : "Resume";
    const resumeName = usePolished ? ((model.polishedResume && model.polishedResume.name) || model.candidateName || rawResumeTitle()) : rawResumeTitle();
    const resumeHeadline = usePolished ? ((model.polishedResume && model.polishedResume.headline) || model.candidateHeadline || model.targetTitle || "Candidate profile") : "Original version";
    root.className = "mode-" + mode + (tourActive ? " tour-active generated-version" : " resume-first start-version") + (promptVisible ? " prompt-visible" : "");
    root.setAttribute("style", designStyle(design));
    root.innerHTML =
      '<main class="artifact-shell">' +
        '<div class="topbar">' +
          '<div class="brand"><strong>' + esc((model.polishedResume && model.polishedResume.name) || model.candidateName || rawResumeTitle()) + '</strong><span>' + esc(((model.polishedResume && model.polishedResume.headline) || model.candidateHeadline || model.targetTitle || "Tailored resume")) + '</span></div>' +
          '<div class="controls">' +
            button("walk", "Interactive View") + button("brief", "Resume Only View") + '<button type="button" data-print>Save as PDF</button>' +
          '</div>' +
        '</div>' +
        '<section class="resume-stage">' +
          '<div class="resume-wrap"><article class="resume-document ' + (usePolished ? "generated-version " + templateClass() : "source-version") + '">' +
            '<header class="resume-head"><div><p>' + resumeLabel + '</p><h1>' + esc(resumeName) + '</h1></div><span>' + esc(resumeHeadline) + '</span></header>' +
            ((usePolished && model.polishedResume && model.polishedResume.contactLine) ? '<p class="resume-contact">' + esc(model.polishedResume.contactLine) + '</p>' : '') +
            ((usePolished && model.polishedResume && model.polishedResume.summary) ? '<p class="resume-summary">' + esc(model.polishedResume.summary) + '</p>' : '') +
            renderResume(step) +
          '</article></div>' +
          '<div class="walkthrough-wrap">' + renderLaunchNote() + renderPopover(step) + '</div>' +
        '</section>' +
        renderBriefing() +
      '</main>';
  }
  function normalizeDesign(input) {
    const widths = { compact: "370px", balanced: "410px", wide: "min(520px, 34vw)" };
    const densities = {
      airy: { padding: "clamp(48px, 7vw, 82px)", lineSize: "15.2px", lineGap: "10px" },
      balanced: { padding: "clamp(38px, 6vw, 68px)", lineSize: "14.7px", lineGap: "7px" },
      dense: { padding: "clamp(30px, 5vw, 54px)", lineSize: "13.8px", lineGap: "4px" }
    };
    const headlineSizes = {
      compact: "clamp(30px, 4.4vw, 46px)",
      balanced: "clamp(34px, 5vw, 54px)",
      large: "clamp(40px, 5.6vw, 64px)"
    };
    const density = densities[input.resumeDensity] || densities.balanced;
    return {
      bg: hex(input.background, "#e9e4dc"),
      paper: hex(input.paper, "#fffdf8"),
      text: hex(input.text, "#1f252c"),
      muted: hex(input.muted, "#69727c"),
      accent: hex(input.accent, "#245f65"),
      accentSoft: hex(input.accentSoft, "#e3f0ee"),
      border: hex(input.border, "#ded6ca"),
      gold: hex(input.highlight, "#f7e6a2"),
      warning: hex(input.warning, "#9a6a1f"),
      risk: hex(input.risk, "#9f4038"),
      stripe: cssGradient(input.resumeStripe) || "linear-gradient(#245f65, #b8892f)",
      popoverWidth: widths[input.popoverWidth] || widths.balanced,
      resumePadding: density.padding,
      resumeLineSize: density.lineSize,
      resumeLineGap: density.lineGap,
      resumeRadius: input.cornerStyle === "crisp" ? "2px" : "10px",
      panelRadius: input.cornerStyle === "crisp" ? "10px" : "20px",
      headlineSize: headlineSizes[input.typeScale] || headlineSizes.balanced
    };
  }
  function designStyle(d) {
    return [
      ["--bg", d.bg],
      ["--paper", d.paper],
      ["--text", d.text],
      ["--muted", d.muted],
      ["--accent", d.accent],
      ["--accent-soft", d.accentSoft],
      ["--border", d.border],
      ["--gold", d.gold],
      ["--warning", d.warning],
      ["--risk", d.risk],
      ["--stripe", d.stripe],
      ["--popover-width", d.popoverWidth],
      ["--resume-padding", d.resumePadding],
      ["--resume-line-size", d.resumeLineSize],
      ["--resume-line-gap", d.resumeLineGap],
      ["--resume-radius", d.resumeRadius],
      ["--panel-radius", d.panelRadius],
      ["--headline-size", d.headlineSize]
    ].map(([key, value]) => key + ":" + value).join(";");
  }
  function hex(value, fallback) {
    return /^#[0-9A-Fa-f]{6}$/.test(String(value || "")) ? value : fallback;
  }
  function cssGradient(value) {
    const text = String(value || "");
    if (!/^linear-gradient\\((#[0-9A-Fa-f]{6}|[\\s,.%degto-])+\\)$/.test(text)) return "";
    return text;
  }
  function button(id, label) {
    return '<button type="button" data-mode="' + id + '" class="' + (mode === id ? "active" : "") + '">' + label + '</button>';
  }
  function renderLaunchNote() {
    if (!promptVisible || tourActive || mode !== "walk") return "";
    return '<aside class="launch-note"><strong>See why this resume fits the role</strong><p>Open the guided overlay to see source-backed resume evidence mapped directly to the target work.</p><button class="start-button" type="button" data-start>Show the fit</button></aside>';
  }
  function renderPopover(step) {
    return '<article class="tour-popover">' +
      '<div class="tour-actions"><span>Step ' + (active + 1) + ' of ' + Math.max(1, steps.length) + '</span><div><button type="button" data-prev ' + (active <= 0 ? "disabled" : "") + '>Back</button><button type="button" data-next ' + (active >= steps.length - 1 ? "disabled" : "") + '>Next</button></div></div>' +
      '<div class="tour-kicker"><span>Hiring signal</span><em>' + esc(step.confidence || "") + '</em></div>' +
      '<h2>' + esc(naturalTitle(step.title || "")) + '</h2>' +
      '<p class="tour-narrative">' + esc(step.narrative || "") + '</p>' +
      '<div class="tour-insights">' +
        detailBlocks(step).map(block => insight(naturalTitle(block.title), block.body, block.kind === "caveat" ? "caveat" : "")).join("") +
      '</div>' +
      '<div class="tour-source"><span>Source evidence</span><p>' + esc(step.evidenceQuote || "") + '</p></div>' +
      '<div class="dots">' + steps.map((_, index) => '<button class="dot ' + (index === active ? "active" : "") + '" type="button" data-step="' + index + '">' + (index + 1) + '</button>').join("") + '</div>' +
    '</article>';
  }
  function insight(title, body, cls) {
    return '<div class="insight ' + cls + '"><strong>' + esc(title) + '</strong><p>' + esc(body || "") + '</p></div>';
  }
  function renderBriefing() {
    return '<section class="brief-view">' +
      '<section><h2>' + esc(model.targetTitle || "Fit brief") + '</h2><p>' + esc(model.closingNote || model.reviewerIntro || "") + '</p></section>' +
      '<section><h3>Resume in one paragraph</h3><p>' + esc(model.resumeBrief || "") + '</p></section>' +
      '<section><h3>What the role needs</h3><p>' + esc(model.roleBrief || "") + '</p></section>' +
      '<section><h3>Strongest signals</h3><ul>' + (model.strongestSignals || []).map(item => '<li>' + esc(item) + '</li>').join("") + '</ul></section>' +
      '<section><h3>Gaps to handle honestly</h3><ul>' + (model.gaps || []).map(item => '<li>' + esc(item) + '</li>').join("") + '</ul></section>' +
    '</section>';
  }
  function startTour(reset) {
    window.clearTimeout(timer);
    if (reset) active = 0;
    promptVisible = false;
    tourActive = true;
    mode = "walk";
    render();
    scrollFocusIntoView();
  }
  function scrollFocusIntoView() {
    window.setTimeout(function () {
      const focused = document.querySelector(".resume-line.focus");
      if (!focused || !tourActive || mode !== "walk") return;
      const mobileResumePane = window.matchMedia("(max-width: 720px)").matches ? document.querySelector(".resume-wrap") : null;
      if (mobileResumePane) {
        const paneRect = mobileResumePane.getBoundingClientRect();
        const rect = focused.getBoundingClientRect();
        const comfortablyVisible = rect.top > paneRect.top + 42 && rect.bottom < paneRect.bottom - 42;
        if (!comfortablyVisible) {
          mobileResumePane.scrollBy({
            top: rect.top - paneRect.top - (paneRect.height / 2) + (rect.height / 2),
            behavior: "smooth"
          });
        }
        followFocusedEvidence = false;
        return;
      }
      const rect = focused.getBoundingClientRect();
      const comfortablyVisible = rect.top > 96 && rect.bottom < window.innerHeight - 40;
      if (!comfortablyVisible && followFocusedEvidence) {
        window.scrollTo({
          top: Math.max(0, window.scrollY + rect.top - 150),
          behavior: "smooth"
        });
      }
      followFocusedEvidence = false;
    }, 50);
  }
  root.addEventListener("click", function (event) {
    const target = event.target;
    if (!target || !target.matches) return;
    if (target.matches("[data-start]")) startTour(true);
    if (target.matches("[data-print]")) window.print();
    if (target.matches("[data-next]")) {
      active = Math.min(steps.length - 1, active + 1);
      followFocusedEvidence = true;
      startTour();
    }
    if (target.matches("[data-prev]")) {
      active = Math.max(0, active - 1);
      followFocusedEvidence = true;
      startTour();
    }
    if (target.matches("[data-mode]")) {
      mode = target.getAttribute("data-mode");
      if (mode === "walk") { followFocusedEvidence = true; startTour(true); }
      else render();
    }
    if (target.matches("[data-step]")) {
      active = Number(target.getAttribute("data-step"));
      followFocusedEvidence = true;
      startTour();
    }
  });
  document.addEventListener("keydown", function (event) {
    if (!tourActive || mode !== "walk") return;
    if (event.key === "ArrowRight") {
      active = Math.min(steps.length - 1, active + 1);
      followFocusedEvidence = true;
      render();
      scrollFocusIntoView();
    }
    if (event.key === "ArrowLeft") {
      active = Math.max(0, active - 1);
      followFocusedEvidence = true;
      render();
      scrollFocusIntoView();
    }
  });
  render();
})();`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeScriptJson(json: string): string {
  return json.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
