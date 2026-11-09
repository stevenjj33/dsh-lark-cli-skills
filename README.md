# dsh-lark-cli-skills

[Agent skills](https://github.com/larksuite/cli) for the Lark/Feishu CLI, packaged as a **DeepSeek Harness** plugin bundle.

Once installed, the DSH agent can consult and use 27 Lark/Feishu skills — docs, Base, calendar, drive, tasks, wiki, approval, mail, slides, meetings, and more.

[中文文档](./README.zh.md)

## Why lark-im is excluded

This package **deliberately omits** the `lark-im` (instant messaging) skill.

IM channels are normally handled by a dedicated bridge plugin (for example `@xmanrui/dsh-im`). Shipping both would overlap and risk conflicting instructions, so this package covers only **non-IM** Lark capabilities — it **complements** an IM bridge instead of duplicating it.

If you do want `lark-im`, read it directly with `lark-cli skills read lark-im`, or remove it from the `EXCLUDED` set in `scripts/sync-skills.mjs` and re-sync.

## Prerequisite

**`lark-cli` must be installed** — every skill documents its commands:

```bash
npm install -g @larksuite/cli
lark-cli --version
```

The skills are plain Markdown, but without the CLI their commands cannot run.

## Install

```bash
dsh plugin --profile <your-profile> add dsh-lark-cli-skills
```

Restart DSH afterwards; the skills appear in the agent's catalog.

## Included skills (27)

`lark-shared` (auth — required by all others), `lark-doc`, `lark-sheets`, `lark-base`, `lark-calendar`, `lark-drive`, `lark-wiki`, `lark-task`, `lark-approval`, `lark-mail`, `lark-slides`, `lark-vc`, `lark-vc-agent`, `lark-minutes`, `lark-meeting`, `lark-note`, `lark-whiteboard`, `lark-okr`, `lark-contact`, `lark-attendance`, `lark-markdown`, `lark-event`, `lark-apps`, `lark-openapi-explorer`, `lark-skill-maker`, `lark-workflow-meeting-summary`, `lark-workflow-standup-report`.

## Updating the skill text

Skill text is **exported** from the locally installed `lark-cli` binary, never hand-written:

```bash
lark-cli update      # 1. upgrade the CLI
npm run sync         # 2. re-export
git add -A && git commit -m "chore: sync skills from lark-cli <version>"
npm version patch
npm publish
```

Detect a stale local copy:

```bash
npm run sync:check   # exits 1 when out of date
```

## Provenance and licensing

- **Skill text**: from [`@larksuite/cli`](https://github.com/larksuite/cli), **MIT License**, copyright Lark/Feishu. See [NOTICE](./NOTICE).
- **Plugin glue code** (`lib/`, `scripts/`, config): MIT License, copyright the authors of this repository.

This package does **not** modify upstream skill text (beyond writing it to files) and does **not** claim authorship of those skills.

## Privacy

Exported skills are **generic documentation** and contain no account data.

The sync script reads only the public output of `lark-cli skills list/read`; it never touches `~/.lark-cli/config.json`, credential storage, or any personal data.

## License

MIT. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
