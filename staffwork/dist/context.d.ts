import type { LanguageModel } from 'ai';
import { type BlockKey, type Charter } from './charter.js';
/** Contextrie's index description of a source. */
export interface Metadata {
    title: string;
    description: string;
    keypoints: string[];
}
export declare const PINNED: BlockKey[];
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
export declare function sections(notes: Note[]): Note[];
export declare function selectContext(model: LanguageModel, charter: Charter, notes: Note[], request: string, opts?: SelectOptions): Promise<Selection>;
