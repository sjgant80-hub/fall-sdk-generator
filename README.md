# fall-sdk-generator

**fall-kit template forge for the AI-Native Solutions estate.**
Consumes the `foldkit-sdk` + `foldkit-mcp` exemplars, fills their shape for any estate tool. Runs on the estate's shared cascade — pick T0 (off), T2 (WebLLM), or T3 (BYOK) at run time.

Live: https://sjgant80-hub.github.io/fall-sdk-generator/

## What it does

Two exemplar repos define the shape of every SDK and every MCP server in the estate:

- **foldkit-sdk** — canonical SDK layout: `src/index.js`, `src/index.d.ts`, `package.json`, `README.md`, `examples/quick-start.mjs`, `.github/workflows/publish.yml`
- **foldkit-mcp** — canonical MCP server layout: `src/server.js`, `src/tools.js`, `src/resources.js`, `package.json`, `manifest.json`, `README.md`, `.github/workflows/publish.yml`

fall-sdk-generator loads both exemplars, picks a target estate tool (either by repo name or pasted source), and asks the fall-kit cascade to fill the exemplar shape for that target. Output arrives as two downloadable zip files ready to `git init && gh repo create`.

Batch mode takes a list of repo names and runs the whole pipeline for each.

## Substrate: fall-kit

This is an **fall-kit consumer**, not a WebLLM standalone. The cascade tier is picked by the user in the wizard's step 1 and takes effect at run time:

| Tier | What it is | When to use |
|------|------------|-------------|
| **T0** · off | No AI. Mechanical template rename only. Always works. | Fast bulk generation where you'll polish the output by hand anyway. |
| **T2** · WebLLM | 1B (700MB) · 3B (2GB, default) · 7B (5GB) · 8B (5GB) · 70B (40GB) in-browser via `@mlc-ai/web-llm`. One-time download, then sovereign. | You want AI-fill without paying provider tokens. |
| **T3** · BYOK | Anthropic Claude / OpenAI / Google Gemini. Key stored in your browser, sent direct. | You want frontier quality and are OK spending tokens. |

`FallKit.aiComplete(sys, msg, maxTokens)` returns `string | null` — a `null` return means T0 (or the current tier is unconfigured), and the generator falls back to mechanical template rename. This is the doctrine: **T0 fallback always works.**

### Note on temperature

fall-kit's `aiComplete` picks provider-sane defaults and does not expose a temperature knob. The original single-purpose generator ran WebLLM at `temperature=0.15` for max determinism on template-fill. If you need that precise control, call the engine directly via `FallKit.state.ai.engine.chat.completions.create({...})` — but expect the estate to move toward the shared `aiComplete` signature over time.

## Alternate estate cascades

fall-kit is the default because it's the smallest, sovereignty-first substrate. If your use case has different demands, the estate ships other cascade shapes:

- **[fallcompass](https://github.com/sjgant80-hub/fallcompass)** — LLM cascade shim across 8 providers with automatic fallback and cost routing. Use when you want provider redundancy.
- **[fall-mcp-bridge](https://github.com/sjgant80-hub/fall-mcp-bridge)** — uniform MCP wrapping around any LLM, 8 adapters. Use when downstream is an agent framework.
- **[fallcore](https://github.com/sjgant80-hub/fallcore)** — Anthropic-compatible local proxy. Use when you want a `messages` endpoint that speaks Anthropic's shape backed by anything.

To swap the substrate: replace the `<script src="fall-kit.js">` include and re-target the `this.kit.aiComplete(...)` call in `generator.js`. The rest of the pipeline (exemplar fetch, prompt build, JSON extract, zip pack, fallback synth) is substrate-neutral.

## Why not direct WebLLM

The earlier build imported `@mlc-ai/web-llm` directly. This left every estate seed reinventing the tier picker, the model registry, the settings UI, and the graceful-degrade path. fall-kit centralises all of that so one refactor updates the cascade for every consumer.

The Gospel: **Grep estate first · never reinvent.** Simon flagged that fall-kit already existed. This is that fix.

## Hardware requirements

Depends on the tier you pick:

- **T0** — nothing. Just a browser.
- **T2 1B/3B** — modest laptop / any modern phone with GPU. ~700MB–2GB one-time download.
- **T2 7B/8B** — 4GB+ VRAM (Chrome/Edge with WebGPU). ~5GB download.
- **T2 70B** — serious GPU + 64GB+ RAM. ~40GB download.
- **T3** — bring your own key. Any device.

## How to use

1. Open the live URL.
2. **Configure cascade** — click *open cascade settings*, pick T0 / T2 / T3. If T2, optionally *preload T2 model* now so step 5 doesn't stall.
3. **Load exemplars** — fetches `foldkit-sdk` + `foldkit-mcp` raw files. Preview shown.
4. **Choose input:**
   - **repo mode** — paste a `sjgant80-hub/<name>` repo name, it fetches the tool source
   - **paste mode** — paste name and source directly
   - **queue mode** — paste a list of repo names, one per line, for batch generation
5. **Configure** — optional GitHub token for private repos, T2 model choice, skip-if-exists toggle.
6. **Generate SDK** — the current tier fills files via `FallKit.aiComplete`. T0 falls straight to mechanical rename.
7. **Generate MCP** — same for the MCP server companion.
8. **Download bundle** — two zip files, `<name>-sdk.zip` and `<name>-mcp.zip`.
9. **Push instructions** — shell block ready to unzip, `gh repo create`, enable Pages, tag v1.0.0.

## Honest limits

- **Review before pushing.** T2 Llama and T3 frontier models are competent at template fill but never perfect. Review `src/index.js` before publishing.
- **Malformed JSON happens on smaller models.** The generator has robust JSON extraction with retry (up to 3 attempts) and a final fallback that renames the exemplar template deterministically. If AI fails cleanly, you still get a shape-correct starting point.
- **Complex tools may need re-runs.** Very large source files (>6000 chars) get truncated in the prompt. For complex targets, run twice and diff. Or split the tool.
- **Not a substitute for judgment.** This tool automates the *shape*. Naming, semantics, README voice, and API design are still your call. Edit before you ship.

## Files

- `index.html` — 8-step wizard, single file
- `fall-kit.js` — inlined substrate (v1.2.0, MIT, from sjgant80-hub/fall-kit)
- `generator.js` — exemplar fetch, prompt build, JSON extraction, STORE-method zip builder, T0 fallback synth
- `manifest.webmanifest` — PWA manifest
- `sw.js` — service worker for offline shell caching
- `.nojekyll` — GitHub Pages plain-static hint

## License

MIT · AI-Native Solutions · 2026
