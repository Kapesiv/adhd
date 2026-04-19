import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type WorkspaceState = 'now' | 'later' | 'parked';
export type SessionStatus = 'active' | 'paused' | 'done';

export interface WorkspaceItem {
	id: string;
	title: string;
	url: string;
	state: WorkspaceState;
	intent: string;
	urgency: number;
	createdAt: string;
	lastVisitedAt: string;
}

export interface Checkpoint {
	id: string;
	summary: string;
	nextStep: string;
	pinnedItemId: string | null;
	createdAt: string;
}

export interface Session {
	id: string;
	title: string;
	goal: string;
	status: SessionStatus;
	createdAt: string;
	updatedAt: string;
	items: WorkspaceItem[];
	checkpoints: Checkpoint[];
}

export interface GuardrailSettings {
	pauseSeconds: number;
	askIntent: boolean;
	requireUrl: boolean;
	defaultState: WorkspaceState;
	urgeThreshold: number;
	recoveryNudge: boolean;
	showReasonChips: boolean;
}

export interface FocusBrowserState {
	sessions: Session[];
	activeSessionId: string | null;
	settings: GuardrailSettings;
}

const STORAGE_KEY = 'adhd-focus-browser';

export const workspaceStateLabels: Record<WorkspaceState, string> = {
	now: 'Nyt',
	later: 'Myöhemmin',
	parked: 'Parkki'
};

const defaultSettings: GuardrailSettings = {
	pauseSeconds: 12,
	askIntent: true,
	requireUrl: true,
	defaultState: 'now',
	urgeThreshold: 4,
	recoveryNudge: true,
	showReasonChips: true
};

function createId() {
	if (browser && 'crypto' in window && 'randomUUID' in window.crypto) {
		return window.crypto.randomUUID();
	}

	return `id-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
	return new Date().toISOString();
}

function seedState(): FocusBrowserState {
	const createdAt = '2026-04-20T09:00:00.000Z';
	const sessionId = 'seed-session';
	const pinnedItemId = 'seed-item-main';

	return {
		activeSessionId: sessionId,
		settings: defaultSettings,
		sessions: [
			{
				id: sessionId,
				title: 'Tutki ADHD-selaimen idea',
				goal: 'Pidä yksi ajatus kasassa ilman tabitulvaa.',
				status: 'active',
				createdAt,
				updatedAt: createdAt,
				items: [
					{
						id: pinnedItemId,
						title: 'Keskeinen näkymä',
						url: 'https://example.com/focus-session',
						state: 'now',
						intent: 'Pysy tässä sivussa ja kirjoita ydinajatus valmiiksi.',
						urgency: 3,
						createdAt,
						lastVisitedAt: createdAt
					},
					{
						id: 'seed-item-reference',
						title: 'Taustalähde',
						url: 'https://example.com/reference',
						state: 'later',
						intent: 'Palaa tähän vasta kun runko on valmis.',
						urgency: 2,
						createdAt,
						lastVisitedAt: createdAt
					},
					{
						id: 'seed-item-rabbit-hole',
						title: 'Houkutteleva sivupolku',
						url: 'https://example.com/rabbit-hole',
						state: 'parked',
						intent: 'Säästä kiinnostava harhapolku myöhemmäksi.',
						urgency: 5,
						createdAt,
						lastVisitedAt: createdAt
					}
				],
				checkpoints: [
					{
						id: 'seed-checkpoint',
						summary: 'Tavoite on prototyypata tapa pysähtyä ennen uutta tabia.',
						nextStep: 'Lisää uusi session ja testaa, miten parkki helpottaa fokusta.',
						pinnedItemId,
						createdAt
					}
				]
			}
		]
	};
}

function normalizeState(value: FocusBrowserState): FocusBrowserState {
	const sessions = Array.isArray(value.sessions) ? value.sessions : [];
	const activeSessionExists = sessions.some((session) => session.id === value.activeSessionId);

	return {
		sessions,
		activeSessionId: activeSessionExists ? value.activeSessionId : sessions[0]?.id ?? null,
		settings: {
			...defaultSettings,
			...(value.settings ?? {})
		}
	};
}

function loadState() {
	if (!browser) {
		return seedState();
	}

	try {
		const saved = window.localStorage.getItem(STORAGE_KEY);
		if (!saved) {
			return seedState();
		}

		return normalizeState(JSON.parse(saved) as FocusBrowserState);
	} catch {
		return seedState();
	}
}

function persist(state: FocusBrowserState) {
	if (!browser) {
		return;
	}

	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function updateSessionList(
	state: FocusBrowserState,
	sessionId: string,
	mapper: (session: Session) => Session
) {
	return {
		...state,
		sessions: state.sessions.map((session) => (session.id === sessionId ? mapper(session) : session))
	};
}

function createFocusBrowserStore() {
	const initialState = loadState();
	const { subscribe, update, set } = writable<FocusBrowserState>(initialState);

	subscribe((value) => {
		persist(value);
	});

	return {
		subscribe,

		reset() {
			set(seedState());
		},

		setActiveSession(sessionId: string) {
			update((state) => ({
				...state,
				activeSessionId: sessionId
			}));
		},

		createSession(input: { title: string; goal: string }) {
			const createdAt = nowIso();
			const session: Session = {
				id: createId(),
				title: input.title.trim(),
				goal: input.goal.trim(),
				status: 'active',
				createdAt,
				updatedAt: createdAt,
				items: [],
				checkpoints: []
			};

			update((state) => ({
				...state,
				activeSessionId: session.id,
				sessions: [session, ...state.sessions]
			}));
		},

		updateSessionStatus(sessionId: string, status: SessionStatus) {
			update((state) =>
				updateSessionList(state, sessionId, (session) => ({
					...session,
					status,
					updatedAt: nowIso()
				}))
			);
		},

		addItem(
			sessionId: string,
			input: { title: string; url: string; state: WorkspaceState; intent: string; urgency: number }
		) {
			const createdAt = nowIso();
			const item: WorkspaceItem = {
				id: createId(),
				title: input.title.trim(),
				url: input.url.trim(),
				state: input.state,
				intent: input.intent.trim(),
				urgency: input.urgency,
				createdAt,
				lastVisitedAt: createdAt
			};

			update((state) =>
				updateSessionList(state, sessionId, (session) => ({
					...session,
					updatedAt: createdAt,
					items: [item, ...session.items]
				}))
			);
		},

		moveItem(sessionId: string, itemId: string, nextState: WorkspaceState) {
			update((state) =>
				updateSessionList(state, sessionId, (session) => ({
					...session,
					updatedAt: nowIso(),
					items: session.items.map((item) =>
						item.id === itemId
							? {
									...item,
									state: nextState,
									lastVisitedAt: nowIso()
								}
							: item
					)
				}))
			);
		},

		saveCheckpoint(
			sessionId: string,
			input: { summary: string; nextStep: string; pinnedItemId: string | null }
		) {
			const createdAt = nowIso();
			const checkpoint: Checkpoint = {
				id: createId(),
				summary: input.summary.trim(),
				nextStep: input.nextStep.trim(),
				pinnedItemId: input.pinnedItemId,
				createdAt
			};

			update((state) =>
				updateSessionList(state, sessionId, (session) => ({
					...session,
					updatedAt: createdAt,
					checkpoints: [checkpoint, ...session.checkpoints].slice(0, 6)
				}))
			);
		},

		updateSettings(patch: Partial<GuardrailSettings>) {
			update((state) => ({
				...state,
				settings: {
					...state.settings,
					...patch
				}
			}));
		}
	};
}

export const focusBrowser = createFocusBrowserStore();
