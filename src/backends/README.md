# Agent Engines

CASCADE runs coding agents through a shared execution lifecycle and a pluggable engine registry.

## Core pieces

- `types.ts`: canonical engine contracts (`AgentEngine`, `AgentEngineDefinition`, `AgentExecutionPlan`)
- `catalog.ts`: static engine definitions with `archetype` field (`sdk` or `native-tool`)
- `registry.ts`: runtime engine registry (`registerEngine`, `getEngine`, `isNativeToolEngine`)
- `bootstrap.ts`: built-in engine registration (also registers settings schemas)
- `adapter.ts`: shared lifecycle around repo setup, prompts, progress, secrets, run tracking, and post-processing
- `shared/NativeToolEngine.ts`: abstract base class for subprocess-based engines (Claude Code, Codex, OpenCode)
- `llmist/`, `claude-code/`, `codex/`, `opencode/`, `antigravity/`: engine-specific implementations. `antigravity/` is a thin subclass of `opencode/` (see below).

## Archetypes

Every engine declares an `archetype` in its `AgentEngineDefinition`:

- **`native-tool`** — subprocess-based CLI tools (Claude Code, Codex, OpenCode). Extend `NativeToolEngine` from `shared/NativeToolEngine.ts`. The base class provides shared env-building, `supportsAgentType()`, `resolveModel()` delegation, and context file cleanup.
- **`sdk`** — in-process SDK integrations (LLMist). Implement `AgentEngine` directly; no base class is used.

## Subclassing an existing engine (Antigravity → OpenCode)

When a new engine is "an existing engine plus auth/provider/config differences", subclass it instead of forking. `antigravity/` extends `OpenCodeEngine` and reuses its full `execute()` pipeline (server spawn, session, stream + continuation loop, cleanup), overriding only protected hooks:

- `engineLabel` — log identity.
- `resolveEngineModel` / `getSettingsSchema` — engine-specific model + settings (read under the `antigravity` settings key).
- `resolveEngineSettingsForRun` — resolve per-run settings (e.g. `webSearch`).
- `getConfigOverrides` — additive OpenCode `Config` keys (the `opencode-antigravity-auth` plugin + `google` provider model map).
- `filterServerSecrets` — drop disk-only auth blobs (the accounts JSON) before they reach the subprocess env.
- `beforeExecute` / `afterExecute` — write the subscription accounts JSON to disk before the run and capture rotated tokens back to the DB afterwards (codex-style; see `antigravity/auth.ts`).

The OpenCode server env is built through the engine's own `getAllowedEnvExact()` / `getExtraEnvVars()` (via `NativeToolEngine.buildEnv`), so subclasses fully control which auth vars reach the server process.

## To add a new engine

See [`docs/adding-engines.md`](../../docs/adding-engines.md) for the full step-by-step guide, including archetype selection, env filtering, settings schemas, model resolution, registration, and testing.

At a high level:

1. Choose archetype: extend `NativeToolEngine` for subprocess CLIs, implement `AgentEngine` directly for in-process SDKs.
2. Create `src/backends/<engine-name>/` with `index.ts`, `env.ts`, `models.ts`, and optionally `settings.ts`.
3. Add an `AgentEngineDefinition` with the `archetype` field to `catalog.ts`.
4. Register the engine (and its settings schema) in `bootstrap.ts`.

The rest of the product consumes engine metadata dynamically via `getEngineCatalog()` — no branching on engine names required.
