import type { Config } from '@opencode-ai/sdk/client';

import { logger } from '../../utils/logging.js';
import { ANTIGRAVITY_ENGINE_DEFINITION } from '../catalog.js';
import { OpenCodeEngine } from '../opencode/index.js';
import type { AgentEngineResult, AgentExecutionPlan } from '../types.js';
import {
	ANTIGRAVITY_ACCOUNTS_CREDENTIAL,
	captureRefreshedAccounts,
	writeAntigravityAccountsFile,
} from './auth.js';
import { ALLOWED_ENV_EXACT } from './env.js';
import {
	ANTIGRAVITY_MODEL_SPECS,
	ANTIGRAVITY_PROVIDER,
	DEFAULT_ANTIGRAVITY_MODEL,
	findAntigravityModelSpec,
} from './models.js';
import {
	AntigravitySettingsSchema,
	buildReasoningOptions,
	type ResolvedAntigravitySettings,
	resolveAntigravitySettings,
} from './settings.js';

/**
 * Pinned `opencode-antigravity-auth` plugin spec.
 *
 * MUST match the version installed in `Dockerfile.worker`. The plugin is loaded
 * by the OpenCode server via the `plugin` array in the config we inject below.
 */
export const ANTIGRAVITY_PLUGIN_VERSION = '1.6.0';
export const ANTIGRAVITY_PLUGIN_SPEC = `opencode-antigravity-auth@${ANTIGRAVITY_PLUGIN_VERSION}`;

/**
 * Resolve a CASCADE model string to the OpenCode `<provider>/<model>` form the
 * Antigravity auth plugin expects.
 *
 * - `provider/model` (already qualified) → passthrough (robust to model drift).
 * - bare `antigravity-*` id → prefixed with the `google/` provider.
 * - `provider:model` → normalized to `provider/model`.
 * - anything else → default Gemini 3 Pro, with a warning.
 */
export function resolveAntigravityModel(cascadeModel: string): string {
	if (cascadeModel.includes('/')) return cascadeModel;

	if (cascadeModel.startsWith('antigravity-')) {
		return `${ANTIGRAVITY_PROVIDER}/${cascadeModel}`;
	}

	if (cascadeModel.includes(':')) {
		const [provider, ...rest] = cascadeModel.split(':');
		if (provider && rest.length > 0) {
			return `${provider}/${rest.join(':')}`;
		}
	}

	logger.warn('Unsupported model configured for Antigravity engine, falling back to default', {
		configured: cascadeModel,
		fallback: DEFAULT_ANTIGRAVITY_MODEL,
	});
	return DEFAULT_ANTIGRAVITY_MODEL;
}

/**
 * Antigravity (Google) backend for CASCADE.
 *
 * Runs Google's Antigravity-quota models (Gemini 3 Pro, Claude, …) using a
 * subscription auth token. Built on top of the OpenCode server: it reuses
 * OpenCodeEngine's entire execute() pipeline (server spawn, session, stream +
 * continuation loop, cleanup) via protected extension hooks, layering in:
 *
 *  - the `opencode-antigravity-auth` plugin + `google` provider model map
 *    (getConfigOverrides),
 *  - subscription auth via a DB-stored accounts JSON written to disk before each
 *    run and captured back afterwards (beforeExecute / afterExecute),
 *  - Antigravity model resolution and its own settings key.
 */
export class AntigravityEngine extends OpenCodeEngine {
	readonly definition = ANTIGRAVITY_ENGINE_DEFINITION;

	/** Original accounts JSON written in beforeExecute; used to detect token refresh. */
	private _originalAccountsJson: string | undefined;

	// -------------------------------------------------------------------------
	// NativeToolEngine abstract method implementations
	// -------------------------------------------------------------------------

	getAllowedEnvExact(): Set<string> {
		return ALLOWED_ENV_EXACT;
	}

	getExtraEnvVars(): Record<string, string> {
		return { CI: 'true' };
	}

	resolveEngineModel(cascadeModel: string): string {
		return resolveAntigravityModel(cascadeModel);
	}

	getSettingsSchema() {
		return AntigravitySettingsSchema;
	}

	// -------------------------------------------------------------------------
	// OpenCodeEngine extension hooks
	// -------------------------------------------------------------------------

	protected get engineLabel(): string {
		return 'Antigravity';
	}

	protected resolveEngineSettingsForRun(input: AgentExecutionPlan): ResolvedAntigravitySettings {
		return resolveAntigravitySettings(input.project, input.engineSettings);
	}

	/**
	 * Inject the Antigravity auth plugin and register the `google` provider models
	 * the plugin serves. These keys are additive on top of OpenCode's base config.
	 *
	 * Reasoning effort is applied to the SELECTED model via its `options`, which
	 * OpenCode forwards to the plugin as `providerOptions.google` (the plugin's
	 * `extractVariantThinkingConfig` reads `thinkingLevel` / `thinkingConfig`).
	 * This is the pinned-SDK-compatible path — `opencode-ai@1.14.25` has no
	 * runtime `--variant` selection on the prompt body.
	 */
	protected getConfigOverrides(input: AgentExecutionPlan): Partial<Config> {
		const { reasoningEffort } = resolveAntigravitySettings(input.project, input.engineSettings);
		const selectedId = findAntigravityModelSpec(this.resolveModel(input.model))?.id;

		const models: Record<string, unknown> = {};
		for (const spec of ANTIGRAVITY_MODEL_SPECS) {
			const entry: Record<string, unknown> = {
				name: spec.label,
				limit: spec.limit,
				modalities: spec.modalities,
				reasoning: spec.family !== 'claude',
			};
			if (spec.id === selectedId) {
				const options = buildReasoningOptions(spec.family, reasoningEffort);
				if (options) entry.options = options;
			}
			models[spec.id] = entry;
		}

		// Cast: `plugin` / `provider` are valid OpenCode config keys but may not be
		// surfaced on the published SDK `Config` type. They are passed through to the
		// server verbatim via OPENCODE_CONFIG_CONTENT.
		return {
			plugin: [ANTIGRAVITY_PLUGIN_SPEC],
			provider: {
				[ANTIGRAVITY_PROVIDER]: { models },
			},
		} as Partial<Config>;
	}

	/**
	 * The accounts JSON is written to disk (beforeExecute) and read by the auth
	 * plugin from there — it must never be forwarded into the server subprocess
	 * env (it would be a large, redundant credential blob). Strip it.
	 */
	protected filterServerSecrets(
		secrets: Record<string, string> | undefined,
	): Record<string, string> | undefined {
		if (!secrets) return secrets;
		const { [ANTIGRAVITY_ACCOUNTS_CREDENTIAL]: _omit, ...rest } = secrets;
		return rest;
	}

	// -------------------------------------------------------------------------
	// Auth lifecycle (codex-style: write before, capture refresh after)
	// -------------------------------------------------------------------------

	async beforeExecute(plan: AgentExecutionPlan): Promise<void> {
		this._originalAccountsJson = await writeAntigravityAccountsFile(
			plan.projectSecrets,
			plan.logWriter,
		);
	}

	async afterExecute(plan: AgentExecutionPlan, result: AgentEngineResult): Promise<void> {
		await super.afterExecute(plan, result);
		await captureRefreshedAccounts(plan.project.id, this._originalAccountsJson, plan.logWriter);
		this._originalAccountsJson = undefined;
	}
}
