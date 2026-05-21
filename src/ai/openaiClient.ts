import { buildStepRevisionInput, buildWalkthroughInput, overlaySystemPrompt } from "./overlayPrompts";
import { overlayStepSchema, overlayWalkthroughSchema } from "./overlaySchema";
import type {
  LlmGenerateRequest,
  LlmReviseStepRequest,
  OverlayStep,
  OverlayWalkthroughModel
} from "../types/overlay";

const responsesEndpoint = "/api/openai-responses";

export async function generateOverlayWalkthrough(request: LlmGenerateRequest): Promise<OverlayWalkthroughModel> {
  const json = await callResponsesApi({
    apiKey: request.apiKey,
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

  return normalizeWalkthrough(extractJson(json));
}

export async function reviseOverlayStep(request: LlmReviseStepRequest): Promise<OverlayStep> {
  const json = await callResponsesApi({
    apiKey: request.apiKey,
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

  return normalizeStep(extractJson(json));
}

async function callResponsesApi({ apiKey, body }: { apiKey: string; body: unknown }) {
  if (!apiKey.trim()) {
    throw new Error("Add an OpenAI API key before generating. The key stays local and is not exported.");
  }

  const response = await fetch(responsesEndpoint, {
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
    throw new Error(text || "OpenAI returned a non-JSON response.");
  }

  if (!response.ok) {
    const message = getApiError(json) || `OpenAI request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return json;
}

function extractJson(response: unknown): unknown {
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

function normalizeWalkthrough(value: unknown): OverlayWalkthroughModel {
  if (!isRecord(value) || !Array.isArray(value.steps)) {
    throw new Error("The model did not return a valid walkthrough.");
  }

  return {
    candidateName: stringField(value.candidateName),
    candidateHeadline: stringField(value.candidateHeadline),
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
