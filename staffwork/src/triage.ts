// Step 6 of the framework: what deserves an interruption, what waits for a brief, what stays silent.
//
// The model picks a tier and quotes the rule it used. Interrupting you ("now") and hiding something ("silent")
// both need a rule found word for word in your charter; otherwise the item goes to the daily brief, where you see it
// without being interrupted. Errors also go to the daily brief.
import type { LanguageModel } from 'ai';
import { z } from 'zod';
import type { BlockKey, Charter } from './charter.js';
import { ask, message } from './model.js';

export type Tier = 'now' | 'daily' | 'weekly' | 'silent';

export interface Item {
	id?: string;
	/** What happened: an email, an event, a specialist's report… */
	text: string;
	/** Where it came from ("Gmail", "Finance agent"). */
	source?: string;
	at?: string;
}

export interface Triaged extends Item {
	tier: Tier;
	reason: string;
	rule?: string;
	block?: BlockKey;
	/** False when the tier was moved to "daily" because the quote wasn't in the charter or the call failed. */
	grounded: boolean;
}

const schema = z.object({
	tier: z.enum(['now', 'daily', 'weekly', 'silent']),
	rule: z.string().describe('The words from my rules that decide this, copied exactly. Empty if no rule covers it.'),
	reason: z.string().describe('One short sentence.')
});

export const TRIAGE_PROMPT = `You sort one incoming item by my notification rules.
Tiers:
- now: interrupt me immediately (urgent, high-impact, blocking, security or financial risk).
- daily: important but not urgent; goes in my daily brief.
- weekly: patterns, drift, longer-term decisions; goes in my weekly review.
- silent: I never need to see it.
Pick the tier my rules give. Copy the exact words of the rule you used into "rule".
If no rule clearly covers the item, pick daily.`;

export class Triage {
	constructor(
		private readonly model: LanguageModel,
		private readonly charter: Charter,
		readonly prompt: string = TRIAGE_PROMPT
	) {}

	async sort(item: Item): Promise<Triaged> {
		try {
			const head = [item.source && `From: ${item.source}`, item.at && `At: ${item.at}`].filter(Boolean).join('\n');
			const out = await ask(this.model, this.prompt, `${this.charter.toMarkdown()}\n\n## Item\n${head ? `${head}\n` : ''}${item.text}`, schema);
			const block = this.charter.find(out.rule);
			if ((out.tier === 'now' || out.tier === 'silent') && !block) {
				const what = out.tier === 'now' ? 'interrupt you' : 'hide this';
				return { ...item, tier: 'daily', reason: `No rule of yours says to ${what}, so it goes in the daily brief.`, rule: out.rule || undefined, grounded: false };
			}
			return { ...item, tier: out.tier, reason: out.reason, rule: out.rule || undefined, block, grounded: true };
		} catch (e) {
			return { ...item, tier: 'daily', reason: `Couldn't sort it (${message(e)}), so it goes in the daily brief.`, grounded: false };
		}
	}

	/** Sort several items in parallel. One failure doesn't affect the others. */
	run(items: Item[]): Promise<Triaged[]> {
		return Promise.all(items.map((i) => this.sort(i)));
	}
}
