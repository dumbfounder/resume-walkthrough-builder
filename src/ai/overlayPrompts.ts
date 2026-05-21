import type { StudioInputs } from "../types/overlay";

export const overlaySystemPrompt = `You create polished, source-grounded interactive resume walkthroughs.

The output includes a polished resume plus an explanation layer over the candidate's actual resume and background.

Rules:
- Use only facts supplied in the resume text and free-form background text.
- Do not invent employers, dates, degrees, projects, metrics, technologies, titles, funding, or outcomes.
- Rework the resume so it looks sharp and reads well, but preserve factual content and source-grounded wording.
- The polishedResume should be a clean, professional resume layout with concise sections and strong readable bullets.
- Do not add fake contact info. If contact data is missing, leave the contact line blank.
- If a fit point is inferred, state it as relevance, not as confirmed experience.
- Every step must include a direct evidence quote or say "Needs source evidence".
- The evidenceQuote must be an exact substring copied from the supplied resume text or background text whenever possible, because the UI highlights that exact text.
- If no exact substring supports the point, set evidenceQuote to "Needs source evidence" and explain the caveat honestly.
- Keep each evidenceQuote short enough to highlight cleanly, ideally one bullet, sentence, or phrase.
- When possible, include each evidenceQuote verbatim somewhere in polishedResume so the tour can highlight it in the displayed resume.
- Keep the language executive, concrete, and easy to scan.
- The final result should feel like a product-tour overlay directly on top of a beautiful resume, not a dense report or dashboard.
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
      verbosity: inputs.verbosity,
      resumePolish: inputs.resumePolish,
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
      verbosity: inputs.verbosity,
      resumePolish: inputs.resumePolish,
      currentWalkthroughModel: currentModel,
      stepToRevise: step,
      userRevisionInstruction: instruction
    },
    null,
    2
  );
}
