import type { LanguageModel } from 'ai';
import { type BlockKey, type Charter } from './charter.js';
export interface Learned {
    block: BlockKey;
    rule: string;
    charter: Charter;
}
export declare const CORRECTION_PROMPT: string;
export declare class Corrections {
    private readonly model;
    private readonly charter;
    readonly prompt: string;
    constructor(model: LanguageModel, charter: Charter, prompt?: string);
    learn(correction: string): Promise<Learned>;
}
