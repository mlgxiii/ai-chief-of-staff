// When the charter and your notes outgrow one prompt, keep only what a request needs, with Contextrie.
//
// Every block and every "## " section of your notes becomes a Contextrie DocumentSource. IndexingAgent describes each
// once (pass `cache` to keep those descriptions between calls), JudgeAgent scores them for the request.
// Role, approval rules and notification rules are always kept: decision rights are never cut to save tokens.
import { DocumentSource, IndexingAgent, JudgeAgent } from '@contextrie/core';
import type { LanguageModel } from 'ai';
import { createHash } from 'node:crypto';
import { BASE_PROMPT, BLOCKS, type BlockKey, type Charter } from './charter.js';

/** Contextrie's index description of a source. */
export interface Metadata {
	title: string;
	description: string;
	keypoints: string[];
}

export const PINNED: BlockKey[] = ['role', 'approvals', 'notifications'];

export interface Note {
	/** A stable id, e.g. the file path. */
	id: string;
	text: string;
}

export interface Selected {
	id: string;
	score: number;
	reason: string;
	kept: boolean;
}

export interface Selection {
	request: string;
	/** The prompt to send: the fixed part, the kept blocks and note sections, then the request. */
	prompt: string;
	pinned: string[];
	/** Every candidate, best first, with whether it was kept. */
	ranked: Selected[];
}

export interface SelectOptions {
	/** Most candidates to keep besides the pinned blocks (default 8). The top 3 are always kept, then anything ≥ minScore. */
	limit?: number;
	minScore?: number;
	/** Index descriptions by content, reused between calls. Persist it yourself if you want it to survive restarts. */
	cache?: Map<string, Metadata>;
	base?: string;
}

/** Split notes into one section per "## " heading; text before the first heading counts only if it says more than a title. */
export function sections(notes: Note[]): Note[] {
	return notes.flatMap((n) =>
		n.text
			.replace(/<!--[\s\S]*?-->/g, '')
			.split(/^(?=## )/m)
			.map((part) => part.trim())
			.filter((part) => part.startsWith('## ') || part.replace(/^# .+\n?/, '').trim().length >= 200)
			.map((part) => {
				const heading = part.match(/^#{1,2} (.+)/)?.[1] ?? n.id;
				return { id: `${n.id}#${heading.toLowerCase().replace(/\W+/g, '-').replace(/^-|-$/g, '')}`, text: part };
			})
	);
}

const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

export async function selectContext(model: LanguageModel, charter: Charter, notes: Note[], request: string, opts: SelectOptions = {}): Promise<Selection> {
	const { limit = 8, minScore = 0.3, cache = new Map(), base = BASE_PROMPT } = opts;
	const pinned = PINNED.filter((k) => charter.has(k));
	const blockSections = charter
		.keys()
		.filter((k) => !pinned.includes(k))
		.map((k) => ({ id: `charter#${k}`, text: `## ${BLOCKS.find((b) => b.key === k)!.title}\n${charter.get(k)}`, block: k }));
	const candidates: (Note & { block?: BlockKey })[] = [...blockSections, ...sections(notes)];

	const indexer = new IndexingAgent(model);
	const sources = await Promise.all(
		candidates.map(async (c) => {
			const key = hash(c.text);
			const source = new DocumentSource(c.id, cache.get(key), c.text);
			if (!source.metadata) cache.set(key, (source.metadata = await indexer.generateMetadata(source)));
			return source;
		})
	);
	const judgments = sources.length ? await new JudgeAgent(model).from(sources).run({ objective: 'response', input: request }) : {};

	const ranked = candidates
		.map((c) => ({ ...c, score: judgments[c.id]?.score ?? 0, reason: judgments[c.id]?.reason ?? 'not judged' }))
		.sort((a, b) => b.score - a.score);
	const kept = new Set(ranked.filter((c, i) => i < 3 || c.score >= minScore).slice(0, limit).map((c) => c.id));

	const keptBlocks = [...pinned, ...blockSections.filter((b) => kept.has(b.id)).map((b) => b.block)];
	const keptNotes = candidates.filter((c) => !c.block && kept.has(c.id)).map((c) => c.text);
	const prompt = [charter.toPrompt(base, keptBlocks), ...keptNotes, `## Request\n${request}`].join('\n\n');
	return {
		request,
		prompt,
		pinned: pinned.map((k) => `charter#${k}`),
		ranked: ranked.map((c) => ({ id: c.id, score: c.score, reason: c.reason, kept: kept.has(c.id) }))
	};
}
