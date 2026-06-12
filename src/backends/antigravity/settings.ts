import { z } from 'zod';
import { type EngineSettings, getEngineSettings } from '../../config/engineSettings.js';
import type { ProjectConfig } from '../../types/index.js';
import type { AntigravityModelFamily } from './models.js';

export const ANTIGRAVITY_SETTING_DEFAULTS = {
	webSearch: false,
};

/** Reasoning-effort levels exposed in the dashboard. */
export const ANTIGRAVITY_REASONING_EFFORTS = ['minimal', 'low', 'medium', 'high'] as const;
export type AntigravityReasoningEffort = (typeof ANTIGRAVITY_REASONING_EFFORTS)[number];

export const AntigravitySettingsSchema = z.object({
	webSearch: z.boolean().optional(),
	/**
	 * Reasoning effort applied to thinking-capable models. Gemini models map it to
	 * a `thinkingLevel`; Claude `*-thinking` models map it to a `thinkingBudget`.
	 * Ignored by non-thinking models. Unset → the model's own default.
	 */
	reasoningEffort: z.enum(ANTIGRAVITY_REASONING_EFFORTS).optional(),
});

export type AntigravitySettings = z.infer<typeof AntigravitySettingsSchema>;

export interface ResolvedAntigravitySettings {
	webSearch: boolean;
	reasoningEffort?: AntigravityReasoningEffort;
}

/**
 * Resolve Antigravity settings from the given engine settings, falling back to
 * project-level settings when no explicit override is provided.
 *
 * Reads settings stored under the `antigravity` engine-id key (distinct from the
 * `opencode` key, even though the runtime shares the OpenCode server).
 */
export function resolveAntigravitySettings(
	project: ProjectConfig,
	engineSettings?: EngineSettings,
): ResolvedAntigravitySettings {
	const effectiveSettings = engineSettings ?? project.engineSettings;
	const antigravity =
		getEngineSettings(effectiveSettings, 'antigravity', AntigravitySettingsSchema) ?? {};

	return {
		webSearch: antigravity.webSearch ?? ANTIGRAVITY_SETTING_DEFAULTS.webSearch,
		reasoningEffort: antigravity.reasoningEffort,
	};
}

/** Claude thinking-budget (tokens) per reasoning-effort level. */
const CLAUDE_THINKING_BUDGET: Record<AntigravityReasoningEffort, number> = {
	minimal: 8192,
	low: 8192,
	medium: 16000,
	high: 32768,
};

/**
 * Build the OpenCode model `options` (forwarded to the plugin as
 * `providerOptions.google`) that encode the requested reasoning effort for a
 * given model family. Returns `undefined` when no effort applies — non-thinking
 * models, or no effort configured (so the model uses its own default).
 *
 * The plugin's `extractVariantThinkingConfig` reads these two shapes:
 *   - Gemini 3 native:  { thinkingLevel: "high" }
 *   - Claude budget:    { thinkingConfig: { thinkingBudget: 32768 } }
 */
export function buildReasoningOptions(
	family: AntigravityModelFamily,
	effort: AntigravityReasoningEffort | undefined,
): Record<string, unknown> | undefined {
	if (!effort) return undefined;
	if (family === 'gemini') return { thinkingLevel: effort };
	if (family === 'claude-thinking') {
		return { thinkingConfig: { thinkingBudget: CLAUDE_THINKING_BUDGET[effort] } };
	}
	return undefined;
}
