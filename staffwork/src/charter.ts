// The Chief of Staff's operating model: the eight blocks, parsed from Markdown.
// No file IO here: pass the text in, get text out. Charters are immutable; addRule returns a new one.

export const BLOCKS = [
	{ key: 'role', title: 'My role', match: /\brole\b/i },
	{ key: 'goals', title: 'My main goals', match: /\bgoals?\b/i },
	{ key: 'people', title: 'My key people', match: /\bpeople\b/i },
	{ key: 'tools', title: 'My tools', match: /\btools?\b/i },
	{ key: 'preferences', title: 'My working preferences', match: /\bpreferences?\b/i },
	{ key: 'approvals', title: 'My approval rules', match: /\bapprovals?\b/i },
	{ key: 'routines', title: 'My routines & automations', match: /\b(routines?|automations?)\b/i },
	{ key: 'notifications', title: 'My notification rules', match: /\bnotifications?\b/i }
] as const;

export type BlockKey = (typeof BLOCKS)[number]['key'];
export const BLOCK_KEYS = BLOCKS.map((b) => b.key) as BlockKey[];

/** The fixed part of the prompt, from the framework's prompt.md. */
export const BASE_PROMPT = `You are my AI Chief of Staff.
Your job is to help me manage my priorities, commitments and decisions.

Always understand:
- what I am trying to achieve
- what is urgent or blocked
- who is waiting on me
- what I should do next

Do not simply summarise information. Interpret it and recommend an action.

You are my only interface. Specialist agents report to you, not directly to me.
Consolidate their work, resolve duplication, prioritise it and surface only what matters.

Use automations for recurring checks and condition-based monitoring.
Notify me immediately only for urgent, high-impact or blocking issues.
Bundle everything else into my daily or weekly brief.

Separate: 1) what you can handle, 2) what you can prepare, 3) what requires my approval.
Learn from my corrections and adapt to the way I work.`;

const LEARNED = '### Rules learned from corrections';

const blockFor = (heading: string) => BLOCKS.find((b) => b.match.test(heading));
const stripComments = (s: string) => s.replace(/<!--[\s\S]*?-->/g, '');
/** Lower-case, unify quotes and dashes, drop Markdown marks and collapse spaces, so a quote matches however it was formatted. */
export const normalise = (s: string) =>
	s
		.toLowerCase()
		.replace(/[‘’]/g, "'")
		.replace(/[“”]/g, '"')
		.replace(/[–—]/g, '-')
		.replace(/[*_`|>#]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

export class Charter {
	private readonly blocks: Partial<Record<BlockKey, string>>;

	constructor(blocks: Partial<Record<BlockKey, string>> = {}) {
		this.blocks = Object.fromEntries(
			Object.entries(blocks).filter(([, text]) => text?.trim()).map(([k, text]) => [k, text!.trim()])
		);
	}

	/**
	 * Read blocks from one or more Markdown texts. A block starts at a `#` or `##` heading that names it
	 * ("My role", "# My approval rules"…) and runs to the next `#`/`##` heading; `###` stays inside.
	 * A block found twice is joined. HTML comments (the template hints) are dropped.
	 */
	static parse(...markdown: string[]): Charter {
		const out: Partial<Record<BlockKey, string>> = {};
		for (const text of markdown) {
			let current: BlockKey | undefined;
			let lines: string[] = [];
			const flush = () => {
				const body = lines.join('\n').trim();
				if (current && body) out[current] = out[current] ? `${out[current]}\n\n${body}` : body;
				lines = [];
			};
			for (const line of stripComments(text).split('\n')) {
				const heading = line.match(/^#{1,2}\s+(.+?)\s*#*$/);
				if (heading) {
					flush();
					current = blockFor(heading[1])?.key;
					continue;
				}
				if (current) lines.push(line);
			}
			flush();
		}
		return new Charter(out);
	}

	get(key: BlockKey): string {
		return this.blocks[key] ?? '';
	}

	has(key: BlockKey): boolean {
		return Boolean(this.blocks[key]);
	}

	/** Keys of the blocks that have content, in framework order. */
	keys(): BlockKey[] {
		return BLOCK_KEYS.filter((k) => this.has(k));
	}

	/** The blocks as Markdown, in framework order. Pass keys to render only some of them. */
	toMarkdown(keys: BlockKey[] = BLOCK_KEYS): string {
		return BLOCKS.filter((b) => keys.includes(b.key) && this.has(b.key))
			.map((b) => `## ${b.title}\n${this.get(b.key)}`)
			.join('\n\n');
	}

	/** The full system prompt: the framework's fixed part, then the blocks. */
	toPrompt(base = BASE_PROMPT, keys?: BlockKey[]): string {
		return [base, this.toMarkdown(keys)].filter(Boolean).join('\n\n');
	}

	/** A new charter with `rule` added under "Rules learned from corrections" in that block. */
	addRule(key: BlockKey, rule: string): Charter {
		const line = `- ${rule.trim().replace(/^[-*]\s*/, '')}`;
		const text = this.get(key);
		const next = text.includes(LEARNED) ? `${text}\n${line}` : [text, `${LEARNED}\n${line}`].filter(Boolean).join('\n\n');
		return new Charter({ ...this.blocks, [key]: next });
	}

	/**
	 * Which block contains `quote`, word for word (case, quotes, Markdown and spacing ignored)?
	 * Quotes shorter than 8 characters never match: "yes" is not a rule.
	 */
	find(quote: string | undefined, keys: BlockKey[] = BLOCK_KEYS): BlockKey | undefined {
		const q = normalise(quote ?? '').replace(/^["']|["']$/g, '');
		if (q.length < 8) return;
		return keys.find((k) => normalise(this.get(k)).includes(q));
	}
}
