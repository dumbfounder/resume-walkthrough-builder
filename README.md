# Resume Walkthrough Builder

A local studio for generating a polished overlay-style resume walkthrough.

The builder takes:

- real resume text
- free-form background/context about the candidate
- a job description, platform memo, or role description
- optional direction about the resume's look and feel
- optional direction about walkthrough tone and emphasis

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
- The default model is editable.
- Verbosity controls how much detail the walkthrough uses.
- Resume polish controls whether the input resume gets light cleanup, an executive rewrite, or a technical rewrite.
- Resume look-and-feel direction controls the resume structure, density, hierarchy, and visual tone used by the full regeneration.

## Workflow

1. Paste the actual resume.
2. Paste any other free-form context about the candidate.
3. Paste the target role or platform description.
4. Choose provider, verbosity, resume polish level, and resume look-and-feel direction.
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
- automatic guided overlay reveal after 3 seconds
- highlighted source text inside the resume
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
