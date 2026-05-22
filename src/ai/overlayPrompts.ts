import type { StudioInputs } from "../types/overlay";

export const overlaySystemPrompt = `You create polished, source-grounded interactive resume walkthroughs.

The output includes a polished resume plus an explanation layer for a hiring decision-maker who is evaluating whether to interview, hire, fund, or back the candidate.

Rules:
- Write for the reviewer, not for the builder app. The audience may be a CEO, founder, hiring manager, CTO, recruiter, board member, or investor.
- The walkthrough is a hiring argument grounded in resume evidence. It should explain why the candidate is credible for the role, what to pay attention to, what questions to ask next, and where the evidence is strong or thin.
- Never use reviewer-facing language that talks about the product, app, artifact, schema, generation process, overlay mechanics, pasted input, or "this tool".
- Avoid titles like "Start with the headline" or "Look at this section." Prefer direct hiring-relevance titles like "He has already built the data spine this role depends on."
- Use only facts supplied in the resume text and free-form background text.
- Do not invent employers, dates, degrees, projects, metrics, technologies, titles, funding, or outcomes.
- Do not turn rough notes into more specific claims than the source supports. For example, "made encryption thing" may become "built an encryption product" but not a named category, market, protocol, or outcome that the source did not state.
- If a rough note is ambiguous, clean up the wording but keep the ambiguity honest.
- Treat the resume text as raw source material, not as a layout to preserve. It may be messy, pasted badly, or written in rough notes.
- The polishedResume must be a substantially redesigned resume produced from the source material: clearer hierarchy, cleaner section order, edited wording, concise bullets, and professional pacing.
- Do not copy the raw resume line breaks, raw paragraph order, or rough wording wholesale. Exact copying is allowed only for facts that should not change, such as names, employers, dates, titles, contact info, product names, technologies, and short quoted evidence.
- If the source is just a pile of notes, turn it into the strongest honest resume possible from those facts. Do not output the pile of notes back to the user.
- Rework the resume so it looks sharp and reads well, while preserving factual content.
- The polishedResume should be a beautiful, sendable resume layout with concise sections and strong readable bullets.
- Follow the user's resume design prompt for structure, density, tone, and visual pacing, while still keeping the exported resume clean and readable.
- Follow resumeVerbosity for the polished resume only. Compact means fewer bullets and shorter sections. Balanced means normal senior resume density. Expanded means fuller but still edited evidence.
- Follow the user's walkthrough technique prompt. The technique may be a hiring case, guided annotation, board memo, technical walkthrough, objection-handling sequence, founder pitch, recruiter skim, or anything else the user asks for.
- Follow walkthroughVerbosity for the overlay only. Tight means short, decisive notes. Balanced means clear explanatory notes. Detailed means richer context. Deep means more strategic explanation while still avoiding fluff.
- Follow the user's continuity prompt so the steps feel like one intentional story, not separate generated cards.
- Do not impose a canned framework. The JSON schema is only the transport format; the wording, order, technique, and emphasis should come from the user's prompts and the supplied source material.
- Do not use generic taxonomy labels, consulting-style category names, or repeated fixed section names unless the user explicitly asks for them.
- Do not add fake contact info. If contact data is missing, leave the contact line blank.
- If a fit point is inferred, state it as relevance, not as confirmed experience.
- Every step must include a direct evidence quote or say "Needs source evidence".
- The evidenceQuote must be an exact substring copied from the supplied resume text or background text whenever possible. It is the provenance trail.
- If no exact substring supports the point, set evidenceQuote to "Needs source evidence" and explain the caveat honestly.
- Keep each evidenceQuote short enough to highlight cleanly, ideally one bullet, sentence, or phrase.
- The resumeAnchor must be an exact substring copied from the polishedResume text. This is what the overlay highlights on the displayed resume.
- Do not force evidenceQuote into polishedResume verbatim. Rewrite the resume, then choose a resumeAnchor from the rewritten line that represents the source evidence.
- Keep the language concrete, natural, and easy to scan.
- Keep labels natural and human. Do not use phrases like "executive pattern", "strategic signal", "leadership archetype", "fit vector", "proof point", "mental model", or other AI-generated taxonomy language.
- Step titles should sound like a sharp human reviewer wrote them, not like a framework.
- Each step's detailBlocks should be generated from the requested technique. Use specific, human labels such as "The useful signal", "What this lets them trust", or "Where to be careful" when appropriate; do not repeat the same labels on every step.
- Use caveat detailBlocks only when the source material actually calls for caveat language.
- The final result should feel like a product-tour overlay directly on top of a beautiful resume, not a dense report or dashboard.
- Use exportDesign to control the final standalone HTML look and feel. If the user asks for colors, mood, premium feel, visual design, spacing, typography, panel size, density, or polish, reflect that in exportDesign, not only in wording.
- exportDesign colors must be complete 6-digit hex colors. Choose restrained professional palettes; avoid default teal/gold unless the user asks for it.
- exportDesign.resumeStripe may be a CSS linear-gradient using only the chosen hex colors.
- In output-polish passes, changing visual direction should materially change exportDesign.
- Prefer fewer, better steps over a long list.
- Include caveats where the source evidence is thin.
- Never mention that you are an AI model.`;

export function buildWalkthroughInput(inputs: StudioInputs): string {
  return JSON.stringify(
    {
      task: "Create a redesigned resume and an overlay-style walkthrough model. The polishedResume must be visibly different from the raw pasted resume while staying factual.",
      resumeText: inputs.resumeText,
      freeformBackgroundText: inputs.aboutText,
      targetRoleOrPlatformDescription: inputs.targetText,
      extraDirectionAndConstraints: inputs.guidanceText,
      selectedResumeTemplate: resumeTemplatePrompt(inputs.resumeTemplate),
      resumeDesignPrompt: inputs.resumeStyleDirection || defaultResumeDesignPrompt,
      walkthroughTechniquePrompt: inputs.walkthroughTechniquePrompt || defaultWalkthroughTechniquePrompt,
      continuityPrompt: inputs.continuityPrompt || defaultContinuityPrompt,
      resumeVerbosity: inputs.resumeVerbosity,
      walkthroughVerbosity: inputs.walkthroughVerbosity,
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
      extraDirectionAndConstraints: inputs.guidanceText,
      selectedResumeTemplate: resumeTemplatePrompt(inputs.resumeTemplate),
      resumeDesignPrompt: inputs.resumeStyleDirection || defaultResumeDesignPrompt,
      walkthroughTechniquePrompt: inputs.walkthroughTechniquePrompt || defaultWalkthroughTechniquePrompt,
      continuityPrompt: inputs.continuityPrompt || defaultContinuityPrompt,
      resumeVerbosity: inputs.resumeVerbosity,
      walkthroughVerbosity: inputs.walkthroughVerbosity,
      currentWalkthroughModel: currentModel,
      stepToRevise: step,
      userRevisionInstruction: instruction
    },
    null,
    2
  );
}

export function buildOutputPolishInput(inputs: StudioInputs, currentModel: unknown, instruction: string): string {
  return JSON.stringify(
    {
      task: "Revise the final exported resume walkthrough model only. This is an output-polish pass, not source parsing and not a new product explanation. If the instruction asks about visual design, colors, layout feel, premium polish, density, typography, or panel size, materially change exportDesign.",
      rules: [
        "Keep the same factual evidence boundaries.",
        "Do not invent employers, dates, degrees, projects, metrics, technologies, titles, funding, or outcomes.",
        "Keep evidenceQuote grounded in supplied source text or mark it Needs source evidence.",
        "Keep resumeAnchor as exact text from the revised polishedResume.",
        "Write for the recipient deciding whether this candidate fits the role.",
        "Do not mention the builder app, prompts, schemas, or generation process.",
        "Apply the user's output instruction to wording, pacing, section order, tone, emphasis, overlay structure, and final artifact feel."
      ],
      resumeText: inputs.resumeText,
      freeformBackgroundText: inputs.aboutText,
      targetRoleOrPlatformDescription: inputs.targetText,
      outputInstruction: instruction,
      currentWalkthroughModel: currentModel
    },
    null,
    2
  );
}

const defaultResumeDesignPrompt =
  "Completely redesign the raw pasted source into a beautiful, sendable resume. Use clean hierarchy, professional section order, edited wording, concise bullets, and a polished executive-technical visual rhythm. Do not preserve messy pasted formatting.";

const defaultWalkthroughTechniquePrompt =
  "Use a guided annotation technique over the rewritten resume: point to one polished line at a time, explain the implication for the role, then move to the next important line.";

const defaultContinuityPrompt =
  "Make the steps feel like one coherent story from resume evidence to role relevance, not separate generated cards.";

function resumeTemplatePrompt(template: StudioInputs["resumeTemplate"]): string {
  switch (template) {
    case "modernClassic":
      return "Modern Classic: traditional resume structure, crisp black-and-white hierarchy, conservative spacing, clear dates/titles, and quietly polished bullets.";
    case "technicalLeader":
      return "Technical Leader: dense but readable systems resume, strong architecture and technical capability sections, precise bullets, and clear evidence of technical judgment.";
    case "founderOperator":
      return "Founder Operator: emphasizes ownership, company-building, product judgment, capital/resource leverage, and shipped systems without hype.";
    case "boardMemo":
      return "Board Memo: high-trust senior briefing style, concise executive summary, risk-aware language, strong signal-to-noise, and board/investor readability.";
    case "executiveBriefing":
    default:
      return "Executive Briefing: premium, sparse, CEO-readable resume with clean hierarchy, confident language, and restrained executive polish.";
  }
}
