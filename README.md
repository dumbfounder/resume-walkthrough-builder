# Resume Walkthrough Builder

A local studio for generating a polished overlay-style resume walkthrough.

The builder takes:

- real resume text
- free-form background/context about the candidate
- a job description, platform memo, or role description
- optional direction about tone and emphasis

It uses an LLM to draft a guided walkthrough, lets you edit every step directly or by prompting, then exports one standalone HTML file that can be opened locally by double-clicking.

## Run

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

## LLM Generation

Paste an OpenAI API key in the app. The key is used by a local Vite proxy at `/api/openai-responses` so the browser can generate via the Responses API without adding a backend project.

- No API key is stored in source.
- The key is not included in exported HTML.
- If `Save key in this browser only` is checked, it is saved in localStorage on this machine.
- The default model is editable.

## Workflow

1. Paste the actual resume.
2. Paste any other free-form context about the candidate.
3. Paste the target role or platform description.
4. Add direction for the walkthrough.
5. Generate.
6. Edit each overlay step directly.
7. Or prompt the LLM to revise a selected step.
8. Preview the exact overlay experience.
9. Export one standalone HTML file.

## Export

The exported HTML includes:

- embedded CSS
- embedded JavaScript
- embedded structured JSON data
- the supplied resume/context needed for the walkthrough
- guided overlay mode
- fit brief mode
- print CSS

The exported file has no external JS, no external CSS, no CDN dependency, no backend calls, and no API calls.

## Credibility Rules

The prompt and schema are designed to keep the walkthrough grounded:

- no invented employers, dates, degrees, projects, metrics, technologies, titles, funding, or outcomes
- every step has a source evidence quote or is marked as needing source evidence
- inferred relevance must be phrased as relevance, not confirmed experience
- caveats stay visible
- every generated field is editable before export
