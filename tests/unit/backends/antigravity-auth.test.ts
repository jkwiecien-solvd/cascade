import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockMkdir = vi.fn().mockResolvedValue(undefined);
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockReadFile = vi.fn();
const mockWriteProjectCredential = vi.fn().mockResolvedValue(undefined);

vi.mock('node:fs/promises', () => ({
	mkdir: (...args: unknown[]) => mockMkdir(...args),
	writeFile: (...args: unknown[]) => mockWriteFile(...args),
	readFile: (...args: unknown[]) => mockReadFile(...args),
}));

vi.mock('../../../src/db/repositories/credentialsRepository.js', () => ({
	writeProjectCredential: (...args: unknown[]) => mockWriteProjectCredential(...args),
}));

import {
	ANTIGRAVITY_ACCOUNTS_CREDENTIAL,
	ANTIGRAVITY_ACCOUNTS_FILE,
	captureRefreshedAccounts,
	writeAntigravityAccountsFile,
} from '../../../src/backends/antigravity/auth.js';

const ACCOUNTS_JSON = JSON.stringify({
	accounts: [{ email: 'dev@example.com', refreshToken: 'rt-1', projectId: 'gcp-1' }],
});

describe('writeAntigravityAccountsFile', () => {
	beforeEach(() => vi.clearAllMocks());
	afterEach(() => vi.restoreAllMocks());

	it('writes a 0600 accounts file and returns the JSON when the credential is present', async () => {
		const logWriter = vi.fn();
		const result = await writeAntigravityAccountsFile(
			{ [ANTIGRAVITY_ACCOUNTS_CREDENTIAL]: ACCOUNTS_JSON },
			logWriter,
		);

		expect(result).toBe(ACCOUNTS_JSON);
		expect(mockWriteFile).toHaveBeenCalledWith(ANTIGRAVITY_ACCOUNTS_FILE, ACCOUNTS_JSON, {
			mode: 0o600,
		});
	});

	it('returns undefined and warns when the credential is absent', async () => {
		const logWriter = vi.fn();
		const result = await writeAntigravityAccountsFile({}, logWriter);

		expect(result).toBeUndefined();
		expect(mockWriteFile).not.toHaveBeenCalled();
		expect(logWriter).toHaveBeenCalledWith('WARN', expect.stringContaining('not configured'), {});
	});

	it('returns undefined when the credential is not valid JSON', async () => {
		const logWriter = vi.fn();
		const result = await writeAntigravityAccountsFile(
			{ [ANTIGRAVITY_ACCOUNTS_CREDENTIAL]: 'not-json{' },
			logWriter,
		);

		expect(result).toBeUndefined();
		expect(mockWriteFile).not.toHaveBeenCalled();
	});
});

describe('captureRefreshedAccounts', () => {
	beforeEach(() => vi.clearAllMocks());
	afterEach(() => vi.restoreAllMocks());

	it('no-ops when there was no original credential', async () => {
		await captureRefreshedAccounts('proj-1', undefined, vi.fn());
		expect(mockReadFile).not.toHaveBeenCalled();
		expect(mockWriteProjectCredential).not.toHaveBeenCalled();
	});

	it('does not persist when the file is unchanged', async () => {
		mockReadFile.mockResolvedValueOnce(ACCOUNTS_JSON);
		await captureRefreshedAccounts('proj-1', ACCOUNTS_JSON, vi.fn());
		expect(mockWriteProjectCredential).not.toHaveBeenCalled();
	});

	it('persists the rotated credential when the file changed', async () => {
		const rotated = JSON.stringify({
			accounts: [{ email: 'dev@example.com', refreshToken: 'rt-2', projectId: 'gcp-1' }],
		});
		mockReadFile.mockResolvedValueOnce(rotated);

		await captureRefreshedAccounts('proj-1', ACCOUNTS_JSON, vi.fn());

		expect(mockWriteProjectCredential).toHaveBeenCalledWith(
			'proj-1',
			ANTIGRAVITY_ACCOUNTS_CREDENTIAL,
			rotated,
		);
	});

	it('does not throw when the accounts file is unreadable', async () => {
		mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));
		await expect(
			captureRefreshedAccounts('proj-1', ACCOUNTS_JSON, vi.fn()),
		).resolves.toBeUndefined();
		expect(mockWriteProjectCredential).not.toHaveBeenCalled();
	});
});
