/**
 * dsh-lark-cli-skills — dsh bundle entry.
 *
 * Registers every skill shipped in ./skills/ with ctx.skills, so the
 * lark-cli skill set shows up in the agent's catalog once this package is
 * installed as a dsh profile bundle:
 *
 *   dsh plugin --profile <name> add dsh-lark-cli-skills
 *
 * Each skill lives in skills/<name>/SKILL.md with its reference files beside
 * it; resourceBase points at that directory so the relative links inside the
 * skill body (references/*.md, ../lark-shared/SKILL.md) resolve correctly.
 *
 * The skill text is generated from the locally installed lark-cli binary by
 * scripts/sync-skills.mjs. It is not written by hand — re-run that script to
 * pick up a new upstream version.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'dsh-lark-cli-skills';
export const inject = ['skills'];

const SKILLS_ROOT = fileURLToPath(new URL('../skills/', import.meta.url));

/** Minimal YAML-frontmatter reader for the fields the registry needs. */
function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return null;
  const fm = match[1];
  const get = (key) => {
    const line = fm.match(new RegExp('^' + key + ':\\s*(.+)$', 'm'));
    if (!line) return undefined;
    let value = line[1].trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted) value = value.slice(1, -1);
    return value;
  };
  return {
    name: get('name'),
    description: get('description'),
    whenToUse: get('whenToUse'),
  };
}

/** Skill directories present on disk, sorted for deterministic registration. */
function skillDirectories() {
  let entries;
  try {
    entries = readdirSync(SKILLS_ROOT);
  } catch (error) {
    return { error };
  }
  return {
    dirs: entries
      .filter((entry) => {
        try {
          return statSync(join(SKILLS_ROOT, entry)).isDirectory();
        } catch {
          return false;
        }
      })
      .sort(),
  };
}

export function apply(ctx) {
  const { dirs, error } = skillDirectories();
  if (error !== undefined) {
    ctx.logger.error('dsh-lark-cli-skills: cannot read skills/ directory: %s', error.message);
    return;
  }
  if (dirs.length === 0) {
    ctx.logger.warn('dsh-lark-cli-skills: skills/ is empty; nothing to register');
    return;
  }

  const disposers = [];
  let registered = 0;

  for (const dir of dirs) {
    const skillDir = join(SKILLS_ROOT, dir);
    const skillFile = join(skillDir, 'SKILL.md');

    let raw;
    try {
      raw = readFileSync(skillFile, 'utf8');
    } catch {
      // A directory without SKILL.md is not a skill; skip quietly.
      continue;
    }

    const meta = parseFrontmatter(raw);
    if (!meta || !meta.name || !meta.description) {
      ctx.logger.warn(
        'dsh-lark-cli-skills: %s/SKILL.md lacks name/description; skipped',
        dir,
      );
      continue;
    }

    const content = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trimStart();

    try {
      const disposer = ctx.skills.register({
        name: meta.name,
        description: meta.description,
        ...(meta.whenToUse ? { whenToUse: meta.whenToUse } : {}),
        content,
        source: 'runtime',
        resourceBase: { kind: 'directory', path: skillDir },
      });
      if (typeof disposer === 'function') disposers.push(disposer);
      registered += 1;
    } catch (error) {
      ctx.logger.warn(
        'dsh-lark-cli-skills: failed to register "%s": %s',
        meta.name,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  ctx.logger.info('dsh-lark-cli-skills: registered %d skill(s)', registered);

  ctx.on('dispose', () => {
    for (const dispose of disposers) {
      try {
        dispose();
      } catch {
        // Disposal is best effort.
      }
    }
  });
}
