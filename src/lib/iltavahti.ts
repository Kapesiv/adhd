import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export interface Task {
	id: string;
	label: string;
	done: boolean;
}

export interface IltavahtiState {
	tasks: Task[];
	lastResetDate: string;
	// Streak: lista päivämääristä jolloin iltatoimet tehtiin
	completedDays: string[];
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
		tasks: defaultTasks.map((t) => ({ ...t, id: createId() })),
		lastResetDate: todayStr(),
		completedDays: []
	};
}

function loadState(): IltavahtiState {
	if (!browser) return seedState();

	try {
		const saved = window.localStorage.getItem(STORAGE_KEY);
		if (!saved) return seedState();

		const parsed = JSON.parse(saved) as IltavahtiState;

		// Migraatio: poista vanha bedtime-kenttä
		if ('bedtime' in parsed) delete (parsed as any).bedtime;

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
			update((s) => {
				const newTasks = s.tasks.map((t) => (t.id === taskId ? { ...t, done: true } : t));
				const allDone = newTasks.every((t) => t.done);
				const today = todayStr();
				const days = allDone && !s.completedDays.includes(today)
					? [...s.completedDays, today]
					: s.completedDays;
				return { ...s, tasks: newTasks, completedDays: days };
			});
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

// Laske putki: montako peräkkäistä päivää taaksepäin (eilen, toissapäivänä...)
export function getStreak(completedDays: string[]): number {
	if (completedDays.length === 0) return 0;

	const set = new Set(completedDays);
	const today = todayStr();
	let streak = 0;
	const d = new Date();

	// Jos tänään on tehty, laske tänään mukaan
	if (set.has(today)) {
		streak = 1;
		d.setDate(d.getDate() - 1);
	} else {
		// Jos eilen on tehty, aloita siitä (putki ei ole vielä katkennut)
		d.setDate(d.getDate() - 1);
		if (!set.has(d.toISOString().slice(0, 10))) return 0;
	}

	while (set.has(d.toISOString().slice(0, 10))) {
		streak++;
		d.setDate(d.getDate() - 1);
	}

	return streak;
}

export function isTodayDone(completedDays: string[]): boolean {
	return completedDays.includes(todayStr());
}

// ── Wake Lock ──
let wakeLock: WakeLockSentinel | null = null;

export async function requestWakeLock() {
	if (!browser) return;
	try {
		if ('wakeLock' in navigator) {
			wakeLock = await navigator.wakeLock.request('screen');
			// iOS voi vapauttaa lockin kun tabi menee taustalle, ota takaisin
			document.addEventListener('visibilitychange', async () => {
				if (document.visibilityState === 'visible' && !wakeLock) {
					wakeLock = await navigator.wakeLock.request('screen');
				}
			});
		}
	} catch {
		// Ei tuettu tai epäonnistui
	}
}

export function releaseWakeLock() {
	wakeLock?.release();
	wakeLock = null;
}

// ── Ääni ──
let audioCtx: AudioContext | null = null;
let alarmInterval: ReturnType<typeof setInterval> | null = null;

export function initAudio() {
	if (!browser || audioCtx) return;
	audioCtx = new AudioContext();
}

function beep(freq: number, duration: number, delay: number) {
	if (!audioCtx) return;
	const t = audioCtx.currentTime + delay;
	const osc = audioCtx.createOscillator();
	const gain = audioCtx.createGain();
	osc.connect(gain);
	gain.connect(audioCtx.destination);
	osc.frequency.value = freq;
	osc.type = 'sine';
	gain.gain.setValueAtTime(0.4, t);
	gain.gain.exponentialRampToValueAtTime(0.01, t + duration);
	osc.start(t);
	osc.stop(t + duration);
}

export function playTick() {
	if (!audioCtx) return;
	beep(900, 0.06, 0);
}

// Jatkuva hälytys — toistetaan kunnes pysäytetään
export function startAlarm() {
	if (alarmInterval) return;

	function ring() {
		beep(520, 0.15, 0);
		beep(680, 0.15, 0.2);
		beep(520, 0.15, 0.4);
		beep(680, 0.2, 0.6);
	}

	ring();
	alarmInterval = setInterval(ring, 2000);
}

export function stopAlarm() {
	if (alarmInterval) {
		clearInterval(alarmInterval);
		alarmInterval = null;
	}
}

// ── Haptic ──
export function haptic() {
	if (!browser) return;
	try {
		if ('vibrate' in navigator) {
			navigator.vibrate(30);
		}
	} catch {
		// iOS ei tue, mutta ei haittaa
	}
}

export function hapticHeavy() {
	if (!browser) return;
	try {
		if ('vibrate' in navigator) {
			navigator.vibrate([50, 30, 50]);
		}
	} catch {
		// iOS ei tue
	}
}

// ── Liiketunnistin ──
type MotionCallback = () => void;
let motionCallback: MotionCallback | null = null;
let motionListening = false;
let lastMotionTime = 0;

function handleMotion(e: DeviceMotionEvent) {
	const acc = e.accelerationIncludingGravity;
	if (!acc || !motionCallback) return;

	const total = Math.sqrt((acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2);
	// Normaali paikallaan ~9.8, liike nostaa arvon yli 12
	const now = Date.now();
	if (total > 13 && now - lastMotionTime > 3000) {
		lastMotionTime = now;
		motionCallback();
	}
}

export async function startMotionDetection(callback: MotionCallback) {
	if (!browser || motionListening) return;

	// iOS vaatii luvan
	const DME = typeof window !== 'undefined' ? (window as any).DeviceMotionEvent : null;
	if (DME && typeof DME.requestPermission === 'function') {
		try {
			const perm = await DME.requestPermission();
			if (perm !== 'granted') return;
		} catch {
			return;
		}
	}

	motionCallback = callback;
	motionListening = true;
	window.addEventListener('devicemotion', handleMotion);
}

export function stopMotionDetection() {
	if (!browser) return;
	motionListening = false;
	motionCallback = null;
	window.removeEventListener('devicemotion', handleMotion);
}
