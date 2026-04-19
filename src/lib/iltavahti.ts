import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export interface Task {
	id: string;
	label: string;
	done: boolean;
}

export interface IltavahtiState {
	bedtime: string; // "22:30" format
	tasks: Task[];
	lastResetDate: string; // "2026-04-20" format, resets checkmarks daily
}

const STORAGE_KEY = 'adhd-iltavahti';

const defaultTasks: Omit<Task, 'id'>[] = [
	{ label: 'Laita puhelin laturiin', done: false },
	{ label: 'Pese hampaat', done: false },
	{ label: 'Valmista aamun vaatteet', done: false },
	{ label: 'Täytä vesipullo', done: false },
	{ label: 'Sammuta ylimääräiset ruudut', done: false }
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
		bedtime: '22:30',
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

		// Reset checkmarks if it's a new day
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

		toggleTask(taskId: string) {
			update((s) => ({
				...s,
				tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t))
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
		}
	};
}

export const iltavahti = createIltavahtiStore();
