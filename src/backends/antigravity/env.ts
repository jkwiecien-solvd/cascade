/**
 * Environment filtering for the Antigravity (Google) engine.
 *
 * Antigravity subscription auth is file-based: the `opencode-antigravity-auth`
 * plugin reads OAuth credentials from `~/.config/opencode/antigravity-accounts.json`
 * (written by the engine's beforeExecute hook), so NO auth env var needs to reach
 * the OpenCode server subprocess. The allowlist is therefore just the shared safe
 * host set — keeping server-side secrets (DATABASE_URL, REDIS_URL, etc.) out of the
 * agent process.
 */

import { SHARED_ALLOWED_ENV_EXACT } from '../shared/envFilter.js';

export const ALLOWED_ENV_EXACT = new Set([...SHARED_ALLOWED_ENV_EXACT]);
