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
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 8%, rgba(36, 95, 101, .11), transparent 32%),
    linear-gradient(135deg, #eee8df, var(--bg));
  color: var(--text);
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.45;
}
button { font: inherit; }
.artifact-shell {
  min-height: 100vh;
  padding: clamp(18px, 3vw, 42px);
}
.topbar {
  position: fixed;
  top: 18px;
  left: 50%;
  z-index: 20;
  width: min(1080px, calc(100% - 36px));
  transform: translateX(-50%);
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: center;
  border: 1px solid rgba(31, 37, 44, .12);
  border-radius: 999px;
  background: rgba(255, 253, 248, .9);
  box-shadow: 0 18px 50px rgba(31, 37, 44, .12);
  padding: 8px 10px 8px 16px;
  backdrop-filter: blur(16px);
}
.brand {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  color: var(--muted);
  font-size: 12px;
}
.brand strong {
  color: var(--accent);
  letter-spacing: .08em;
  text-transform: uppercase;
}
.controls {
  display: flex;
  gap: 7px;
  align-items: center;
}
.controls button,
.dot,
.start-button {
  border: 1px solid var(--border);
  border-radius: 999px;
  background: rgba(255, 253, 248, .92);
  color: var(--text);
  padding: 8px 12px;
  cursor: pointer;
}
.controls button.active,
.dot.active,
.start-button {
  border-color: var(--accent);
  background: var(--accent);
  color: white;
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
  border: 1px solid rgba(31, 37, 44, .12);
  box-shadow: 0 30px 100px rgba(31, 37, 44, .18);
  padding: clamp(38px, 6vw, 68px);
  transition: transform .5s ease, filter .5s ease;
}
.resume-document::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 9px;
  background: linear-gradient(#245f65, #b8892f);
}
.resume-document.source-version::before {
  background: linear-gradient(#8a8176, #c9c0b2);
}
.resume-document.source-version {
  box-shadow: 0 22px 70px rgba(31, 37, 44, .12);
}
.source-version .resume-head p {
  color: #7a7167;
}
.source-version .resume-line {
  color: #3b4148;
}
.resume-document.template-modern-classic {
  --accent: #222831;
  --paper: #ffffff;
  border-color: #d8dce0;
  box-shadow: 0 22px 70px rgba(31, 37, 44, .12);
}
.resume-document.template-modern-classic::before {
  background: #222831;
}
.resume-document.template-technical-leader {
  --accent: #1f5a8a;
  --paper: #fbfdff;
  border-color: #cbd9e6;
}
.resume-document.template-technical-leader::before {
  background: linear-gradient(#1f5a8a, #4a7c59);
}
.resume-document.template-founder-operator {
  --accent: #38614a;
  --paper: #fffdf6;
  border-color: #d7d0bd;
}
.resume-document.template-founder-operator::before {
  background: linear-gradient(#38614a, #b8892f);
}
.resume-document.template-board-memo {
  --accent: #27384a;
  --paper: #fffefa;
  border-color: #cfd4d9;
}
.resume-document.template-board-memo::before {
  background: linear-gradient(#27384a, #7a6b52);
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
  border-bottom: 1px solid rgba(31, 37, 44, .24);
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
  font-size: clamp(34px, 5vw, 54px);
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
  color: #303942;
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
  margin: 0 0 7px;
  color: #29323b;
  font-size: 14.7px;
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
  color: #111820;
  box-shadow: 0 0 0 5px rgba(247, 230, 162, .42), 0 14px 35px rgba(31,37,44,.16);
  padding: 1px 3px;
}
.launch-note {
  position: fixed;
  right: clamp(18px, 4vw, 46px);
  bottom: clamp(18px, 4vw, 42px);
  z-index: 18;
  width: min(360px, calc(100% - 36px));
  border: 1px solid rgba(36, 95, 101, .22);
  border-radius: 18px;
  background: rgba(255, 253, 248, .94);
  box-shadow: 0 20px 70px rgba(31, 37, 44, .16);
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
  width: min(410px, calc(100% - 36px));
  transform: translateY(-50%) translateX(18px);
  opacity: 0;
  pointer-events: none;
  border: 1px solid rgba(36, 95, 101, .28);
  border-radius: 20px;
  background: rgba(255, 253, 248, .97);
  box-shadow: 0 28px 100px rgba(31, 37, 44, .25);
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
  background: rgba(255, 253, 248, .97);
  border-left: 1px solid rgba(36, 95, 101, .28);
  border-bottom: 1px solid rgba(36, 95, 101, .28);
  transform: rotate(45deg);
}
.tour-actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(31, 37, 44, .1);
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
  background: var(--paper);
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
  color: #303941;
  font-size: 17px;
}
.tour-insights {
  display: grid;
  gap: 9px;
}
.insight {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #fbf8f1;
  padding: 12px;
}
.insight strong {
  display: block;
  margin-bottom: 5px;
  font-size: 13px;
}
.insight p {
  margin: 0;
  color: #39424b;
  font-size: 14px;
}
.insight.caveat {
  border-left: 4px solid var(--warning);
}
.tour-source {
  margin: 12px 0;
  border-left: 4px solid var(--accent);
  border-radius: 12px;
  background: #edf4f3;
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
  color: #26343a;
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
  background: rgba(255,253,248,.9);
  box-shadow: 0 18px 60px rgba(31,37,44,.1);
  padding: 24px;
}
.brief-view h2,
.brief-view h3 {
  margin: 0 0 8px;
}
.brief-view p,
.brief-view li {
  color: #374049;
}
.empty-resume {
  color: var(--muted);
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
  let active = 0;
  let mode = "walk";
  let tourActive = false;
  const root = document.getElementById("walkthrough-root");
  let timer = window.setTimeout(function () {
    tourActive = true;
    render();
    scrollFocusIntoView();
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
    root.className = "mode-" + mode + (tourActive ? " tour-active generated-version" : " resume-first start-version");
    root.innerHTML =
      '<main class="artifact-shell">' +
        '<div class="topbar">' +
          '<div class="brand"><strong>Candidate Fit</strong><span>' + esc(model.targetTitle || "Role review") + '</span><span>' + esc(model.targetOrganization || "Hiring brief") + '</span></div>' +
          '<div class="controls">' +
            button("walk", "Walkthrough") + button("brief", "Fit brief") + '<button type="button" data-print>Print</button>' +
          '</div>' +
        '</div>' +
        '<section class="resume-stage">' +
          '<article class="resume-document ' + (usePolished ? "generated-version " + templateClass() : "source-version") + '">' +
            '<header class="resume-head"><div><p>' + resumeLabel + '</p><h1>' + esc(resumeName) + '</h1></div><span>' + esc(resumeHeadline) + '</span></header>' +
            ((usePolished && model.polishedResume && model.polishedResume.contactLine) ? '<p class="resume-contact">' + esc(model.polishedResume.contactLine) + '</p>' : '') +
            ((usePolished && model.polishedResume && model.polishedResume.summary) ? '<p class="resume-summary">' + esc(model.polishedResume.summary) + '</p>' : '') +
            renderResume(step) +
          '</article>' +
          renderLaunchNote() +
          renderPopover(step) +
        '</section>' +
        renderBriefing() +
      '</main>';
  }
  function button(id, label) {
    return '<button type="button" data-mode="' + id + '" class="' + (mode === id ? "active" : "") + '">' + label + '</button>';
  }
  function renderLaunchNote() {
    return '<aside class="launch-note"><strong>Guided notes start in a moment.</strong><p>The walkthrough will highlight the resume evidence most relevant to this role.</p><button class="start-button" type="button" data-start>Start now</button></aside>';
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
  function startTour() {
    window.clearTimeout(timer);
    tourActive = true;
    mode = "walk";
    render();
    scrollFocusIntoView();
  }
  function scrollFocusIntoView() {
    window.setTimeout(function () {
      const focused = document.querySelector(".resume-line.focus");
      if (focused) focused.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 50);
  }
  root.addEventListener("click", function (event) {
    const target = event.target;
    if (!target || !target.matches) return;
    if (target.matches("[data-start]")) startTour();
    if (target.matches("[data-print]")) window.print();
    if (target.matches("[data-next]")) {
      active = Math.min(steps.length - 1, active + 1);
      startTour();
    }
    if (target.matches("[data-prev]")) {
      active = Math.max(0, active - 1);
      startTour();
    }
    if (target.matches("[data-mode]")) {
      mode = target.getAttribute("data-mode");
      if (mode === "walk") startTour();
      else render();
    }
    if (target.matches("[data-step]")) {
      active = Number(target.getAttribute("data-step"));
      startTour();
    }
  });
  document.addEventListener("keydown", function (event) {
    if (!tourActive || mode !== "walk") return;
    if (event.key === "ArrowRight") {
      active = Math.min(steps.length - 1, active + 1);
      render();
      scrollFocusIntoView();
    }
    if (event.key === "ArrowLeft") {
      active = Math.max(0, active - 1);
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
