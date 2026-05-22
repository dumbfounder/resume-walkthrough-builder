import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { generateOverlayWalkthrough, polishOverlayOutput, reviseOverlayStep } from "./ai/openaiClient";
import { buildOverlayHtml } from "./export/overlayHtmlExporter";
import type { OverlayDetailBlock, OverlayStep, OverlayWalkthroughModel, PolishedResume, StudioInputs, StudioState } from "./types/overlay";

const STORAGE_KEY = "resume-overlay-studio:v3";
const KEY_STORAGE_KEY = "resume-overlay-studio:provider-keys:v2";
const PROJECT_SESSION_KEY = "resume-overlay-studio:project-session-id:v1";
const DRAFT_SCHEMA_VERSION = 8;

const resumeTemplateOptions: { value: StudioInputs["resumeTemplate"]; label: string; note: string }[] = [
  { value: "executiveBriefing", label: "Executive Briefing", note: "Crisp, premium, CEO-readable" },
  { value: "modernClassic", label: "Modern Classic", note: "Traditional resume with cleaner hierarchy" },
  { value: "technicalLeader", label: "Technical Leader", note: "Dense systems and architecture signal" },
  { value: "founderOperator", label: "Founder Operator", note: "Builder, ownership, and leverage" },
  { value: "boardMemo", label: "Board Memo", note: "High-trust briefing for senior review" }
];

const modelOptions: Record<StudioState["provider"], { value: string; label: string; note: string }[]> = {
  openai: [
    { value: "gpt-5.5", label: "GPT-5.5", note: "Best OpenAI default for complex professional work" },
    { value: "gpt-5.5-pro", label: "GPT-5.5 pro", note: "Most precise, slower, premium" },
    { value: "gpt-5.4", label: "GPT-5.4", note: "Frontier quality at lower cost" },
    { value: "gpt-5.4-pro", label: "GPT-5.4 pro", note: "Heavier reasoning, premium" },
    { value: "gpt-5.4-mini", label: "GPT-5.4 mini", note: "Fast and cost efficient" },
    { value: "gpt-5.4-nano", label: "GPT-5.4 nano", note: "Cheapest latest GPT-5.4-class model" }
  ],
  anthropic: [
    { value: "claude-opus-4-7", label: "Claude Opus 4.7", note: "Most capable Claude model" },
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", note: "Best speed/intelligence balance" },
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", note: "Fastest latest Claude model" }
  ]
};

const emptyInputs: StudioInputs = {
  resumeText: "",
  aboutText: "",
  targetText: "",
  guidanceText: "",
  resumeStyleDirection: "",
  resumeTemplate: "executiveBriefing",
  walkthroughTechniquePrompt: "",
  continuityPrompt: "",
  resumeVerbosity: "balanced",
  walkthroughVerbosity: "balanced"
};

const emptyState: StudioState = {
  draftSchemaVersion: DRAFT_SCHEMA_VERSION,
  provider: "openai",
  openaiApiKey: "",
  anthropicApiKey: "",
  model: defaultModelForProvider("openai"),
  saveKey: false,
  inputs: emptyInputs,
  walkthrough: null,
  outputPrompt: "",
  outputWalkthrough: null,
  selectedStepId: null,
  selectedMode: "compose",
  status: "Paste source material, then generate the walkthrough.",
  error: "",
  isGenerating: false,
  isRevising: false,
  isPolishingOutput: false
};

export default function App() {
  const [state, setState] = useState<StudioState>(() => loadState());
  const [revisionPrompt, setRevisionPrompt] = useState("");
  const [backupStatus, setBackupStatus] = useState("");
  const projectSessionId = useRef(readProjectSessionId());

  useEffect(() => {
    if (state.draftSchemaVersion === DRAFT_SCHEMA_VERSION) return;
    setState((current) => ({
      ...current,
      draftSchemaVersion: DRAFT_SCHEMA_VERSION,
      walkthrough: null,
      selectedStepId: null,
      selectedMode: "compose",
      outputWalkthrough: null,
      isGenerating: false,
      isRevising: false,
      isPolishingOutput: false,
      error: "",
      status: "App updated. Your pasted inputs were kept, and the stale generated walkthrough was cleared automatically."
    }));
  }, [state.draftSchemaVersion]);

  useEffect(() => {
    const { openaiApiKey: _openaiApiKey, anthropicApiKey: _anthropicApiKey, ...persistable } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
    if (state.saveKey) {
      localStorage.setItem(KEY_STORAGE_KEY, JSON.stringify({ openai: state.openaiApiKey, anthropic: state.anthropicApiKey }));
    }
    if (!state.saveKey) {
      localStorage.removeItem(KEY_STORAGE_KEY);
    }
  }, [state]);

  useEffect(() => {
    if (!hasMeaningfulDraft(state)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      saveServerWorkSession(projectSessionId.current, state, controller.signal).then((result) => {
        if (!result) return;
        setBackupStatus(result.ok ? `Session backed up ${new Date(result.savedAt).toLocaleTimeString()}` : result.error);
      });
    }, 1400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [state]);

  const selectedStep = useMemo(() => {
    if (!state.walkthrough?.steps.length) return null;
    return state.walkthrough.steps.find((step) => step.id === state.selectedStepId) ?? state.walkthrough.steps[0];
  }, [state.walkthrough, state.selectedStepId]);

  const selectedIndex = state.walkthrough?.steps.findIndex((step) => step.id === selectedStep?.id) ?? -1;
  const canGenerate = state.inputs.resumeText.trim() && state.inputs.targetText.trim();

  async function handleCheckProxy() {
    setState((current) => ({ ...current, error: "", status: "Checking the local AI proxy loaded by this browser tab..." }));
    try {
      const response = await fetch("/api/ai-health", { cache: "no-store" });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`Local AI proxy health returned ${response.status}: ${text.slice(0, 120)}`);
      }
      setState((current) => ({ ...current, status: "Local AI proxy is loaded in this browser tab. Claude route is available." }));
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Local AI proxy health check failed.",
        status: "This browser tab is not connected to the current local AI proxy."
      }));
    }
  }

  async function handleGenerate() {
    if (!canGenerate || state.isGenerating) return;
    setState((current) => ({ ...current, isGenerating: true, error: "", status: "Regenerating the polished resume and overlay walkthrough..." }));
    try {
      const walkthrough = await generateOverlayWalkthrough({
        provider: state.provider,
        apiKey: activeApiKey(state),
        model: resolveModelForProvider(state.provider, state.model),
        inputs: state.inputs
      });
      const outputWalkthrough = currentOutputPrompt(state)
        ? await polishOverlayOutput({
            provider: state.provider,
            apiKey: activeApiKey(state),
            model: resolveModelForProvider(state.provider, state.model),
            inputs: state.inputs,
            walkthrough,
            instruction: currentOutputPrompt(state)
          })
        : null;
      setState((current) => ({
        ...current,
        walkthrough,
        outputWalkthrough,
        selectedStepId: walkthrough.steps[0]?.id ?? null,
        selectedMode: current.outputPrompt.trim() ? "output" : "edit",
        isGenerating: false,
        status: current.outputPrompt.trim()
          ? "Everything regenerated and the saved output prompt was reapplied."
          : "Everything regenerated. Edit the resume and steps until the artifact feels right."
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        isGenerating: false,
        error: error instanceof Error ? error.message : "Could not regenerate the resume and walkthrough.",
        status: "Full regeneration stopped."
      }));
    }
  }

  async function handleReviseStep() {
    if (!state.walkthrough || !selectedStep || !revisionPrompt.trim() || state.isRevising) return;
    setState((current) => ({ ...current, isRevising: true, error: "", status: "Revising the selected overlay step..." }));
    try {
      const revisedStep = await reviseOverlayStep({
        provider: state.provider,
        apiKey: activeApiKey(state),
        model: resolveModelForProvider(state.provider, state.model),
        inputs: state.inputs,
        walkthrough: state.walkthrough,
        step: selectedStep,
        instruction: revisionPrompt
      });
      setState((current) => ({
        ...current,
        walkthrough: current.walkthrough
          ? {
              ...current.walkthrough,
              steps: current.walkthrough.steps.map((step) => (step.id === selectedStep.id ? { ...revisedStep, id: selectedStep.id } : step))
            }
          : current.walkthrough,
        outputWalkthrough: null,
        isRevising: false,
        status: "Step revised. Reapply the output prompt before export if you want the final artifact updated."
      }));
      setRevisionPrompt("");
    } catch (error) {
      setState((current) => ({
        ...current,
        isRevising: false,
        error: error instanceof Error ? error.message : "Could not revise step.",
        status: "Revision stopped."
      }));
    }
  }

  function updateInputs(patch: Partial<StudioInputs>) {
    setState((current) => ({
      ...current,
      inputs: { ...current.inputs, ...patch },
      outputWalkthrough: null,
      error: "",
      status: "Draft saved locally."
    }));
  }

  function updateWalkthrough(patch: Partial<OverlayWalkthroughModel>) {
    setState((current) => ({
      ...current,
      walkthrough: current.walkthrough ? { ...current.walkthrough, ...patch } : current.walkthrough,
      outputWalkthrough: null,
      status: "Walkthrough edits saved locally. Reapply the output prompt before export if needed."
    }));
  }

  function updateStep(patch: Partial<OverlayStep>) {
    if (!selectedStep) return;
    setState((current) => ({
      ...current,
      walkthrough: current.walkthrough
        ? {
            ...current.walkthrough,
            steps: current.walkthrough.steps.map((step) => (step.id === selectedStep.id ? { ...step, ...patch } : step))
          }
        : current.walkthrough,
      outputWalkthrough: null,
      status: "Step edits saved locally. Reapply the output prompt before export if needed."
    }));
  }

  function moveStep(direction: -1 | 1) {
    if (!state.walkthrough || selectedIndex < 0) return;
    const nextIndex = selectedIndex + direction;
    if (nextIndex < 0 || nextIndex >= state.walkthrough.steps.length) return;
    const steps = [...state.walkthrough.steps];
    const [step] = steps.splice(selectedIndex, 1);
    steps.splice(nextIndex, 0, step);
    updateWalkthrough({ steps });
  }

  function addStep() {
    const id = `step-${Date.now()}`;
    const step: OverlayStep = {
      id,
      title: "New step",
      eyebrow: "Needs editing",
      narrative: "",
      detailBlocks: [{ title: "Needs editing", body: "", kind: "caveat" }],
      evidenceQuote: "Needs source evidence",
      whyItMatters: "",
      fitLanguage: "",
      caveat: "",
      confidence: "needs confirmation",
      resumeAnchor: ""
    };
    setState((current) => ({
      ...current,
      walkthrough: current.walkthrough
        ? { ...current.walkthrough, steps: [...current.walkthrough.steps, step] }
        : createManualWalkthrough(step),
      outputWalkthrough: null,
      selectedStepId: id,
      selectedMode: "edit",
      status: "Blank step added."
    }));
  }

  function removeStep() {
    if (!state.walkthrough || !selectedStep) return;
    const steps = state.walkthrough.steps.filter((step) => step.id !== selectedStep.id);
    setState((current) => ({
      ...current,
      walkthrough: current.walkthrough ? { ...current.walkthrough, steps } : null,
      outputWalkthrough: null,
      selectedStepId: steps[0]?.id ?? null,
      status: "Step removed."
    }));
  }

  function exportHtml() {
    const exportModel = state.outputWalkthrough ?? state.walkthrough;
    if (!exportModel) return;
    const html = buildOverlayHtml(exportModel, state.inputs);
    download(`${slug(exportModel.candidateName || "resume")}-${slug(exportModel.targetTitle || "walkthrough")}.html`, html, "text/html;charset=utf-8");
    setState((current) => ({ ...current, status: "Standalone HTML exported." }));
  }

  async function handlePolishOutput() {
    if (!state.walkthrough || !state.outputPrompt.trim() || state.isPolishingOutput) return;
    setState((current) => ({ ...current, isPolishingOutput: true, error: "", status: "Applying the output-only prompt to the final artifact..." }));
    try {
      const outputWalkthrough = await polishOverlayOutput({
        provider: state.provider,
        apiKey: activeApiKey(state),
        model: resolveModelForProvider(state.provider, state.model),
        inputs: state.inputs,
        walkthrough: state.walkthrough,
        instruction: state.outputPrompt
      });
      setState((current) => ({
        ...current,
        outputWalkthrough,
        selectedStepId: outputWalkthrough.steps[0]?.id ?? current.selectedStepId,
        selectedMode: "output",
        isPolishingOutput: false,
        status: "Output prompt applied. Preview and export now use the polished output variant."
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        isPolishingOutput: false,
        error: error instanceof Error ? error.message : "Could not polish final output.",
        status: "Output polish stopped."
      }));
    }
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    projectSessionId.current = createProjectSessionId();
    setState({
      ...emptyState,
      provider: state.provider,
      model: defaultModelForProvider(state.provider),
      openaiApiKey: state.saveKey ? state.openaiApiKey : "",
      anthropicApiKey: state.saveKey ? state.anthropicApiKey : "",
      saveKey: state.saveKey,
      outputPrompt: state.outputPrompt
    });
    setRevisionPrompt("");
  }

  return (
    <div className="studio-shell">
      <header className="studio-topbar">
        <div>
          <p className="product-mark">Resume Walkthrough Builder</p>
          <h1>Turn a resume into a guided overlay.</h1>
        </div>
        <div className="top-actions">
          <button type="button" className={state.selectedMode === "compose" ? "mode active" : "mode"} onClick={() => setState((current) => ({ ...current, selectedMode: "compose" }))}>
            Inputs
          </button>
          <button type="button" className={state.selectedMode === "edit" ? "mode active" : "mode"} onClick={() => setState((current) => ({ ...current, selectedMode: "edit" }))}>
            Edit
          </button>
          <button type="button" className={state.selectedMode === "preview" ? "mode active" : "mode"} onClick={() => setState((current) => ({ ...current, selectedMode: "preview" }))}>
            Preview
          </button>
          <button type="button" className={state.selectedMode === "output" ? "mode active" : "mode"} onClick={() => setState((current) => ({ ...current, selectedMode: "output" }))}>
            Output
          </button>
          <button type="button" className="export-button" onClick={exportHtml} disabled={!state.walkthrough}>
            Export HTML
          </button>
        </div>
      </header>

      <main className="studio-grid">
        <section className="left-panel">
          <div className="status-line">
            <span>{state.status}</span>
            {backupStatus && <small>{backupStatus}</small>}
            {state.error && <strong>{state.error}</strong>}
          </div>

          {state.selectedMode === "compose" && (
            <ComposePanel
              state={state}
              canGenerate={Boolean(canGenerate)}
              onStateChange={setState}
              onInputChange={updateInputs}
              onCheckProxy={handleCheckProxy}
              onGenerate={handleGenerate}
              onReset={reset}
            />
          )}

          {state.selectedMode === "edit" && (
            <EditPanel
              walkthrough={state.walkthrough}
              selectedStep={selectedStep}
              selectedIndex={selectedIndex}
              revisionPrompt={revisionPrompt}
              isRevising={state.isRevising}
              onSelectStep={(id) => setState((current) => ({ ...current, selectedStepId: id }))}
              onWalkthroughChange={updateWalkthrough}
              onStepChange={updateStep}
              inputs={state.inputs}
              canRegenerate={Boolean(canGenerate)}
              isGenerating={state.isGenerating}
              onInputChange={updateInputs}
              onRegenerateAll={handleGenerate}
              onMove={moveStep}
              onAdd={addStep}
              onRemove={removeStep}
              onPromptChange={setRevisionPrompt}
              onRevise={handleReviseStep}
            />
          )}

          {state.selectedMode === "preview" && (
            <PreviewNotes walkthrough={state.outputWalkthrough ?? state.walkthrough} hasOutputVariant={Boolean(state.outputWalkthrough)} onExport={exportHtml} />
          )}

          {state.selectedMode === "output" && (
            <OutputPolishPanel
              state={state}
              onPromptChange={(outputPrompt) => setState((current) => ({ ...current, outputPrompt, outputWalkthrough: null, status: "Output prompt saved. Apply it to update the export preview." }))}
              onApply={handlePolishOutput}
              onClearVariant={() => setState((current) => ({ ...current, outputWalkthrough: null, status: "Output variant cleared. Export will use the base generated walkthrough." }))}
              onExport={exportHtml}
            />
          )}
        </section>

        <section className="preview-stage" aria-label="Live walkthrough preview">
          <OverlayPreview
            model={state.outputWalkthrough ?? state.walkthrough}
            inputs={state.inputs}
            selectedStep={(state.outputWalkthrough ?? state.walkthrough)?.steps.find((step) => step.id === selectedStep?.id) ?? (state.outputWalkthrough ?? state.walkthrough)?.steps[0] ?? null}
            onSelectStep={(id) => setState((current) => ({ ...current, selectedStepId: id, selectedMode: "edit" }))}
          />
        </section>
      </main>
      {state.isGenerating && (
        <div className="loading-overlay" role="status" aria-live="polite">
          <div>
            <span />
            <h2>Building the resume walkthrough</h2>
            <p>Reworking the resume, mapping evidence to the role, and preparing the guided overlay.</p>
          </div>
        </div>
      )}
      {state.isPolishingOutput && (
        <div className="loading-overlay" role="status" aria-live="polite">
          <div>
            <span />
            <h2>Polishing the final output</h2>
            <p>Applying the saved output prompt to the resume, overlay wording, and exported artifact.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ComposePanel({
  state,
  canGenerate,
  onStateChange,
  onInputChange,
  onCheckProxy,
  onGenerate,
  onReset
}: {
  state: StudioState;
  canGenerate: boolean;
  onStateChange: Dispatch<SetStateAction<StudioState>>;
  onInputChange: (patch: Partial<StudioInputs>) => void;
  onCheckProxy: () => void;
  onGenerate: () => void;
  onReset: () => void;
}) {
  return (
    <div className="compose-stack">
      <div className="provider-grid">
        <label>
          Provider
          <select
            value={state.provider}
            onChange={(event) => {
              const provider = event.target.value as StudioState["provider"];
              onStateChange((current) => ({ ...current, provider, model: defaultModelForProvider(provider) }));
            }}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Claude</option>
          </select>
        </label>
        <label>
          Resume template
          <select value={state.inputs.resumeTemplate} onChange={(event) => onInputChange({ resumeTemplate: event.target.value as StudioInputs["resumeTemplate"] })}>
            {resumeTemplateOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} - {option.note}
              </option>
            ))}
          </select>
        </label>
        <label>
          Resume detail
          <select value={state.inputs.resumeVerbosity} onChange={(event) => onInputChange({ resumeVerbosity: event.target.value as StudioInputs["resumeVerbosity"] })}>
            <option value="compact">Compact</option>
            <option value="balanced">Balanced</option>
            <option value="expanded">Expanded</option>
          </select>
        </label>
        <label>
          Walkthrough depth
          <select value={state.inputs.walkthroughVerbosity} onChange={(event) => onInputChange({ walkthroughVerbosity: event.target.value as StudioInputs["walkthroughVerbosity"] })}>
            <option value="tight">Tight</option>
            <option value="balanced">Balanced</option>
            <option value="detailed">Detailed</option>
            <option value="deep">Deep walkthrough</option>
          </select>
        </label>
      </div>
      <div className="api-row">
        <label>
          {state.provider === "anthropic" ? "Anthropic API key" : "OpenAI API key"}
          <input
            type="password"
            value={activeApiKey(state)}
            onChange={(event) =>
              onStateChange((current) =>
                current.provider === "anthropic"
                  ? { ...current, anthropicApiKey: event.target.value }
                  : { ...current, openaiApiKey: event.target.value }
              )
            }
            placeholder={state.provider === "anthropic" ? "sk-ant-..." : "sk-..."}
          />
        </label>
        <label>
          Model
          <select value={resolveModelForProvider(state.provider, state.model)} onChange={(event) => onStateChange((current) => ({ ...current, model: event.target.value }))}>
            {modelOptions[state.provider].map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} - {option.note}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="save-key">
        <input
          type="checkbox"
          checked={state.saveKey}
          onChange={(event) => onStateChange((current) => ({ ...current, saveKey: event.target.checked }))}
        />
        Save key in this browser only
      </label>
      <button type="button" className="quiet check-proxy" onClick={onCheckProxy}>
        Check local AI proxy
      </button>
      <label>
        Resume
        <textarea
          value={state.inputs.resumeText}
          onChange={(event) => onInputChange({ resumeText: event.target.value })}
          rows={12}
          placeholder="Paste the actual resume text."
        />
      </label>
      <label>
        Other context about you
        <textarea
          value={state.inputs.aboutText}
          onChange={(event) => onInputChange({ aboutText: event.target.value })}
          rows={7}
          placeholder="Paste free-form notes: projects, positioning, preferences, context from conversations, things to emphasize, things to avoid."
        />
      </label>
      <label>
        Job or platform description
        <textarea
          value={state.inputs.targetText}
          onChange={(event) => onInputChange({ targetText: event.target.value })}
          rows={9}
          placeholder="Paste the role description, platform memo, hiring brief, or what you would be working on."
        />
      </label>
      <label>
        Resume design prompt
        <textarea
          value={state.inputs.resumeStyleDirection}
          onChange={(event) => onInputChange({ resumeStyleDirection: event.target.value })}
          rows={4}
          placeholder="Make the resume itself feel finished: cleaner hierarchy, stronger wording, better pacing, restrained visual treatment, and no inflated claims."
        />
      </label>
      <label>
        Walkthrough technique prompt
        <textarea
          value={state.inputs.walkthroughTechniquePrompt}
          onChange={(event) => onInputChange({ walkthroughTechniquePrompt: event.target.value })}
          rows={4}
          placeholder="Tell the model how the notes should make the hiring case: guided annotation, objection handling, board memo, founder pitch, technical deep dive, or another technique."
        />
      </label>
      <label>
        Continuity prompt
        <textarea
          value={state.inputs.continuityPrompt}
          onChange={(event) => onInputChange({ continuityPrompt: event.target.value })}
          rows={3}
          placeholder="Describe the throughline the walkthrough should maintain from step to step."
        />
      </label>
      <label>
        Extra direction and constraints
        <textarea
          value={state.inputs.guidanceText}
          onChange={(event) => onInputChange({ guidanceText: event.target.value })}
          rows={5}
          placeholder="Things to emphasize, avoid, simplify, or make more natural."
        />
      </label>
      <div className="action-row">
        <button type="button" className="primary" onClick={onGenerate} disabled={!canGenerate || state.isGenerating}>
          {state.isGenerating ? "Regenerating everything..." : "Generate / regenerate everything"}
        </button>
        <button type="button" className="quiet" onClick={onReset}>
          Reset
        </button>
      </div>
    </div>
  );
}

function EditPanel({
  walkthrough,
  selectedStep,
  selectedIndex,
  revisionPrompt,
  isRevising,
  onSelectStep,
  onWalkthroughChange,
  onStepChange,
  inputs,
  canRegenerate,
  isGenerating,
  onInputChange,
  onRegenerateAll,
  onMove,
  onAdd,
  onRemove,
  onPromptChange,
  onRevise
}: {
  walkthrough: OverlayWalkthroughModel | null;
  selectedStep: OverlayStep | null;
  selectedIndex: number;
  revisionPrompt: string;
  isRevising: boolean;
  onSelectStep: (id: string) => void;
  onWalkthroughChange: (patch: Partial<OverlayWalkthroughModel>) => void;
  onStepChange: (patch: Partial<OverlayStep>) => void;
  inputs: StudioInputs;
  canRegenerate: boolean;
  isGenerating: boolean;
  onInputChange: (patch: Partial<StudioInputs>) => void;
  onRegenerateAll: () => void;
  onMove: (direction: -1 | 1) => void;
  onAdd: () => void;
  onRemove: () => void;
  onPromptChange: (value: string) => void;
  onRevise: () => void;
}) {
  if (!walkthrough) {
    return (
      <div className="empty-edit">
        <h2>No walkthrough yet.</h2>
        <p>Generate one from the Inputs view, or add a blank step and build manually.</p>
        <button type="button" className="primary" onClick={onAdd}>
          Add blank step
        </button>
      </div>
    );
  }

  return (
    <div className="edit-stack">
      <div className="step-strip">
        {walkthrough.steps.map((step, index) => (
          <button key={step.id} type="button" className={selectedStep?.id === step.id ? "active" : ""} onClick={() => onSelectStep(step.id)}>
            {index + 1}
          </button>
        ))}
        <button type="button" onClick={onAdd}>
          +
        </button>
      </div>

      <div className="regenerate-card">
        <div className="template-grid">
          <label>
            Resume template
            <select value={inputs.resumeTemplate} onChange={(event) => onInputChange({ resumeTemplate: event.target.value as StudioInputs["resumeTemplate"] })}>
              {resumeTemplateOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.note}
                </option>
              ))}
            </select>
          </label>
          <label>
            Resume detail
            <select value={inputs.resumeVerbosity} onChange={(event) => onInputChange({ resumeVerbosity: event.target.value as StudioInputs["resumeVerbosity"] })}>
              <option value="compact">Compact</option>
              <option value="balanced">Balanced</option>
              <option value="expanded">Expanded</option>
            </select>
          </label>
          <label>
            Walkthrough depth
            <select value={inputs.walkthroughVerbosity} onChange={(event) => onInputChange({ walkthroughVerbosity: event.target.value as StudioInputs["walkthroughVerbosity"] })}>
              <option value="tight">Tight</option>
              <option value="balanced">Balanced</option>
              <option value="detailed">Detailed</option>
              <option value="deep">Deep walkthrough</option>
            </select>
          </label>
        </div>
        <label>
          Resume design prompt
          <textarea
            value={inputs.resumeStyleDirection}
            onChange={(event) => onInputChange({ resumeStyleDirection: event.target.value })}
            rows={4}
            placeholder="Tell the model how to rework the resume before rebuilding the overlay."
          />
        </label>
        <label>
          Walkthrough technique prompt
          <textarea
            value={inputs.walkthroughTechniquePrompt}
            onChange={(event) => onInputChange({ walkthroughTechniquePrompt: event.target.value })}
            rows={4}
            placeholder="Tell the model how the overlay should walk through the resume."
          />
        </label>
        <label>
          Continuity prompt
          <textarea
            value={inputs.continuityPrompt}
            onChange={(event) => onInputChange({ continuityPrompt: event.target.value })}
            rows={3}
            placeholder="Give the model the story thread to keep across steps."
          />
        </label>
        <button type="button" className="primary" onClick={onRegenerateAll} disabled={!canRegenerate || isGenerating}>
          {isGenerating ? "Regenerating everything..." : "Regenerate everything"}
        </button>
      </div>

      <div className="brief-fields">
        <label>
          Candidate name
          <input value={walkthrough.candidateName} onChange={(event) => onWalkthroughChange({ candidateName: event.target.value })} />
        </label>
        <label>
          Target title
          <input value={walkthrough.targetTitle} onChange={(event) => onWalkthroughChange({ targetTitle: event.target.value })} />
        </label>
        <label>
          Reviewer intro
          <textarea value={walkthrough.reviewerIntro} onChange={(event) => onWalkthroughChange({ reviewerIntro: event.target.value })} rows={3} />
        </label>
        <label>
          Polished resume used in export
          <textarea
            value={serializePolishedResume(walkthrough)}
            onChange={(event) => onWalkthroughChange({ polishedResume: parsePolishedResumeText(event.target.value, walkthrough) })}
            rows={10}
          />
        </label>
      </div>

      {selectedStep && (
        <div className="step-editor">
          <div className="step-editor-head">
            <p>Step {selectedIndex + 1}</p>
            <div>
              <button type="button" className="quiet" onClick={() => onMove(-1)} disabled={selectedIndex <= 0}>
                Up
              </button>
              <button type="button" className="quiet" onClick={() => onMove(1)} disabled={selectedIndex >= walkthrough.steps.length - 1}>
                Down
              </button>
              <button type="button" className="danger" onClick={onRemove}>
                Delete
              </button>
            </div>
          </div>
          <label>
            Title
            <input value={selectedStep.title} onChange={(event) => onStepChange({ title: event.target.value })} />
          </label>
          <label>
            Overlay narrative
            <textarea value={selectedStep.narrative} onChange={(event) => onStepChange({ narrative: event.target.value })} rows={5} />
          </label>
          <label>
            Overlay cards
            <textarea
              value={serializeDetailBlocks(selectedStep)}
              onChange={(event) => onStepChange({ detailBlocks: parseDetailBlocks(event.target.value) })}
              rows={6}
              placeholder="One card per line. Example: What to trust: This point is directly supported by the highlighted resume text."
            />
          </label>
          <label>
            Source evidence quote
            <textarea value={selectedStep.evidenceQuote} onChange={(event) => onStepChange({ evidenceQuote: event.target.value })} rows={4} />
          </label>
          <label>
            Resume highlight text
            <textarea
              value={selectedStep.resumeAnchor}
              onChange={(event) => onStepChange({ resumeAnchor: event.target.value })}
              rows={3}
              placeholder="Exact text from the polished resume that should light up during this step."
            />
          </label>
          <label>
            Confidence
            <select value={selectedStep.confidence} onChange={(event) => onStepChange({ confidence: event.target.value as OverlayStep["confidence"] })}>
              <option>high</option>
              <option>medium</option>
              <option>low</option>
              <option>needs confirmation</option>
            </select>
          </label>
          <div className="prompt-box">
            <label>
              Revise this step by prompting
              <textarea
                value={revisionPrompt}
                onChange={(event) => onPromptChange(event.target.value)}
                rows={4}
                placeholder="Example: make this more executive, shorter, and less hypey; keep the same evidence."
              />
            </label>
            <button type="button" className="primary" onClick={onRevise} disabled={!revisionPrompt.trim() || isRevising}>
              {isRevising ? "Revising..." : "Revise selected step"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OutputPolishPanel({
  state,
  onPromptChange,
  onApply,
  onClearVariant,
  onExport
}: {
  state: StudioState;
  onPromptChange: (value: string) => void;
  onApply: () => void;
  onClearVariant: () => void;
  onExport: () => void;
}) {
  return (
    <div className="output-polish">
      <h2>Final output polish</h2>
      <p>
        This prompt only changes the exported artifact. It leaves the base generated resume and step editor intact, then creates a separate polished output variant for preview and export.
      </p>
      <label>
        Output-only prompt
        <textarea
          value={state.outputPrompt}
          onChange={(event) => onPromptChange(event.target.value)}
          rows={9}
          placeholder="Example: make the final artifact feel more like a premium resume with a calm guided tour; reduce hype; make the overlay speak directly to a CEO; tighten the resume bullets; keep the strongest hiring case upfront."
        />
      </label>
      <div className="action-row">
        <button type="button" className="primary" onClick={onApply} disabled={!state.walkthrough || !state.outputPrompt.trim() || state.isPolishingOutput}>
          {state.isPolishingOutput ? "Applying output prompt..." : "Apply to final output"}
        </button>
        <button type="button" className="quiet" onClick={onClearVariant} disabled={!state.outputWalkthrough}>
          Clear output variant
        </button>
        <button type="button" className="export-button" onClick={onExport} disabled={!state.walkthrough}>
          Export current output
        </button>
      </div>
      <div className="output-state">
        <strong>{state.outputWalkthrough ? "Preview/export are using the polished output variant." : "Preview/export are using the base generated walkthrough."}</strong>
        <span>When this prompt is saved, full regeneration applies it again after rebuilding the base resume.</span>
      </div>
    </div>
  );
}

function PreviewNotes({ walkthrough, hasOutputVariant, onExport }: { walkthrough: OverlayWalkthroughModel | null; hasOutputVariant: boolean; onExport: () => void }) {
  return (
    <div className="preview-notes">
      <h2>What will export</h2>
      <p>
        The exported file is a single offline HTML document with embedded CSS, JavaScript, and JSON data. The API key and builder draft controls are not included.
      </p>
      {hasOutputVariant && <p className="output-badge">Using output-polished variant.</p>}
      {walkthrough ? (
        <>
          <ul>
            <li>{walkthrough.steps.length} overlay steps</li>
            <li>{walkthrough.strongestSignals.length} strongest-fit signals</li>
            <li>{walkthrough.gaps.length} caveats or gaps</li>
          </ul>
          <button type="button" className="primary" onClick={onExport}>
            Export standalone HTML
          </button>
        </>
      ) : (
        <p>No generated walkthrough yet.</p>
      )}
    </div>
  );
}

function OverlayPreview({
  model,
  inputs,
  selectedStep,
  onSelectStep
}: {
  model: OverlayWalkthroughModel | null;
  inputs: StudioInputs;
  selectedStep: OverlayStep | null;
  onSelectStep: (id: string) => void;
}) {
  if (!model || !selectedStep) {
    return (
      <div className="empty-preview">
        <div>
          <p className="product-mark">Preview</p>
          <h2>The final artifact will appear here.</h2>
          <p>It should feel like a calm web walkthrough over the resume, with one idea per overlay.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="artifact-frame">
      <div className="artifact-toolbar">
        <span>Candidate fit preview</span>
        <strong>{model.targetTitle || "Target role"}</strong>
      </div>
      <div className="resume-tour-canvas">
        <ResumeDocument model={model} inputs={inputs} selectedStep={selectedStep} />
        <article className="tour-popover">
          <div className="tour-actions">
            <span>{stepPosition(model, selectedStep)}</span>
            <div>
              <button type="button" onClick={() => onSelectStep(adjacentStepId(model, selectedStep, -1))} disabled={stepIndex(model, selectedStep) <= 0}>
                Back
              </button>
              <button type="button" onClick={() => onSelectStep(adjacentStepId(model, selectedStep, 1))} disabled={stepIndex(model, selectedStep) >= model.steps.length - 1}>
                Next
              </button>
            </div>
          </div>
          <div className="tour-kicker">
            <span>Hiring signal</span>
            <em>{selectedStep.confidence}</em>
          </div>
          <h2>{naturalDisplayTitle(selectedStep.title)}</h2>
          <p className="tour-narrative">{selectedStep.narrative}</p>
          <div className="tour-insights">
            {displayDetailBlocks(selectedStep).map((block, index) => (
              <Insight key={`${block.title}-${index}`} title={naturalDisplayTitle(block.title)} body={block.body} variant={block.kind === "caveat" ? "caveat" : ""} />
            ))}
          </div>
          <div className="tour-source">
            <span>Source evidence</span>
            <p>{selectedStep.evidenceQuote}</p>
          </div>
          <nav className="artifact-dots">
            {model.steps.map((step, index) => (
              <button key={step.id} type="button" className={step.id === selectedStep.id ? "active" : ""} onClick={() => onSelectStep(step.id)}>
                {index + 1}
              </button>
            ))}
          </nav>
        </article>
      </div>
    </div>
  );
}

function stepIndex(model: OverlayWalkthroughModel, selectedStep: OverlayStep): number {
  return Math.max(0, model.steps.findIndex((step) => step.id === selectedStep.id));
}

function stepPosition(model: OverlayWalkthroughModel, selectedStep: OverlayStep): string {
  return `Step ${stepIndex(model, selectedStep) + 1} of ${Math.max(1, model.steps.length)}`;
}

function adjacentStepId(model: OverlayWalkthroughModel, selectedStep: OverlayStep, direction: -1 | 1): string {
  const nextIndex = Math.min(model.steps.length - 1, Math.max(0, stepIndex(model, selectedStep) + direction));
  return model.steps[nextIndex]?.id ?? selectedStep.id;
}

function templateClass(template: StudioInputs["resumeTemplate"]): string {
  return `template-${template.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

function naturalDisplayTitle(value: string): string {
  return value
    .replace(/\bexecutive pattern\b/gi, "career context")
    .replace(/\bstrategic signal\b/gi, "relevant signal")
    .replace(/\bleadership archetype\b/gi, "leadership experience")
    .replace(/\bfit vector\b/gi, "fit")
    .replace(/\bproof point\b/gi, "evidence")
    .replace(/\bmental model\b/gi, "starting point");
}

function displayDetailBlocks(step: OverlayStep): OverlayDetailBlock[] {
  if (step.detailBlocks?.length) return step.detailBlocks.filter((block) => block.title || block.body);
  return [
    { title: "Why this matters", body: step.whyItMatters, kind: "standard" },
    { title: "How this connects", body: step.fitLanguage, kind: "standard" },
    { title: "Where to be careful", body: step.caveat, kind: "caveat" }
  ].filter((block) => block.body.trim()) as OverlayDetailBlock[];
}

function Insight({ title, body, variant = "" }: { title: string; body: string; variant?: string }) {
  return (
    <div className={`artifact-insight ${variant}`}>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function ResumeDocument({ model, inputs, selectedStep }: { model: OverlayWalkthroughModel; inputs: StudioInputs; selectedStep: OverlayStep }) {
  const sections = buildResumeSections(model, inputs);
  const query = normalizedFocusQuery(selectedStep);
  const hasFocus = sections.some((section) => section.lines.some((line) => lineMatchesFocus(line, query)));

  return (
    <article className={`resume-document ${templateClass(inputs.resumeTemplate)}`}>
      <header className="resume-head">
        <div>
          <p>Resume</p>
          <h2>{model.polishedResume.name || model.candidateName || "Candidate"}</h2>
        </div>
        <span>{model.polishedResume.headline || model.candidateHeadline || model.targetTitle || "Interactive walkthrough"}</span>
      </header>
      {model.polishedResume.contactLine && <p className="resume-contact">{model.polishedResume.contactLine}</p>}
      {model.polishedResume.summary && <p className="resume-summary">{model.polishedResume.summary}</p>}
      {sections.length === 0 && <p className="empty-resume-text">Paste resume text to build the walkthrough canvas.</p>}
      {sections.map((section, sectionIndex) => (
        <section className="resume-section-block" key={`${section.heading}-${sectionIndex}`}>
          {section.heading && <h3>{section.heading}</h3>}
          {section.lines.map((line, lineIndex) => {
            const isFocused = lineMatchesFocus(line, query);
            const className = hasFocus ? (isFocused ? "resume-line focus" : "resume-line dim") : "resume-line";
            return (
              <p className={className} key={`${line}-${lineIndex}`} dangerouslySetInnerHTML={{ __html: highlightLine(line, query) }} />
            );
          })}
        </section>
      ))}
    </article>
  );
}

function loadState(): StudioState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const savedKeys = readSavedKeys();
    if (!saved) return { ...emptyState, ...savedKeys, saveKey: Boolean(savedKeys.openaiApiKey || savedKeys.anthropicApiKey) };
    const parsed = JSON.parse(saved) as Partial<StudioState>;
    const provider = parsed.provider ?? "openai";
    const model = resolveModelForProvider(provider, parsed.model);
    const rawInputs = (parsed.inputs ?? {}) as Partial<StudioInputs>;
    const legacyVerbosity = rawInputs.verbosity ?? "balanced";
    const inputs = {
      ...emptyInputs,
      ...rawInputs,
      resumeVerbosity: rawInputs.resumeVerbosity ?? "balanced",
      walkthroughVerbosity: rawInputs.walkthroughVerbosity ?? legacyVerbosity,
      resumeTemplate: rawInputs.resumeTemplate ?? "executiveBriefing"
    };
    const migratedWalkthrough = parsed.walkthrough ? migrateWalkthrough(parsed.walkthrough) : null;
    const migratedOutputWalkthrough = parsed.outputWalkthrough ? migrateWalkthrough(parsed.outputWalkthrough) : null;
    const savedVersion = typeof parsed.draftSchemaVersion === "number" ? parsed.draftSchemaVersion : 0;
    const staleWalkthrough = Boolean(migratedWalkthrough) && (savedVersion < DRAFT_SCHEMA_VERSION || !isWalkthroughCompatible(migratedWalkthrough));
    const walkthrough = staleWalkthrough ? null : migratedWalkthrough;
    const outputWalkthrough = staleWalkthrough || !isWalkthroughCompatible(migratedOutputWalkthrough) ? null : migratedOutputWalkthrough;
    const selectedStepId = walkthrough?.steps.some((step) => step.id === parsed.selectedStepId) ? parsed.selectedStepId ?? null : walkthrough?.steps[0]?.id ?? null;
    const selectedMode = staleWalkthrough ? "compose" : parsed.selectedMode ?? emptyState.selectedMode;
    const status = staleWalkthrough
      ? "App updated. Your pasted inputs were kept, and the stale generated walkthrough was cleared automatically."
      : parsed.status || emptyState.status;

    return {
      ...emptyState,
      ...parsed,
      ...savedKeys,
      draftSchemaVersion: DRAFT_SCHEMA_VERSION,
      provider,
      model,
      saveKey: Boolean(savedKeys.openaiApiKey || savedKeys.anthropicApiKey),
      inputs,
      walkthrough,
      outputPrompt: typeof parsed.outputPrompt === "string" ? parsed.outputPrompt : "",
      outputWalkthrough,
      selectedStepId,
      selectedMode,
      status,
      isGenerating: false,
      isRevising: false,
      isPolishingOutput: false,
      error: ""
    };
  } catch {
    return emptyState;
  }
}

function readProjectSessionId(): string {
  const existing = localStorage.getItem(PROJECT_SESSION_KEY);
  if (existing) return existing;
  return createProjectSessionId();
}

function createProjectSessionId(): string {
  const generated = crypto.randomUUID ? crypto.randomUUID() : `project-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(PROJECT_SESSION_KEY, generated);
  return generated;
}

function hasMeaningfulDraft(state: StudioState): boolean {
  return Boolean(
    state.inputs.resumeText.trim() ||
      state.inputs.aboutText.trim() ||
      state.inputs.targetText.trim() ||
      state.inputs.guidanceText.trim() ||
      state.walkthrough
  );
}

async function saveServerWorkSession(projectId: string, state: StudioState, signal: AbortSignal): Promise<{ ok: true; savedAt: string } | { ok: false; error: string } | null> {
  try {
    const {
      openaiApiKey: _openaiApiKey,
      anthropicApiKey: _anthropicApiKey,
      isGenerating: _isGenerating,
      isRevising: _isRevising,
      error: _error,
      ...persistable
    } = state;
    const response = await fetch("/api/work-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        state: {
          ...persistable,
          openaiApiKey: "",
          anthropicApiKey: "",
          saveKey: false,
          isGenerating: false,
          isRevising: false,
          error: ""
        }
      }),
      signal
    });
    if (response.ok) {
      const data = (await response.json()) as { savedAt?: string };
      return { ok: true, savedAt: data.savedAt || new Date().toISOString() };
    }
    if (response.status === 401 || response.status === 404) {
      return null;
    }
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, error: data?.error || `Session backup failed: ${response.status}` };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    return { ok: false, error: "Session backup failed." };
  }
}

function isWalkthroughCompatible(walkthrough: OverlayWalkthroughModel | null): boolean {
  if (!walkthrough) return true;
  const sections = Array.isArray(walkthrough.polishedResume?.sections) ? walkthrough.polishedResume.sections : [];
  const steps = Array.isArray(walkthrough.steps) ? walkthrough.steps : [];
  const hasGeneratedResume = sections.some((section) => section.heading || section.lines.some((line) => line.trim()));
  const hasUsableSteps = steps.length > 0;
  const allStepsHaveGeneratedAnchors = steps.every((step) => typeof step.resumeAnchor === "string" && step.resumeAnchor.trim());
  const allStepsHaveGeneratedCards = steps.every((step) => Array.isArray(step.detailBlocks) && step.detailBlocks.some((block) => block.title || block.body));
  return hasGeneratedResume && hasUsableSteps && allStepsHaveGeneratedAnchors && allStepsHaveGeneratedCards;
}

function migrateWalkthrough(walkthrough: OverlayWalkthroughModel): OverlayWalkthroughModel {
  const migrated = walkthrough.polishedResume
    ? walkthrough
    : {
    ...walkthrough,
    polishedResume: {
      name: walkthrough.candidateName ?? "",
      headline: walkthrough.candidateHeadline ?? "",
      contactLine: "",
      summary: walkthrough.resumeBrief ?? "",
      sections: []
    }
  };
  return {
    ...migrated,
    steps: migrated.steps.map((step) => ({
      ...step,
      detailBlocks: displayDetailBlocks(step)
    }))
  };
}

function createManualWalkthrough(step: OverlayStep): OverlayWalkthroughModel {
  return {
    candidateName: "",
    candidateHeadline: "",
    polishedResume: {
      name: "",
      headline: "",
      contactLine: "",
      summary: "",
      sections: []
    },
    targetTitle: "",
    targetOrganization: "",
    reviewerIntro: "",
    resumeBrief: "",
    roleBrief: "",
    strongestSignals: [],
    gaps: [],
    steps: [step],
    closingNote: ""
  };
}

function serializeDetailBlocks(step: OverlayStep): string {
  return displayDetailBlocks(step)
    .map((block) => `${block.kind === "caveat" ? "Caveat - " : ""}${block.title}: ${block.body}`.trim())
    .join("\n");
}

function parseDetailBlocks(text: string): OverlayDetailBlock[] {
  const blocks = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const caveat = /^caveat\s*[-:]/i.test(line);
      const cleaned = line.replace(/^caveat\s*[-:]\s*/i, "");
      const separator = cleaned.indexOf(":");
      const title = separator >= 0 ? cleaned.slice(0, separator).trim() : "Note";
      const body = separator >= 0 ? cleaned.slice(separator + 1).trim() : cleaned;
      return { title: title || "Note", body, kind: caveat ? "caveat" : "standard" } satisfies OverlayDetailBlock;
    });
  return blocks.length ? blocks : [{ title: "Needs editing", body: "", kind: "caveat" }];
}

function activeApiKey(state: StudioState): string {
  return state.provider === "anthropic" ? state.anthropicApiKey : state.openaiApiKey;
}

function currentOutputPrompt(state: StudioState): string {
  return state.outputPrompt.trim();
}

function defaultModelForProvider(provider: StudioState["provider"]): string {
  return modelOptions[provider][0]?.value ?? "";
}

function resolveModelForProvider(provider: StudioState["provider"], model?: string): string {
  if (model && modelOptions[provider].some((option) => option.value === model)) return model;
  return defaultModelForProvider(provider);
}

function readSavedKeys(): Pick<StudioState, "openaiApiKey" | "anthropicApiKey"> {
  const raw = localStorage.getItem(KEY_STORAGE_KEY);
  if (!raw) return { openaiApiKey: "", anthropicApiKey: "" };
  try {
    const parsed = JSON.parse(raw) as { openai?: string; anthropic?: string };
    return { openaiApiKey: parsed.openai ?? "", anthropicApiKey: parsed.anthropic ?? "" };
  } catch {
    return { openaiApiKey: raw, anthropicApiKey: "" };
  }
}

function serializePolishedResume(walkthrough: OverlayWalkthroughModel): string {
  const resume = walkthrough.polishedResume;
  return [
    resume.name,
    resume.headline,
    resume.contactLine,
    "",
    "SUMMARY",
    resume.summary,
    "",
    ...resume.sections.flatMap((section) => [section.heading.toUpperCase(), ...section.lines, ""])
  ]
    .join("\n")
    .trim();
}

function parsePolishedResumeText(text: string, walkthrough: OverlayWalkthroughModel): PolishedResume {
  const lines = text.replace(/\r/g, "").split("\n");
  const name = lines[0]?.trim() ?? "";
  const headline = lines[1]?.trim() ?? "";
  const contactLine = lines[2]?.trim() ?? "";
  const body = lines.slice(3).join("\n").trim();
  const parsedSections = parseResumeLikeText(body);
  const summarySection = parsedSections.find((section) => /^summary$/i.test(section.heading));
  const summary = summarySection?.lines.join(" ") || walkthrough.polishedResume.summary;
  const sections = parsedSections.filter((section) => !/^summary$/i.test(section.heading));

  return {
    name,
    headline,
    contactLine,
    summary,
    sections
  };
}

interface ResumeSection {
  heading: string;
  lines: string[];
}

function buildResumeSections(model: OverlayWalkthroughModel, inputs: StudioInputs): ResumeSection[] {
  const polishedSections = model.polishedResume.sections.filter((section) => section.heading || section.lines.length);
  if (polishedSections.length) return polishedSections;
  const sections = parseResumeLikeText(inputs.resumeText);
  if (inputs.aboutText.trim()) {
    sections.push({
      heading: "Additional Context",
      lines: inputs.aboutText
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
    });
  }
  return sections;
}

function parseResumeLikeText(text: string): ResumeSection[] {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const sections: ResumeSection[] = [];
  let current: ResumeSection = { heading: "", lines: [] };

  lines.forEach((line, index) => {
    if (isResumeHeading(line) && (index > 1 || current.lines.length > 2)) {
      if (current.heading || current.lines.length) sections.push(current);
      current = { heading: cleanHeading(line), lines: [] };
      return;
    }
    current.lines.push(line);
  });

  if (current.heading || current.lines.length) sections.push(current);
  return sections;
}

function isResumeHeading(line: string): boolean {
  const clean = cleanHeading(line);
  const known = /^(summary|profile|experience|professional experience|work experience|projects|selected projects|education|skills|technical skills|leadership|certifications|publications|awards)$/i;
  return known.test(clean) || (/^[A-Z][A-Z\s/&+-]{2,}$/.test(line) && line.length < 42);
}

function cleanHeading(line: string): string {
  return line.replace(/[:|]/g, "").replace(/\s+/g, " ").trim();
}

function normalizedFocusQuery(step: OverlayStep): string {
  const anchor = step.resumeAnchor.trim();
  if (anchor) return anchor;
  const quote = step.evidenceQuote.trim();
  if (quote && quote !== "Needs source evidence") return quote;
  return "";
}

function lineMatchesFocus(line: string, query: string): boolean {
  if (!query) return false;
  const normalizedLine = normalizeForMatch(line);
  const normalizedQuery = normalizeForMatch(query);
  if (!normalizedQuery) return false;
  if (normalizedLine.includes(normalizedQuery)) return true;
  const queryWords = normalizedQuery.split(" ").filter((word) => word.length > 3);
  if (queryWords.length < 3) return false;
  return queryWords.filter((word) => normalizedLine.includes(word)).length >= Math.min(4, queryWords.length);
}

function highlightLine(line: string, query: string): string {
  const escaped = escapeHtml(line);
  if (!query || !lineMatchesFocus(line, query)) return escaped;
  const exactIndex = line.toLowerCase().indexOf(query.toLowerCase());
  if (exactIndex >= 0) {
    const before = escapeHtml(line.slice(0, exactIndex));
    const match = escapeHtml(line.slice(exactIndex, exactIndex + query.length));
    const after = escapeHtml(line.slice(exactIndex + query.length));
    return `${before}<mark>${match}</mark>${after}`;
  }
  return `<mark>${escaped}</mark>`;
}

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 64) || "resume";
}
