/**
 * Build a heading-level chunked JSONL corpus for the provided Tauri docs.
 *
 * Usage:
 *   1. Put all your .mdx (and .ts if desired) source files into ./raw/
 *      (filenames should match those you supplied: e.g. calling-rust.mdx).
 *   2. npx tsx build_corpus.ts   (or ts-node, or compile with tsc)
 *   3. Outputs:
 *        - docs_corpus.jsonl
 *        - permissions_index.json
 *        - config_keys_index.json
 *        - commands_index.json
 *
 * Chunk Object Fields (per earlier spec):
 *  {
 *    id: string;                 // doc_id + '#' + local_anchor (lowercase kebab)
 *    doc_id: string;             // filename without extension
 *    section_title: string;      // heading title or "Introduction"
 *    doc_title: string;          // from frontmatter
 *    hierarchy: string[];        // heading path
 *    content: string;            // cleaned markdown
 *    tokens_est: number;         // heuristic token estimate
 *    tags: string[];             // derived taxonomy tags
 *    src_path: string;           // original relative path
 *    anchors: string[];          // anchors inside this chunk
 *    code_languages: string[];   // detected fenced code langs
 *    version: string | null;     // naive detection (e.g. '2.0')
 *    permissions: string[];      // permission identifiers found
 *    config_keys: string[];      // tauri.conf.json dotted keys found
 *    commands: string[];         // #[tauri::command] names or JS invoke ids
 *    plugins: string[];          // mentioned plugin names
 *    updated_at: string;         // generation timestamp
 *    raw_frontmatter?: string;   // (only on first intro chunk of a doc)
 *    part_index?: number;        // if a large code block split
 *    part_total?: number;
 *  }
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

const RAW_DIR = path.join(process.cwd(), 'raw');
const OUT_JSONL = path.join(process.cwd(), 'docs_corpus.jsonl');
const PERMISSIONS_OUT = path.join(process.cwd(), 'permissions_index.json');
const CONFIG_KEYS_OUT = path.join(process.cwd(), 'config_keys_index.json');
const COMMANDS_OUT = path.join(process.cwd(), 'commands_index.json');

interface Chunk {
  id: string;
  doc_id: string;
  section_title: string;
  doc_title: string;
  hierarchy: string[];
  content: string;
  tokens_est: number;
  tags: string[];
  src_path: string;
  anchors: string[];
  code_languages: string[];
  version: string | null;
  permissions: string[];
  config_keys: string[];
  commands: string[];
  plugins: string[];
  updated_at: string;
  raw_frontmatter?: string;
  part_index?: number;
  part_total?: number;
}

// --- Helpers -------------------------------------------------

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
function parseFrontmatter(src: string): { frontmatter: string | null; body: string; title?: string } {
  const m = src.match(FRONTMATTER_RE);
  if (!m) return { frontmatter: null, body: src };
  const fm = m[1];
  let title: string | undefined;
  const titleLine = fm.split('\n').find(l => l.trim().startsWith('title:'));
  if (titleLine) title = titleLine.replace(/^title:\s*/, '').trim().replace(/^['"]|['"]$/g, '');
  return { frontmatter: fm, body: src.slice(m[0].length), title };
}

interface Heading {
  line: number;
  level: number;
  text: string;
  anchor: string;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[`~!@#$%^&*()+=<>{}\[\]|\\:;"',.?/]+/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function extractHeadings(md: string): Heading[] {
  const lines = md.split('\n');
  const heads: Heading[] = [];
  lines.forEach((line, i) => {
    const m = line.match(/^(#{2,6})\s+(.+)/); // start at ## for chunking (keep # doc title implicit)
    if (m) {
      const level = m[1].length;
      const text = m[2].trim().replace(/\s+#+\s*$/, '');
      heads.push({ line: i, level, text, anchor: slugify(text) });
    }
  });
  return heads;
}

// Admonitions normalization (:::note etc.)
function normalizeAdmonitions(md: string) {
  return md
    .replace(/:::(note|tip|caution|danger)(\[[^\]]*\])?/gi, (full, kind) => {
      return `\n[${kind.toUpperCase()}]\n`;
    });
}

// Remove MDX imports and component tags (simple heuristic)
function stripMdxArtifacts(md: string) {
  return md
    .replace(/^\s*import .*?;\s*$/gm, '')
    .replace(/<(?:Steps|TabItem|Tabs|ShowSolution|Cta|CTA|CommandTabs|Image)[^>]*>/g, '')
    .replace(/<\/(?:Steps|TabItem|Tabs|ShowSolution|Cta|CTA|CommandTabs|Image)>/g, '');
}

// Permission / config / plugin extraction
const PERMISSION_PATTERN = /\b(?:core:[a-z0-9:_-]+|[a-z0-9_-]+:allow-[a-z0-9:_-]+|[a-z0-9_-]+:deny-[a-z0-9:_-]+)\b/g;
const CONFIG_KEY_PATTERN = /\b(?:bundle|build|app|plugins|windows?|identifier|productName|devUrl|frontendDist)(?:\.[a-zA-Z0-9_-]+)+/g;
const COMMAND_ATTR_RE = /^#[ \t]*tauri::command(?:\([^)]+\))?/m;
const RUST_FN_NAME_RE = /#[ \t]*tauri::command[^\n]*\n(?:pub\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)/g;
const JS_INVOKE_RE = /invoke\(['"`]([^'"`]+)['"`]/g;
const CHANNEL_TYPE_RE = /\bChannel<([A-Za-z0-9_<>:&\[\]]+)>/g;
const PLUGIN_HINTS = [
  'fs', 'shell', 'dialog', 'http', 'cli', 'updater', 'global-shortcut', 'clipboard', 'notification', 'process', 'os', 'tray'
];

function estimateTokens(s: string) {
  // Rough heuristic: 1 token ≈ 4 chars
  return Math.round(s.length / 4);
}

function detectCodeLangs(md: string) {
  const langs = new Set<string>();
  md.replace(/```([a-zA-Z0-9_-]+)?/g, (_, l) => {
    if (l) langs.add(l.toLowerCase());
    return '';
  });
  return [...langs];
}

function deriveTags(doc_id: string, doc_title: string, content: string): string[] {
  const tags = new Set<string>();
  const t = (s: string) => s.toLowerCase();
  const lower = content.toLowerCase();

  const addIf = (cond: boolean, tag: string) => cond && tags.add(tag);

  // coarse categories
  addIf(/command(s)?\b/.test(lower), 'commands');
  addIf(/event system|emit\(|emit_to|listen\b/.test(lower), 'ipc');
  addIf(/permission|capabilit/.test(lower), 'permissions');
  addIf(/migration|upgrade/.test(lower), 'migration');
  addIf(/window|titlebar/.test(lower), 'windowing');
  addIf(/state|mutex|manage\(/.test(lower), 'state');
  addIf(/sidecar|external binary/.test(lower), 'sidecar');
  addIf(/vite/.test(lower), 'tooling');
  addIf(/android|ios/.test(lower), 'mobile');
  addIf(/system tray|trayicon|tray icon/.test(lower), 'tray');
  addIf(/icon\.icns|png|ico/.test(lower), 'assets');
  addIf(/resource(s)?/.test(lower), 'resources');
  addIf(/debug|debugging|lldb/.test(lower), 'debugging');
  addIf(/env(ironment)? variable/.test(lower), 'config');
  addIf(/cargo\.toml|package\.json|tauri\.conf/.test(lower), 'configuration');
  addIf(/channel<|Channel</.test(content), 'streaming');

  // doc-based explicit map
  const explicit: Record<string, string[]> = {
    'calling-rust': ['ipc', 'commands'],
    'calling-frontend': ['ipc', 'events'],
    'project-structure': ['setup'],
    'create-project': ['setup'],
    'prerequisites': ['setup'],
    'configuration-files': ['configuration'],
    'migrate-from-tauri-1': ['migration'],
    'migrate-from-tauri-2-beta': ['migration'],
    'writing-plugin-permissions': ['permissions', 'plugins'],
    'using-plugin-permissions': ['permissions', 'plugins'],
    'core-permissions': ['permissions'],
    'state-management': ['state'],
    'window-customization': ['windowing'],
    'system-tray': ['tray', 'windowing'],
    'sidecar-nodejs': ['sidecar'],
    'sidecar': ['sidecar'],
    'resources': ['resources'],
    'splashscreen': ['windowing', 'ux'],
    'vite': ['tooling', 'configuration'],
    'icons': ['assets'],
    'develop': ['dev'],
    'environment-variables': ['configuration'],
  };
  if (explicit[doc_id]) explicit[doc_id].forEach(tg => tags.add(tg));

  // language presence
  detectCodeLangs(content).forEach(l => tags.add(`lang:${l}`));
  if (/```/.test(content)) tags.add('has_code');

  return [...tags];
}

function extractVersion(md: string): string | null {
  const m = md.match(/\btauri[ @-]*v?([0-9]+\.[0-9]+(\.[0-9]+)?)/i);
  return m ? m[1].split('.').slice(0,2).join('.') : null;
}

// Chunk assembly
function buildChunks(doc_id: string, doc_title: string, src_path: string, body: string, raw_frontmatter: string | null): Chunk[] {
  let cleaned = stripMdxArtifacts(normalizeAdmonitions(body));
  // Normalize blank lines
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');

  const headings = extractHeadings(cleaned);
  const lines = cleaned.split('\n');

  type RawChunk = { start: number; end: number; heading?: Heading };
  const rawChunks: RawChunk[] = [];

  if (headings.length === 0) {
    rawChunks.push({ start: 0, end: lines.length });
  } else {
    // Intro before first heading
    if (headings[0].line > 0) rawChunks.push({ start: 0, end: headings[0].line });

    // Each heading to next heading
    headings.forEach((h, idx) => {
      const end = idx < headings.length - 1 ? headings[idx + 1].line : lines.length;
      rawChunks.push({ start: h.line, end, heading: h });
    });
  }

  const now = new Date().toISOString();
  const chunks: Chunk[] = [];
  const seenAnchors = new Set<string>();

  rawChunks.forEach((rc, i) => {
    const slice = lines.slice(rc.start, rc.end).join('\n').trim();
    if (!slice) return;

    const heading = rc.heading;
    const section_title = heading ? heading.text : 'Introduction';
    const anchorBase = heading ? heading.anchor : 'introduction';
    let anchor = anchorBase;
    let dupeCounter = 2;
    while (seenAnchors.has(anchor)) {
      anchor = `${anchorBase}-${dupeCounter++}`;
    }
    seenAnchors.add(anchor);

    // Hierarchy: derive from previous headings
    let hierarchy: string[] = [doc_title];
    if (heading) {
      // Build stack by scanning previous headings
      const prior = headings.filter(h => h.line <= heading.line);
      // maintain stack of levels
      const stack: Heading[] = [];
      prior.forEach(hh => {
        while (stack.length && stack[stack.length - 1].level >= hh.level) stack.pop();
        stack.push(hh);
      });
      hierarchy = [doc_title, ...stack.map(hh => hh.text)];
    }

    const permissions = Array.from(new Set(slice.match(PERMISSION_PATTERN) || [])).filter(p =>
      /[a-z]/.test(p)
    );
    const config_keys = Array.from(new Set(slice.match(CONFIG_KEY_PATTERN) || []));
    const commands = new Set<string>();
    // Rust commands
    let rm;
    while ((rm = RUST_FN_NAME_RE.exec(slice)) !== null) {
      commands.add(rm[1]);
    }
    // JS invokes
    let jm;
    while ((jm = JS_INVOKE_RE.exec(slice)) !== null) {
      commands.add(jm[1]);
    }

    const pluginsMentioned = PLUGIN_HINTS.filter(p => new RegExp(`\\b${p.replace('-', '\\-')}\\b`, 'i').test(slice));

    const code_languages = detectCodeLangs(slice);
    const tags = deriveTags(doc_id, doc_title, slice);
    const version = extractVersion(slice);
    const tokens_est = estimateTokens(slice);

    const chunk: Chunk = {
      id: `${doc_id}#${anchor}`,
      doc_id,
      section_title,
      doc_title,
      hierarchy,
      content: slice,
      tokens_est,
      tags,
      src_path,
      anchors: [anchor],
      code_languages,
      version,
      permissions,
      config_keys,
      commands: [...commands],
      plugins: pluginsMentioned,
      updated_at: now,
    };
    if (i === 0 && raw_frontmatter) chunk.raw_frontmatter = raw_frontmatter;
    chunks.push(chunk);
  });

  // Large code block splitting (optional minimal implementation):
  const MAX_TOKENS = 1200;
  const finalChunks: Chunk[] = [];
  for (const c of chunks) {
    if (c.tokens_est <= MAX_TOKENS) {
      finalChunks.push(c);
      continue;
    }
    // naive split by code fence boundaries
    const parts = c.content.split(/(^```[^\n]*\n[\s\S]*?^```$)/m).filter(Boolean);
    let acc: string[] = [];
    let accumTokens = 0;
    const pieces: string[] = [];
    const flush = () => {
      if (!acc.length) return;
      pieces.push(acc.join('').trim());
      acc = [];
      accumTokens = 0;
    };
    for (const p of parts) {
      const t = estimateTokens(p);
      if (accumTokens + t > MAX_TOKENS && acc.length) {
        flush();
      }
      acc.push(p);
      accumTokens += t;
    }
    flush();
    pieces.forEach((p, idx) => {
      finalChunks.push({
        ...c,
        id: `${c.id}-part-${idx + 1}`,
        content: p,
        tokens_est: estimateTokens(p),
        part_index: idx + 1,
        part_total: pieces.length,
        raw_frontmatter: idx === 0 ? c.raw_frontmatter : undefined,
      });
    });
  }

  return finalChunks;
}

// Derived indexes
const permissionsIndex: Record<string, { doc_id: string; section_id: string; description?: string }> = {};
const configKeysIndex: Record<string, { doc_id: string; section_id: string }> = {};
const commandsIndex: Record<string, { doc_id: string; section_id: string }> = {};

// --- Main ----------------------------------------------------
function main() {
  const files = readdirSync(RAW_DIR).filter(f => /\.(mdx?|md|ts)$/.test(f));
  const allChunks: Chunk[] = [];

  for (const file of files) {
    const full = readFileSync(path.join(RAW_DIR, file), 'utf-8');
    const { frontmatter, body, title } = parseFrontmatter(full);
    const doc_id = path.basename(file).replace(/\.(mdx?|ts)$/, '').toLowerCase();
    const doc_title = title || doc_id;
    const chunks = buildChunks(doc_id, doc_title, file, body, frontmatter);
    allChunks.push(...chunks);
  }

  // Populate derived indexes
  for (const c of allChunks) {
    c.permissions.forEach(p => {
      if (!permissionsIndex[p]) {
        permissionsIndex[p] = { doc_id: c.doc_id, section_id: c.id };
      }
    });
    c.config_keys.forEach(k => {
      if (!configKeysIndex[k]) {
        configKeysIndex[k] = { doc_id: c.doc_id, section_id: c.id };
      }
    });
    c.commands.forEach(cmd => {
      if (!commandsIndex[cmd]) {
        commandsIndex[cmd] = { doc_id: c.doc_id, section_id: c.id };
      }
    });
  }

  // Write JSONL
  const lines = allChunks.map(c => JSON.stringify(c));
  writeFileSync(OUT_JSONL, lines.join('\n') + '\n', 'utf-8');
  writeFileSync(PERMISSIONS_OUT, JSON.stringify(permissionsIndex, null, 2), 'utf-8');
  writeFileSync(CONFIG_KEYS_OUT, JSON.stringify(configKeysIndex, null, 2), 'utf-8');
  writeFileSync(COMMANDS_OUT, JSON.stringify(commandsIndex, null, 2), 'utf-8');

  console.log(`Wrote ${allChunks.length} chunks to ${OUT_JSONL}`);
}

main();