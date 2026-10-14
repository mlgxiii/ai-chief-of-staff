import type { LanguageModel } from 'ai';
import type { BlockKey, Charter } from './charter.js';
export type Lane = 'handle' | 'prepare' | 'approve';
export interface Decision {
    action: string;
    lane: Lane;
    /** Why, in one sentence. */
    reason: string;
    /** The rule relied on, as quoted by the model. */
    rule?: string;
    /** The block the quote was found in; undefined when it wasn't found. */
    block?: BlockKey;
    /** False when the lane was moved to "approve" because the quote wasn't in the charter or the call failed. */
    grounded: boolean;
}
export declare const DECISION_PROMPT = "You apply my approval rules to one action you are about to take.\nLanes:\n- handle: my rules let you do it on your own.\n- prepare: my rules say you prepare it and I approve it.\n- approve: you must ask me before doing anything.\nPick the lane my rules give. Copy the exact words of the rule you used into \"rule\".\nIf no rule clearly covers the action, pick approve.";
export declare class DecisionRights {
    private readonly model;
    private readonly charter;
    readonly prompt: string;
    constructor(model: LanguageModel, charter: Charter, prompt?: string);
    decide(action: string): Promise<Decision>;
    /** Decide several actions in parallel. One failure doesn't affect the others. */
    run(actions: string[]): Promise<Decision[]>;
}
