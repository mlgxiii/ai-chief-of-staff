// Your Chief of Staff's context, cut down to what a request needs, with Contextrie.
//
// Every "## " section of every Markdown file in --dir (your eight blocks, notes, meeting notes…) becomes a
// Contextrie source. IndexingAgent describes each one once (cached by content), JudgeAgent scores them for the
// request, and the prompt is rebuilt from prompt.md plus the sections that matter. Your role, approval rules and
// notification rules are always kept: decision rights are never left out to save tokens.
//
// Usage: npm run brief -- "Prep my 3pm with Priya" [--dir ../examples] [--limit 8] > prompt.txt
// Needs ANTHROPIC_API_KEY or OPENAI_API_KEY in the environment. Nothing is sent anywhere else, no key is written.
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { DocumentSource, IndexingAgent, JudgeAgent, type Metadata } from '@contextrie/core';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const PINNED = /\b(role|approval|notification)/i;

function args() {
	const out = { task: '', dir: join(here, '../examples'), limit: 8 };
	const argv = process.argv.slice(2);
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--dir') out.dir = resolve(argv[++i]);
		else if (argv[i] === '--limit') out.limit = Number(argv[++i]);
		else out.task = [out.task, argv[i]].filter(Boolean).join(' ');
	}
	return out;
}

function model() {
	const { ANTHROPIC_API_KEY, OPENAI_API_KEY, MODEL } = process.env;
	if (ANTHROPIC_API_KEY) return anthropic(MODEL ?? 'claude-haiku-5-5');
	if (OPENAI_API_KEY) return openai(MODEL ?? 'gpt-4.1-mini');
	console.error('Set a key first: export ANTHROPIC_API_KEY=...  or  export OPENAI_API_KEY=...');
	process.exit(1);
}

function markdownFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		if (e.name.startsWith('.') || e.name === 'node_modules') return [];
		const path = join(dir, e.name);
		return e.isDirectory() ? markdownFiles(path) : /\.md$/i.test(e.name) ? [path] : [];
	});
}

interface Section {
	id: string;
	heading: string;
	text: string;
	order: number;
}

/** One section per "## " heading; text before the first one counts only if it says more than a title. */
function sections(dir: string): Section[] {
	const out: Section[] = [];
	for (const file of markdownFiles(dir).sort()) {
		const name = relative(dir, file);
		const parts = readFileSync(file, 'utf8').split(/^(?=## )/m);
		for (const part of parts) {
			const text = part.replace(/<!--[\s\S]*?-->/g, '').trim();
			const heading = text.match(/^#{1,2} (.+)/)?.[1] ?? name;
			const body = text.replace(/^#{1,2} .+\n?/, '').trim();
			if (!body || (!part.startsWith('## ') && body.length < 200)) continue;
			out.push({ id: `${name}#${heading.toLowerCase().replace(/\W+/g, '-')}`, heading, text, order: out.length });
		}
	}
	return out;
}

const { task, dir, limit } = args();
if (!task) {
	console.error('Usage: npm run brief -- "what you need" [--dir path/to/your/blocks] [--limit 8]');
	process.exit(1);
}
console.info = () => {}; // Contextrie's progress logs would end up in the prompt on stdout
process.on('uncaughtException', (e) => {
	console.error(`Failed: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`);
	process.exit(1);
});

const all = sections(dir);
if (!all.length) {
	console.error(`No "## " sections found in Markdown files under ${dir}`);
	process.exit(1);
}
const pinned = all.filter((s) => PINNED.test(s.heading));
const candidates = all.filter((s) => !pinned.includes(s));

// Index each section once; metadata is cached by content so edits re-index only what changed.
const cacheFile = join(here, '.contextrie', 'index.json');
let cache: Record<string, Metadata> = {};
try {
	cache = JSON.parse(readFileSync(cacheFile, 'utf8'));
} catch {}
const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const llm = model();
const indexer = new IndexingAgent(llm);
const sources = await Promise.all(
	candidates.map(async (s) => {
		const key = hash(s.text);
		const source = new DocumentSource(s.id, cache[key], s.text);
		if (!cache[key]) cache[key] = source.metadata = await indexer.generateMetadata(source);
		return source;
	})
);
mkdirSync(dirname(cacheFile), { recursive: true });
writeFileSync(cacheFile, JSON.stringify(cache, null, 2));

// Keep the top 3 plus anything scoring 0.3 or more, at most --limit.
const judgments = candidates.length ? await new JudgeAgent(llm).from(sources).run({ objective: 'response', input: task }) : {};
const ranked = candidates
	.map((s) => ({ ...s, ...(judgments[s.id] ?? { score: 0, reason: 'not judged' }) }))
	.sort((a, b) => b.score - a.score);
const chosen = ranked.filter((s, i) => i < 3 || s.score >= 0.3).slice(0, limit);

console.error(`Request: ${task}\n`);
for (const s of pinned) console.error(`  always  ${s.id}`);
for (const s of ranked) console.error(`  ${chosen.includes(s) ? s.score.toFixed(2) : ' --  '}    ${s.id}  ${s.reason}`);
console.error(`\n${pinned.length + chosen.length} of ${all.length} sections kept.\n`);

const base = readFileSync(join(here, '../prompt.md'), 'utf8').split(/^## /m)[0].trim();
const kept = [...pinned, ...chosen].sort((a, b) => a.order - b.order).map((s) => s.text.replace(/^# /, '## '));
console.log([base, ...kept, `## Request\n${task}`].join('\n\n'));
