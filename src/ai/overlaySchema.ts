export const overlayStepSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    eyebrow: { type: "string" },
    narrative: { type: "string" },
    detailBlocks: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          body: { type: "string" },
          kind: {
            type: "string",
            enum: ["standard", "caveat"]
          }
        },
        required: ["title", "body", "kind"]
      }
    },
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
    "detailBlocks",
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

export const exportDesignSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    paletteName: { type: "string" },
    background: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    paper: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    text: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    muted: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    accent: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    accentSoft: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    border: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    highlight: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    warning: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    risk: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    resumeStripe: { type: "string" },
    popoverWidth: { type: "string", enum: ["compact", "balanced", "wide"] },
    resumeDensity: { type: "string", enum: ["airy", "balanced", "dense"] },
    cornerStyle: { type: "string", enum: ["soft", "crisp"] },
    typeScale: { type: "string", enum: ["compact", "balanced", "large"] },
    visualNotes: { type: "string" }
  },
  required: [
    "paletteName",
    "background",
    "paper",
    "text",
    "muted",
    "accent",
    "accentSoft",
    "border",
    "highlight",
    "warning",
    "risk",
    "resumeStripe",
    "popoverWidth",
    "resumeDensity",
    "cornerStyle",
    "typeScale",
    "visualNotes"
  ]
} as const;

export const overlayWalkthroughSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    candidateName: { type: "string" },
    candidateHeadline: { type: "string" },
    polishedResume: polishedResumeSchema,
    exportDesign: exportDesignSchema,
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
    "exportDesign",
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
