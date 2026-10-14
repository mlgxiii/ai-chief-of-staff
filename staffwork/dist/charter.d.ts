export declare const BLOCKS: readonly [{
    readonly key: "role";
    readonly title: "My role";
    readonly match: RegExp;
}, {
    readonly key: "goals";
    readonly title: "My main goals";
    readonly match: RegExp;
}, {
    readonly key: "people";
    readonly title: "My key people";
    readonly match: RegExp;
}, {
    readonly key: "tools";
    readonly title: "My tools";
    readonly match: RegExp;
}, {
    readonly key: "preferences";
    readonly title: "My working preferences";
    readonly match: RegExp;
}, {
    readonly key: "approvals";
    readonly title: "My approval rules";
    readonly match: RegExp;
}, {
    readonly key: "routines";
    readonly title: "My routines & automations";
    readonly match: RegExp;
}, {
    readonly key: "notifications";
    readonly title: "My notification rules";
    readonly match: RegExp;
}];
export type BlockKey = (typeof BLOCKS)[number]['key'];
export declare const BLOCK_KEYS: BlockKey[];
/** The fixed part of the prompt, from the framework's prompt.md. */
export declare const BASE_PROMPT = "You are my AI Chief of Staff.\nYour job is to help me manage my priorities, commitments and decisions.\n\nAlways understand:\n- what I am trying to achieve\n- what is urgent or blocked\n- who is waiting on me\n- what I should do next\n\nDo not simply summarise information. Interpret it and recommend an action.\n\nYou are my only interface. Specialist agents report to you, not directly to me.\nConsolidate their work, resolve duplication, prioritise it and surface only what matters.\n\nUse automations for recurring checks and condition-based monitoring.\nNotify me immediately only for urgent, high-impact or blocking issues.\nBundle everything else into my daily or weekly brief.\n\nSeparate: 1) what you can handle, 2) what you can prepare, 3) what requires my approval.\nLearn from my corrections and adapt to the way I work.";
/** Lower-case, unify quotes and dashes, drop Markdown marks and collapse spaces, so a quote matches however it was formatted. */
export declare const normalise: (s: string) => string;
export declare class Charter {
    private readonly blocks;
    constructor(blocks?: Partial<Record<BlockKey, string>>);
    /**
     * Read blocks from one or more Markdown texts. A block starts at a `#` or `##` heading that names it
     * ("My role", "# My approval rules"…) and runs to the next `#`/`##` heading; `###` stays inside.
     * A block found twice is joined. HTML comments (the template hints) are dropped.
     */
    static parse(...markdown: string[]): Charter;
    get(key: BlockKey): string;
    has(key: BlockKey): boolean;
    /** Keys of the blocks that have content, in framework order. */
    keys(): BlockKey[];
    /** The blocks as Markdown, in framework order. Pass keys to render only some of them. */
    toMarkdown(keys?: BlockKey[]): string;
    /** The full system prompt: the framework's fixed part, then the blocks. */
    toPrompt(base?: string, keys?: BlockKey[]): string;
    /** A new charter with `rule` added under "Rules learned from corrections" in that block. */
    addRule(key: BlockKey, rule: string): Charter;
    /**
     * Which block contains `quote`, word for word (case, quotes, Markdown and spacing ignored)?
     * Quotes shorter than 8 characters never match: "yes" is not a rule.
     */
    find(quote: string | undefined, keys?: BlockKey[]): BlockKey | undefined;
}
