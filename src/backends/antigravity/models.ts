/**
 * Antigravity (Google) engine models.
 *
 * The engine runs on top of the OpenCode server with the
 * `opencode-antigravity-auth` plugin, which registers Antigravity-quota models
 * under the `google` provider. OpenCode addresses models as `<provider>/<model>`,
 * so the runtime model string is always `google/<antigravity-model-id>`.
 *
 * The list below drives the dashboard model picker. Antigravity's catalog evolves
 * quickly, so `resolveAntigravityModel` deliberately passes through any
 * `provider/model` string rather than hard-rejecting unknown ids — keeping the
 * engine robust to upstream model drift.
 */

export const ANTIGRAVITY_MODELS = [
	{ value: 'google/antigravity-gemini-3-pro', label: 'Gemini 3 Pro (Antigravity, default)' },
	{ value: 'google/antigravity-gemini-3-flash', label: 'Gemini 3 Flash (Antigravity)' },
	{
		value: 'google/antigravity-claude-opus-4-6-thinking',
		label: 'Claude Opus 4.6 Thinking (Antigravity)',
	},
] as const;

export const ANTIGRAVITY_MODEL_IDS = ANTIGRAVITY_MODELS.map((m) => m.value);

export const DEFAULT_ANTIGRAVITY_MODEL = 'google/antigravity-gemini-3-pro';

/** OpenCode provider key the auth plugin registers Antigravity models under. */
export const ANTIGRAVITY_PROVIDER = 'google';
