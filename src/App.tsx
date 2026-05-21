import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { generateOverlayWalkthrough, reviseOverlayStep } from "./ai/openaiClient";
import { buildOverlayHtml } from "./export/overlayHtmlExporter";
import type { OverlayStep, OverlayWalkthroughModel, StudioInputs, StudioState } from "./types/overlay";

const STORAGE_KEY = "resume-overlay-studio:v2";
const KEY_STORAGE_KEY = "resume-overlay-studio:openai-key";

const emptyInputs: StudioInputs = {
  resumeText: "",
  aboutText: "",
  targetText: "",
  guidanceText: ""
};

const emptyState: StudioState = {
  apiKey: "",
  model: "gpt-5.5",
  saveKey: false,
  inputs: emptyInputs,
  walkthrough: null,
  selectedStepId: null,
  selectedMode: "compose",
  status: "Paste source material, then generate the walkthrough.",
  error: "",
  isGenerating: false,
  isRevising: false
};

export default function App() {
  const [state, setState] = useState<StudioState>(() => loadState());
  const [revisionPrompt, setRevisionPrompt] = useState("");

  useEffect(() => {
    const { apiKey: _apiKey, ...persistable } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
    if (state.saveKey && state.apiKey.trim()) {
      localStorage.setItem(KEY_STORAGE_KEY, state.apiKey);
    }
    if (!state.saveKey) {
      localStorage.removeItem(KEY_STORAGE_KEY);
    }
  }, [state]);

  const selectedStep = useMemo(() => {
    if (!state.walkthrough?.steps.length) return null;
    return state.walkthrough.steps.find((step) => step.id === state.selectedStepId) ?? state.walkthrough.steps[0];
  }, [state.walkthrough, state.selectedStepId]);

  const selectedIndex = state.walkthrough?.steps.findIndex((step) => step.id === selectedStep?.id) ?? -1;
  const canGenerate = state.inputs.resumeText.trim() && state.inputs.targetText.trim();

  async function handleGenerate() {
    if (!canGenerate || state.isGenerating) return;
    setState((current) => ({ ...current, isGenerating: true, error: "", status: "Generating a polished overlay walkthrough..." }));
    try {
      const walkthrough = await generateOverlayWalkthrough({
        apiKey: state.apiKey,
        model: state.model,
        inputs: state.inputs
      });
      setState((current) => ({
        ...current,
        walkthrough,
        selectedStepId: walkthrough.steps[0]?.id ?? null,
        selectedMode: "edit",
        isGenerating: false,
        status: "Walkthrough generated. Edit the steps until every overlay feels right."
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        isGenerating: false,
        error: error instanceof Error ? error.message : "Could not generate walkthrough.",
        status: "Generation stopped."
      }));
    }
  }

  async function handleReviseStep() {
    if (!state.walkthrough || !selectedStep || !revisionPrompt.trim() || state.isRevising) return;
    setState((current) => ({ ...current, isRevising: true, error: "", status: "Revising the selected overlay step..." }));
    try {
      const revisedStep = await reviseOverlayStep({
        apiKey: state.apiKey,
        model: state.model,
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
        isRevising: false,
        status: "Step revised. Review the text before export."
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
      error: "",
      status: "Draft saved locally."
    }));
  }

  function updateWalkthrough(patch: Partial<OverlayWalkthroughModel>) {
    setState((current) => ({
      ...current,
      walkthrough: current.walkthrough ? { ...current.walkthrough, ...patch } : current.walkthrough,
      status: "Walkthrough edits saved locally."
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
      status: "Step edits saved locally."
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
      selectedStepId: steps[0]?.id ?? null,
      status: "Step removed."
    }));
  }

  function exportHtml() {
    if (!state.walkthrough) return;
    const html = buildOverlayHtml(state.walkthrough, state.inputs);
    download(`${slug(state.walkthrough.candidateName || "resume")}-${slug(state.walkthrough.targetTitle || "walkthrough")}.html`, html, "text/html;charset=utf-8");
    setState((current) => ({ ...current, status: "Standalone HTML exported." }));
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    setState({ ...emptyState, apiKey: state.saveKey ? state.apiKey : "", saveKey: state.saveKey });
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
          <button type="button" className="export-button" onClick={exportHtml} disabled={!state.walkthrough}>
            Export HTML
          </button>
        </div>
      </header>

      <main className="studio-grid">
        <section className="left-panel">
          <div className="status-line">
            <span>{state.status}</span>
            {state.error && <strong>{state.error}</strong>}
          </div>

          {state.selectedMode === "compose" && (
            <ComposePanel
              state={state}
              canGenerate={Boolean(canGenerate)}
              onStateChange={setState}
              onInputChange={updateInputs}
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
              onMove={moveStep}
              onAdd={addStep}
              onRemove={removeStep}
              onPromptChange={setRevisionPrompt}
              onRevise={handleReviseStep}
            />
          )}

          {state.selectedMode === "preview" && (
            <PreviewNotes walkthrough={state.walkthrough} onExport={exportHtml} />
          )}
        </section>

        <section className="preview-stage" aria-label="Live walkthrough preview">
          <OverlayPreview
            model={state.walkthrough}
            inputs={state.inputs}
            selectedStep={selectedStep}
            onSelectStep={(id) => setState((current) => ({ ...current, selectedStepId: id, selectedMode: "edit" }))}
          />
        </section>
      </main>
    </div>
  );
}

function ComposePanel({
  state,
  canGenerate,
  onStateChange,
  onInputChange,
  onGenerate,
  onReset
}: {
  state: StudioState;
  canGenerate: boolean;
  onStateChange: Dispatch<SetStateAction<StudioState>>;
  onInputChange: (patch: Partial<StudioInputs>) => void;
  onGenerate: () => void;
  onReset: () => void;
}) {
  return (
    <div className="compose-stack">
      <div className="api-row">
        <label>
          OpenAI API key
          <input
            type="password"
            value={state.apiKey}
            onChange={(event) => onStateChange((current) => ({ ...current, apiKey: event.target.value }))}
            placeholder="sk-..."
          />
        </label>
        <label>
          Model
          <input value={state.model} onChange={(event) => onStateChange((current) => ({ ...current, model: event.target.value }))} />
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
        Direction for the generated walkthrough
        <textarea
          value={state.inputs.guidanceText}
          onChange={(event) => onInputChange({ guidanceText: event.target.value })}
          rows={5}
          placeholder="Example: make it CEO-friendly, emphasize platform architecture, avoid sounding like a generic resume."
        />
      </label>
      <div className="action-row">
        <button type="button" className="primary" onClick={onGenerate} disabled={!canGenerate || state.isGenerating}>
          {state.isGenerating ? "Generating..." : "Generate walkthrough"}
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
            Small label
            <input value={selectedStep.eyebrow} onChange={(event) => onStepChange({ eyebrow: event.target.value })} />
          </label>
          <label>
            Overlay narrative
            <textarea value={selectedStep.narrative} onChange={(event) => onStepChange({ narrative: event.target.value })} rows={5} />
          </label>
          <label>
            Source evidence quote
            <textarea value={selectedStep.evidenceQuote} onChange={(event) => onStepChange({ evidenceQuote: event.target.value })} rows={4} />
          </label>
          <label>
            Why it matters
            <textarea value={selectedStep.whyItMatters} onChange={(event) => onStepChange({ whyItMatters: event.target.value })} rows={4} />
          </label>
          <label>
            How to say it
            <textarea value={selectedStep.fitLanguage} onChange={(event) => onStepChange({ fitLanguage: event.target.value })} rows={4} />
          </label>
          <label>
            Caveat
            <textarea value={selectedStep.caveat} onChange={(event) => onStepChange({ caveat: event.target.value })} rows={3} />
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

function PreviewNotes({ walkthrough, onExport }: { walkthrough: OverlayWalkthroughModel | null; onExport: () => void }) {
  return (
    <div className="preview-notes">
      <h2>What will export</h2>
      <p>
        The exported file is a single offline HTML document with embedded CSS, JavaScript, and JSON data. The API key and builder draft controls are not included.
      </p>
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
      <aside className="artifact-resume">
        <article>
          <h2>{model.candidateName || "Resume"}</h2>
          <p>{model.candidateHeadline}</p>
          <h3>Resume source</h3>
          <div className="resume-source" dangerouslySetInnerHTML={{ __html: markEvidence(inputs.resumeText, selectedStep.evidenceQuote) }} />
          {inputs.aboutText && (
            <>
              <h3>Additional context</h3>
              <div className="resume-source" dangerouslySetInnerHTML={{ __html: markEvidence(inputs.aboutText, selectedStep.evidenceQuote) }} />
            </>
          )}
        </article>
      </aside>
      <section className="artifact-overlay">
        <header>
          <span>Resume Walkthrough</span>
          <strong>{model.targetTitle || "Target role"}</strong>
        </header>
        <article className="overlay-card">
          <div className="overlay-kicker">
            <span>{selectedStep.eyebrow}</span>
            <em>{selectedStep.confidence}</em>
          </div>
          <h2>{selectedStep.title}</h2>
          <p className="overlay-narrative">{selectedStep.narrative}</p>
          <div className="overlay-grid">
            <Insight title="Source evidence" body={selectedStep.evidenceQuote} variant="quote" />
            <Insight title="Why it matters" body={selectedStep.whyItMatters} />
            <Insight title="How this maps to the role" body={selectedStep.fitLanguage} />
            <Insight title="Caveat" body={selectedStep.caveat} variant="caveat" />
          </div>
        </article>
        <nav className="artifact-dots">
          {model.steps.map((step, index) => (
            <button key={step.id} type="button" className={step.id === selectedStep.id ? "active" : ""} onClick={() => onSelectStep(step.id)}>
              {index + 1}
            </button>
          ))}
        </nav>
      </section>
    </div>
  );
}

function Insight({ title, body, variant = "" }: { title: string; body: string; variant?: string }) {
  return (
    <div className={`artifact-insight ${variant}`}>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function loadState(): StudioState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const savedKey = localStorage.getItem(KEY_STORAGE_KEY) || "";
    if (!saved) return { ...emptyState, apiKey: savedKey, saveKey: Boolean(savedKey) };
    const parsed = JSON.parse(saved) as Partial<StudioState>;
    return {
      ...emptyState,
      ...parsed,
      apiKey: savedKey,
      saveKey: Boolean(savedKey),
      inputs: { ...emptyInputs, ...(parsed.inputs ?? {}) },
      isGenerating: false,
      isRevising: false,
      error: ""
    };
  } catch {
    return emptyState;
  }
}

function createManualWalkthrough(step: OverlayStep): OverlayWalkthroughModel {
  return {
    candidateName: "",
    candidateHeadline: "",
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

function markEvidence(text: string, quote: string): string {
  const source = escapeHtml(text || "");
  const needle = quote.trim();
  if (!needle || needle === "Needs source evidence") return source;
  return source.replace(escapeHtml(needle), `<mark>${escapeHtml(needle)}</mark>`);
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
