# Resume Walkthrough Builder

A local studio for generating a polished overlay-style resume walkthrough.

The builder takes:

- real resume text
- free-form background/context about the candidate
- a job description, platform memo, or role description
- a resume design prompt
- a walkthrough technique prompt
- a continuity prompt for the step-by-step story

It uses an LLM to draft a guided walkthrough, lets you edit every step directly or by prompting, then exports one standalone HTML file that can be opened locally by double-clicking.

## Run

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

## LLM Generation

Choose OpenAI or Claude in the app and paste the matching API key. Keys are used by local Vite proxies so the browser can generate without adding a backend project.

- OpenAI proxy: `/api/openai-responses`
- Claude proxy: `/api/anthropic-messages`
- No API key is stored in source.
- The key is not included in exported HTML.
- If `Save key in this browser only` is checked, it is saved in localStorage on this machine.
- Model selection is a provider-aware dropdown of current high-quality model IDs.
- Claude options: `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`.
- OpenAI options: `gpt-5.5`, `gpt-5.5-pro`, `gpt-5.4`, `gpt-5.4-pro`, `gpt-5.4-mini`, `gpt-5.4-nano`.
- Verbosity controls how much detail the walkthrough uses.
- Resume design prompt controls the resume structure, density, hierarchy, and visual tone used by the full regeneration.
- Walkthrough technique prompt controls how the overlay teaches the resume, such as guided annotation, product tour, board memo, objection handling, or technical deep dive.
- Continuity prompt gives the LLM a throughline to maintain across steps.

## Workflow

1. Paste the actual resume.
2. Paste any other free-form context about the candidate.
3. Paste the target role or platform description.
4. Choose provider and verbosity, then write the resume design, walkthrough technique, and continuity prompts.
5. Generate or regenerate everything.
6. Edit the polished resume and each overlay step directly.
7. Prompt the LLM to revise a selected step, or use Regenerate everything to rebuild the polished resume and full tour.
8. Preview the exact overlay experience.
9. Export one standalone HTML file.

## Export

The exported HTML includes:

- embedded CSS
- embedded JavaScript
- embedded structured JSON data
- the supplied resume/context needed for the walkthrough
- standard resume-first opening
- two resume versions: the starting pasted resume first, then the generated polished resume
- automatic guided overlay reveal after 3 seconds
- highlighted text inside the generated resume, with source evidence kept separately
- slightly dimmed non-focused resume text during the tour
- fit brief mode
- print CSS
- a subtle note that the file was built with a custom resume tool in under a day

The exported file has no external JS, no external CSS, no CDN dependency, no backend calls, and no API calls.

## Credibility Rules

The prompt and schema are designed to keep the walkthrough grounded:

- no invented employers, dates, degrees, projects, metrics, technologies, titles, funding, or outcomes
- every step has a source evidence quote or is marked as needing source evidence
- inferred relevance must be phrased as relevance, not confirmed experience
- caveats stay visible
- every generated field is editable before export
