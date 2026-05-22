import { buildHtmlPolishInput, buildOutputPolishInput, buildStepRevisionInput, buildWalkthroughInput, overlaySystemPrompt } from "./overlayPrompts";
import { overlayStepSchema, overlayWalkthroughSchema } from "./overlaySchema";
import type {
  LlmGenerateRequest,
  LlmPolishHtmlRequest,
  LlmPolishOutputRequest,
  LlmReviseStepRequest,
  OverlayDetailBlock,
  OverlayStep,
  OverlayWalkthroughModel,
  ExportDesign,
  PolishedResume,
  PolishedResumeSection
} from "../types/overlay";

const responsesEndpoint = "/api/openai-responses";
const anthropicEndpoint = "/api/anthropic-messages";

const htmlPolishSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    html: { type: "string" },
    changeSummary: { type: "string" }
  },
  required: ["html", "changeSummary"]
} as const;

export async function generateOverlayWalkthrough(request: LlmGenerateRequest): Promise<OverlayWalkthroughModel> {
  const raw = request.provider === "anthropic" ? await callClaudeWalkthrough(request) : await callOpenAiWalkthrough(request);
  return normalizeWalkthrough(raw, request.inputs);
}

export async function reviseOverlayStep(request: LlmReviseStepRequest): Promise<OverlayStep> {
  const raw = request.provider === "anthropic" ? await callClaudeStep(request) : await callOpenAiStep(request);
  return normalizeStep(raw);
}

export async function polishOverlayOutput(request: LlmPolishOutputRequest): Promise<OverlayWalkthroughModel> {
  const raw = request.provider === "anthropic" ? await callClaudeOutputPolish(request) : await callOpenAiOutputPolish(request);
  return normalizeWalkthrough(raw, request.inputs);
}

export async function polishStandaloneHtml(request: LlmPolishHtmlRequest): Promise<string> {
  const raw = request.provider === "anthropic" ? await callClaudeHtmlPolish(request) : await callOpenAiHtmlPolish(request);
  return normalizeHtmlOutput(raw);
}

async function callOpenAiWalkthrough(request: LlmGenerateRequest): Promise<unknown> {
  const json = await callJsonEndpoint({
    url: responsesEndpoint,
    apiKey: request.apiKey,
    providerName: "OpenAI",
    body: {
      model: request.model,
      instructions: overlaySystemPrompt,
      input: buildWalkthroughInput(request.inputs),
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "resume_overlay_walkthrough",
          strict: true,
          schema: overlayWalkthroughSchema
        }
      }
    }
  });
  return extractOpenAiJson(json);
}

async function callOpenAiStep(request: LlmReviseStepRequest): Promise<unknown> {
  const json = await callJsonEndpoint({
    url: responsesEndpoint,
    apiKey: request.apiKey,
    providerName: "OpenAI",
    body: {
      model: request.model,
      instructions: `${overlaySystemPrompt}

Return only the revised step. Keep the same id unless the user explicitly asks for a new section.`,
      input: buildStepRevisionInput(request.inputs, request.walkthrough, request.step, request.instruction),
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "resume_overlay_step",
          strict: true,
          schema: overlayStepSchema
        }
      }
    }
  });
  return extractOpenAiJson(json);
}

async function callOpenAiOutputPolish(request: LlmPolishOutputRequest): Promise<unknown> {
  const json = await callJsonEndpoint({
    url: responsesEndpoint,
    apiKey: request.apiKey,
    providerName: "OpenAI",
    body: {
      model: request.model,
      instructions: `${overlaySystemPrompt}

This is a final-output polish pass. Return a complete revised walkthrough model. Preserve source-grounded credibility and only change the final artifact.`,
      input: buildOutputPolishInput(request.inputs, request.walkthrough, request.instruction),
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "resume_overlay_walkthrough",
          strict: true,
          schema: overlayWalkthroughSchema
        }
      }
    }
  });
  return extractOpenAiJson(json);
}

async function callOpenAiHtmlPolish(request: LlmPolishHtmlRequest): Promise<unknown> {
  const json = await callJsonEndpoint({
    url: responsesEndpoint,
    apiKey: request.apiKey,
    providerName: "OpenAI",
    body: {
      model: request.model,
      instructions: `You are editing a finished standalone HTML resume walkthrough file.

Return only JSON matching the schema. The html field must contain the complete revised HTML file. Preserve local-only constraints and factual credibility.`,
      input: buildHtmlPolishInput(request.html, request.instruction),
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "standalone_html_polish",
          strict: true,
          schema: htmlPolishSchema
        }
      }
    }
  });
  return extractOpenAiJson(json);
}

async function callClaudeWalkthrough(request: LlmGenerateRequest): Promise<unknown> {
  const json = await callJsonEndpoint({
    url: anthropicEndpoint,
    apiKey: request.apiKey,
    providerName: "Claude",
    body: {
      model: request.model,
      max_tokens: 8000,
      system: overlaySystemPrompt,
      messages: [{ role: "user", content: buildWalkthroughInput(request.inputs) }],
      tools: [
        {
          name: "return_resume_overlay_walkthrough",
          description: "Return the structured resume walkthrough model.",
          input_schema: overlayWalkthroughSchema
        }
      ],
      tool_choice: { type: "tool", name: "return_resume_overlay_walkthrough" }
    }
  });
  return extractClaudeToolInput(json, "return_resume_overlay_walkthrough");
}

async function callClaudeStep(request: LlmReviseStepRequest): Promise<unknown> {
  const json = await callJsonEndpoint({
    url: anthropicEndpoint,
    apiKey: request.apiKey,
    providerName: "Claude",
    body: {
      model: request.model,
      max_tokens: 3000,
      system: `${overlaySystemPrompt}

Return only the revised step. Keep the same id unless the user explicitly asks for a new section.`,
      messages: [{ role: "user", content: buildStepRevisionInput(request.inputs, request.walkthrough, request.step, request.instruction) }],
      tools: [
        {
          name: "return_resume_overlay_step",
          description: "Return the revised walkthrough step.",
          input_schema: overlayStepSchema
        }
      ],
      tool_choice: { type: "tool", name: "return_resume_overlay_step" }
    }
  });
  return extractClaudeToolInput(json, "return_resume_overlay_step");
}

async function callClaudeOutputPolish(request: LlmPolishOutputRequest): Promise<unknown> {
  const json = await callJsonEndpoint({
    url: anthropicEndpoint,
    apiKey: request.apiKey,
    providerName: "Claude",
    body: {
      model: request.model,
      max_tokens: 8000,
      system: `${overlaySystemPrompt}

This is a final-output polish pass. Return a complete revised walkthrough model. Preserve source-grounded credibility and only change the final artifact.`,
      messages: [{ role: "user", content: buildOutputPolishInput(request.inputs, request.walkthrough, request.instruction) }],
      tools: [
        {
          name: "return_resume_overlay_walkthrough",
          description: "Return the polished final resume walkthrough model.",
          input_schema: overlayWalkthroughSchema
        }
      ],
      tool_choice: { type: "tool", name: "return_resume_overlay_walkthrough" }
    }
  });
  return extractClaudeToolInput(json, "return_resume_overlay_walkthrough");
}

async function callClaudeHtmlPolish(request: LlmPolishHtmlRequest): Promise<unknown> {
  const json = await callJsonEndpoint({
    url: anthropicEndpoint,
    apiKey: request.apiKey,
    providerName: "Claude",
    body: {
      model: request.model,
      max_tokens: 12000,
      system: `You are editing a finished standalone HTML resume walkthrough file.

Return the complete revised HTML in the html tool field. Preserve local-only constraints and factual credibility.`,
      messages: [{ role: "user", content: buildHtmlPolishInput(request.html, request.instruction) }],
      tools: [
        {
          name: "return_standalone_html",
          description: "Return the revised standalone HTML artifact.",
          input_schema: htmlPolishSchema
        }
      ],
      tool_choice: { type: "tool", name: "return_standalone_html" }
    }
  });
  return extractClaudeToolInput(json, "return_standalone_html");
}

async function callJsonEndpoint({ url, apiKey, body, providerName }: { url: string; apiKey: string; body: unknown; providerName: string }) {
  if (!apiKey.trim()) {
    throw new Error(`Add a ${providerName} API key before generating. The key stays local and is not exported.`);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.trim()}`
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(text || `${providerName} returned a non-JSON response.`);
  }

  if (!response.ok) {
    const message = getApiError(json) || `${providerName} request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return json;
}

function extractOpenAiJson(response: unknown): unknown {
  if (isRecord(response) && typeof response.output_text === "string") {
    return JSON.parse(response.output_text);
  }

  if (isRecord(response) && Array.isArray(response.output)) {
    const text = response.output
      .flatMap((item) => (isRecord(item) && Array.isArray(item.content) ? item.content : []))
      .map((content) => {
        if (!isRecord(content)) return "";
        if (typeof content.text === "string") return content.text;
        if (typeof content.refusal === "string") throw new Error(content.refusal);
        return "";
      })
      .join("")
      .trim();
    if (text) return JSON.parse(text);
  }

  throw new Error("Could not find structured JSON in the OpenAI response.");
}

function extractClaudeToolInput(response: unknown, toolName: string): unknown {
  if (!isRecord(response) || !Array.isArray(response.content)) {
    throw new Error("Could not find structured JSON in the Claude response.");
  }

  const toolUse = response.content.find(
    (item) => isRecord(item) && item.type === "tool_use" && item.name === toolName && isRecord(item.input)
  );
  if (isRecord(toolUse) && isRecord(toolUse.input)) return toolUse.input;

  const text = response.content
    .map((item) => (isRecord(item) && typeof item.text === "string" ? item.text : ""))
    .join("")
    .trim();
  if (text) return JSON.parse(text);

  throw new Error("Claude did not return the expected structured tool output.");
}

function normalizeWalkthrough(value: unknown, inputs?: LlmGenerateRequest["inputs"]): OverlayWalkthroughModel {
  const source = unwrapWalkthrough(value);
  if (!isRecord(source)) {
    throw new Error("Generation returned empty structured output. Regenerate with a current model or try a shorter input.");
  }

  const rawSteps = firstArray(source.steps, source.walkthroughSteps, source.tourSteps);
  const normalizedSteps = rawSteps.length ? rawSteps.map((step, index) => normalizeStep(step, index)) : createFallbackSteps(source);
  const fallbackResume = createFallbackPolishedResume(source);
  const polishedResume = normalizePolishedResume(source.polishedResume, fallbackResume);
  if (inputs && isPolishedResumeStillRaw(polishedResume, inputs.resumeText)) {
    throw new Error("The model mostly copied the pasted resume instead of redesigning it. Add a stronger resume design prompt or use a stronger model, then regenerate.");
  }

  return {
    candidateName: stringField(source.candidateName) || fallbackResume.name,
    candidateHeadline: stringField(source.candidateHeadline) || fallbackResume.headline,
    polishedResume,
    exportDesign: normalizeExportDesign(source.exportDesign),
    targetTitle: stringField(source.targetTitle),
    targetOrganization: stringField(source.targetOrganization),
    reviewerIntro: stringField(source.reviewerIntro),
    resumeBrief: stringField(source.resumeBrief),
    roleBrief: stringField(source.roleBrief),
    strongestSignals: arrayOfStrings(source.strongestSignals),
    gaps: arrayOfStrings(source.gaps),
    steps: normalizedSteps,
    closingNote: stringField(source.closingNote)
  };
}

function normalizeExportDesign(value: unknown): ExportDesign {
  const source = isRecord(value) ? value : {};
  return {
    paletteName: stringField(source.paletteName) || "Executive neutral",
    background: hexField(source.background, "#e9e4dc"),
    paper: hexField(source.paper, "#fffdf8"),
    text: hexField(source.text, "#1f252c"),
    muted: hexField(source.muted, "#69727c"),
    accent: hexField(source.accent, "#245f65"),
    accentSoft: hexField(source.accentSoft, "#e3f0ee"),
    border: hexField(source.border, "#ded6ca"),
    highlight: hexField(source.highlight, "#f7e6a2"),
    warning: hexField(source.warning, "#9a6a1f"),
    risk: hexField(source.risk, "#9f4038"),
    resumeStripe: stringField(source.resumeStripe) || "linear-gradient(#245f65, #b8892f)",
    popoverWidth: enumField(source.popoverWidth, ["compact", "balanced", "wide"], "balanced"),
    resumeDensity: enumField(source.resumeDensity, ["airy", "balanced", "dense"], "balanced"),
    cornerStyle: enumField(source.cornerStyle, ["soft", "crisp"], "soft"),
    typeScale: enumField(source.typeScale, ["compact", "balanced", "large"], "balanced"),
    visualNotes: stringField(source.visualNotes)
  };
}

function unwrapWalkthrough(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const candidates = [
    value,
    value.walkthrough,
    value.model,
    value.data,
    value.result,
    value.generatedResumeWalkthrough,
    value.resumeWalkthrough,
    value.output
  ];
  return candidates.find((candidate) => isRecord(candidate) && (Array.isArray(candidate.steps) || Array.isArray(candidate.walkthroughSteps))) ?? value;
}

function normalizeHtmlOutput(value: unknown): string {
  const html = isRecord(value) && typeof value.html === "string" ? value.html.trim() : typeof value === "string" ? value.trim() : "";
  if (!html) throw new Error("The model did not return revised HTML.");
  if (!/^<!doctype html>|^<html[\s>]/i.test(html)) {
    throw new Error("The model did not return a complete standalone HTML document.");
  }
  if (/<script\b[^>]*\bsrc\s*=|<link\b[^>]*\bhref\s*=|@import\s+url|url\(\s*["']?https?:\/\//i.test(stripEmbeddedJson(html))) {
    throw new Error("The revised HTML appears to include external dependencies. Ask for a fully self-contained local file.");
  }
  return html;
}

function stripEmbeddedJson(html: string): string {
  return html.replace(/<script[^>]*type=["']application\/json["'][\s\S]*?<\/script>/gi, "");
}

function firstArray(...values: unknown[]): unknown[] {
  const value = values.find(Array.isArray);
  return Array.isArray(value) ? value : [];
}

function createFallbackSteps(value: Record<string, unknown>): OverlayStep[] {
  const title = stringField(value.targetTitle) || "the role";
  return [
    {
      id: "step-1",
      title: "Use the strongest verified evidence",
      eyebrow: "Step 1",
      narrative: "Generation returned a partial structure, so this step is intentionally conservative. Review the resume text and add the strongest supported point here.",
      detailBlocks: [
        {
          title: "What to verify",
          body: "The walkthrough should only claim what the resume or supplied background can support.",
          kind: "caveat"
        }
      ],
      evidenceQuote: "Needs source evidence",
      whyItMatters: "The walkthrough should only claim what the resume or supplied background can support.",
      fitLanguage: `Use this step to explain the clearest source-backed connection to ${title}.`,
      caveat: "This step needs review because generation did not return a complete walkthrough.",
      confidence: "needs confirmation",
      resumeAnchor: ""
    }
  ];
}

function normalizePolishedResume(value: unknown, fallback: PolishedResume): PolishedResume {
  if (!isRecord(value)) return fallback;
  return {
    name: stringField(value.name) || fallback.name,
    headline: stringField(value.headline) || fallback.headline,
    contactLine: stringField(value.contactLine),
    summary: stringField(value.summary),
    sections: normalizePolishedSections(value.sections, fallback.sections)
  };
}

function normalizePolishedSections(value: unknown, fallback: PolishedResumeSection[]): PolishedResumeSection[] {
  if (!Array.isArray(value)) return fallback;
  const sections = value
    .filter(isRecord)
    .map((section) => ({
      heading: stringField(section.heading),
      lines: arrayOfStrings(section.lines)
    }))
    .filter((section) => section.heading || section.lines.length);
  return sections.length ? sections : fallback;
}

function isPolishedResumeStillRaw(resume: PolishedResume, rawResumeText: string): boolean {
  const rawLines = rawResumeText
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => normalizeForSimilarity(line))
    .filter((line) => line.length > 28);
  if (rawLines.length < 3) return false;

  const polishedLines = [
    resume.summary,
    ...resume.sections.flatMap((section) => [section.heading, ...section.lines])
  ]
    .map((line) => normalizeForSimilarity(line))
    .filter((line) => line.length > 28);
  if (!polishedLines.length) return true;

  const copiedLines = polishedLines.filter((line) => rawLines.some((rawLine) => rawLine === line || rawLine.includes(line) || line.includes(rawLine)));
  const copyRatio = copiedLines.length / polishedLines.length;
  return polishedLines.length >= 4 && copyRatio > 0.65;
}

function normalizeForSimilarity(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").replace(/\s+/g, " ").trim();
}

function createFallbackPolishedResume(value: Record<string, unknown>): PolishedResume {
  return {
    name: stringField(value.candidateName),
    headline: stringField(value.candidateHeadline),
    contactLine: "",
    summary: stringField(value.resumeBrief),
    sections: []
  };
}

function normalizeStep(value: unknown, index = 0): OverlayStep {
  if (!isRecord(value)) {
    return createFallbackSteps({})[0] ?? {
      id: `step-${index + 1}`,
      title: `Fit point ${index + 1}`,
      eyebrow: `Step ${index + 1}`,
      narrative: "",
      detailBlocks: [{ title: "Needs editing", body: "", kind: "caveat" }],
      evidenceQuote: "Needs source evidence",
      whyItMatters: "",
      fitLanguage: "",
      caveat: "",
      confidence: "needs confirmation",
      resumeAnchor: ""
    };
  }

  const confidence = stringField(value.confidence);
  return {
    id: stringField(value.id) || `step-${index + 1}`,
    title: naturalTitle(stringField(value.title), index),
    eyebrow: naturalEyebrow(stringField(value.eyebrow), index),
    narrative: stringField(value.narrative),
    detailBlocks: normalizeDetailBlocks(value.detailBlocks, value),
    evidenceQuote: stringField(value.evidenceQuote) || "Needs source evidence",
    whyItMatters: stringField(value.whyItMatters),
    fitLanguage: stringField(value.fitLanguage),
    caveat: stringField(value.caveat),
    confidence: confidence === "high" || confidence === "medium" || confidence === "low" || confidence === "needs confirmation" ? confidence : "needs confirmation",
    resumeAnchor: stringField(value.resumeAnchor)
  };
}

function normalizeDetailBlocks(value: unknown, legacy: Record<string, unknown>): OverlayDetailBlock[] {
  if (Array.isArray(value)) {
    const blocks = value
      .filter(isRecord)
      .map((block) => ({
        title: naturalDetailTitle(stringField(block.title)),
        body: stringField(block.body),
        kind: stringField(block.kind) === "caveat" ? ("caveat" as const) : ("standard" as const)
      }))
      .filter((block) => block.title || block.body);
    if (blocks.length) return blocks;
  }

  return [
    { title: "Why this matters", body: stringField(legacy.whyItMatters), kind: "standard" as const },
    { title: "How this connects", body: stringField(legacy.fitLanguage), kind: "standard" as const },
    { title: "Where to be careful", body: stringField(legacy.caveat), kind: "caveat" as const }
  ].filter((block) => block.body.trim());
}

function naturalTitle(value: string, index: number): string {
  const trimmed = value.trim();
  if (!trimmed) return `Fit point ${index + 1}`;
  return trimmed
    .replace(/\bexecutive pattern\b/gi, "career context")
    .replace(/\bstrategic signal\b/gi, "relevant signal")
    .replace(/\bleadership archetype\b/gi, "leadership experience")
    .replace(/\bfit vector\b/gi, "fit")
    .replace(/\bproof point\b/gi, "evidence")
    .replace(/\bmental model\b/gi, "starting point");
}

function naturalEyebrow(value: string, index: number): string {
  const trimmed = value.trim();
  if (!trimmed) return `Step ${index + 1}`;
  if (/\b(executive pattern|strategic signal|leadership archetype|fit vector|proof point|mental model)\b/i.test(trimmed)) {
    return `Step ${index + 1}`;
  }
  return trimmed;
}

function naturalDetailTitle(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "Note";
  return naturalTitle(trimmed, 0).replace(/^Fit point 1$/, "Note");
}

function getApiError(value: unknown): string {
  if (!isRecord(value)) return "";
  if (isRecord(value.error) && typeof value.error.message === "string") return value.error.message;
  if (typeof value.message === "string") return value.message;
  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function hexField(value: unknown, fallback: string): string {
  const text = stringField(value).trim();
  return /^#[0-9A-Fa-f]{6}$/.test(text) ? text : fallback;
}

function enumField<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  const text = stringField(value);
  return options.includes(text as T) ? (text as T) : fallback;
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
