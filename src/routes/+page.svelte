<svelte:options runes={false} />

<script lang="ts">
	import {
		iltavahti, getStreak, isTodayDone,
		requestWakeLock, releaseWakeLock,
		initAudio, playTick, startAlarm, stopAlarm,
		haptic,
		startMotionDetection, stopMotionDetection
	} from '$lib/iltavahti';
	import { onMount, onDestroy } from 'svelte';
	import { settings } from '$lib/core/state';
	import {
		calculateDeadline,
		hoursUntilDeadline,
		sleepIfNow,
		getIntensityLevel,
		formatTime
	} from '$lib/modules/iltavahti/time-engine';
	import {
		handleIntensityChange,
		stopIntensityHandler,
		currentInteraction,
		clearCurrentInteraction
	} from '$lib/modules/iltavahti/intensity-handler';
	import InteractionModal from '$lib/modules/iltavahti/InteractionModal.svelte';
	import IntensityOverlay from '$lib/modules/iltavahti/IntensityOverlay.svelte';
	import type { IntensityLevel } from '$lib/core/events';

	// --- State ---
	let now = new Date();
	const timer = setInterval(() => (now = new Date()), 1000);
	let audioReady = false;
	let alarmActive = false;
	let phonePickedUp = false;
	let pickupTimeout: ReturnType<typeof setTimeout> | null = null;
	let showSettings = false;

	// "doing" = tapping through tasks, "idle" = streak/start view
	let mode: 'idle' | 'doing' | 'done' = 'idle';

	let level: IntensityLevel = 'calm';

	onMount(() => {
		const s = $iltavahti;
		if (isTodayDone(s.completedDays ?? [])) {
			mode = 'done';
		}
	});

	onDestroy(() => {
		clearInterval(timer);
		releaseWakeLock();
		stopAlarm();
		stopMotionDetection();
		stopIntensityHandler();
		clearCurrentInteraction();
	});

	// Intensiteetti: laske jokaisella tikityksella
	$: deadline = calculateDeadline($settings.wakeUpTime, $settings.sleepHours);
	$: hoursRemaining = (() => {
		void now;
		return hoursUntilDeadline(deadline);
	})();
	$: hoursIfNow = (() => {
		void now;
		return sleepIfNow($settings.wakeUpTime);
	})();
	$: level = getIntensityLevel(hoursRemaining);

	// Aktivoi handler vain kun onboarding tehty
	$: if ($settings.onboardingDone) {
		handleIntensityChange(level, hoursRemaining, $settings.intensityPreference);
	}

	function onInteractionDone() {
		clearCurrentInteraction();
	}

	$: state = $iltavahti;
	$: streak = getStreak(state.completedDays ?? []);
	$: todayDone = isTodayDone(state.completedDays ?? []);
	$: remaining = state.tasks.filter((t) => !t.done);
	$: current = remaining[0] ?? null;
	$: allDone = state.tasks.length > 0 && remaining.length === 0;

	// Switch to done mode when all tasks completed
	$: if (allDone && mode === 'doing') {
		mode = 'done';
	}

	// Bedtime logic
	$: bedtimeParts = state.bedtime.split(':').map(Number);
	$: bedtimeToday = (() => {
		const d = new Date();
		d.setHours(bedtimeParts[0], bedtimeParts[1], 0, 0);
		return d;
	})();
	$: minutesLeft = Math.round((bedtimeToday.getTime() - now.getTime()) / 60000);
	$: overTime = minutesLeft <= 0;

	// Alarm when overtime and still doing tasks
	$: if (overTime && mode === 'doing' && !allDone && !alarmActive && audioReady) {
		alarmActive = true;
		startAlarm();
	}
	$: if (allDone && alarmActive) {
		alarmActive = false;
		stopAlarm();
	}

	// Background color for task mode
	$: bg = (() => {
		if (mode !== 'doing') return 'var(--bg)';
		if (allDone) return '#0a0f0a';
		if (overTime) return '#1a0505';
		if (minutesLeft <= 15) return '#1a0f05';
		if (minutesLeft <= 45) return '#15130a';
		return '#0f1115';
	})();

	// Week calendar
	$: week = (() => {
		const days: { date: string; label: string; done: boolean; isToday: boolean }[] = [];
		const set = new Set(state.completedDays ?? []);
		const weekdays = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];
		for (let i = 6; i >= 0; i--) {
			const d = new Date();
			d.setDate(d.getDate() - i);
			const str = d.toISOString().slice(0, 10);
			days.push({
				date: str,
				label: weekdays[d.getDay()],
				done: set.has(str),
				isToday: i === 0
			});
		}
		return days;
	})();

	const rewards = [
		{ label: 'YouTube', url: 'https://youtube.com' },
		{ label: 'TikTok', url: 'https://tiktok.com' },
		{ label: 'Instagram', url: 'https://instagram.com' },
		{ label: 'Reddit', url: 'https://reddit.com' },
		{ label: 'X', url: 'https://x.com' }
	];

	function startTasks() {
		mode = 'doing';
		requestWakeLock();
	}

	function tap() {
		if (!audioReady) {
			initAudio();
			audioReady = true;
		}

		if (alarmActive) {
			stopAlarm();
			alarmActive = false;
		}

		if (!current) return;

		haptic();
		playTick();
		iltavahti.markDone(current.id);

		if (remaining.length <= 1) {
			stopAlarm();
			startMotionDetection(() => {
				phonePickedUp = true;
				if (pickupTimeout) clearTimeout(pickupTimeout);
				pickupTimeout = setTimeout(() => { phonePickedUp = false; }, 4000);
			});
		}
	}

	function clock(d: Date) {
		return d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
	}
</script>

<svelte:head>
	<title>Iltavahti</title>
</svelte:head>

<!-- DOING: fullscreen tap mode -->
{#if mode === 'doing' && !allDone}
	<div class="full" style="background: {bg}" role="button" tabindex="0" onclick={tap} onkeydown={(e) => e.key === 'Enter' && tap()}>
		<p class="clock">
			{clock(now)}
			{#if $settings.onboardingDone}
				<span class="sleep-mini">{hoursIfNow.toFixed(1)}h</span>
			{/if}
		</p>

		{#if alarmActive}
			<p class="warn blink">Aika meni. Tee nyt.</p>
		{/if}

		<h1 class="task-name">{current?.label}</h1>

		<p class="hint">
			{#if !audioReady}
				Napauta aloittaaksesi
			{:else}
				Napauta kun tehty
			{/if}
		</p>

		<div class="dots">
			{#each state.tasks as task}
				<span class="dot" class:done={task.done} class:active={task.id === current?.id}></span>
			{/each}
		</div>
	</div>

<!-- DONE: goodnight + rewards -->
{:else if mode === 'done' || todayDone}
	<div class="page">
		<div class="done-top">
			<p class="done-clock">{clock(now)}</p>
			{#if phonePickedUp}
				<p class="warn">Laita puhelin pois.</p>
			{:else}
				<p class="done-msg">Tehty. Hyvää yötä.</p>
			{/if}

			{#if streak > 0}
				<div class="streak-badge">{streak} {streak === 1 ? 'ilta' : 'iltaa'} putkeen</div>
			{/if}
		</div>

		<div class="rewards">
			<div class="reward-grid">
				{#each rewards as r}
					<a href={r.url} target="_blank" rel="noreferrer" class="reward">{r.label}</a>
				{/each}
			</div>
		</div>
	</div>

<!-- IDLE: streak + start -->
{:else}
	<div class="page">
		<!-- Settings toggle -->
		<button class="settings-btn" onclick={() => showSettings = !showSettings}>
			{showSettings ? 'Sulje' : 'Asetukset'}
		</button>

		{#if showSettings}
			<div class="settings-panel">
				<label class="setting-row">
					<span>Nukkumaanmeno</span>
					<input
						type="time"
						value={state.bedtime}
						onchange={(e) => iltavahti.setBedtime((e.currentTarget as HTMLInputElement).value)}
					/>
				</label>
			</div>
		{/if}

		{#if $settings.onboardingDone}
			<div class="sleep-counter" data-level={level}>
				<span class="sleep-num">{hoursIfNow.toFixed(1)}</span>
				<span class="sleep-label">tuntia unta jos menet nyt</span>
				<span class="deadline-row">Nukkumaan klo {formatTime(deadline)}</span>
			</div>
		{/if}

		<div class="streak-block">
			{#if streak > 0}
				<div class="streak-num">{streak}</div>
				<p class="streak-label">{streak === 1 ? 'ilta putkeen' : 'iltaa putkeen'}</p>
			{:else}
				<p class="streak-label no-streak">Aloita tänään.</p>
			{/if}

			<div class="week">
				{#each week as day}
					<div class="day" class:done={day.done} class:today={day.isToday}>
						<span class="day-dot">{day.done ? '●' : '○'}</span>
						<span class="day-label">{day.label}</span>
					</div>
				{/each}
			</div>
		</div>

		<button class="start-btn" onclick={startTasks}>
			Tee iltatoimet
		</button>

		<div class="rewards locked-section">
			<p class="rewards-hint">Tee ensin iltatoimet.</p>
			<div class="reward-grid">
				{#each rewards as r}
					<div class="reward locked">{r.label}</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

<!-- Intensiteetti-overlay (urgent/overdue) -->
<IntensityOverlay {level} visible={$settings.onboardingDone} />

<!-- Pakotettu interaktio -->
{#if $currentInteraction}
	<InteractionModal interaction={$currentInteraction} on:done={onInteractionDone} />
{/if}

<style>
	/* ── Page (idle & done views) ── */
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		max-width: 400px;
		margin: 0 auto;
		padding: 2rem 1.25rem;
		min-height: 100vh;
		min-height: 100dvh;
	}

	/* ── Settings ── */
	.settings-btn {
		align-self: flex-end;
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 0.8rem;
		cursor: pointer;
		padding: 0.25rem 0;
	}

	.settings-panel {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		padding: 1rem;
	}

	.setting-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.9rem;
	}

	.setting-row input[type='time'] {
		background: var(--field);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 0.4rem 0.6rem;
		font: inherit;
		font-size: 0.9rem;
	}

	/* ── Sleep counter ── */
	.sleep-counter {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 1.5rem 1rem;
		border-radius: 0.75rem;
		background: var(--bg-card);
		border: 1px solid var(--border);
		text-align: center;
		transition: border-color 0.5s, background 0.5s;
	}
	.sleep-counter[data-level='gentle'] {
		border-color: var(--intensity-gentle);
	}
	.sleep-counter[data-level='warning'] {
		border-color: var(--intensity-warning);
		background: rgba(255, 112, 67, 0.08);
	}
	.sleep-counter[data-level='urgent'] {
		border-color: var(--intensity-urgent);
		background: rgba(255, 82, 82, 0.12);
	}
	.sleep-counter[data-level='overdue'] {
		border-color: var(--intensity-overdue);
		background: rgba(224, 64, 251, 0.12);
	}
	.sleep-num {
		font-size: 3.5rem;
		font-weight: 200;
		font-variant-numeric: tabular-nums;
		line-height: 1;
		background: linear-gradient(45deg, #fff, #7eb2ff);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}
	.sleep-label {
		font-size: 0.85rem;
		color: var(--text-muted);
	}
	.deadline-row {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin-top: 0.4rem;
	}
	.sleep-mini {
		display: inline-block;
		margin-left: 0.6rem;
		font-size: 0.95rem;
		color: var(--text);
		opacity: 0.6;
		font-variant-numeric: tabular-nums;
	}

	/* ── Streak ── */
	.streak-block {
		text-align: center;
		padding: 2rem 0 1rem;
	}

	.streak-num {
		font-size: 5rem;
		font-weight: 800;
		line-height: 1;
		color: var(--accent);
	}

	.streak-label {
		font-size: 1rem;
		color: var(--text-muted);
		margin-top: 0.25rem;
	}

	.no-streak {
		font-size: 1.2rem;
		color: var(--text);
		padding: 2rem 0;
	}

	.week {
		display: flex;
		justify-content: center;
		gap: 0.75rem;
		margin-top: 1.5rem;
	}

	.day {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
	}

	.day-dot {
		font-size: 1.1rem;
		color: var(--border);
	}

	.day.done .day-dot { color: var(--accent); }
	.day.today .day-dot { color: var(--text); }
	.day.today.done .day-dot { color: var(--accent); }

	.day-label {
		font-size: 0.65rem;
		color: var(--text-muted);
		text-transform: uppercase;
	}

	.day.today .day-label {
		color: var(--text);
		font-weight: 600;
	}

	/* ── Start button ── */
	.start-btn {
		display: block;
		width: 100%;
		text-align: center;
		padding: 1.2rem;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: 0.75rem;
		font-size: 1.15rem;
		font-weight: 600;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.start-btn:active {
		opacity: 0.85;
	}

	/* ── Rewards ── */
	.rewards-hint {
		font-size: 0.8rem;
		color: var(--text-muted);
		text-align: center;
		margin-bottom: 0.75rem;
	}

	.reward-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
	}

	.reward {
		text-align: center;
		padding: 0.85rem 0.5rem;
		border-radius: 0.6rem;
		font-size: 0.85rem;
		font-weight: 500;
		text-decoration: none;
		background: var(--bg-card);
		border: 1px solid var(--border);
		color: var(--text);
	}

	.reward:active {
		border-color: var(--accent);
	}

	.reward.locked {
		color: var(--text-muted);
		opacity: 0.3;
	}

	/* ── Done view ── */
	.done-top {
		text-align: center;
		padding: 4rem 0 2rem;
	}

	.done-clock {
		font-size: 4rem;
		font-weight: 700;
		line-height: 1;
		color: var(--text);
		opacity: 0.3;
	}

	.done-msg {
		font-size: 1rem;
		color: var(--text-muted);
		margin-top: 1rem;
	}

	.streak-badge {
		display: inline-block;
		margin-top: 1.5rem;
		padding: 0.4rem 1rem;
		background: var(--accent-dim);
		color: var(--accent);
		border-radius: 2rem;
		font-size: 0.85rem;
		font-weight: 600;
	}

	/* ── Fullscreen task mode ── */
	.full {
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 2rem;
		gap: 1rem;
		transition: background 2s;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		touch-action: manipulation;
		user-select: none;
		-webkit-user-select: none;
		z-index: 200;
	}

	.clock {
		font-size: 1.2rem;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		position: absolute;
		top: 3rem;
	}

	.task-name {
		font-size: clamp(2rem, 8vw, 3.5rem);
		font-weight: 700;
		line-height: 1.15;
		max-width: 14ch;
	}

	.hint {
		font-size: 0.9rem;
		color: var(--text-muted);
		margin-top: 1rem;
	}

	.dots {
		display: flex;
		gap: 0.5rem;
		position: absolute;
		bottom: 3rem;
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--border);
	}

	.dot.done { background: var(--accent); }
	.dot.active { background: var(--text); }

	.warn {
		color: #f87171;
		font-size: 1.2rem;
		font-weight: 600;
	}

	.blink {
		animation: blink 1s infinite;
	}

	@keyframes blink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.3; }
	}
</style>
