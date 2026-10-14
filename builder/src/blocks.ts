// The builder reads the repo's own Markdown, so prompt.md, template/ and examples/ stay the only copy.
import prompt from '../../prompt.md?raw';
import example from '../../examples/founder.md?raw';

const templates = import.meta.glob('../../template/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export interface Block {
	title: string;
	hint: string;
	starter: string;
}

/** The fixed part of the prompt: everything before the first "## " block. */
export const base = prompt.split(/^## /m)[0].trim();

/** The eight blocks in file order: "# Title", an HTML comment as the hint, the rest as a starter. */
export const blocks: Block[] = Object.keys(templates)
	.sort()
	.map((path) => {
		const text = templates[path];
		return {
			title: text.match(/^# (.+)/m)?.[1].trim() ?? path,
			hint: text.match(/<!--\s*([\s\S]*?)\s*-->/)?.[1] ?? '',
			starter: text.replace(/^# .+\n/m, '').replace(/<!--[\s\S]*?-->/, '').trim()
		};
	});

/** The filled-in example, keyed by block title ("## My role" … in examples/founder.md). */
export const exampleValues: Record<string, string> = Object.fromEntries(
	example
		.split(/^## /m)
		.slice(1)
		.map((part) => {
			const [title, ...rest] = part.split('\n');
			return [title.trim(), rest.join('\n').trim()];
		})
);

/** A block counts once it says more than its untouched starter. */
export const isFilled = (b: Block, value = '') => value.trim() !== '' && value.trim() !== b.starter;

/** The full prompt: the fixed part, then every filled block. */
export const compose = (values: Record<string, string>) =>
	[base, ...blocks.filter((b) => isFilled(b, values[b.title])).map((b) => `## ${b.title}\n${values[b.title].trim()}`)].join('\n\n') + '\n';
