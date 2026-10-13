#!/usr/bin/env node
/**
 * Generate Docusaurus diagram artifacts from the AIPA CALM architecture.
 *
 * 1. calm-cli docify → mermaid (block-architecture + flow sequences)
 * 2. Split into named .mmd sources under examples/aipa/calm/diagrams/
 * 3. Render SVG into static/img/calm/... (requires Chrome / Chromium)
 *
 * Usage:
 *   node scripts/generate-calm-diagrams.mjs
 *   node scripts/generate-calm-diagrams.mjs --skip-svg
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const ARCHITECTURE = join(root, 'examples/aipa/calm/architecture.json');
const TEMPLATE = join(root, 'examples/aipa/calm/templates/diagrams.md');
const MMD_DIR = join(root, 'examples/aipa/calm/diagrams');
const SVG_DIR = join(root, 'static/img/calm/ai-portfolio-assistant');

/** Heading title → artifact basename (must match templates/diagrams.md). */
const DIAGRAMS = [
  { title: 'Architecture Overview', basename: 'architecture-overview' },
  { title: 'Sensitive Intent Flow', basename: 'sensitive-intent-flow' },
  { title: 'Governed Chat Flow', basename: 'governed-chat-flow' },
  { title: 'In-firewall Inference Flow', basename: 'in-firewall-inference-flow' },
];

const skipSvg = process.argv.includes('--skip-svg');

function findChrome() {
  const env = process.env.CALM_DIAGRAM_BROWSER || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (env && existsSync(env)) return env;

  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  return candidates.find((p) => existsSync(p));
}

function runDocify(outDir) {
  const args = [
    '@finos/calm-cli',
    'docify',
    '-a',
    ARCHITECTURE,
    '-t',
    TEMPLATE,
    '-o',
    outDir,
    '--clear-output-directory',
  ];
  execFileSync('npx', args, { cwd: root, stdio: 'inherit' });
  return join(outDir, 'output.md');
}

function splitMermaid(outputMd) {
  const text = readFileSync(outputMd, 'utf8');
  const titles = [...text.matchAll(/^# (.+)$/gm)].map((m) => m[1].trim());
  const blocks = [...text.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((m) =>
    m[1].trim(),
  );

  if (blocks.length === 0) {
    throw new Error(`No mermaid blocks found in ${outputMd}`);
  }

  mkdirSync(MMD_DIR, { recursive: true });
  const written = [];

  for (const def of DIAGRAMS) {
    const idx = titles.indexOf(def.title);
    if (idx < 0 || !blocks[idx]) {
      throw new Error(
        `Expected heading "# ${def.title}" with a mermaid block in docify output`,
      );
    }
    const mmdPath = join(MMD_DIR, `${def.basename}.mmd`);
    writeFileSync(mmdPath, `${blocks[idx]}\n`);
    written.push({ ...def, mmdPath });
    console.log(`wrote ${mmdPath}`);
  }

  // Keep the combined docify markdown for debugging / re-docify diffs.
  writeFileSync(join(MMD_DIR, 'docify-output.md'), text);
  return written;
}

function renderSvgs(diagrams) {
  const chrome = findChrome();
  if (!chrome) {
    console.warn(
      'No Chrome/Chromium found; skipping SVG render. Set CALM_DIAGRAM_BROWSER or install Chrome.',
    );
    return false;
  }

  mkdirSync(SVG_DIR, { recursive: true });
  const puppeteerConfig = join(tmpdir(), `calm-puppeteer-${process.pid}.json`);
  writeFileSync(
    puppeteerConfig,
    JSON.stringify(
      {
        executablePath: chrome,
        args: ['--no-sandbox', '--disable-gpu'],
      },
      null,
      2,
    ),
  );

  try {
    for (const d of diagrams) {
      const svgPath = join(SVG_DIR, `${d.basename}.svg`);
      execFileSync(
        'npx',
        [
          '@mermaid-js/mermaid-cli',
          '-i',
          d.mmdPath,
          '-o',
          svgPath,
          '-b',
          'transparent',
          '-p',
          puppeteerConfig,
        ],
        { cwd: root, stdio: 'inherit' },
      );
      console.log(`wrote ${svgPath}`);
    }
  } finally {
    rmSync(puppeteerConfig, { force: true });
  }
  return true;
}

function main() {
  if (!existsSync(ARCHITECTURE)) {
    throw new Error(`Missing architecture: ${ARCHITECTURE}`);
  }
  if (!existsSync(TEMPLATE)) {
    throw new Error(`Missing template: ${TEMPLATE}`);
  }

  const tmp = mkdtempSync(join(tmpdir(), 'calm-diagrams-'));
  try {
    console.log('Running calm-cli docify…');
    const outputMd = runDocify(tmp);
    const diagrams = splitMermaid(outputMd);

    if (skipSvg) {
      console.log('Skipping SVG (--skip-svg).');
      return;
    }

    console.log('Rendering SVG…');
    const ok = renderSvgs(diagrams);
    if (!ok) {
      process.exitCode = 2;
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

main();
