import { buildStepRevisionInput, buildWalkthroughInput, overlaySystemPrompt } from "./overlayPrompts";
import { overlayStepSchema, overlayWalkthroughSchema } from "./overlaySchema";
import type {
  LlmGenerateRequest,
  LlmReviseStepRequest,
  OverlayStep,
  OverlayWalkthroughModel,
  PolishedResume,
  PolishedResumeSection
} from "../types/overlay";

const responsesEndpoint = "/api/openai-responses";
const anthropicEndpoint = "/api/anthropic-messages";

export async function generateOverlayWalkthrough(request: LlmGenerateRequest): Promise<OverlayWalkthroughModel> {
  const raw = request.provider === "anthropic" ? await callClaudeWalkthrough(request) : await callOpenAiWalkthrough(request);
  return normalizeWalkthrough(raw);
}

export async function reviseOverlayStep(request: LlmReviseStepRequest): Promise<OverlayStep> {
  const raw = request.provider === "anthropic" ? await callClaudeStep(request) : await callOpenAiStep(request);
  return normalizeStep(raw);
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

function normalizeWalkthrough(value: unknown): OverlayWalkthroughModel {
  if (!isRecord(value) || !Array.isArray(value.steps)) {
    throw new Error("The model did not return a valid walkthrough.");
  }

  const fallbackResume = createFallbackPolishedResume(value);
  return {
    candidateName: stringField(value.candidateName) || fallbackResume.name,
    candidateHeadline: stringField(value.candidateHeadline) || fallbackResume.headline,
    polishedResume: normalizePolishedResume(value.polishedResume, fallbackResume),
    targetTitle: stringField(value.targetTitle),
    targetOrganization: stringField(value.targetOrganization),
    reviewerIntro: stringField(value.reviewerIntro),
    resumeBrief: stringField(value.resumeBrief),
    roleBrief: stringField(value.roleBrief),
    strongestSignals: arrayOfStrings(value.strongestSignals),
    gaps: arrayOfStrings(value.gaps),
    steps: value.steps.map((step, index) => normalizeStep(step, index)),
    closingNote: stringField(value.closingNote)
  };
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
    throw new Error("The model did not return a valid step.");
  }

  const confidence = stringField(value.confidence);
  return {
    id: stringField(value.id) || `step-${index + 1}`,
    title: stringField(value.title),
    eyebrow: stringField(value.eyebrow),
    narrative: stringField(value.narrative),
    evidenceQuote: stringField(value.evidenceQuote) || "Needs source evidence",
    whyItMatters: stringField(value.whyItMatters),
    fitLanguage: stringField(value.fitLanguage),
    caveat: stringField(value.caveat),
    confidence: confidence === "high" || confidence === "medium" || confidence === "low" || confidence === "needs confirmation" ? confidence : "needs confirmation",
    resumeAnchor: stringField(value.resumeAnchor)
  };
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

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
