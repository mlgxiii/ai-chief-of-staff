import { MockLanguageModelV3 } from 'ai/test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { brief, Charter, Corrections, DecisionRights, Triage, type Triaged } from '../src/index.ts';

const root = join(import.meta.dirname, '../..');
const example = readFileSync(join(root, 'examples/founder.md'), 'utf8');
const charter = Charter.parse(example);

/** A model that always answers `json`, or throws when given an Error. */
const fake = (json: object | Error) =>
	new MockLanguageModelV3({
		doGenerate: async () => {
			if (json instanceof Error) throw json;
			return {
				content: [{ type: 'text', text: JSON.stringify(json) }],
				finishReason: { unified: 'stop', raw: 'stop' },
				usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
				warnings: []
			} as any;
		}
	});

test('Charter parses the eight blocks from the example and from the template files', () => {
	assert.deepEqual(charter.keys(), ['role', 'goals', 'people', 'tools', 'preferences', 'approvals', 'routines', 'notifications']);
	assert.match(charter.get('notifications'), /### Rules learned from corrections/);
	assert.doesNotMatch(charter.get('role'), /^## /m);

	const dir = join(root, 'template');
	const templates = Charter.parse(...readdirSync(dir).map((f) => readFileSync(join(dir, f), 'utf8')));
	assert.equal(templates.keys().length, 8);
	assert.doesNotMatch(templates.toMarkdown(), /<!--/);
});

test('Charter renders the prompt and adds rules without changing the original', () => {
	assert.match(charter.toPrompt(), /^You are my AI Chief of Staff\./);
	assert.match(charter.toPrompt(undefined, ['role']), /## My role/);
	assert.doesNotMatch(charter.toPrompt(undefined, ['role']), /## My tools/);

	const next = charter.addRule('approvals', 'Never accept a meeting before 9:30.');
	assert.match(next.get('approvals'), /### Rules learned from corrections\n- Never accept a meeting before 9:30\./);
	assert.doesNotMatch(charter.get('approvals'), /9:30\./);
	const twice = next.addRule('approvals', '- Second rule');
	assert.equal(twice.get('approvals').match(/Rules learned/g)?.length, 1);
	assert.match(twice.get('approvals'), /\n- Second rule$/);
});

test('Charter.find matches quotes word for word, ignoring Markdown, case and spacing', () => {
	assert.equal(charter.find('always ask me first: anything i\'d sign'), 'approvals');
	assert.equal(charter.find('**Interrupt me now:**   a client unhappy'), 'notifications');
	assert.equal(charter.find('a rule that is not there'), undefined);
	assert.equal(charter.find('sign'), undefined, 'too short to count');
});

test('DecisionRights keeps a grounded lane', async () => {
	const d = await new DecisionRights(fake({ lane: 'prepare', rule: 'replies to clients and prospects', reason: 'A prospect reply.' }), charter).decide('Reply to Northwind');
	assert.equal(d.lane, 'prepare');
	assert.equal(d.block, 'approvals');
	assert.equal(d.grounded, true);
});

test('DecisionRights falls back to approve without a real rule, on errors, and with no approval rules', async () => {
	const invented = await new DecisionRights(fake({ lane: 'handle', rule: 'you may send any email', reason: 'Fine.' }), charter).decide('Email the bank');
	assert.equal(invented.lane, 'approve');
	assert.equal(invented.grounded, false);

	const broken = await new DecisionRights(fake(new Error('rate limited')), charter).decide('Book a flight');
	assert.equal(broken.lane, 'approve');
	assert.match(broken.reason, /rate limited/);

	const empty = await new DecisionRights(fake({ lane: 'handle', rule: 'x', reason: 'y' }), new Charter({ role: 'CEO' })).decide('Anything');
	assert.equal(empty.lane, 'approve');
});

test('Triage keeps grounded tiers and never interrupts or hides without a rule', async () => {
	const urgent = await new Triage(fake({ tier: 'now', rule: 'a payment failed', reason: 'Payment failure.' }), charter).sort({ text: 'Stripe: payment failed' });
	assert.equal(urgent.tier, 'now');

	const noisy = await new Triage(fake({ tier: 'now', rule: 'anything from a VIP', reason: 'VIP.' }), charter).sort({ text: 'Hello' });
	assert.equal(noisy.tier, 'daily');
	assert.equal(noisy.grounded, false);

	const hidden = await new Triage(fake({ tier: 'silent', rule: 'promotions', reason: 'Promo.' }), charter).sort({ text: 'Sale!' });
	assert.equal(hidden.tier, 'daily');

	const weekly = await new Triage(fake({ tier: 'weekly', rule: '', reason: 'A trend.' }), charter).sort({ text: 'Pipeline down 10%' });
	assert.equal(weekly.tier, 'weekly', 'daily and weekly need no quote');

	const broken = await new Triage(fake(new Error('timeout')), charter).run([{ text: 'a' }, { text: 'b' }]);
	assert.deepEqual(broken.map((t) => t.tier), ['daily', 'daily']);
});

test('brief groups items, counts silent ones and marks unverified reasons', () => {
	const t = (text: string, tier: Triaged['tier'], grounded = true): Triaged => ({ text, tier, reason: `because ${text}`, grounded });
	const b = brief([t('Payment failed', 'now'), t('Lena replied', 'daily', false), t('Pipeline trend', 'weekly'), t('Newsletter', 'silent')], { title: 'Morning brief' });
	assert.equal(b.now.length, 1);
	assert.equal(b.silent, 1);
	assert.match(b.markdown, /^# Morning brief\n\n## Needs you now\n- Payment failed/);
	assert.match(b.markdown, /Unverified: because Lena replied/);
	assert.doesNotMatch(b.markdown, /Pipeline trend/);
	assert.match(b.markdown, /_1 for the weekly review, 1 kept silent\._/);
	assert.match(brief([t('Pipeline trend', 'weekly')], { weekly: true }).markdown, /## This week\n- Pipeline trend/);
	assert.match(brief([]).markdown, /Nothing needs you\./);
});

test('Corrections files the rule in the block the model picks', async () => {
	const learned = await new Corrections(fake({ block: 'preferences', rule: 'Keep drafts under 5 sentences.' }), charter).learn('Too long!');
	assert.equal(learned.block, 'preferences');
	assert.match(learned.charter.get('preferences'), /- Keep drafts under 5 sentences\.$/);
});

test('CLI: init, add, list and prompt work in an empty folder', () => {
	const cli = join(root, 'staffwork/dist/cli.js');
	const dir = mkdtempSync(join(tmpdir(), 'staffwork-'));
	// Run the file itself, as npx does, so a missing #! line fails the test.
	const run = (...args: string[]) => execFileSync(cli, args, { cwd: dir, encoding: 'utf8' });

	run('init');
	assert.equal(readdirSync(join(dir, 'chief-of-staff')).length, 8);
	assert.match(run('init'), /skipped/);
	run('add', 'triage', 'brief');
	assert.deepEqual(readdirSync(join(dir, 'staffwork')).sort(), ['brief.ts', 'charter.ts', 'model.ts', 'triage.ts']);
	assert.match(run('list'), /decision-rights/);
	assert.match(run('prompt'), /You are my AI Chief of Staff[\s\S]*## My approval rules/);
});
