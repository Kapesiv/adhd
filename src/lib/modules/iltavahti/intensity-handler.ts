import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import type { IntensityLevel } from '$lib/core/events';
import { emit } from '$lib/core/events';
import type { IntensityPreference } from '$lib/core/state';
import { haptic, hapticHeavy, requestWakeLock, releaseWakeLock } from '$lib/iltavahti';
import { pickInteraction, type Interaction } from './interaction-picker';

export const currentInteraction = writable<Interaction | null>(null);

export function clearCurrentInteraction(): void {
	currentInteraction.set(null);
}

let lastLevel: IntensityLevel = 'calm';
let interactionInterval: ReturnType<typeof setInterval> | null = null;

function vibrateForLevel(level: IntensityLevel): void {
	if (level === 'gentle') haptic();
	else if (level === 'warning' || level === 'urgent' || level === 'overdue') hapticHeavy();
}

function sendNotification(level: IntensityLevel): void {
	if (!browser || typeof Notification === 'undefined') return;
	if (Notification.permission !== 'granted') return;
	const titles: Record<IntensityLevel, string> = {
		calm: '',
		gentle: 'Aika alkaa olla',
		warning: 'Mene nukkumaan',
		urgent: 'MENE NUKKUMAAN',
		overdue: 'Olet jo myöhässä'
	};
	const title = titles[level];
	if (!title) return;
	try {
		new Notification(title, { silent: false });
	} catch {
		// ignore
	}
}

function shouldAct(level: IntensityLevel, pref: IntensityPreference): boolean {
	if (level === 'calm') return false;
	if (pref === 'light' && level === 'gentle') return false;
	return true;
}

function getInteractionIntervalMs(level: IntensityLevel): number {
	switch (level) {
		case 'warning': return 5 * 60 * 1000;
		case 'urgent': return 2 * 60 * 1000;
		case 'overdue': return 60 * 1000;
		default: return 0;
	}
}

async function triggerInteraction(): Promise<void> {
	const interaction = await pickInteraction();
	currentInteraction.set(interaction);
	emit('interaction-required', {
		type: interaction.type,
		deadline: Date.now() + interaction.timeLimit * 1000
	});
}

export function handleIntensityChange(
	level: IntensityLevel,
	hoursRemaining: number,
	pref: IntensityPreference
): void {
	if (level === lastLevel) return;
	lastLevel = level;

	emit('intensity-changed', { level, hoursRemaining });

	if (!shouldAct(level, pref)) {
		if (interactionInterval) {
			clearInterval(interactionInterval);
			interactionInterval = null;
		}
		releaseWakeLock();
		return;
	}

	sendNotification(level);
	vibrateForLevel(level);

	if (interactionInterval) {
		clearInterval(interactionInterval);
		interactionInterval = null;
	}

	if (level === 'urgent' || level === 'overdue') {
		requestWakeLock();
		triggerInteraction();
		const ms = getInteractionIntervalMs(level);
		if (ms > 0) interactionInterval = setInterval(triggerInteraction, ms);
	} else if (level === 'warning' && pref !== 'light') {
		triggerInteraction();
		const ms = getInteractionIntervalMs(level);
		if (ms > 0) interactionInterval = setInterval(triggerInteraction, ms);
	} else {
		releaseWakeLock();
	}
}

export function stopIntensityHandler(): void {
	if (interactionInterval) {
		clearInterval(interactionInterval);
		interactionInterval = null;
	}
	releaseWakeLock();
	lastLevel = 'calm';
}
