import { describe, expect, it } from 'vitest';
import { ALLOWED_ENV_EXACT } from '../../../src/backends/antigravity/env.js';
import {
	SHARED_ALLOWED_ENV_EXACT,
	SHARED_BLOCKED_ENV_EXACT,
} from '../../../src/backends/shared/envFilter.js';

describe('antigravity ALLOWED_ENV_EXACT', () => {
	it('does not allow any blocked vars', () => {
		for (const blocked of SHARED_BLOCKED_ENV_EXACT) {
			expect(ALLOWED_ENV_EXACT.has(blocked)).toBe(false);
		}
	});

	it('is a superset of the shared allowlist', () => {
		for (const allowed of SHARED_ALLOWED_ENV_EXACT) {
			expect(ALLOWED_ENV_EXACT.has(allowed)).toBe(true);
		}
	});

	it('does not leak server secrets', () => {
		expect(ALLOWED_ENV_EXACT.has('DATABASE_URL')).toBe(false);
		expect(ALLOWED_ENV_EXACT.has('REDIS_URL')).toBe(false);
		expect(ALLOWED_ENV_EXACT.has('CREDENTIAL_MASTER_KEY')).toBe(false);
	});

	it('does not pass the accounts credential as an env var (file-based auth)', () => {
		// Antigravity auth is file-based — the accounts JSON is written to disk by
		// beforeExecute, never forwarded into the agent process environment.
		expect(ALLOWED_ENV_EXACT.has('ANTIGRAVITY_ACCOUNTS_JSON')).toBe(false);
	});
});
