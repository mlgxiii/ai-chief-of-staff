// Manual check with a real model: OPENAI_API_KEY=... npx tsx staffwork/test/live.ts
import { openai } from '@ai-sdk/openai';
import { readFileSync } from 'node:fs';
import { brief, Charter, Corrections, DecisionRights, Triage } from '../src/index.ts';
import { selectContext } from '../src/context.ts';

const model = openai(process.env.MODEL ?? 'gpt-4.1-mini');
const charter = Charter.parse(readFileSync('examples/founder.md', 'utf8'));

const rights = await new DecisionRights(model, charter).run([
	'Decline a cold pitch from a link-building agency',
	'Send Northwind a nudge since they have not replied in 6 days',
	'Pay the $340 venue deposit for the Lisbon offsite',
	'Move Monday team meeting from 10:00 to 14:00',
	'Sign the Fieldwork change order'
]);
for (const d of rights) console.log(`${d.lane.padEnd(8)} ${d.grounded ? ' ' : '!'} ${d.action}\n           rule: ${d.rule ?? '-'}`);

const items = await new Triage(model, charter).run([
	{ text: 'Stripe: the payment from Atlas Bank failed', source: 'Stripe' },
	{ text: 'Lena (Northwind) replied: can we talk Thursday?', source: 'Gmail' },
	{ text: 'Your weekly Figma digest', source: 'Gmail' },
	{ text: 'Pipeline value dropped 15% over the month', source: 'HubSpot' },
	{ text: 'Fieldwork: "honestly disappointed with round two, considering other studios"', source: 'Gmail' },
	{ text: 'URGENT!!! limited offer on stock photos', source: 'Gmail' }
]);
console.log('\n' + brief(items, { title: 'Morning brief' }).markdown);

const learned = await new Corrections(model, charter).learn("Don't book anything on Friday afternoons, I told you that's finance time");
console.log(`learned → ${learned.block}: ${learned.rule}\n`);

const sel = await selectContext(model, charter, [{ id: 'notes/october.md', text: readFileSync('examples/notes/october.md', 'utf8') }], 'Prep my call with Northwind');
for (const r of sel.ranked) console.log(`${r.kept ? 'kept' : '    '} ${r.score.toFixed(2)} ${r.id}`);
