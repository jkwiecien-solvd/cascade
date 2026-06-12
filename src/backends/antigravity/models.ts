/**
 * Antigravity (Google) engine models.
 *
 * The engine runs on top of the OpenCode server with the
 * `opencode-antigravity-auth` plugin, which registers Antigravity-quota models
 * under the `google` provider. OpenCode addresses models as `<provider>/<model>`,
 * so the runtime model string is always `google/<antigravity-model-id>`.
 *
 * This list mirrors the plugin's documented "Antigravity Quota" models (see the
 * plugin README's Available Models section). Reasoning effort is NOT encoded as
 * separate model IDs — it is applied per-run via each model's `options`
 * (providerOptions), see `index.ts` getConfigOverrides + the `reasoningEffort`
 * engine setting.
 */

/**
 * How a model expresses reasoning effort:
 * - `gemini`         → `thinkingLevel` string ("minimal" | "low" | "medium" | "high")
 * - `claude-thinking`→ `thinkingConfig.thinkingBudget` number
 * - `claude`         → no thinking (effort ignored)
 */
export type AntigravityModelFamily = 'gemini' | 'claude-thinking' | 'claude';

export interface AntigravityModelSpec {
	/** Model id WITHOUT the provider prefix (e.g. `antigravity-gemini-3-pro`). */
	id: string;
	label: string;
	family: AntigravityModelFamily;
	limit: { context: number; output: number };
	modalities: { input: Array<'text' | 'image' | 'pdf'>; output: Array<'text'> };
}

/** OpenCode provider key the auth plugin registers Antigravity models under. */
export const ANTIGRAVITY_PROVIDER = 'google';

const IMAGE_PDF_INPUT: AntigravityModelSpec['modalities'] = {
	input: ['text', 'image', 'pdf'],
	output: ['text'],
};

/**
 * Authoritative Antigravity-quota model specs (plugin v1.6.0 README + config).
 * Limits/modalities come straight from the plugin's documented config. There is
 * no "Gemini 3.5" model in the plugin — the Flash model is `gemini-3-flash`
 * (what Google's Antigravity CLI displays as "3.5 Flash").
 */
export const ANTIGRAVITY_MODEL_SPECS: AntigravityModelSpec[] = [
	{
		id: 'antigravity-gemini-3-pro',
		label: 'Gemini 3 Pro (Antigravity)',
		family: 'gemini',
		limit: { context: 1048576, output: 65535 },
		modalities: IMAGE_PDF_INPUT,
	},
	{
		id: 'antigravity-gemini-3.1-pro',
		label: 'Gemini 3.1 Pro (Antigravity)',
		family: 'gemini',
		limit: { context: 1048576, output: 65535 },
		modalities: IMAGE_PDF_INPUT,
	},
	{
		id: 'antigravity-gemini-3-flash',
		label: 'Gemini 3 Flash (Antigravity)',
		family: 'gemini',
		limit: { context: 1048576, output: 65536 },
		modalities: IMAGE_PDF_INPUT,
	},
	{
		id: 'antigravity-claude-sonnet-4-6',
		label: 'Claude Sonnet 4.6 (Antigravity)',
		family: 'claude',
		limit: { context: 200000, output: 64000 },
		modalities: IMAGE_PDF_INPUT,
	},
	{
		id: 'antigravity-claude-opus-4-6-thinking',
		label: 'Claude Opus 4.6 Thinking (Antigravity)',
		family: 'claude-thinking',
		limit: { context: 200000, output: 64000 },
		modalities: IMAGE_PDF_INPUT,
	},
];

export const DEFAULT_ANTIGRAVITY_MODEL = `${ANTIGRAVITY_PROVIDER}/antigravity-gemini-3-pro`;

/** Dropdown options for the dashboard model picker. */
export const ANTIGRAVITY_MODELS = ANTIGRAVITY_MODEL_SPECS.map((spec) => ({
	value: `${ANTIGRAVITY_PROVIDER}/${spec.id}`,
	label: spec.label,
}));

export const ANTIGRAVITY_MODEL_IDS = ANTIGRAVITY_MODELS.map((m) => m.value);

/** Look up a model spec by its fully-qualified `google/<id>` value. */
export function findAntigravityModelSpec(qualifiedModel: string): AntigravityModelSpec | undefined {
	const bareId = qualifiedModel.startsWith(`${ANTIGRAVITY_PROVIDER}/`)
		? qualifiedModel.slice(`${ANTIGRAVITY_PROVIDER}/`.length)
		: qualifiedModel;
	return ANTIGRAVITY_MODEL_SPECS.find((spec) => spec.id === bareId);
}
