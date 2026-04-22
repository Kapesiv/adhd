import { browser } from '$app/environment';
import type { UserSettings } from './state';

const SETTINGS_KEY = 'adhd-iltavahti-v2';
const INTERACTIONS_KEY = 'adhd-iltavahti-interactions';
const SLEEPLOG_KEY = 'adhd-iltavahti-sleeplog';
const INTERACTIONS_MAX = 200;

function read<T>(key: string, fallback: T): T {
	if (!browser) return fallback;
	try {
		const raw = window.localStorage.getItem(key);
		if (!raw) return fallback;
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

function write<T>(key: string, value: T): void {
	if (!browser) return;
	try {
		window.localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// quota or serialize error: best effort, ignore
	}
}

export async function saveSettings(s: UserSettings): Promise<void> {
	write(SETTINGS_KEY, s);
}

export async function loadSettings(): Promise<UserSettings | undefined> {
	const raw = read<UserSettings | null>(SETTINGS_KEY, null);
	return raw ?? undefined;
}

export interface InteractionRecord {
	type: string;
	timestamp: number;
	durationMs: number;
	completed: boolean;
}

export async function logInteraction(record: InteractionRecord): Promise<void> {
	const all = read<InteractionRecord[]>(INTERACTIONS_KEY, []);
	all.push(record);
	const trimmed = all.length > INTERACTIONS_MAX ? all.slice(-INTERACTIONS_MAX) : all;
	write(INTERACTIONS_KEY, trimmed);
}

export async function getRecentInteractions(limit = 10): Promise<InteractionRecord[]> {
	const all = read<InteractionRecord[]>(INTERACTIONS_KEY, []);
	return all.slice(-limit);
}

export interface SleepLogEntry {
	date: string;
	bedtime: string;
	wakeTime: string;
	sleepHours: number;
	intensityReached: string;
}

export async function logSleep(entry: SleepLogEntry): Promise<void> {
	const all = read<SleepLogEntry[]>(SLEEPLOG_KEY, []);
	const next = all.filter((e) => e.date !== entry.date);
	next.push(entry);
	write(SLEEPLOG_KEY, next);
}
