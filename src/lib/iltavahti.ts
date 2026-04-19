import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export interface Task {
	id: string;
	label: string;
	done: boolean;
}

export interface IltavahtiState {
	bedtime: string;
	tasks: Task[];
	lastResetDate: string;
}

const STORAGE_KEY = 'adhd-iltavahti';

const defaultTasks: Omit<Task, 'id'>[] = [
	{ label: 'Sammuta ylimääräiset ruudut', done: false },
	{ label: 'Laita puhelin laturiin', done: false },
	{ label: 'Pese hampaat', done: false },
	{ label: 'Valmista aamun vaatteet', done: false },
	{ label: 'Mene sänkyyn', done: false }
];

function createId() {
	if (browser && 'crypto' in window && 'randomUUID' in window.crypto) {
		return window.crypto.randomUUID();
	}
	return `id-${Math.random().toString(36).slice(2, 10)}`;
}

function todayStr() {
	return new Date().toISOString().slice(0, 10);
}

function seedState(): IltavahtiState {
	return {
		bedtime: '23:00',
		tasks: defaultTasks.map((t) => ({ ...t, id: createId() })),
		lastResetDate: todayStr()
	};
}

function loadState(): IltavahtiState {
	if (!browser) return seedState();

	try {
		const saved = window.localStorage.getItem(STORAGE_KEY);
		if (!saved) return seedState();

		const parsed = JSON.parse(saved) as IltavahtiState;

		if (parsed.lastResetDate !== todayStr()) {
			return {
				...parsed,
				lastResetDate: todayStr(),
				tasks: parsed.tasks.map((t) => ({ ...t, done: false }))
			};
		}

		return parsed;
	} catch {
		return seedState();
	}
}

function persist(state: IltavahtiState) {
	if (!browser) return;
	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createIltavahtiStore() {
	const { subscribe, update } = writable<IltavahtiState>(loadState());

	subscribe((value) => persist(value));

	return {
		subscribe,

		markDone(taskId: string) {
			update((s) => ({
				...s,
				tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, done: true } : t))
			}));
		},

		setBedtime(time: string) {
			update((s) => ({ ...s, bedtime: time }));
		},

		addTask(label: string) {
			update((s) => ({
				...s,
				tasks: [...s.tasks, { id: createId(), label: label.trim(), done: false }]
			}));
		},

		removeTask(taskId: string) {
			update((s) => ({
				...s,
				tasks: s.tasks.filter((t) => t.id !== taskId)
			}));
		},

		resetTasks() {
			update((s) => ({
				...s,
				tasks: s.tasks.map((t) => ({ ...t, done: false }))
			}));
		}
	};
}

export const iltavahti = createIltavahtiStore();

// Wake lock - pitää näytön päällä
let wakeLock: WakeLockSentinel | null = null;

export async function requestWakeLock() {
	if (!browser) return;
	try {
		if ('wakeLock' in navigator) {
			wakeLock = await navigator.wakeLock.request('screen');
		}
	} catch {
		// Ei tuettu tai käyttäjä esti
	}
}

export function releaseWakeLock() {
	wakeLock?.release();
	wakeLock = null;
}

// Hälytysääni Web Audio API:lla
let audioCtx: AudioContext | null = null;

export function initAudio() {
	if (!browser) return;
	if (!audioCtx) {
		audioCtx = new AudioContext();
	}
}

export function playAlarm() {
	if (!audioCtx) return;

	const now = audioCtx.currentTime;

	// Kolme nousevaa ääntä
	for (let i = 0; i < 3; i++) {
		const osc = audioCtx.createOscillator();
		const gain = audioCtx.createGain();
		osc.connect(gain);
		gain.connect(audioCtx.destination);

		osc.frequency.value = 440 + i * 120;
		osc.type = 'sine';
		gain.gain.value = 0.3;
		gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3 + i * 0.35);

		osc.start(now + i * 0.35);
		osc.stop(now + 0.3 + i * 0.35);
	}
}
