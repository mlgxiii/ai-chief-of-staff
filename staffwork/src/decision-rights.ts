// Step 4 of the framework: what the Chief of Staff can do, what it prepares, and what it must ask.
//
// The model picks a lane and quotes the rule it used. The quote is checked word for word against your charter:
// a lane that lets the agent act (handle) or draft (prepare) without a real rule behind it becomes "approve".
// Errors also become "approve". When in doubt, it asks you.
import type { LanguageModel } from 'ai';
import { z } from 'zod';
import type { BlockKey, Charter } from './charter.js';
import { ask, message } from './model.js';

export type Lane = 'handle' | 'prepare' | 'approve';

export interface Decision {
	action: string;
	lane: Lane;
	/** Why, in one sentence. */
	reason: string;
	/** The rule relied on, as quoted by the model. */
	rule?: string;
	/** The block the quote was found in; undefined when it wasn't found. */
	block?: BlockKey;
	/** False when the lane was moved to "approve" because the quote wasn't in the charter or the call failed. */
	grounded: boolean;
}

const schema = z.object({
	lane: z.enum(['handle', 'prepare', 'approve']),
	rule: z.string().describe('The words from my rules that decide this, copied exactly. Empty if no rule covers it.'),
	reason: z.string().describe('One short sentence.')
});

export const DECISION_PROMPT = `You apply my approval rules to one action you are about to take.
Lanes:
- handle: my rules let you do it on your own.
- prepare: my rules say you prepare it and I approve it.
- approve: you must ask me before doing anything.
Pick the lane my rules give. Copy the exact words of the rule you used into "rule".
If no rule clearly covers the action, pick approve.`;

export class DecisionRights {
	constructor(
		private readonly model: LanguageModel,
		private readonly charter: Charter,
		readonly prompt: string = DECISION_PROMPT
	) {}

	async decide(action: string): Promise<Decision> {
		if (!this.charter.has('approvals')) {
			return { action, lane: 'approve', reason: 'There are no approval rules yet, so everything needs your approval.', grounded: false };
		}
		try {
			const out = await ask(this.model, this.prompt, `${this.charter.toMarkdown()}\n\n## Action\n${action}`, schema);
			if (out.lane === 'approve') return { action, lane: 'approve', reason: out.reason, rule: out.rule || undefined, block: this.charter.find(out.rule), grounded: true };
			const block = this.charter.find(out.rule);
			if (!block) {
				return { action, lane: 'approve', reason: `No rule of yours allows this (the model suggested "${out.lane}"), so it asks you first.`, rule: out.rule || undefined, grounded: false };
			}
			return { action, lane: out.lane, reason: out.reason, rule: out.rule, block, grounded: true };
		} catch (e) {
			return { action, lane: 'approve', reason: `Couldn't check the rules (${message(e)}), so it asks you first.`, grounded: false };
		}
	}

	/** Decide several actions in parallel. One failure doesn't affect the others. */
	run(actions: string[]): Promise<Decision[]> {
		return Promise.all(actions.map((a) => this.decide(a)));
	}
}
