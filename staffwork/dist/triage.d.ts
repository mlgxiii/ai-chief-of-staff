import type { LanguageModel } from 'ai';
import type { BlockKey, Charter } from './charter.js';
export type Tier = 'now' | 'daily' | 'weekly' | 'silent';
export interface Item {
    id?: string;
    /** What happened: an email, an event, a specialist's report… */
    text: string;
    /** Where it came from ("Gmail", "Finance agent"). */
    source?: string;
    at?: string;
}
export interface Triaged extends Item {
    tier: Tier;
    reason: string;
    rule?: string;
    block?: BlockKey;
    /** False when the tier was moved to "daily" because the quote wasn't in the charter or the call failed. */
    grounded: boolean;
}
export declare const TRIAGE_PROMPT = "You sort one incoming item by my notification rules.\nTiers:\n- now: interrupt me immediately (urgent, high-impact, blocking, security or financial risk).\n- daily: important but not urgent; goes in my daily brief.\n- weekly: patterns, drift, longer-term decisions; goes in my weekly review.\n- silent: I never need to see it.\nPick the tier my rules give. Copy the exact words of the rule you used into \"rule\".\nIf no rule clearly covers the item, pick daily.";
export declare class Triage {
    private readonly model;
    private readonly charter;
    readonly prompt: string;
    constructor(model: LanguageModel, charter: Charter, prompt?: string);
    sort(item: Item): Promise<Triaged>;
    /** Sort several items in parallel. One failure doesn't affect the others. */
    run(items: Item[]): Promise<Triaged[]>;
}
