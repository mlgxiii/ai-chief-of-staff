<!--
  Fill in the eight blocks, get the full Chief of Staff prompt to paste into any model.
  Everything stays in this browser: there is no server, and the draft is only kept in localStorage.
-->
<script lang="ts">
	import { Button, Pill, Surface, TextArea, Theme, ThemeModeToggle } from 'bref-ui';
	import { blocks, compose, exampleValues, isFilled } from './blocks';

	const REPO = 'https://github.com/mlgxiii/ai-chief-of-staff';
	const KEY = 'cos-builder-draft';
	const starters = () => Object.fromEntries(blocks.map((b) => [b.title, b.starter]));

	function load(): Record<string, string> {
		try {
			const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
			if (saved && typeof saved === 'object') return { ...starters(), ...saved };
		} catch {}
		return starters();
	}

	let values = $state(load());
	let copied = $state(false);
	// ThemeModeToggle only sets <meta name="color-scheme">; it renders no control, so we bring the button.
	let mode = $state<'light' | 'dark'>(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

	const prompt = $derived(compose(values));
	const filled = $derived(blocks.filter((b) => isFilled(b, values[b.title])).length);

	$effect(() => {
		try {
			localStorage.setItem(KEY, JSON.stringify(values));
		} catch {}
	});

	async function copy() {
		await navigator.clipboard.writeText(prompt);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	function download() {
		const a = document.createElement('a');
		a.href = URL.createObjectURL(new Blob([prompt], { type: 'text/markdown' }));
		a.download = 'chief-of-staff.md';
		a.click();
		URL.revokeObjectURL(a.href);
	}
</script>

<Theme />
<ThemeModeToggle {mode} />

<main>
	<header>
		<div>
			<h1>Build your AI Chief of Staff</h1>
			<p>Fill in the eight blocks. The prompt on the right works in ChatGPT, Claude, Gemini or any other model.</p>
		</div>
		<Button
			icon={{ name: mode === 'dark' ? 'light_mode' : 'dark_mode', label: 'Toggle dark mode' }}
			rounded
			onClick={() => (mode = mode === 'dark' ? 'light' : 'dark')}
		/>
	</header>

	<div class="row">
		<Pill label="{filled} of {blocks.length} blocks filled" color={filled === blocks.length ? 'primary' : 'muted'} size="small" />
		<Button label="Load the example" icon={{ name: 'person' }} variant="soft" size="small" onClick={() => (values = { ...starters(), ...exampleValues })} />
		<Button label="Start over" icon={{ name: 'restart_alt' }} variant="soft" size="small" onClick={() => (values = starters())} />
	</div>

	<div class="layout">
		<section class="blocks">
			{#each blocks as block, i (block.title)}
				<Surface variant="soft" spacing="medium" radius="large" orientation="vertical">
					<label for="block-{i}">
						<strong>{i + 1}. {block.title}</strong>
						<small>{block.hint}</small>
					</label>
					<TextArea id="block-{i}" bind:value={values[block.title]} wide rows={6} resizable />
				</Surface>
			{/each}
		</section>

		<aside>
			<Surface variant="neutral" spacing="medium" radius="large" orientation="vertical" shadow>
				<div class="row">
					<strong>Your prompt</strong>
					<Button label={copied ? 'Copied' : 'Copy'} icon={{ name: copied ? 'check' : 'content_copy' }} color="primary" variant="filled" size="small" onClick={copy} />
					<Button label="Download" icon={{ name: 'download' }} size="small" onClick={download} />
				</div>
				<pre>{prompt}</pre>
				<small>Nothing leaves your browser. Every correction you make later belongs in one of these blocks.</small>
			</Surface>
		</aside>
	</div>

	<footer>
		<a href={REPO} target="_blank" rel="noopener">The framework on GitHub</a> · UI built with
		<a href="https://github.com/feuersteiner/bref-ui" target="_blank" rel="noopener">Bref UI</a> · context selection with
		<a href="https://github.com/feuersteiner/contextrie" target="_blank" rel="noopener">Contextrie</a>
	</footer>
</main>

<style>
	main { max-width: 1200px; margin: 0 auto; padding: 2rem 1rem; display: grid; gap: 1.25rem; }
	header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
	h1 { margin: 0 0 0.25rem; }
	header p { margin: 0; opacity: 0.75; }
	.row { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
	.layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1.25rem; align-items: start; }
	.blocks { display: grid; gap: 1rem; }
	label { display: grid; gap: 0.15rem; }
	label small, aside small { opacity: 0.7; }
	aside { position: sticky; top: 1rem; }
	pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 0.8rem; max-height: 70vh; overflow: auto; }
	footer { font-size: 0.85rem; opacity: 0.75; }
	footer a { color: inherit; }
	@media (max-width: 800px) {
		.layout { grid-template-columns: minmax(0, 1fr); }
		aside { position: static; }
	}
</style>
