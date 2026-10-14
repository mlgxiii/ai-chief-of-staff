import type { Triaged } from './triage.js';
export interface Brief {
    now: Triaged[];
    daily: Triaged[];
    weekly: Triaged[];
    /** Silent items are counted, never listed. */
    silent: number;
    markdown: string;
}
export interface BriefOptions {
    /** Heading of the brief, e.g. "Morning brief, Tuesday 14 October". */
    title?: string;
    /** Include the weekly items (for a weekly review). Default false: a daily brief leaves them for the week. */
    weekly?: boolean;
    /** Show why each item landed where it did. Default true. */
    reasons?: boolean;
}
export declare function brief(items: Triaged[], { title, weekly, reasons }?: BriefOptions): Brief;
