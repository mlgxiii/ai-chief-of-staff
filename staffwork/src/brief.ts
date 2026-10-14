// Step 5 of the framework: the brief. A pure function, no model: triaged items in, grouped brief out.
import type { Tier, Triaged } from './triage.js';

export interface Brief {
	now: Triaged[];
	daily: Triaged[];
	weekly: Triaged[];
	/** Silent items are counted, never listed. */
	silent: number;
	markdown: string;
}

export interface BriefOptions {
	/** Heading of the brief, e.g. "Morning brief, Tuesday 14 October". */
	title?: string;
	/** Include the weekly items (for a weekly review). Default false: a daily brief leaves them for the week. */
	weekly?: boolean;
	/** Show why each item landed where it did. Default true. */
	reasons?: boolean;
}

const SECTIONS: ['now' | 'daily' | 'weekly', string][] = [
	['now', 'Needs you now'],
	['daily', 'Today'],
	['weekly', 'This week']
];

export function brief(items: Triaged[], { title = 'Brief', weekly = false, reasons = true }: BriefOptions = {}): Brief {
	const by = (tier: Tier) => items.filter((i) => i.tier === tier);
	const out = { now: by('now'), daily: by('daily'), weekly: by('weekly'), silent: by('silent').length };
	const line = (i: Triaged) =>
		`- ${i.text.trim().split('\n')[0]}${i.source ? ` (${i.source})` : ''}${reasons ? `\n  ${i.grounded ? '' : 'Unverified: '}${i.reason}` : ''}`;
	const parts = [`# ${title}`];
	for (const [tier, heading] of SECTIONS) {
		if (tier === 'weekly' && !weekly) continue;
		const list = out[tier];
		if (list.length) parts.push(`## ${heading}\n${list.map(line).join('\n')}`);
	}
	if (!out.now.length && !out.daily.length && !(weekly && out.weekly.length)) parts.push('Nothing needs you.');
	const later = weekly ? 0 : out.weekly.length;
	const tail = [later && `${later} for the weekly review`, out.silent && `${out.silent} kept silent`].filter(Boolean);
	if (tail.length) parts.push(`_${tail.join(', ')}._`);
	return { ...out, markdown: parts.join('\n\n') + '\n' };
}
