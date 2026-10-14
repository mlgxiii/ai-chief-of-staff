import { type LanguageModel } from 'ai';
import type { z } from 'zod';
export declare function ask<T>(model: LanguageModel, system: string, prompt: string, schema: z.ZodType<T>): Promise<T>;
export declare const message: (e: unknown) => string;
