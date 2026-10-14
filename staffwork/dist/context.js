import {
  BASE_PROMPT,
  BLOCKS
} from "./chunk-NBOAKW2B.js";

// node_modules/@contextrie/core/types/source.ts
var IndexedSourceBase = class {
  /**
   * @param id Unique source ID
   * @param metadata Optional metadata; missing metadata means source is draft.
   * @param path Optional source provenance path
   */
  constructor(id, metadata, path) {
    this.id = id;
    this.metadata = metadata;
    this.path = path;
  }
  id;
  metadata;
  path;
  /** True when source has not been indexed yet. */
  get isDraft() {
    return !this.metadata;
  }
};

// node_modules/@contextrie/core/sources/document.ts
var DocumentSource = class extends IndexedSourceBase {
  /**
   * @param id Unique source ID
   * @param metadata Generated metadata for the source
   * @param content Document text
   */
  constructor(id, metadata, content, path) {
    super(id, metadata, path);
    this.content = content;
  }
  content;
  kind = "document";
  get isIterable() {
    return false;
  }
  /** Returns the document text. */
  getContent = () => this.content;
  buildIndexInput() {
    return this.content;
  }
  buildDeepJudgeInput() {
    return this.content;
  }
};

// node_modules/@contextrie/core/agents/judge/index.ts
import { generateText, Output } from "ai";
import { z } from "zod";

// node_modules/@contextrie/core/agents/judge/types.ts
var JudgeTaskPromptRecord = {
  response: "Judge whether this source is useful for producing a direct, high-quality response to the input.",
  proof: "Judge whether this source materially supports, verifies, or grounds the input with evidence.",
  other: "Judge whether this source is meaningfully relevant to the input and objective."
};

// node_modules/@contextrie/core/agents/judge/index.ts
var DEFAULT_JUDGE_PROMPT = `Judge source relevance for a task.

Return ONLY valid JSON with this exact shape:
{
  "score": number,
  "reason": string
}

Rules:
- score must be between 0 and 1
- reason must be concise and factual
- use only the provided task and source information
- no markdown, no code fences, no extra keys`;
var judgeDecisionSchema = z.object({
  score: z.number().min(0).max(1),
  reason: z.string()
});
var JudgeAgent = class {
  constructor(model, prompt = DEFAULT_JUDGE_PROMPT) {
    this.model = model;
    this.prompt = prompt;
  }
  model;
  prompt;
  queue = [];
  deepQueue = [];
  from = (source) => {
    if (Array.isArray(source)) this.queue.push(...source);
    else this.queue.push(source);
    return this;
  };
  fromDeep = (source) => {
    if (Array.isArray(source)) this.deepQueue.push(...source);
    else this.deepQueue.push(source);
    return this;
  };
  deep = () => {
    this.deepQueue.push(...this.queue);
    this.queue = [];
    return this;
  };
  clear = () => {
    this.queue = [];
    this.deepQueue = [];
    return this;
  };
  buildShallowPrompt = (task, source) => {
    const metadata = source.metadata;
    if (!metadata) {
      throw new Error(
        `[JudgeAgent] shallow source ${source.id} is missing metadata`
      );
    }
    return `${this.prompt}

Task objective: ${task.objective}
Task input: ${task.input}
Task guidance: ${JudgeTaskPromptRecord[task.objective]}

Source ID: ${source.id}
Source kind: ${source.kind}
Source title: ${metadata.title}
Source description: ${metadata.description}
Source keypoints:
${metadata.keypoints.map((point) => `- ${point}`).join("\n")}`;
  };
  buildDeepPrompt = async (task, source) => {
    const content = await source.buildDeepJudgeInput();
    return `${this.prompt}

Task objective: ${task.objective}
Task input: ${task.input}
Task guidance: ${JudgeTaskPromptRecord[task.objective]}

Source ID: ${source.id}
Source kind: ${source.kind}

Source content:
${content}`;
  };
  async judgeDeepSource(task, source) {
    console.info(
      `[JudgeAgent] starting deep judgment for source ${source.id} (${source.kind})`
    );
    try {
      const prompt = await this.buildDeepPrompt(task, source);
      const { output } = await generateText({
        model: this.model,
        output: Output.object({ schema: judgeDecisionSchema }),
        prompt
      });
      console.info(
        `[JudgeAgent] completed deep judgment for source ${source.id} with score ${output.score}`
      );
      return output;
    } catch (error) {
      console.error(
        `[JudgeAgent] deep judgment failed for source ${source.id} (${source.kind})`,
        error
      );
      throw error;
    }
  }
  async judgeShallowSource(task, source) {
    console.info(
      `[JudgeAgent] starting shallow judgment for source ${source.id} (${source.kind})`
    );
    try {
      const prompt = this.buildShallowPrompt(task, source);
      const { output } = await generateText({
        model: this.model,
        output: Output.object({ schema: judgeDecisionSchema }),
        prompt
      });
      console.info(
        `[JudgeAgent] completed shallow judgment for source ${source.id} with score ${output.score}`
      );
      return output;
    } catch (error) {
      console.error(
        `[JudgeAgent] shallow judgment failed for source ${source.id} (${source.kind})`,
        error
      );
      throw error;
    }
  }
  async run(task) {
    const shallowCount = this.queue.length;
    const deepCount = this.deepQueue.length;
    const totalCount = shallowCount + deepCount;
    const results = {};
    const failures = [];
    console.info(`[JudgeAgent] judging ${totalCount} source(s)`);
    try {
      const shallowJobs = this.queue.map(async (source) => {
        try {
          results[source.id] = await this.judgeShallowSource(task, source);
        } catch {
          failures.push(source);
        }
      });
      const deepJobs = this.deepQueue.map(async (source) => {
        try {
          results[source.id] = await this.judgeDeepSource(task, source);
        } catch {
          failures.push(source);
        }
      });
      await Promise.all([...shallowJobs, ...deepJobs]);
      if (failures.length > 0) {
        console.error(
          `[JudgeAgent] ${failures.length}/${totalCount} judgment(s) failed for task objective ${task.objective}: ${failures.map((source) => `${source.id} (${source.kind})`).join(", ")}`
        );
        throw new Error(
          `[JudgeAgent] failed ${failures.length} of ${totalCount} judgment(s)`
        );
      }
      console.info(`[JudgeAgent] completed judging ${totalCount} source(s)`);
      return results;
    } catch (error) {
      console.error(
        `[JudgeAgent] failed while judging sources for task objective ${task.objective}`,
        error
      );
      throw error;
    } finally {
      this.clear();
    }
  }
};

// node_modules/@contextrie/core/agents/indexing/index.ts
import { generateText as generateText2, Output as Output2 } from "ai";
import { z as z2 } from "zod";
var DEFAULT_INDEXING_PROMPT = `Generate metadata for retrieval.

Return ONLY valid JSON with this exact shape:
{
  "title": string,
  "description": string,
  "keypoints": string[]
}

Rules:
- title: specific and concise (max 80 chars)
- description: 1-2 factual sentences about what this source contains and when to use it
- keypoints: 3-7 short strings with the most relevant facts, constraints, entities, or decisions
- prioritize information that helps relevance filtering
- use only provided content
- no markdown, no code fences, no extra keys`;
var metadataSchema = z2.object({
  title: z2.string(),
  description: z2.string(),
  keypoints: z2.array(z2.string())
});
var IndexingAgent = class {
  constructor(model, prompt = DEFAULT_INDEXING_PROMPT) {
    this.model = model;
    this.prompt = prompt;
  }
  model;
  prompt;
  queue = [];
  add = (source) => {
    if (Array.isArray(source)) this.queue.push(...source);
    else this.queue.push(source);
    return this;
  };
  clear = () => {
    this.queue = [];
    return this;
  };
  generateMetadata = async (source) => {
    const input = await source.buildIndexInput();
    const { output } = await generateText2({
      model: this.model,
      output: Output2.object({ schema: metadataSchema }),
      prompt: `${this.prompt}

Source ID: ${source.id}
Source kind: ${source.kind}

Source content:
${input}`
    });
    return output;
  };
  async run() {
    console.info(`[IndexingAgent] indexing ${this.queue.length} source(s)`);
    const failedSources = [];
    const successfulResults = [];
    await Promise.all(
      this.queue.map(async (source) => {
        try {
          console.info(`[IndexingAgent] indexing source ${source.id} (${source.kind})`);
          const metadata = await this.generateMetadata(source);
          source.metadata = metadata;
          successfulResults.push(source);
          console.info(`[IndexingAgent] indexed source ${source.id}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[IndexingAgent] failed to index source ${source.id}: ${message}`);
          failedSources.push(source);
        }
      })
    );
    console.info(
      `[IndexingAgent] completed indexing ${successfulResults.length}/${this.queue.length} source(s), failed: ${failedSources.length}`
    );
    this.clear();
    return successfulResults;
  }
};

// staffwork/src/context.ts
import { createHash } from "node:crypto";
var PINNED = ["role", "approvals", "notifications"];
function sections(notes) {
  return notes.flatMap(
    (n) => n.text.replace(/<!--[\s\S]*?-->/g, "").split(/^(?=## )/m).map((part) => part.trim()).filter((part) => part.startsWith("## ") || part.replace(/^# .+\n?/, "").trim().length >= 200).map((part) => {
      const heading = part.match(/^#{1,2} (.+)/)?.[1] ?? n.id;
      return { id: `${n.id}#${heading.toLowerCase().replace(/\W+/g, "-").replace(/^-|-$/g, "")}`, text: part };
    })
  );
}
var hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
async function selectContext(model, charter, notes, request, opts = {}) {
  const { limit = 8, minScore = 0.3, cache = /* @__PURE__ */ new Map(), base = BASE_PROMPT } = opts;
  const pinned = PINNED.filter((k) => charter.has(k));
  const blockSections = charter.keys().filter((k) => !pinned.includes(k)).map((k) => ({ id: `charter#${k}`, text: `## ${BLOCKS.find((b) => b.key === k).title}
${charter.get(k)}`, block: k }));
  const candidates = [...blockSections, ...sections(notes)];
  const indexer = new IndexingAgent(model);
  const sources = await Promise.all(
    candidates.map(async (c) => {
      const key = hash(c.text);
      const source = new DocumentSource(c.id, cache.get(key), c.text);
      if (!source.metadata) cache.set(key, source.metadata = await indexer.generateMetadata(source));
      return source;
    })
  );
  const judgments = sources.length ? await new JudgeAgent(model).from(sources).run({ objective: "response", input: request }) : {};
  const ranked = candidates.map((c) => ({ ...c, score: judgments[c.id]?.score ?? 0, reason: judgments[c.id]?.reason ?? "not judged" })).sort((a, b) => b.score - a.score);
  const kept = new Set(ranked.filter((c, i) => i < 3 || c.score >= minScore).slice(0, limit).map((c) => c.id));
  const keptBlocks = [...pinned, ...blockSections.filter((b) => kept.has(b.id)).map((b) => b.block)];
  const keptNotes = candidates.filter((c) => !c.block && kept.has(c.id)).map((c) => c.text);
  const prompt = [charter.toPrompt(base, keptBlocks), ...keptNotes, `## Request
${request}`].join("\n\n");
  return {
    request,
    prompt,
    pinned: pinned.map((k) => `charter#${k}`),
    ranked: ranked.map((c) => ({ id: c.id, score: c.score, reason: c.reason, kept: kept.has(c.id) }))
  };
}
export {
  PINNED,
  sections,
  selectContext
};
