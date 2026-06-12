import { z } from 'zod';
import { type EngineSettings, getEngineSettings } from '../../config/engineSettings.js';
import type { ProjectConfig } from '../../types/index.js';

export const ANTIGRAVITY_SETTING_DEFAULTS = {
	webSearch: false,
};

export const AntigravitySettingsSchema = z.object({
	webSearch: z.boolean().optional(),
});

export type AntigravitySettings = z.infer<typeof AntigravitySettingsSchema>;

export interface ResolvedAntigravitySettings
	extends Required<Pick<AntigravitySettings, 'webSearch'>> {}

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
	};
}
