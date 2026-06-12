/**
 * Antigravity subscription auth — accounts-file lifecycle.
 *
 * Mirrors the Codex subscription-auth pattern (see src/backends/codex/index.ts):
 * the credential lives in the DB (`ANTIGRAVITY_ACCOUNTS_JSON`), is written to disk
 * before each run, and any refreshed token is captured back to the DB afterwards.
 *
 * The `opencode-antigravity-auth` plugin reads/writes
 * `~/.config/opencode/antigravity-accounts.json` (shape:
 * `{ accounts: [{ email, refreshToken, projectId }] }`). Because the plugin rotates
 * access tokens (and may persist new refresh tokens) during a run, we re-read the
 * file afterwards and persist it back so the rotated credential survives the
 * ephemeral worker container.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { writeProjectCredential } from '../../db/repositories/credentialsRepository.js';
import type { LogWriter } from '../types.js';

/** DB credential key holding the Antigravity OAuth accounts JSON. */
export const ANTIGRAVITY_ACCOUNTS_CREDENTIAL = 'ANTIGRAVITY_ACCOUNTS_JSON';

export const ANTIGRAVITY_CONFIG_DIR = join(homedir(), '.config', 'opencode');
export const ANTIGRAVITY_ACCOUNTS_FILE = join(ANTIGRAVITY_CONFIG_DIR, 'antigravity-accounts.json');

/**
 * Write ~/.config/opencode/antigravity-accounts.json for Antigravity subscription auth.
 * Returns the written JSON string so callers can detect post-run token refreshes.
 * Returns undefined if the credential is absent (no subscription auth configured).
 */
export async function writeAntigravityAccountsFile(
	projectSecrets: Record<string, string> | undefined,
	logWriter: LogWriter,
): Promise<string | undefined> {
	const accountsJson = projectSecrets?.[ANTIGRAVITY_ACCOUNTS_CREDENTIAL];
	if (!accountsJson) {
		logWriter(
			'WARN',
			`No ${ANTIGRAVITY_ACCOUNTS_CREDENTIAL} credential — Antigravity subscription auth is not configured`,
			{},
		);
		return undefined;
	}

	try {
		JSON.parse(accountsJson);
	} catch {
		logWriter(
			'WARN',
			`${ANTIGRAVITY_ACCOUNTS_CREDENTIAL} is not valid JSON — skipping Antigravity auth file`,
			{},
		);
		return undefined;
	}

	await mkdir(ANTIGRAVITY_CONFIG_DIR, { recursive: true });
	await writeFile(ANTIGRAVITY_ACCOUNTS_FILE, accountsJson, { mode: 0o600 });
	logWriter(
		'INFO',
		'Writing ~/.config/opencode/antigravity-accounts.json for subscription auth',
		{},
	);
	return accountsJson;
}

/**
 * After a run, read the accounts file and update the project credential if the
 * Antigravity auth plugin rotated the token during the run.
 */
export async function captureRefreshedAccounts(
	projectId: string,
	originalJson: string | undefined,
	logWriter: LogWriter,
): Promise<void> {
	if (!originalJson) return;

	let newJson: string;
	try {
		newJson = await readFile(ANTIGRAVITY_ACCOUNTS_FILE, 'utf-8');
	} catch {
		return; // Unreadable — nothing to capture
	}

	if (newJson === originalJson) return;

	try {
		await writeProjectCredential(projectId, ANTIGRAVITY_ACCOUNTS_CREDENTIAL, newJson);
		logWriter(
			'INFO',
			'Captured refreshed Antigravity accounts token and updated project credential',
			{},
		);
	} catch (error) {
		logWriter('WARN', 'Failed to capture refreshed Antigravity accounts token', {
			error: String(error),
		});
	}
}
