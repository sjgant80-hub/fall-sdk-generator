# fall-sdk-generator

**WebLLM template forge for the AI-Native Solutions estate.**
Consumes the `foldkit-sdk` + `foldkit-mcp` exemplars, fills their shape for any estate tool. Zero Claude tokens per repo.

Live: https://sjgant80-hub.github.io/fall-sdk-generator/

## What it does

Two exemplar repos define the shape of every SDK and every MCP server in the estate:

- **foldkit-sdk** — canonical SDK layout: `src/index.js`, `src/index.d.ts`, `package.json`, `README.md`, `examples/quick-start.mjs`, `.github/workflows/publish.yml`
- **foldkit-mcp** — canonical MCP server layout: `src/server.js`, `src/tools.js`, `src/resources.js`, `package.json`, `manifest.json`, `README.md`, `.github/workflows/publish.yml`

fall-sdk-generator loads both exemplars, picks a target estate tool (either by repo name or pasted source), and asks a Llama 3.1 8B model running in your browser to fill the exemplar shape for that target. Output arrives as two downloadable zip files ready to `git init && gh repo create`.

Batch mode takes a list of repo names and runs the whole pipeline for each.

## Why WebLLM instead of Claude

Template-fill is a mechanical transformation: take an exemplar structure, rename identifiers, adapt exported symbols to what the target exports. A local Llama 3.1 8B is more than good enough for that job — and every repo processed locally is Anthropic tokens saved.

The estate has 296 repos. Two companions per repo (`-sdk` and `-mcp`) means ~592 generation runs. Sending each of those to Claude would burn a huge budget on work Llama can do in the browser. This is the **WebLLM first · Claude for judgment** gospel applied at estate scale.

Claude stays reserved for planning, judgment, multi-step orchestration, and anything where output quality actually matters more than throughput.

## Hardware requirements

- **GPU with ~4GB VRAM** — Llama 3.1 8B q4f32 quantised
- **~4GB one-time download** — cached in IndexedDB after first load
- **Chrome / Edge with WebGPU** — Firefox WebGPU is behind a flag

Smaller model options in the wizard (Llama 3.2 3B / 1B) for weaker hardware, at the cost of accuracy.

## How to use

1. Open the live URL.
2. **Load engine** — pick a model, wait for the download (first time only).
3. **Load exemplars** — fetches `foldkit-sdk` + `foldkit-mcp` raw files. Preview shown.
4. **Choose input:**
   - **repo mode** — paste a `sjgant80-hub/<name>` repo name, it fetches the tool source
   - **paste mode** — paste name and source directly
   - **queue mode** — paste a list of repo names, one per line, for batch generation
5. **Configure** — optional GitHub token for private repos, model choice, skip-if-exists toggle.
6. **Generate SDK** — Llama streams filled files. Preview each inline.
7. **Generate MCP** — same for the MCP server companion.
8. **Download bundle** — two zip files, `<name>-sdk.zip` and `<name>-mcp.zip`.
9. **Push instructions** — shell block ready to unzip, `gh repo create`, enable Pages, tag v1.0.0.

## Honest limits

- **Review before pushing.** Llama is competent at template fill, but *always* review the generated code before publishing. Especially the `src/index.js` — that is where model errors compound.
- **Temperature must be low.** 0.15 is the ceiling. Higher, and Llama starts inventing API surface that the target tool does not expose.
- **Malformed JSON happens.** The generator has robust JSON extraction with retry (up to 3 attempts) and a final fallback that renames the exemplar template deterministically. If Llama fails cleanly, you still get a shape-correct starting point.
- **Complex tools may need re-runs.** Very large source files (>6000 chars) get truncated in the prompt. For complex targets, run twice and diff. Or split the tool.
- **Not a substitute for judgment.** This tool automates the *shape*. Naming, semantics, README voice, and API design are still your call. Edit before you ship.

## Files

- `index.html` — 8-step wizard, single file, under 1200 lines
- `generator.js` — WebLLM invocation, JSON extraction, STORE-method zip builder, fallback synth
- `manifest.webmanifest` — PWA manifest
- `sw.js` — service worker for offline shell caching
- `.nojekyll` — GitHub Pages plain-static hint

## License

MIT · AI-Native Solutions · 2026
