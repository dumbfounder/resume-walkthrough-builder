import type { StudioInputs } from "../types/overlay";

export const overlaySystemPrompt = `You create polished, source-grounded interactive resume walkthroughs.

The output is not a resume rewrite. It is an explanation layer over the candidate's actual resume and background.

Rules:
- Use only facts supplied in the resume text and free-form background text.
- Do not invent employers, dates, degrees, projects, metrics, technologies, titles, funding, or outcomes.
- If a fit point is inferred, state it as relevance, not as confirmed experience.
- Every step must include a direct evidence quote or say "Needs source evidence".
- Keep the language executive, concrete, and easy to scan.
- The final result should feel like a high-end website walkthrough with overlays, not a dense report.
- Prefer fewer, better steps over a long list.
- Include caveats where the source evidence is thin.
- Never mention that you are an AI model.`;

export function buildWalkthroughInput(inputs: StudioInputs): string {
  return JSON.stringify(
    {
      task: "Create a polished overlay-style resume walkthrough model.",
      resumeText: inputs.resumeText,
      freeformBackgroundText: inputs.aboutText,
      targetRoleOrPlatformDescription: inputs.targetText,
      userGuidance: inputs.guidanceText,
      requiredExperience: "The exported HTML should walk a reviewer through how the supplied experience fits the supplied role/platform."
    },
    null,
    2
  );
}

export function buildStepRevisionInput(inputs: StudioInputs, currentModel: unknown, step: unknown, instruction: string): string {
  return JSON.stringify(
    {
      task: "Revise one walkthrough step while preserving source-grounded credibility.",
      resumeText: inputs.resumeText,
      freeformBackgroundText: inputs.aboutText,
      targetRoleOrPlatformDescription: inputs.targetText,
      currentWalkthroughModel: currentModel,
      stepToRevise: step,
      userRevisionInstruction: instruction
    },
    null,
    2
  );
}
