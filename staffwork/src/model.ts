// One structured model call. Any AI SDK v6 model works; temperature 0 so the same input gives the same answer.
import { generateText, Output, type LanguageModel } from 'ai';
import type { z } from 'zod';

export async function ask<T>(model: LanguageModel, system: string, prompt: string, schema: z.ZodType<T>): Promise<T> {
	const { output } = await generateText({ model, system, prompt, temperature: 0, output: Output.object({ schema }) });
	return output as T;
}

export const message = (e: unknown) => (e instanceof Error ? e.message : String(e)).split('\n')[0].slice(0, 200);
