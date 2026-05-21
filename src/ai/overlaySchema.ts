export const overlayStepSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    eyebrow: { type: "string" },
    narrative: { type: "string" },
    evidenceQuote: { type: "string" },
    whyItMatters: { type: "string" },
    fitLanguage: { type: "string" },
    caveat: { type: "string" },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low", "needs confirmation"]
    },
    resumeAnchor: { type: "string" }
  },
  required: [
    "id",
    "title",
    "eyebrow",
    "narrative",
    "evidenceQuote",
    "whyItMatters",
    "fitLanguage",
    "caveat",
    "confidence",
    "resumeAnchor"
  ]
} as const;

export const polishedResumeSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    headline: { type: "string" },
    contactLine: { type: "string" },
    summary: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          heading: { type: "string" },
          lines: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["heading", "lines"]
      }
    }
  },
  required: ["name", "headline", "contactLine", "summary", "sections"]
} as const;

export const overlayWalkthroughSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    candidateName: { type: "string" },
    candidateHeadline: { type: "string" },
    polishedResume: polishedResumeSchema,
    targetTitle: { type: "string" },
    targetOrganization: { type: "string" },
    reviewerIntro: { type: "string" },
    resumeBrief: { type: "string" },
    roleBrief: { type: "string" },
    strongestSignals: {
      type: "array",
      items: { type: "string" }
    },
    gaps: {
      type: "array",
      items: { type: "string" }
    },
    steps: {
      type: "array",
      minItems: 4,
      maxItems: 9,
      items: overlayStepSchema
    },
    closingNote: { type: "string" }
  },
  required: [
    "candidateName",
    "candidateHeadline",
    "polishedResume",
    "targetTitle",
    "targetOrganization",
    "reviewerIntro",
    "resumeBrief",
    "roleBrief",
    "strongestSignals",
    "gaps",
    "steps",
    "closingNote"
  ]
} as const;
