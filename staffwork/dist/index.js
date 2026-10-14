import {
  BASE_PROMPT,
  BLOCKS,
  BLOCK_KEYS,
  Charter,
  normalise
} from "./chunk-NBOAKW2B.js";

// staffwork/src/decision-rights.ts
import { z } from "zod";

// staffwork/src/model.ts
import { generateText, Output } from "ai";
async function ask(model, system, prompt, schema4) {
  const { output } = await generateText({ model, system, prompt, temperature: 0, output: Output.object({ schema: schema4 }) });
  return output;
}
var message = (e) => (e instanceof Error ? e.message : String(e)).split("\n")[0].slice(0, 200);

// staffwork/src/decision-rights.ts
var schema = z.object({
  lane: z.enum(["handle", "prepare", "approve"]),
  rule: z.string().describe("The words from my rules that decide this, copied exactly. Empty if no rule covers it."),
  reason: z.string().describe("One short sentence.")
});
var DECISION_PROMPT = `You apply my approval rules to one action you are about to take.
Lanes:
- handle: my rules let you do it on your own.
- prepare: my rules say you prepare it and I approve it.
- approve: you must ask me before doing anything.
Pick the lane my rules give. Copy the exact words of the rule you used into "rule".
If no rule clearly covers the action, pick approve.`;
var DecisionRights = class {
  constructor(model, charter, prompt = DECISION_PROMPT) {
    this.model = model;
    this.charter = charter;
    this.prompt = prompt;
  }
  model;
  charter;
  prompt;
  async decide(action) {
    if (!this.charter.has("approvals")) {
      return { action, lane: "approve", reason: "There are no approval rules yet, so everything needs your approval.", grounded: false };
    }
    try {
      const out = await ask(this.model, this.prompt, `${this.charter.toMarkdown()}

## Action
${action}`, schema);
      if (out.lane === "approve") return { action, lane: "approve", reason: out.reason, rule: out.rule || void 0, block: this.charter.find(out.rule), grounded: true };
      const block = this.charter.find(out.rule);
      if (!block) {
        return { action, lane: "approve", reason: `No rule of yours allows this (the model suggested "${out.lane}"), so it asks you first.`, rule: out.rule || void 0, grounded: false };
      }
      return { action, lane: out.lane, reason: out.reason, rule: out.rule, block, grounded: true };
    } catch (e) {
      return { action, lane: "approve", reason: `Couldn't check the rules (${message(e)}), so it asks you first.`, grounded: false };
    }
  }
  /** Decide several actions in parallel. One failure doesn't affect the others. */
  run(actions) {
    return Promise.all(actions.map((a) => this.decide(a)));
  }
};

// staffwork/src/triage.ts
import { z as z2 } from "zod";
var schema2 = z2.object({
  tier: z2.enum(["now", "daily", "weekly", "silent"]),
  rule: z2.string().describe("The words from my rules that decide this, copied exactly. Empty if no rule covers it."),
  reason: z2.string().describe("One short sentence.")
});
var TRIAGE_PROMPT = `You sort one incoming item by my notification rules.
Tiers:
- now: interrupt me immediately (urgent, high-impact, blocking, security or financial risk).
- daily: important but not urgent; goes in my daily brief.
- weekly: patterns, drift, longer-term decisions; goes in my weekly review.
- silent: I never need to see it.
Pick the tier my rules give. Copy the exact words of the rule you used into "rule".
If no rule clearly covers the item, pick daily.`;
var Triage = class {
  constructor(model, charter, prompt = TRIAGE_PROMPT) {
    this.model = model;
    this.charter = charter;
    this.prompt = prompt;
  }
  model;
  charter;
  prompt;
  async sort(item) {
    try {
      const head = [item.source && `From: ${item.source}`, item.at && `At: ${item.at}`].filter(Boolean).join("\n");
      const out = await ask(this.model, this.prompt, `${this.charter.toMarkdown()}

## Item
${head ? `${head}
` : ""}${item.text}`, schema2);
      const block = this.charter.find(out.rule);
      if ((out.tier === "now" || out.tier === "silent") && !block) {
        const what = out.tier === "now" ? "interrupt you" : "hide this";
        return { ...item, tier: "daily", reason: `No rule of yours says to ${what}, so it goes in the daily brief.`, rule: out.rule || void 0, grounded: false };
      }
      return { ...item, tier: out.tier, reason: out.reason, rule: out.rule || void 0, block, grounded: true };
    } catch (e) {
      return { ...item, tier: "daily", reason: `Couldn't sort it (${message(e)}), so it goes in the daily brief.`, grounded: false };
    }
  }
  /** Sort several items in parallel. One failure doesn't affect the others. */
  run(items) {
    return Promise.all(items.map((i) => this.sort(i)));
  }
};

// staffwork/src/brief.ts
var SECTIONS = [
  ["now", "Needs you now"],
  ["daily", "Today"],
  ["weekly", "This week"]
];
function brief(items, { title = "Brief", weekly = false, reasons = true } = {}) {
  const by = (tier) => items.filter((i) => i.tier === tier);
  const out = { now: by("now"), daily: by("daily"), weekly: by("weekly"), silent: by("silent").length };
  const line = (i) => `- ${i.text.trim().split("\n")[0]}${i.source ? ` (${i.source})` : ""}${reasons ? `
  ${i.grounded ? "" : "Unverified: "}${i.reason}` : ""}`;
  const parts = [`# ${title}`];
  for (const [tier, heading] of SECTIONS) {
    if (tier === "weekly" && !weekly) continue;
    const list = out[tier];
    if (list.length) parts.push(`## ${heading}
${list.map(line).join("\n")}`);
  }
  if (!out.now.length && !out.daily.length && !(weekly && out.weekly.length)) parts.push("Nothing needs you.");
  const later = weekly ? 0 : out.weekly.length;
  const tail = [later && `${later} for the weekly review`, out.silent && `${out.silent} kept silent`].filter(Boolean);
  if (tail.length) parts.push(`_${tail.join(", ")}._`);
  return { ...out, markdown: parts.join("\n\n") + "\n" };
}

// staffwork/src/corrections.ts
import { z as z3 } from "zod";
var schema3 = z3.object({
  block: z3.enum(BLOCK_KEYS),
  rule: z3.string().describe("One short operating rule, written as an instruction to you, in my words where possible.")
});
var CORRECTION_PROMPT = `I corrected you. Turn the correction into one short, general operating rule you will follow from now on,
and pick the block of my charter it belongs to:
${BLOCKS.map((b) => `- ${b.key}: ${b.title}`).join("\n")}
Approval matters (sending, spending, committing, signing, deleting) go in approvals; what interrupts me or waits goes in notifications.
Don't repeat a rule that is already in the charter.`;
var Corrections = class {
  constructor(model, charter, prompt = CORRECTION_PROMPT) {
    this.model = model;
    this.charter = charter;
    this.prompt = prompt;
  }
  model;
  charter;
  prompt;
  async learn(correction) {
    const out = await ask(this.model, this.prompt, `${this.charter.toMarkdown()}

## Correction
${correction}`, schema3);
    return { block: out.block, rule: out.rule.trim(), charter: this.charter.addRule(out.block, out.rule) };
  }
};
export {
  BASE_PROMPT,
  BLOCKS,
  BLOCK_KEYS,
  CORRECTION_PROMPT,
  Charter,
  Corrections,
  DECISION_PROMPT,
  DecisionRights,
  TRIAGE_PROMPT,
  Triage,
  brief,
  normalise
};
