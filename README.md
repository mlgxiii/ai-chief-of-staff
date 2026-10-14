# How to Build Your Own AI Chief of Staff

The practical framework I used to build **Hector** for my personal life and **Atlas** for my work. It works with any model: ChatGPT, Claude, Gemini or another one.

**Core idea:** don't start with a giant prompt. Design the operating model first: role, context, tools, decision rights, routines and escalation.

> **The framework in one line**
> Role → Context → Tools → Decision rights → Routines → Escalation → Feedback

**In this repo**

- [`prompt.md`](prompt.md): the system prompt to copy into your model
- [`template/`](template/): the eight blocks to fill in, one file each
- [`examples/`](examples/): a filled-in example plus a month of notes (fictional)
- [`builder/`](builder/): fill in the blocks in your browser and copy the prompt: **[open the builder](https://mlgxiii.github.io/ai-chief-of-staff/)** (built with [Bref UI](https://github.com/feuersteiner/bref-ui))
- [`context/`](context/): when your context outgrows one prompt, keep only what a request needs (built with [Contextrie](https://github.com/feuersteiner/contextrie))

## The 8 steps

| # | Step | What it means |
| --- | --- | --- |
| 1 | **Define the job** | Mission, scope, out-of-scope and what "good" looks like. |
| 2 | **Give it context** | Your role, goals, key people, preferences, constraints and communication style. |
| 3 | **Connect the right tools** | Email, calendar, CRM, Notion, files, tasks, finance or travel, but only where useful. |
| 4 | **Set decision rights** | What it can do, what it prepares for approval, and what must always be approved. |
| 5 | **Create routines** | Morning brief, meeting prep, follow-ups, weekly review and recurring checks. |
| 6 | **Define escalation** | What deserves an interruption versus what can wait for the next brief. |
| 7 | **Add specialist agents** | Finance, Travel, Sales, Research, Admin, etc. Keep each specialist narrow. |
| 8 | **Train through corrections** | Every correction can become an operating rule: tone, timing, priorities, notifications. |

## The part that makes it work

One interlocutor, specialist agents underneath, and an automation and notification layer around the system.

### 1. Keep one single interface

I don't want to manage a collection of bots. I speak only to my Chief of Staff. Every specialist agent reports back to it, and it decides what I actually need to see.

```
                 ┌──────────────────────┐
                 │    Hector / Atlas    │
                 │ My only interlocutor │
                 └──────────┬───────────┘
      ┌──────────┬──────────┼──────────┬──────────┐
  Finance     Travel    Sales / GTM  Research    Admin
```

**Rule:** sub-agents can research, analyse and prepare work, but they report upward. The Chief of Staff consolidates, prioritises and communicates with me.

### 2. Add automations

Automations turn the system from reactive into proactive. They run recurring checks or trigger when a condition changes.

| Type | Examples |
| --- | --- |
| **Scheduled** | Morning brief at a set time, weekly review, monthly finance/admin review. |
| **Event-based** | Prepare me before meetings, create follow-ups after meetings, surface travel conflicts. |
| **Condition-based** | Notify me when a deadline is close, a reply arrives, something becomes blocked, or a key status changes. |

### 3. Build a notification system, not a notification flood

| Tier | What goes there |
| --- | --- |
| **Immediate** | Urgent, high-impact, blocking, security or financial risk. |
| **Daily brief** | Important but non-urgent items. |
| **Weekly review** | Patterns, drift and longer-term decisions. |
| **Silent** | Everything else. |

The Chief of Staff filters the system so attention, not information, becomes the scarce resource.

## Build it in 15 minutes

1. Copy [`prompt.md`](prompt.md) into the model of your choice, as a project, custom instructions, a custom GPT/Gem, or a `CLAUDE.md`/`AGENTS.md` for a coding agent.
2. Fill in the eight blocks in [`template/`](template/) and paste them in under the prompt, or attach them as files.
3. Connect the tools you listed, and only those.
4. Set up the routines you listed with your model's scheduling or an external scheduler.
5. Every time you correct it, add the correction as a rule in the right block.

**Goal:** not an assistant that waits for commands, but an operating layer that understands context, delegates work, runs checks, filters notifications and knows when to ask.

## When the context outgrows the prompt

The eight blocks fit in one prompt. Months of meeting notes, people and corrections don't. Pasting everything costs tokens and buries what matters, so `context/` keeps only what a request needs:

```sh
cd context && npm install
export ANTHROPIC_API_KEY=...        # or OPENAI_API_KEY
npm run brief -- "Prep my 3pm call with Northwind" --dir ../examples > prompt.txt
```

Every `## ` section of every Markdown file in `--dir` becomes a [Contextrie](https://github.com/feuersteiner/contextrie) source. `IndexingAgent` describes each section once (cached, so only edited sections are described again), `JudgeAgent` scores them for the request, and the prompt is rebuilt from `prompt.md` plus the sections that matter, with the reason for each choice printed to stderr. **Your role, approval rules and notification rules are always kept**: decision rights never get cut to save tokens.

Using a coding agent (Claude Code, Cursor, Codex) as your Chief of Staff? Put your blocks and notes in a folder, use `prompt.md` as its `CLAUDE.md` or `AGENTS.md`, and add [contextrie-mcp](https://github.com/mlgxiii/contextrie-mcp) so the agent picks the right files itself:

```sh
claude mcp add contextrie -- npx -y github:mlgxiii/contextrie-mcp
```

## The builder

[Open it](https://mlgxiii.github.io/ai-chief-of-staff/), or run it locally with `cd builder && npm install && npm run dev`. It reads `prompt.md`, `template/` and `examples/` from this repo, so editing those files changes the builder too. Nothing leaves your browser; the draft is kept in local storage.

## License

- The framework text (this README and `examples/`) is licensed under [CC BY 4.0](LICENSE-CC-BY-4.0): reuse and adapt it, with credit to Marie Gerard.
- The prompt, the templates and the code (`prompt.md`, `template/`, `builder/`, `context/`) are licensed under [MIT](LICENSE): copy them into your own setup, no credit needed.
