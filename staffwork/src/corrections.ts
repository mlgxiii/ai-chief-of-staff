// Step 8 of the framework: every correction can become an operating rule.
// One correction in, one short rule out, filed in the right block. Returns a new Charter; saving it is up to you.
import type { LanguageModel } from 'ai';
import { z } from 'zod';
import { BLOCKS, BLOCK_KEYS, type BlockKey, type Charter } from './charter.js';
import { ask } from './model.js';

export interface Learned {
	block: BlockKey;
	rule: string;
	charter: Charter;
}

const schema = z.object({
	block: z.enum(BLOCK_KEYS as [BlockKey, ...BlockKey[]]),
	rule: z.string().describe('One short operating rule, written as an instruction to you, in my words where possible.')
});

export const CORRECTION_PROMPT = `I corrected you. Turn the correction into one short, general operating rule you will follow from now on,
and pick the block of my charter it belongs to:
${BLOCKS.map((b) => `- ${b.key}: ${b.title}`).join('\n')}
Approval matters (sending, spending, committing, signing, deleting) go in approvals; what interrupts me or waits goes in notifications.
Don't repeat a rule that is already in the charter.`;

export class Corrections {
	constructor(
		private readonly model: LanguageModel,
		private readonly charter: Charter,
		readonly prompt: string = CORRECTION_PROMPT
	) {}

	async learn(correction: string): Promise<Learned> {
		const out = await ask(this.model, this.prompt, `${this.charter.toMarkdown()}\n\n## Correction\n${correction}`, schema);
		return { block: out.block, rule: out.rule.trim(), charter: this.charter.addRule(out.block, out.rule) };
	}
}
