export interface StudioInputs {
  resumeText: string;
  aboutText: string;
  targetText: string;
  guidanceText: string;
  resumeStyleDirection: string;
  resumeTemplate: "executiveBriefing" | "modernClassic" | "technicalLeader" | "founderOperator" | "boardMemo";
  walkthroughTechniquePrompt: string;
  continuityPrompt: string;
  resumeVerbosity: "compact" | "balanced" | "expanded";
  walkthroughVerbosity: "tight" | "balanced" | "detailed" | "deep";
  verbosity?: "tight" | "balanced" | "detailed" | "deep";
}

export interface PolishedResumeSection {
  heading: string;
  lines: string[];
}

export interface PolishedResume {
  name: string;
  headline: string;
  contactLine: string;
  summary: string;
  sections: PolishedResumeSection[];
}

export interface OverlayDetailBlock {
  title: string;
  body: string;
  kind: "standard" | "caveat";
}

export interface OverlayStep {
  id: string;
  title: string;
  eyebrow: string;
  narrative: string;
  detailBlocks: OverlayDetailBlock[];
  evidenceQuote: string;
  whyItMatters: string;
  fitLanguage: string;
  caveat: string;
  confidence: "high" | "medium" | "low" | "needs confirmation";
  resumeAnchor: string;
}

export interface ExportDesign {
  paletteName: string;
  background: string;
  paper: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  border: string;
  highlight: string;
  warning: string;
  risk: string;
  resumeStripe: string;
  popoverWidth: "compact" | "balanced" | "wide";
  resumeDensity: "airy" | "balanced" | "dense";
  cornerStyle: "soft" | "crisp";
  typeScale: "compact" | "balanced" | "large";
  visualNotes: string;
}

export interface OverlayWalkthroughModel {
  candidateName: string;
  candidateHeadline: string;
  polishedResume: PolishedResume;
  exportDesign: ExportDesign;
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
  draftSchemaVersion: number;
  provider: "openai" | "anthropic";
  openaiApiKey: string;
  anthropicApiKey: string;
  model: string;
  saveKey: boolean;
  inputs: StudioInputs;
  walkthrough: OverlayWalkthroughModel | null;
  outputPrompt: string;
  outputWalkthrough: OverlayWalkthroughModel | null;
  outputHtml: string | null;
  selectedStepId: string | null;
  selectedMode: "compose" | "edit" | "output" | "preview";
  status: string;
  error: string;
  isGenerating: boolean;
  isRevising: boolean;
  isPolishingOutput: boolean;
}

export interface LlmGenerateRequest {
  provider: StudioState["provider"];
  apiKey: string;
  model: string;
  inputs: StudioInputs;
}

export interface LlmReviseStepRequest {
  provider: StudioState["provider"];
  apiKey: string;
  model: string;
  inputs: StudioInputs;
  walkthrough: OverlayWalkthroughModel;
  step: OverlayStep;
  instruction: string;
}

export interface LlmPolishOutputRequest {
  provider: StudioState["provider"];
  apiKey: string;
  model: string;
  inputs: StudioInputs;
  walkthrough: OverlayWalkthroughModel;
  instruction: string;
}

export interface LlmPolishHtmlRequest {
  provider: StudioState["provider"];
  apiKey: string;
  model: string;
  html: string;
  instruction: string;
}
