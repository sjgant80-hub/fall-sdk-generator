// fall-sdk-generator · WebLLM template forge · AI-Native Solutions · MIT
// Fills foldkit-sdk + foldkit-mcp exemplar shape for any estate tool.

import { CreateMLCEngine } from 'https://esm.run/@mlc-ai/web-llm';

const SDK_FILES = [
  'src/index.js',
  'src/index.d.ts',
  'package.json',
  'README.md',
  'examples/quick-start.mjs',
  '.github/workflows/publish.yml'
];
const MCP_FILES = [
  'src/server.js',
  'src/tools.js',
  'src/resources.js',
  'package.json',
  'manifest.json',
  'README.md',
  '.github/workflows/publish.yml'
];

async function ghRaw(owner, repo, path, token) {
  const h = token ? { Authorization: 'token ' + token } : {};
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;
  const r = await fetch(url, { headers: h });
  if (!r.ok) throw new Error(`raw ${repo}/${path} ${r.status}`);
  return await r.text();
}

async function ghRawSafe(owner, repo, path, token) {
  try { return await ghRaw(owner, repo, path, token); } catch { return null; }
}

async function findMainSource(owner, repo, token) {
  const candidates = [
    'src/index.js', 'src/main.js', 'src/server.js', 'src/index.mjs',
    'index.js', 'index.mjs', 'main.js', 'server.js',
    'lib/index.js', 'src/index.ts'
  ];
  for (const p of candidates) {
    const c = await ghRawSafe(owner, repo, p, token);
    if (c && c.length > 40) return { path: p, content: c };
  }
  const readme = await ghRawSafe(owner, repo, 'README.md', token);
  if (readme) return { path: 'README.md', content: readme };
  throw new Error('no source file found in ' + repo);
}

function extractJson(text) {
  // find outer {...}
  let start = text.indexOf('{');
  if (start < 0) throw new Error('no JSON object found');
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  throw new Error('unbalanced JSON braces');
}

function robustParse(text) {
  let raw;
  try { raw = extractJson(text); } catch (e) { throw new Error('extract: ' + e.message); }
  try { return JSON.parse(raw); }
  catch {
    // salvage: strip trailing commas
    const cleaned = raw.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(cleaned);
  }
}

function shapeSummary(template) {
  const out = {};
  for (const [p, content] of Object.entries(template)) {
    // compact each file so prompt stays under context; keep whole small files, snippet large ones
    if (content.length <= 1800) out[p] = content;
    else out[p] = content.slice(0, 900) + '\n// ...\n' + content.slice(-700);
  }
  return out;
}

function renameFoldkit(text, name) {
  if (!text) return text;
  return text
    .replaceAll('foldkit-sdk', `${name}-sdk`)
    .replaceAll('foldkit-mcp', `${name}-mcp`)
    .replaceAll('foldkit_', `${name.replace(/-/g, '_')}_`)
    .replaceAll('foldkit://', `${name}://`)
    .replaceAll('foldkit', name);
}

// ---- STORE-method inline zip (no compression) ----
// CRC32 table
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function encodeStr(s) { return new TextEncoder().encode(s); }
function u16(n) { return [n & 0xFF, (n >>> 8) & 0xFF]; }
function u32(n) { return [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]; }

function buildStoreZip(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [path, content] of Object.entries(files)) {
    const nameBytes = encodeStr(path);
    const data = encodeStr(content);
    const c = crc32(data);
    const size = data.length;
    // local file header
    const lfh = [
      ...u32(0x04034b50),      // signature
      ...u16(20),              // version
      ...u16(0),               // flags
      ...u16(0),               // method STORE
      ...u16(0),               // time
      ...u16(0x21),            // date (some valid date)
      ...u32(c),               // crc32
      ...u32(size),            // compressed size
      ...u32(size),            // uncompressed size
      ...u16(nameBytes.length),
      ...u16(0)                // extra
    ];
    parts.push(new Uint8Array(lfh));
    parts.push(nameBytes);
    parts.push(data);
    // central directory record
    const cdh = [
      ...u32(0x02014b50),
      ...u16(20),              // version made by
      ...u16(20),              // version needed
      ...u16(0),               // flags
      ...u16(0),               // method
      ...u16(0),               // time
      ...u16(0x21),            // date
      ...u32(c),
      ...u32(size),
      ...u32(size),
      ...u16(nameBytes.length),
      ...u16(0),               // extra
      ...u16(0),               // comment
      ...u16(0),               // disk
      ...u16(0),               // internal attr
      ...u32(0),               // external attr
      ...u32(offset)
    ];
    central.push(new Uint8Array(cdh));
    central.push(nameBytes);
    offset += lfh.length + nameBytes.length + data.length;
  }
  const centralStart = offset;
  let centralLen = 0;
  for (const p of central) centralLen += p.length;
  const eocd = new Uint8Array([
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(Object.keys(files).length),
    ...u16(Object.keys(files).length),
    ...u32(centralLen),
    ...u32(centralStart),
    ...u16(0)
  ]);
  return new Blob([...parts, ...central, eocd], { type: 'application/zip' });
}

// ---- Fallback synth (when Llama returns garbage on tiny models) ----
function synthSDK(name, source, template) {
  const files = {};
  for (const p of SDK_FILES) {
    if (template[p]) files[p] = renameFoldkit(template[p], name);
  }
  // patch package.json name
  try {
    const pkg = JSON.parse(files['package.json']);
    pkg.name = `@ai-native-solutions/${name}-sdk`;
    pkg.description = `SDK for ${name} · generated by fall-sdk-generator`;
    if (pkg.repository) pkg.repository.url = `https://github.com/sjgant80-hub/${name}-sdk.git`;
    pkg.homepage = `https://sjgant80-hub.github.io/${name}-sdk/`;
    files['package.json'] = JSON.stringify(pkg, null, 2);
  } catch {}
  // slim source-based index.js
  files['src/index.js'] = `// ${name} · SDK · AI-Native Solutions · MIT\n// generated by fall-sdk-generator (fallback synth)\n\n${source}\n`;
  return files;
}
function synthMCP(name, template) {
  const files = {};
  for (const p of MCP_FILES) {
    if (template[p]) files[p] = renameFoldkit(template[p], name);
  }
  try {
    const pkg = JSON.parse(files['package.json']);
    pkg.name = `@ai-native-solutions/${name}-mcp`;
    if (pkg.bin) pkg.bin = { [`${name}-mcp`]: 'src/server.js' };
    if (pkg.dependencies && pkg.dependencies['@ai-native-solutions/foldkit-sdk']) {
      delete pkg.dependencies['@ai-native-solutions/foldkit-sdk'];
      pkg.dependencies[`@ai-native-solutions/${name}-sdk`] = '^1.0.0';
    }
    files['package.json'] = JSON.stringify(pkg, null, 2);
  } catch {}
  return files;
}

export class SDKGenerator {
  constructor() { this.engine = null; this.modelId = null; }

  async loadEngine(modelId, progressCb) {
    this.modelId = modelId;
    this.engine = await CreateMLCEngine(modelId, {
      initProgressCallback: (r) => progressCb && progressCb({ progress: r.progress || 0, text: r.text || 'loading' })
    });
    return this.engine;
  }

  async loadExemplars() {
    const sdkTemplate = {};
    for (const f of SDK_FILES) {
      const c = await ghRawSafe('sjgant80-hub', 'foldkit-sdk', f);
      if (c) sdkTemplate[f] = c;
    }
    const mcpTemplate = {};
    for (const f of MCP_FILES) {
      const c = await ghRawSafe('sjgant80-hub', 'foldkit-mcp', f);
      if (c) mcpTemplate[f] = c;
    }
    if (!Object.keys(sdkTemplate).length) throw new Error('sdk exemplar empty');
    if (!Object.keys(mcpTemplate).length) throw new Error('mcp exemplar empty');
    return { sdkTemplate, mcpTemplate };
  }

  async fetchTool(repoName, token) {
    const src = await findMainSource('sjgant80-hub', repoName, token);
    const readme = await ghRawSafe('sjgant80-hub', repoName, 'README.md', token) || '';
    return { name: repoName, source: src.content, sourcePath: src.path, readme };
  }

  _buildPrompt(kind, target, template, targetFiles) {
    const shape = shapeSummary(template);
    const system = `You are a code generator. Given an EXEMPLAR REPO SHAPE and a TARGET TOOL SOURCE, generate the equivalent files for the target following the exemplar shape exactly. Output ONLY a single JSON object mapping file paths to file contents. No commentary. No markdown fences. Just the JSON object.`;
    const user = `EXEMPLAR SHAPE for foldkit-${kind}:
${JSON.stringify(shape, null, 2)}

TARGET TOOL: ${target.name}
TARGET SOURCE (${target.sourcePath || 'pasted'}):
${(target.source || '').slice(0, 6000)}

TARGET README:
${(target.readme || '').slice(0, 2000)}

Generate the ${target.name}-${kind} repo files matching EXEMPLAR shape. Rename all "foldkit" -> "${target.name}". Adapt the API surface to what TARGET SOURCE actually exports. Keep file structure, package.json shape, README format, and workflow YAML identical.

Output JSON with these keys ONLY: ${JSON.stringify(targetFiles)}
Return the JSON object now.`;
    return [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ];
  }

  async _streamGenerate(messages, progressCb) {
    let full = '';
    const chunks = await this.engine.chat.completions.create({
      messages,
      stream: true,
      temperature: 0.15,
      top_p: 0.9,
      seed: 42,
      max_tokens: 8192
    });
    let n = 0;
    for await (const c of chunks) {
      const d = c.choices?.[0]?.delta?.content || '';
      full += d;
      n++;
      if (progressCb && n % 6 === 0) progressCb({ type: 'chunk', pct: Math.min(90, full.length / 120) });
    }
    return full;
  }

  async _generate(kind, target, template, targetFiles, progressCb) {
    const MAX = 3;
    for (let i = 1; i <= MAX; i++) {
      try {
        progressCb && progressCb({ type: 'info', msg: `attempt ${i} · streaming` });
        const messages = this._buildPrompt(kind, target, template, targetFiles);
        const text = await this._streamGenerate(messages, progressCb);
        const parsed = robustParse(text);
        const files = {};
        for (const p of targetFiles) {
          if (typeof parsed[p] === 'string' && parsed[p].length > 20) {
            files[p] = parsed[p];
            progressCb && progressCb({ type: 'file', path: p, size: parsed[p].length });
          }
        }
        if (Object.keys(files).length >= Math.min(3, targetFiles.length)) {
          // patch any missing files from template rename
          for (const p of targetFiles) {
            if (!files[p] && template[p]) {
              files[p] = renameFoldkit(template[p], target.name);
              progressCb && progressCb({ type: 'file', path: p, size: files[p].length });
            }
          }
          return files;
        }
        progressCb && progressCb({ type: 'retry', n: i, reason: 'too few files parsed' });
      } catch (e) {
        progressCb && progressCb({ type: 'retry', n: i, reason: e.message });
      }
    }
    // fallback synth
    progressCb && progressCb({ type: 'info', msg: 'llama unstable · using template-rename fallback' });
    return kind === 'sdk'
      ? synthSDK(target.name, target.source || '', template)
      : synthMCP(target.name, template);
  }

  async generateSDK(target, sdkTemplate, progressCb) {
    return await this._generate('sdk', target, sdkTemplate, SDK_FILES, progressCb);
  }

  async generateMCP(target, mcpTemplate, progressCb) {
    return await this._generate('mcp', target, mcpTemplate, MCP_FILES, progressCb);
  }

  packageAsZip(files, name) {
    // include LICENSE
    const complete = {
      ...files,
      'LICENSE': `MIT License\n\nCopyright (c) 2026 AI-Native Solutions\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.\n`,
      '.nojekyll': ''
    };
    // prefix with name/ so unzip creates a folder
    const prefixed = {};
    for (const [p, c] of Object.entries(complete)) prefixed[`${name}/${p}`] = c;
    return buildStoreZip(prefixed);
  }
}
