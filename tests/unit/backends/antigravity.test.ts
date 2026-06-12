import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSpawn = vi.fn();
const mockStoreLlmCall = vi.fn().mockResolvedValue(undefined);
const mockCreateOpencodeClient = vi.fn();
const mockCreateServer = vi.fn();

vi.mock('node:child_process', () => ({
	spawn: (...args: unknown[]) => mockSpawn(...args),
}));

vi.mock('node:net', () => ({
	createServer: (...args: unknown[]) => mockCreateServer(...args),
}));

vi.mock('../../../src/db/repositories/runsRepository.js', () => ({
	storeLlmCall: (...args: unknown[]) => mockStoreLlmCall(...args),
}));

vi.mock('@opencode-ai/sdk/client', () => ({
	createOpencodeClient: (...args: unknown[]) => mockCreateOpencodeClient(...args),
}));

vi.mock('../../../src/utils/logging.js', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
	ANTIGRAVITY_PLUGIN_SPEC,
	ANTIGRAVITY_PLUGIN_VERSION,
	AntigravityEngine,
	resolveAntigravityModel,
} from '../../../src/backends/antigravity/index.js';
import { DEFAULT_ANTIGRAVITY_MODEL } from '../../../src/backends/antigravity/models.js';
import type { AgentExecutionPlan } from '../../../src/backends/types.js';

/** Exposes the protected config-override hook for assertions. */
class TestableAntigravityEngine extends AntigravityEngine {
	publicConfigOverrides(input: AgentExecutionPlan) {
		return this.getConfigOverrides(input);
	}
}

function makeInput(overrides: Partial<AgentExecutionPlan> = {}): AgentExecutionPlan {
	return {
		agentType: 'implementation',
		project: {
			id: 'test-project',
			orgId: 'org-1',
			name: 'Test Project',
			repo: 'owner/repo',
			baseBranch: 'main',
			branchPrefix: 'feature/',
			pm: { type: 'trello' },
			trello: { boardId: 'b1', lists: {}, labels: {} },
			engineSettings: undefined,
		},
		config: { projects: [] },
		repoDir: '/tmp/repo',
		systemPrompt: 'You are an agent.',
		taskPrompt: 'Implement feature X.',
		cliToolsDir: '/usr/bin',
		availableTools: [],
		contextInjections: [],
		maxIterations: 20,
		budgetUsd: 5,
		model: DEFAULT_ANTIGRAVITY_MODEL,
		nativeToolCapabilities: ['fs:read', 'fs:write', 'shell:exec'],
		progressReporter: {
			onIteration: vi.fn().mockResolvedValue(undefined),
			onToolCall: vi.fn(),
			onText: vi.fn(),
		},
		logWriter: vi.fn(),
		agentInput: { workItemId: 'card-1' },
		projectSecrets: {},
		engineLogPath: undefined,
		...overrides,
	} as AgentExecutionPlan;
}

function createMockChild(output = 'opencode server listening on http://127.0.0.1:4101\n') {
	const child = new EventEmitter() as EventEmitter & {
		stdout: PassThrough;
		stderr: PassThrough;
		kill: ReturnType<typeof vi.fn>;
	};
	child.stdout = new PassThrough();
	child.stderr = new PassThrough();
	child.kill = vi.fn();
	queueMicrotask(() => child.stdout.write(output));
	return child;
}

function createEventStream(events: Array<Record<string, unknown>>) {
	return {
		stream: (async function* () {
			for (const event of events) yield event;
		})(),
	};
}

function createMockPortServer(port = 4101) {
	return {
		once: vi.fn(),
		listen: vi.fn((_p: number, _h: string, cb: () => void) => cb()),
		address: vi.fn(() => ({ port })),
		close: vi.fn((cb?: (e?: Error) => void) => cb?.()),
	};
}

describe('resolveAntigravityModel', () => {
	it('passes through provider/model values', () => {
		expect(resolveAntigravityModel('google/antigravity-gemini-3-pro')).toBe(
			'google/antigravity-gemini-3-pro',
		);
	});

	it('prefixes bare antigravity-* ids with the google provider', () => {
		expect(resolveAntigravityModel('antigravity-gemini-3-flash')).toBe(
			'google/antigravity-gemini-3-flash',
		);
	});

	it('normalizes provider:model values', () => {
		expect(resolveAntigravityModel('google:antigravity-gemini-3-pro')).toBe(
			'google/antigravity-gemini-3-pro',
		);
	});

	it('falls back to the default for unsupported bare values', () => {
		expect(resolveAntigravityModel('gpt-5')).toBe(DEFAULT_ANTIGRAVITY_MODEL);
	});
});

describe('AntigravityEngine definition', () => {
	it('declares the antigravity native-tool engine', () => {
		const engine = new AntigravityEngine();
		expect(engine.definition.id).toBe('antigravity');
		expect(engine.definition.archetype).toBe('native-tool');
		expect(engine.definition.capabilities).toContain('permission_policy');
	});

	it('validates its settings schema', () => {
		const engine = new AntigravityEngine();
		const schema = engine.getSettingsSchema();
		expect(schema.parse({ webSearch: true })).toEqual({ webSearch: true });
	});

	it('resolves the engine model through resolveAntigravityModel', () => {
		const engine = new AntigravityEngine();
		expect(engine.resolveModel('antigravity-gemini-3-pro')).toBe('google/antigravity-gemini-3-pro');
	});
});

describe('AntigravityEngine config overrides', () => {
	it('injects the pinned auth plugin and the google provider models', () => {
		const engine = new TestableAntigravityEngine();
		const overrides = engine.publicConfigOverrides(makeInput()) as {
			plugin: string[];
			provider: Record<string, { models: Record<string, unknown> }>;
		};

		expect(overrides.plugin).toEqual([ANTIGRAVITY_PLUGIN_SPEC]);
		expect(ANTIGRAVITY_PLUGIN_SPEC).toBe(`opencode-antigravity-auth@${ANTIGRAVITY_PLUGIN_VERSION}`);
		expect(Object.keys(overrides.provider.google.models)).toContain('antigravity-gemini-3-pro');
	});
});

describe('AntigravityEngine execute', () => {
	beforeEach(() => {
		mockCreateServer.mockReturnValue(createMockPortServer());
	});
	afterEach(() => vi.restoreAllMocks());

	it('runs the OpenCode pipeline and forwards the antigravity plugin config to the server', async () => {
		mockSpawn.mockReturnValue(createMockChild());
		mockCreateOpencodeClient.mockImplementation(() => ({
			session: {
				create: vi.fn().mockResolvedValue({ data: { id: 'session-1' } }),
				prompt: vi.fn().mockResolvedValue({
					data: {
						info: { id: 'assistant-1', cost: 0.1 },
						parts: [
							{
								id: 'text-final',
								sessionID: 'session-1',
								messageID: 'assistant-1',
								type: 'text',
								text: 'Done. https://github.com/owner/repo/pull/9',
							},
						],
					},
				}),
				delete: vi.fn().mockResolvedValue(true),
			},
			event: {
				subscribe: vi
					.fn()
					.mockResolvedValue(
						createEventStream([{ type: 'session.idle', properties: { sessionID: 'session-1' } }]),
					),
			},
			postSessionIdPermissionsPermissionId: vi.fn(),
		}));

		const engine = new AntigravityEngine();
		const result = await engine.execute(makeInput());

		expect(result.success).toBe(true);
		expect(result.prUrl).toBe('https://github.com/owner/repo/pull/9');

		// The injected plugin + provider config must reach the server subprocess via
		// OPENCODE_CONFIG_CONTENT.
		const spawnEnv = mockSpawn.mock.calls[0][2].env as Record<string, string>;
		const configContent = spawnEnv.OPENCODE_CONFIG_CONTENT;
		expect(configContent).toContain(ANTIGRAVITY_PLUGIN_SPEC);
		expect(configContent).toContain('"google"');
		expect(configContent).toContain('google/antigravity-gemini-3-pro');
	});

	it('does not forward the accounts credential into the server subprocess env', async () => {
		mockSpawn.mockReturnValue(createMockChild());
		mockCreateOpencodeClient.mockImplementation(() => ({
			session: {
				create: vi.fn().mockResolvedValue({ data: { id: 'session-1' } }),
				prompt: vi.fn().mockResolvedValue({
					data: { info: { id: 'assistant-1', cost: 0 }, parts: [] },
				}),
				delete: vi.fn().mockResolvedValue(true),
			},
			event: {
				subscribe: vi
					.fn()
					.mockResolvedValue(
						createEventStream([{ type: 'session.idle', properties: { sessionID: 'session-1' } }]),
					),
			},
			postSessionIdPermissionsPermissionId: vi.fn(),
		}));

		const engine = new AntigravityEngine();
		await engine.execute(
			makeInput({ projectSecrets: { ANTIGRAVITY_ACCOUNTS_JSON: '{"accounts":[]}' } }),
		);

		const spawnEnv = mockSpawn.mock.calls[0][2].env as Record<string, string>;
		expect(spawnEnv.ANTIGRAVITY_ACCOUNTS_JSON).toBeUndefined();
	});
});
