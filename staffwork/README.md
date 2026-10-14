# staffwork

The building blocks of an AI Chief of Staff, in TypeScript. It's the [AI Chief of Staff framework](../README.md) turned into code: a charter, decision rights, triage, briefs and learning from corrections.

staffwork isn't a bot. It's a set of small parts that you wire into your own agent:

- **Any model.** Every part takes an [AI SDK](https://ai-sdk.dev) v6 model: OpenAI, Anthropic, Google, a local model.
- **No IO.** No email or calendar connectors, no scheduler, no database. You pass text in and get decisions out; where they come from and go to is up to you.
- **The code is yours.** Use it from npm, or copy any part's source into your project with the CLI and edit it.
- **When in doubt, it asks you.** Every decision quotes the rule from your charter that it relied on. That quote is checked word for word. If the rule isn't really there, the decision falls back to the safe side.

```sh
npm i staffwork ai zod                          # or, before it's on npm:
npm i github:mlgxiii/ai-chief-of-staff ai zod   # same package
```

## Quick start

```sh
npx staffwork init               # writes the eight blocks to ./chief-of-staff/
# fill them in, then:
npx staffwork prompt             # the full system prompt, for any model
```

```ts
import { readFileSync, readdirSync } from 'node:fs';
import { openai } from '@ai-sdk/openai';
import { Charter, DecisionRights, Triage, brief } from 'staffwork';

const dir = './chief-of-staff';
const charter = Charter.parse(...readdirSync(dir).map((f) => readFileSync(`${dir}/${f}`, 'utf8')));
const model = openai('gpt-4.1-mini');

await new DecisionRights(model, charter).decide('Pay the $340 venue deposit');
// { lane: 'approve', rule: 'Always ask me first: any spend over $100', block: 'approvals', grounded: true, … }

const items = await new Triage(model, charter).run([
  { text: 'Stripe: the payment from Atlas Bank failed', source: 'Stripe' },
  { text: 'Your weekly Figma digest', source: 'Gmail' },
]);
console.log(brief(items, { title: 'Morning brief' }).markdown);
```

## The parts

Each part maps to a step of the framework.

| Part | Step | What it does | Model call |
| --- | --- | --- | --- |
| `Charter` | 1, 2 | Parses the eight blocks from Markdown (one file or several, `#` or `##` headings). Renders the prompt, adds learned rules, finds quotes | no |
| `DecisionRights` | 4 | Sorts an action into **handle** (do it), **prepare** (draft it for approval) or **approve** (ask first) | yes |
| `Triage` | 6 | Sorts an incoming item into **now**, **daily**, **weekly** or **silent** | yes |
| `brief()` | 5 | Turns sorted items into a brief, as data and Markdown. Silent items are counted, never listed | no |
| `Corrections` | 8 | Turns a correction into one rule, filed in the right block. Returns a new `Charter` | yes |
| `selectContext()` | 2 | Keeps only the blocks and notes a request needs, using [Contextrie](https://github.com/feuersteiner/contextrie). Import it from `staffwork/context` | yes |

### Charter

```ts
const charter = Charter.parse(markdownA, markdownB);   // blocks found in any order, joined if repeated
charter.keys();                    // ['role', 'goals', …] in framework order
charter.get('approvals');          // the block's text
charter.toPrompt();                // the framework's fixed prompt + every block
charter.toPrompt(undefined, ['role', 'approvals']);   // only some blocks
charter.find('any spend over $100');                  // 'approvals': the block that contains this quote
const next = charter.addRule('preferences', 'Keep drafts under 5 sentences.');  // charters never change in place
```

Blocks are found by their heading: role, goals, people, tools, preferences, approval(s), routines/automations, notification(s). HTML comments (the template hints) are ignored.

### DecisionRights

```ts
const rights = new DecisionRights(model, charter);
const d = await rights.decide('Send Northwind a nudge');
// { action, lane: 'prepare', reason, rule: 'replies to clients and prospects', block: 'approvals', grounded: true }
await rights.run([...actions]);   // in parallel; one failure doesn't affect the others
```

It falls back to **approve** when:
- the model picks handle or prepare, but the rule it quotes isn't in your charter word for word (`grounded: false`)
- the model call fails
- the charter has no approval rules

### Triage

```ts
const t = await new Triage(model, charter).sort({ text: 'Lena replied: can we talk Thursday?', source: 'Gmail' });
// { …item, tier: 'daily', reason, rule, block, grounded }
```

Interrupting you (**now**) and hiding something (**silent**) both need a rule found in your charter. Without one, or when the call fails, the item goes to **daily**, so you still see it in the brief.

### brief

```ts
const b = brief(items, { title: 'Morning brief, Tuesday', weekly: false, reasons: true });
b.now; b.daily; b.weekly; b.silent;   // the groups; silent is a count
b.markdown;                           // ready to send
```

Weekly items are left out of a daily brief and counted at the end. Pass `weekly: true` for the weekly review. Items whose tier fell back are marked "Unverified".

### Corrections

```ts
const { block, rule, charter: updated } = await new Corrections(model, charter).learn("Don't book anything on Friday afternoons");
// block: 'preferences', rule: 'Never book meetings on Friday afternoons…'
// updated has the rule under "### Rules learned from corrections" in that block. Saving it is up to you.
```

### selectContext (Contextrie)

```ts
import { selectContext } from 'staffwork/context';

const cache = new Map();   // index descriptions, reused between calls
const sel = await selectContext(model, charter, [{ id: 'notes/october.md', text: notes }], 'Prep my call with Northwind', { cache });
sel.prompt;   // the fixed prompt + the kept blocks and note sections + the request
sel.ranked;   // every candidate with score, reason and whether it was kept
```

Every block and every `## ` section of your notes becomes a Contextrie `DocumentSource`. `IndexingAgent` describes each one once, and `JudgeAgent` scores them for the request. The top 3 are always kept, plus anything scoring 0.3 or more, up to `limit` (8 by default). **Role, approval rules and notification rules are always kept.** Contextrie is bundled, so it needs nothing extra from npm.

## Copy the source

```sh
npx staffwork list                         # the parts
npx staffwork add triage brief             # copies triage.ts, brief.ts and what they import into ./staffwork/
npx staffwork add context --to src/lib/cos # choose the folder; --force overwrites
```

The copied files import only each other, plus `ai`, `zod` and, for `context`, `@contextrie/core`. Nothing imports `staffwork`, so you can uninstall it.

## Prompts

Each part's instructions are exported (`DECISION_PROMPT`, `TRIAGE_PROMPT`, `CORRECTION_PROMPT`) and can be replaced: `new Triage(model, charter, myPrompt)`.

## On a real model

On the [example charter](../examples/founder.md) with `gpt-4.1-mini`:

| Action | Lane | Rule quoted |
| --- | --- | --- |
| Decline a cold pitch from a link-building agency | handle | declining obvious spam and cold pitches |
| Send Northwind a nudge (no reply in 6 days) | prepare | replies to clients and prospects |
| Move Monday's team meeting from 10:00 to 14:00 | handle | moving internal meetings inside the same day |
| Pay the $340 venue deposit | approve | any spend over $100 |
| Sign the Fieldwork change order | approve | anything I'd sign |

On six incoming items, a failed payment and an unhappy client went to **now**, a prospect's reply to **daily**, a pipeline drop to **weekly**, and a newsletter and a stock-photo promotion to **silent**.

## License

MIT
