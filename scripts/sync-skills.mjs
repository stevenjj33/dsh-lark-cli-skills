#!/usr/bin/env node
/**
 * Pull agent skills out of the local \`lark-cli\` binary into ./skills/.
 *
 * \`lark-cli skills\` only prints to stdout — it never writes files — so this
 * script walks the embedded skill tree and materialises it on disk. The
 * contents therefore always match whatever \`lark-cli\` version is installed.
 *
 * Usage:
 *   node scripts/sync-skills.mjs              # sync all skills except EXCLUDED
 *   node scripts/sync-skills.mjs --dry-run    # list what would be written
 *   node scripts/sync-skills.mjs --check      # exit 1 if the local copy is stale
 *
 * Environment:
 *   LARK_CLI   path to the lark-cli executable (default: resolved from PATH)
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = join(ROOT, 'skills');
const MANIFEST = join(ROOT, 'skills.manifest.json');

/** Skills deliberately left out of this package. */
const EXCLUDED = new Set([
  // lark-im is intentionally omitted: this package complements an IM bridge
  // (e.g. @xmanrui/dsh-im) rather than duplicating it. See README.
  'lark-im',
]);

/**
 * Text substitutions applied to every exported file.
 *
 * Skills link to each other as `../<skill>/SKILL.md`. When a linked skill is
 * excluded from this package, that link would 404 for the reader. Each rule
 * below replaces a dangling link with an inline note naming the CLI command
 * that still serves it, so the surrounding prose keeps reading correctly.
 */
const LINK_REWRITES = [
  {
    // lark-im is excluded on purpose (see EXCLUDED above).
    pattern: /\[lark-im\]\(\.\.\/lark-im\/SKILL\.md\)/g,
    replace: 'lark-im (not bundled here — read it with `lark-cli skills read lark-im`)',
  },
  {
    pattern: /\.\.\/lark-im\/SKILL\.md/g,
    replace: 'lark-im (not bundled here — read it with `lark-cli skills read lark-im`)',
  },
  // Reference-file links: [text](../../lark-im/references/x.md) and
  // [text](../lark-im/references/x.md). Keep the label, drop the dead target.
  {
    pattern: /\[([^\]]+)\]\((?:[.][.]\/)+lark-im\/references\/[^)]+\)/g,
    replace: '$1 (not bundled here — see `lark-cli skills list lark-im`)',
  },
  {
    pattern: /(?:[.][.]\/)+lark-im\/references\/[^\s)\]]+/g,
    replace: 'lark-im reference (not bundled here — see `lark-cli skills list lark-im`)',
  },
];

/** Apply every LINK_REWRITES rule to one file's text. */
function rewriteLinks(text) {
  let out = text;
  for (const rule of LINK_REWRITES) out = out.replace(rule.pattern, rule.replace);
  return out;
}

const LARK = process.env.LARK_CLI || 'lark-cli';
const argv = new Set(process.argv.slice(2));
const DRY_RUN = argv.has('--dry-run');
const CHECK = argv.has('--check');

/** Run a lark-cli subcommand and parse its JSON envelope. */
function larkJson(args) {
  const out = execFileSync(LARK, args, {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return JSON.parse(out);
}

/** Print a skill file's raw contents. */
function larkRead(path) {
  return execFileSync(LARK, ['skills', 'read', path], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

/** Recursively list every file under a skill path. */
function walk(path, acc = []) {
  const listing = larkJson(['skills', 'list', path]);
  for (const entry of listing.entries ?? []) {
    if (entry.is_dir) walk(entry.path, acc);
    else acc.push(entry.path);
  }
  return acc;
}

function main() {
  const version = execFileSync(LARK, ['--version'], { encoding: 'utf8' }).trim();
  const top = larkJson(['skills', 'list']);
  const all = top.skills.map((s) => s.name);
  const kept = all.filter((n) => !EXCLUDED.has(n));

  console.log(`lark-cli: ${version}`);
  console.log(`skills: ${all.length} total, ${kept.length} kept, ${EXCLUDED.size} excluded`);
  console.log(`excluded: ${[...EXCLUDED].join(', ') || '(none)'}`);

  // --check: compare against the committed manifest instead of writing.
  if (CHECK) {
    if (!existsSync(MANIFEST)) {
      console.error('stale: skills.manifest.json is missing');
      process.exit(1);
    }
    const prev = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    if (prev.larkCliVersion !== version || prev.skillCount !== kept.length) {
      console.error(
        `stale: manifest is ${prev.larkCliVersion}/${prev.skillCount}, local lark-cli is ${version}/${kept.length}`,
      );
      process.exit(1);
    }
    console.log('up to date');
    return;
  }

  if (DRY_RUN) {
    for (const name of kept) {
      const files = walk(name);
      console.log(`  ${name}: ${files.length} file(s)`);
    }
    return;
  }

  // Materialise. Removing first keeps deletions from the upstream tree honest.
  rmSync(SKILLS_DIR, { recursive: true, force: true });
  mkdirSync(SKILLS_DIR, { recursive: true });

  let written = 0;
  const summary = [];
  for (const name of kept) {
    const files = walk(name);
    for (const rel of files) {
      const dest = join(SKILLS_DIR, rel);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, rewriteLinks(larkRead(rel)), 'utf8');
      written += 1;
    }
    summary.push({ name, files: files.length });
    console.log(`  ${name.padEnd(30)} ${String(files.length).padStart(3)} file(s)`);
  }

  writeFileSync(
    MANIFEST,
    JSON.stringify(
      {
        larkCliVersion: version,
        skillCount: kept.length,
        fileCount: written,
        excluded: [...EXCLUDED],
        skills: summary,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );

  console.log(`\nwrote ${written} file(s) across ${kept.length} skill(s) into skills/`);
}

main();
