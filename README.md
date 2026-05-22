# Resume Walkthrough Builder

A local studio for generating a polished overlay-style resume walkthrough.

The builder takes:

- real resume text
- free-form background/context about the candidate
- a job description, platform memo, or role description
- a preselected resume design template
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

Choose OpenAI or Claude in the app and paste the matching API key. Keys are sent through the local/hosted app proxy so the browser can generate without exposing provider calls directly to CORS.

- OpenAI proxy: `/api/openai-responses`
- Claude proxy: `/api/anthropic-messages`
- No API key is stored in source.
- The key is not included in exported HTML.
- If `Save key in this browser only` is checked, it is saved in localStorage on this machine.
- Model selection is a provider-aware dropdown of current high-quality model IDs.
- Builder updates automatically invalidate stale generated walkthroughs. Pasted inputs and saved local keys are kept, so a browser hard refresh should not be needed after code/schema changes.
- Claude options: `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`.
- OpenAI options: `gpt-5.5`, `gpt-5.5-pro`, `gpt-5.4`, `gpt-5.4-pro`, `gpt-5.4-mini`, `gpt-5.4-nano`.
- Resume detail controls the density of the generated resume.
- Walkthrough depth controls how much explanation appears in the guided overlay.
- Resume template controls the visual and structural starting point: Executive Briefing, Modern Classic, Technical Leader, Founder Operator, or Board Memo.
- Resume design prompt controls the resume structure, density, hierarchy, and visual tone used by the full regeneration.
- Walkthrough technique prompt controls how the overlay makes the hiring case, such as guided annotation, board memo, objection handling, founder pitch, recruiter skim, or technical deep dive.
- Continuity prompt gives the LLM a throughline to maintain across steps.
- Output-only prompt sends the complete standalone HTML file to the LLM and stores the returned HTML as the preview/export artifact.
- Output polishing can directly change CSS, layout, markup, JavaScript behavior, color palette, highlight styling, panel structure, mobile behavior, and copy inside the final file.

## Workflow

1. Paste the actual resume.
2. Paste any other free-form context about the candidate.
3. Paste the target role or platform description.
4. Choose provider, resume template, resume detail, and walkthrough depth, then write any extra design or technique prompts.
5. Generate or regenerate everything.
6. Edit the polished resume and each overlay step directly.
7. Prompt the LLM to revise a selected step, or use Regenerate everything to rebuild the polished resume and full tour.
8. Use the Output screen to apply saved export-only polish prompts directly to the generated standalone HTML.
9. Preview the exact overlay experience.
10. Export one standalone HTML file.

## Export

The exported HTML includes:

- embedded CSS
- embedded JavaScript
- embedded structured JSON data
- the supplied resume/context needed for the walkthrough
- standard resume-first opening
- two resume versions: the starting pasted resume first, then the generated polished resume
- a prompt after 3 seconds that opens the guided overlay
- highlighted text inside the generated resume, with source evidence kept separately
- slightly dimmed non-focused resume text during the tour
- desktop sticky walkthrough rail
- mobile 50/50 stacked resume and walkthrough panes
- fit brief mode
- print CSS

The exported file has no external JS, no external CSS, no CDN dependency, no backend calls, and no API calls.

## Render Deployment

This repo includes a Render web service blueprint. It builds the Vite app and serves it through `server.mjs`, which requires magic-link login before serving the app or AI proxy routes.

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Magic links expire after 15 minutes.
- Browser login cookies are signed and last 45 days by default, so deploys and restarts do not force a fresh login.
- Set `COOKIE_SECRET` in deployment secrets to keep signed cookies stable if email provider keys rotate.
- Successful logins send a notification email to `LOGIN_NOTIFY_TO`.
- Email delivery uses `RESEND_API_KEY` or `SENDGRID_API_KEY`.
- Set `MAGIC_LINK_FROM` to a verified sender for the selected email provider.
- Set `PUBLIC_APP_URL` to the deployed Render URL so links point to the live app.
- Authenticated editing sessions are backed up through `/api/work-session` while someone works on a resume.
- On login, the app tries to reload the same project session and falls back to the latest saved session for that email when the browser is new.
- Server-side work-session backups strip provider API keys before writing.
- Render stays stateless. Durable session backup uses S3-compatible object storage configured with `SESSION_S3_BUCKET`, `SESSION_S3_PREFIX`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY`.
- Without S3 settings, local development writes backups under `./data`; Render returns a clear storage-configuration error instead of pretending the session was saved.

## Credibility Rules

The prompt and schema are designed to keep the walkthrough grounded:

- no invented employers, dates, degrees, projects, metrics, technologies, titles, funding, or outcomes
- every step has a source evidence quote or is marked as needing source evidence
- inferred relevance must be phrased as relevance, not confirmed experience
- caveats stay visible
- every generated field is editable before export
