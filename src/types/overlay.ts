export interface StudioInputs {
  resumeText: string;
  aboutText: string;
  targetText: string;
  guidanceText: string;
}

export interface OverlayStep {
  id: string;
  title: string;
  eyebrow: string;
  narrative: string;
  evidenceQuote: string;
  whyItMatters: string;
  fitLanguage: string;
  caveat: string;
  confidence: "high" | "medium" | "low" | "needs confirmation";
  resumeAnchor: string;
}

export interface OverlayWalkthroughModel {
  candidateName: string;
  candidateHeadline: string;
  targetTitle: string;
  targetOrganization: string;
  reviewerIntro: string;
  resumeBrief: string;
  roleBrief: string;
  strongestSignals: string[];
  gaps: string[];
  steps: OverlayStep[];
  closingNote: string;
}

export interface StudioState {
  apiKey: string;
  model: string;
  saveKey: boolean;
  inputs: StudioInputs;
  walkthrough: OverlayWalkthroughModel | null;
  selectedStepId: string | null;
  selectedMode: "compose" | "edit" | "preview";
  status: string;
  error: string;
  isGenerating: boolean;
  isRevising: boolean;
}

export interface LlmGenerateRequest {
  apiKey: string;
  model: string;
  inputs: StudioInputs;
}

export interface LlmReviseStepRequest {
  apiKey: string;
  model: string;
  inputs: StudioInputs;
  walkthrough: OverlayWalkthroughModel;
  step: OverlayStep;
  instruction: string;
}
