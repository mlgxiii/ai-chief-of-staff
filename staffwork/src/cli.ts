#!/usr/bin/env node
// staffwork CLI. Plain Node, no Bun. Copies files into your project; it never calls a model and never needs a key.
//
//   staffwork init [dir]            the eight blocks as Markdown files (default ./chief-of-staff)
//   staffwork add <part…> [--to d]  a part's source and its local dependencies, yours to edit (default ./staffwork)
//   staffwork list                  the parts you can add
//   staffwork prompt [dir]          print the full prompt built from your blocks
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Charter } from './charter.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const src = join(root, 'staffwork/src');

export const PARTS: Record<string, { files: string[]; deps: string[]; about: string }> = {
	charter: { files: ['charter.ts'], deps: [], about: 'The eight blocks parsed from Markdown; renders the prompt, adds learned rules' },
	'decision-rights': { files: ['decision-rights.ts', 'charter.ts', 'model.ts'], deps: ['ai', 'zod'], about: 'Action → handle / prepare / approve, with the rule quoted' },
	triage: { files: ['triage.ts', 'charter.ts', 'model.ts'], deps: ['ai', 'zod'], about: 'Item → now / daily / weekly / silent, with the rule quoted' },
	brief: { files: ['brief.ts', 'triage.ts', 'charter.ts', 'model.ts'], deps: ['ai', 'zod'], about: 'Triaged items → a grouped brief (no model call)' },
	corrections: { files: ['corrections.ts', 'charter.ts', 'model.ts'], deps: ['ai', 'zod'], about: 'A correction → one rule in the right block' },
	context: { files: ['context.ts', 'charter.ts'], deps: ['ai', '@contextrie/core'], about: 'Keep only the blocks and notes a request needs (Contextrie)' }
};

const say = (s = '') => process.stdout.write(`${s}\n`);
const fail = (s: string): never => {
	process.stderr.write(`${s}\n`);
	process.exit(1);
};

function copy(from: string, to: string, force: boolean) {
	if (existsSync(to) && !force) return say(`  skipped ${relative(process.cwd(), to)} (already there; --force overwrites)`);
	mkdirSync(dirname(to), { recursive: true });
	copyFileSync(from, to);
	say(`  wrote   ${relative(process.cwd(), to)}`);
}

function init(dir = 'chief-of-staff', force = false) {
	const templates = join(root, 'template');
	for (const name of readdirSync(templates).filter((f) => f.endsWith('.md')).sort()) copy(join(templates, name), resolve(dir, name), force);
	say(`\nFill in the blocks, then:\n  npx staffwork prompt ${dir}   # the full prompt for any model`);
}

function add(parts: string[], to = 'staffwork', force = false) {
	if (!parts.length) fail('Name a part: staffwork add triage   (staffwork list shows them all)');
	const unknown = parts.filter((p) => !PARTS[p]);
	if (unknown.length) fail(`Unknown part: ${unknown.join(', ')}. Parts: ${Object.keys(PARTS).join(', ')}`);
	const files = new Set(parts.flatMap((p) => PARTS[p].files));
	const deps = new Set(parts.flatMap((p) => PARTS[p].deps));
	for (const f of files) copy(join(src, f), resolve(to, f), force);
	if (deps.size) say(`\nThese files import ${[...deps].join(', ')}. Install them if you haven't:\n  npm i ${[...deps].join(' ')}`);
	say('\nThe code is yours now: nothing imports "staffwork", so edit it freely.');
}

function list() {
	const width = Math.max(...Object.keys(PARTS).map((p) => p.length));
	for (const [name, p] of Object.entries(PARTS)) say(`${name.padEnd(width)}  ${p.about}`);
}

function prompt(dir = 'chief-of-staff') {
	if (!existsSync(dir)) fail(`No folder ${dir}. Run: npx staffwork init ${dir}`);
	const texts = readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => readFileSync(join(dir, f), 'utf8'));
	const charter = Charter.parse(...texts);
	if (!charter.keys().length) fail(`No blocks found in ${dir}. Each file needs a heading such as "# My role".`);
	say(charter.toPrompt());
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const toAt = args.indexOf('--to');
const to = toAt >= 0 ? args[toAt + 1] : undefined;
const rest = args.filter((a, i) => a !== '--force' && (toAt < 0 || (i !== toAt && i !== toAt + 1)));
const [command, ...params] = rest;

switch (command) {
	case 'init':
		init(params[0], force);
		break;
	case 'add':
		add(params, to, force);
		break;
	case 'list':
		list();
		break;
	case 'prompt':
		prompt(params[0]);
		break;
	default:
		say(`staffwork: the building blocks of an AI Chief of Staff

  staffwork init [dir]             write the eight blocks to fill in (default ./chief-of-staff)
  staffwork add <part…> [--to d]   copy a part's source into your project (default ./staffwork)
  staffwork list                   the parts you can add
  staffwork prompt [dir]           print the full prompt built from your blocks`);
		if (command && command !== 'help' && command !== '--help') process.exitCode = 1;
}
