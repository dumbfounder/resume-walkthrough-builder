import type { OverlayStep, OverlayWalkthroughModel, StudioInputs } from "../types/overlay";

export function buildOverlayHtml(model: OverlayWalkthroughModel, inputs: StudioInputs): string {
  const payload = {
    model,
    resumeText: inputs.resumeText,
    aboutText: inputs.aboutText,
    targetText: inputs.targetText,
    exportedAt: new Date().toISOString()
  };
  const title = [model.candidateName || "Resume", model.targetTitle || "Walkthrough"].filter(Boolean).join(" - ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
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
  --bg: #f6f4ef;
  --surface: #fffdf8;
  --text: #1e252c;
  --muted: #6a727c;
  --accent: #245d63;
  --border: #ded8ce;
  --success: #2c704a;
  --warning: #9a6a1f;
  --risk: #9f4038;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.45;
}
button { font: inherit; }
.shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(360px, 44vw) minmax(420px, 1fr);
}
.resume-pane {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow: auto;
  padding: 42px;
  background: #ede7dd;
  border-right: 1px solid var(--border);
}
.paper {
  min-height: calc(100vh - 84px);
  background: var(--surface);
  border: 1px solid rgba(30,37,44,.12);
  box-shadow: 0 24px 70px rgba(30,37,44,.12);
  padding: 42px;
}
.paper h1 {
  margin: 0;
  font-size: 31px;
  line-height: 1.05;
}
.paper .headline {
  margin: 8px 0 22px;
  color: var(--muted);
}
.paper h2 {
  margin: 26px 0 8px;
  padding-top: 18px;
  border-top: 1px solid var(--border);
  font-size: 13px;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.source-text {
  white-space: pre-wrap;
  color: #2c333b;
}
.source-text mark {
  background: #dfeeed;
  color: inherit;
  border-radius: 3px;
  padding: 1px 2px;
}
.overlay-pane {
  min-height: 100vh;
  padding: 34px clamp(24px, 4vw, 62px);
}
.topline {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: center;
  margin-bottom: 26px;
}
.brand {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .09em;
  text-transform: uppercase;
  color: var(--accent);
}
.mode-buttons {
  display: flex;
  gap: 8px;
}
.mode-buttons button,
.nav-button,
.dot {
  border: 1px solid var(--border);
  border-radius: 999px;
  background: rgba(255,253,248,.72);
  color: var(--text);
  padding: 8px 12px;
  cursor: pointer;
}
.mode-buttons button.active,
.dot.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.hero {
  margin-bottom: 28px;
}
.hero h2 {
  max-width: 820px;
  margin: 0;
  font-size: clamp(34px, 5vw, 70px);
  line-height: .98;
  letter-spacing: 0;
}
.hero p {
  max-width: 720px;
  color: var(--muted);
  font-size: 18px;
}
.walk-card {
  max-width: 850px;
  min-height: 520px;
  display: grid;
  align-content: space-between;
  gap: 28px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: rgba(255,253,248,.88);
  box-shadow: 0 22px 60px rgba(30,37,44,.1);
  padding: clamp(24px, 4vw, 46px);
}
.step-kicker {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: center;
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.walk-card h3 {
  margin: 0;
  font-size: clamp(28px, 4vw, 48px);
  line-height: 1.04;
}
.narrative {
  color: #303942;
  font-size: 19px;
}
.insight-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.insight {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #fbf8f1;
  padding: 15px;
}
.insight strong {
  display: block;
  margin-bottom: 6px;
}
.quote {
  border-left: 4px solid var(--accent);
  background: #edf4f3;
}
.caveat {
  border-left: 4px solid var(--warning);
}
.confidence {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 4px 10px;
  background: #edf4f3;
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
}
.controls {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: center;
}
.dots {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.dot {
  width: 34px;
  height: 34px;
  padding: 0;
}
.briefing {
  max-width: 900px;
  display: grid;
  gap: 18px;
}
.briefing section {
  border: 1px solid var(--border);
  border-radius: 16px;
  background: rgba(255,253,248,.84);
  padding: 24px;
}
.briefing h3 {
  margin: 0 0 8px;
}
.briefing li {
  margin: 7px 0;
}
.print-view {
  display: none;
}
@media (max-width: 900px) {
  .shell {
    display: block;
  }
  .resume-pane {
    position: static;
    height: auto;
    max-height: 48vh;
    padding: 20px;
  }
  .paper {
    min-height: 0;
    padding: 24px;
  }
  .overlay-pane {
    padding: 24px 18px;
  }
  .topline {
    align-items: flex-start;
    flex-direction: column;
  }
  .insight-grid {
    grid-template-columns: 1fr;
  }
}
@media print {
  body { background: #fff; }
  .shell {
    display: block;
  }
  .resume-pane,
  .topline,
  .controls {
    display: none !important;
  }
  .overlay-pane {
    padding: 0;
  }
  .hero,
  .walk-card,
  .briefing section {
    box-shadow: none;
    border: 0;
    border-radius: 0;
    padding: 0 0 18px;
    break-inside: avoid;
  }
  .walk-card {
    min-height: 0;
    display: block;
    margin-bottom: 22px;
  }
  .mode-walk .walk-card,
  .mode-walk .hero {
    display: block;
  }
}`;
}

function exportJs(): string {
  return `
(function () {
  const data = JSON.parse(document.getElementById("walkthrough-data").textContent);
  const model = data.model;
  const steps = model.steps || [];
  let active = 0;
  let mode = "walk";
  const root = document.getElementById("walkthrough-root");

  function esc(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function highlight(text, quote) {
    const source = esc(text || "");
    const needle = String(quote || "").trim();
    if (!needle || needle === "Needs source evidence") return source;
    const escapedNeedle = esc(needle);
    return source.replace(escapedNeedle, "<mark>" + escapedNeedle + "</mark>");
  }
  function render() {
    const step = steps[active] || {};
    root.className = "mode-" + mode;
    root.innerHTML =
      '<main class="shell">' +
        '<aside class="resume-pane">' +
          '<article class="paper">' +
            '<h1>' + esc(model.candidateName || "Resume") + '</h1>' +
            '<p class="headline">' + esc(model.candidateHeadline || "") + '</p>' +
            '<h2>Resume Source</h2>' +
            '<div class="source-text">' + highlight(data.resumeText, step.evidenceQuote) + '</div>' +
            (data.aboutText ? '<h2>Additional Context</h2><div class="source-text">' + highlight(data.aboutText, step.evidenceQuote) + '</div>' : '') +
          '</article>' +
        '</aside>' +
        '<section class="overlay-pane">' +
          '<div class="topline">' +
            '<div class="brand">Resume Walkthrough</div>' +
            '<div class="mode-buttons">' +
              button("walk", "Walkthrough") + button("brief", "Fit brief") + button("print", "Print") +
            '</div>' +
          '</div>' +
          (mode === "brief" ? renderBriefing() : renderWalk(step)) +
        '</section>' +
      '</main>';
  }
  function button(id, label) {
    return '<button type="button" data-mode="' + id + '" class="' + (mode === id ? "active" : "") + '">' + label + '</button>';
  }
  function renderWalk(step) {
    if (mode === "print") return steps.map(renderStepCard).join("");
    return '<header class="hero"><h2>' + esc(model.targetTitle || "Role fit walkthrough") + '</h2><p>' + esc(model.reviewerIntro || "") + '</p></header>' +
      renderStepCard(step) +
      '<div class="controls">' +
        '<button class="nav-button" type="button" data-prev ' + (active === 0 ? "disabled" : "") + '>Back</button>' +
        '<div class="dots">' + steps.map((_, index) => '<button class="dot ' + (index === active ? "active" : "") + '" type="button" data-step="' + index + '">' + (index + 1) + '</button>').join("") + '</div>' +
        '<button class="nav-button" type="button" data-next ' + (active >= steps.length - 1 ? "disabled" : "") + '>Next</button>' +
      '</div>';
  }
  function renderStepCard(step, index) {
    const stepIndex = typeof index === "number" ? index : active;
    return '<article class="walk-card">' +
      '<div>' +
        '<div class="step-kicker"><span>' + esc(step.eyebrow || "Step " + (stepIndex + 1)) + '</span><span class="confidence">' + esc(step.confidence || "") + '</span></div>' +
        '<h3>' + esc(step.title || "") + '</h3>' +
        '<p class="narrative">' + esc(step.narrative || "") + '</p>' +
      '</div>' +
      '<div class="insight-grid">' +
        insight("Source evidence", step.evidenceQuote, "quote") +
        insight("Why it matters", step.whyItMatters, "") +
        insight("How to say it", step.fitLanguage, "") +
        insight("Caveat", step.caveat, "caveat") +
      '</div>' +
    '</article>';
  }
  function insight(title, body, cls) {
    return '<div class="insight ' + cls + '"><strong>' + esc(title) + '</strong><p>' + esc(body || "") + '</p></div>';
  }
  function renderBriefing() {
    return '<header class="hero"><h2>' + esc(model.targetTitle || "Fit brief") + '</h2><p>' + esc(model.closingNote || "") + '</p></header>' +
      '<div class="briefing">' +
        '<section><h3>Resume in one paragraph</h3><p>' + esc(model.resumeBrief || "") + '</p></section>' +
        '<section><h3>What the role needs</h3><p>' + esc(model.roleBrief || "") + '</p></section>' +
        '<section><h3>Strongest signals</h3><ul>' + (model.strongestSignals || []).map(item => '<li>' + esc(item) + '</li>').join("") + '</ul></section>' +
        '<section><h3>Gaps to handle honestly</h3><ul>' + (model.gaps || []).map(item => '<li>' + esc(item) + '</li>').join("") + '</ul></section>' +
      '</div>';
  }
  root.addEventListener("click", function (event) {
    const target = event.target;
    if (!target || !target.matches) return;
    if (target.matches("[data-mode]")) {
      mode = target.getAttribute("data-mode");
      render();
    }
    if (target.matches("[data-step]")) {
      active = Number(target.getAttribute("data-step"));
      render();
    }
    if (target.matches("[data-next]")) {
      active = Math.min(steps.length - 1, active + 1);
      render();
    }
    if (target.matches("[data-prev]")) {
      active = Math.max(0, active - 1);
      render();
    }
  });
  document.addEventListener("keydown", function (event) {
    if (mode !== "walk") return;
    if (event.key === "ArrowRight") {
      active = Math.min(steps.length - 1, active + 1);
      render();
    }
    if (event.key === "ArrowLeft") {
      active = Math.max(0, active - 1);
      render();
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
