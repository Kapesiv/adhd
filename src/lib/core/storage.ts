import { browser } from '$app/environment';
import { defaultSettings, type IntensityPreference, type UserSettings } from './state';

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

function normalizeSettings(raw: unknown): UserSettings | undefined {
	if (!raw || typeof raw !== 'object') return undefined;

	const candidate = raw as Partial<UserSettings>;
	const wakeUpTime =
		typeof candidate.wakeUpTime === 'string' && /^\d{2}:\d{2}$/.test(candidate.wakeUpTime)
			? candidate.wakeUpTime
			: defaultSettings.wakeUpTime;
	const sleepHours =
		typeof candidate.sleepHours === 'number' &&
		Number.isFinite(candidate.sleepHours) &&
		candidate.sleepHours >= 5 &&
		candidate.sleepHours <= 10
			? candidate.sleepHours
			: defaultSettings.sleepHours;
	const allowedIntensity: IntensityPreference[] = ['light', 'medium', 'hard'];
	const intensityPreference = allowedIntensity.includes(
		candidate.intensityPreference as IntensityPreference
	)
		? (candidate.intensityPreference as IntensityPreference)
		: defaultSettings.intensityPreference;

	return {
		onboardingDone: candidate.onboardingDone === true,
		wakeUpTime,
		sleepHours,
		intensityPreference,
		selectedSymptoms: Array.isArray(candidate.selectedSymptoms)
			? candidate.selectedSymptoms.filter((value): value is string => typeof value === 'string')
			: defaultSettings.selectedSymptoms
	};
}

export async function saveSettings(s: UserSettings): Promise<void> {
	write(SETTINGS_KEY, s);
}

export async function loadSettings(): Promise<UserSettings | undefined> {
	const raw = read<unknown>(SETTINGS_KEY, null);
	const normalized = normalizeSettings(raw);
	if (normalized) {
		write(SETTINGS_KEY, normalized);
	}
	return normalized;
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
