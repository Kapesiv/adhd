<svelte:options runes={false} />

<script lang="ts">
	import {
		iltavahti,
		requestWakeLock, releaseWakeLock,
		initAudio, playTick, startAlarm, stopAlarm,
		haptic, hapticHeavy,
		startMotionDetection, stopMotionDetection
	} from '$lib/iltavahti';
	import { onDestroy } from 'svelte';

	let now = new Date();
	const timer = setInterval(() => (now = new Date()), 1000);

	onDestroy(() => {
		clearInterval(timer);
		releaseWakeLock();
		stopAlarm();
		stopMotionDetection();
	});

	let started = false;
	let alarmActive = false;
	let phonePickedUp = false;
	let pickupTimeout: ReturnType<typeof setTimeout> | null = null;

	$: state = $iltavahti;
	$: remaining = state.tasks.filter((t) => !t.done);
	$: currentTask = remaining[0] ?? null;
	$: doneCount = state.tasks.length - remaining.length;
	$: allDone = state.tasks.length > 0 && remaining.length === 0;
	$: stepLabel = allDone ? '' : `${doneCount + 1} / ${state.tasks.length}`;

	$: bedtimeParts = state.bedtime.split(':').map(Number);
	$: bedtimeToday = (() => {
		const d = new Date();
		d.setHours(bedtimeParts[0], bedtimeParts[1], 0, 0);
		return d;
	})();
	$: minutesLeft = Math.round((bedtimeToday.getTime() - now.getTime()) / 60000);

	$: countdownText = (() => {
		if (minutesLeft <= 0) {
			const over = Math.abs(minutesLeft);
			if (over < 60) return `+${over}`;
			return `+${Math.floor(over / 60)}:${String(over % 60).padStart(2, '0')}`;
		}
		if (minutesLeft < 60) return String(minutesLeft);
		const h = Math.floor(minutesLeft / 60);
		const m = minutesLeft % 60;
		return `${h}:${String(m).padStart(2, '0')}`;
	})();

	$: countdownUnit = minutesLeft <= 0 ? 'min yli' : minutesLeft < 60 ? 'min' : 'h';

	$: urgency = (() => {
		if (minutesLeft <= 0) return 'past';
		if (minutesLeft <= 15) return 'red';
		if (minutesLeft <= 45) return 'yellow';
		return 'ok';
	})();

	// Himmennyslevel 0-0.6 — mitä lähempänä nukkumista, sitä tummempi
	$: dimLevel = (() => {
		if (!started) return 0;
		if (allDone) return 0.5;
		if (minutesLeft <= 0) return 0;
		if (minutesLeft >= 60) return 0;
		return Math.min(0.4, (1 - minutesLeft / 60) * 0.4);
	})();

	// Hälytys kun aika menee yli
	$: if (started && minutesLeft <= 0 && !allDone && !alarmActive) {
		alarmActive = true;
		startAlarm();
	}

	// Sammuta hälytys kun kaikki tehty
	$: if (allDone && alarmActive) {
		alarmActive = false;
		stopAlarm();
	}

	function start() {
		started = true;
		alarmActive = false;
		initAudio();
		requestWakeLock();
	}

	function complete() {
		if (!currentTask) return;
		haptic();
		playTick();
		iltavahti.markDone(currentTask.id);

		// Jos tämä oli viimeinen, siirry yöpöytäkellotilaan
		if (remaining.length <= 1) {
			stopAlarm();
			enterNightMode();
		}
	}

	function dismissAlarm() {
		stopAlarm();
		alarmActive = false;
		hapticHeavy();
	}

	function enterNightMode() {
		startMotionDetection(() => {
			phonePickedUp = true;
			hapticHeavy();
			if (pickupTimeout) clearTimeout(pickupTimeout);
			pickupTimeout = setTimeout(() => {
				phonePickedUp = false;
			}, 4000);
		});
	}

	function clock(date: Date) {
		return date.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
	}
</script>

<svelte:head>
	<title>Iltavahti</title>
</svelte:head>

<!-- Himmennyskerros -->
{#if dimLevel > 0}
	<div class="dim" style="opacity: {dimLevel}"></div>
{/if}

{#if !started}
	<!-- ALOITUS -->
	<div class="screen">
		<div class="start-clock">{clock(now)}</div>
		<div class="start-countdown" class:red={urgency === 'red' || urgency === 'past'} class:yellow={urgency === 'yellow'}>
			<span class="big-num">{countdownText}</span>
			<span class="unit">{countdownUnit}</span>
		</div>
		<p class="subtle">nukkumaan {state.bedtime}</p>
		<button class="main-btn" onclick={start}>
			Aloita iltatoimet
		</button>
		<details class="edit">
			<summary>vaihda aika</summary>
			<input
				type="time"
				value={state.bedtime}
				onchange={(e) => iltavahti.setBedtime((e.currentTarget as HTMLInputElement).value)}
			/>
		</details>
	</div>

{:else if allDone}
	<!-- YÖPÖYTÄKELLO -->
	<div class="screen night">
		<div class="night-clock">{clock(now)}</div>
		{#if phonePickedUp}
			<p class="pickup-warn">Laita puhelin pois.</p>
		{:else}
			<p class="night-text">Silmät kiinni.</p>
		{/if}
	</div>

{:else}
	<!-- YKSI TEHTÄVÄ -->
	<div class="screen">
		<div class="countdown" class:red={urgency === 'red' || urgency === 'past'} class:yellow={urgency === 'yellow'}>
			<span class="big-num">{countdownText}</span>
			<span class="unit">{countdownUnit}</span>
		</div>

		<p class="step">{stepLabel}</p>

		<h1 class="task-name">{currentTask?.label}</h1>

		{#if alarmActive}
			<button class="alarm-dismiss" onclick={dismissAlarm}>
				OK, teen nyt
			</button>
		{/if}

		<button class="main-btn" onclick={complete}>
			Tehty
		</button>

		{#if remaining.length > 1}
			<div class="upcoming">
				<p class="upcoming-label">seuraavaksi</p>
				{#each remaining.slice(1, 3) as task (task.id)}
					<p>{task.label}</p>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.screen {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 80vh;
		text-align: center;
		gap: 0.5rem;
		position: relative;
		z-index: 1;
	}

	/* Himmennyslayer */
	.dim {
		position: fixed;
		inset: 0;
		background: #000;
		pointer-events: none;
		z-index: 50;
		transition: opacity 2s;
	}

	/* Aloitus */
	.start-clock {
		font-size: 1.2rem;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}

	.start-countdown {
		margin: 0.5rem 0;
	}

	/* Kello / countdown iso */
	.big-num {
		font-size: 6rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		line-height: 1;
		display: block;
	}

	.unit {
		font-size: 1.1rem;
		color: var(--text-muted);
		font-weight: 500;
	}

	.subtle {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin-bottom: 2rem;
	}

	/* Tehtävänäkymä */
	.countdown {
		margin-bottom: 0.5rem;
	}

	.step {
		font-size: 0.75rem;
		color: var(--text-muted);
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.task-name {
		font-size: 1.8rem;
		font-weight: 700;
		margin: 1rem 0 2rem;
		max-width: 16ch;
		line-height: 1.2;
	}

	/* Napit */
	.main-btn {
		background: var(--accent);
		color: white;
		border: none;
		border-radius: 1rem;
		padding: 1.2rem 4rem;
		font: inherit;
		font-size: 1.2rem;
		font-weight: 600;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		touch-action: manipulation;
	}

	.main-btn:active {
		transform: scale(0.97);
	}

	.alarm-dismiss {
		background: #f87171;
		color: white;
		border: none;
		border-radius: 1rem;
		padding: 0.8rem 2rem;
		font: inherit;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		margin-bottom: 1rem;
		animation: pulse 1s infinite;
		-webkit-tap-highlight-color: transparent;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.6; }
	}

	.upcoming {
		margin-top: 3rem;
		font-size: 0.8rem;
		color: var(--text-muted);
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.upcoming-label {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin-bottom: 0.2rem;
		opacity: 0.6;
	}

	.edit {
		margin-top: 1.5rem;
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.edit summary {
		cursor: pointer;
	}

	.edit input {
		margin-top: 0.5rem;
		background: var(--field);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
		font: inherit;
	}

	/* Yöpöytäkello */
	.night {
		min-height: 90vh;
	}

	.night-clock {
		font-size: 7rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		line-height: 1;
		color: var(--text-muted);
		opacity: 0.4;
	}

	.night-text {
		font-size: 1rem;
		color: var(--text-muted);
		opacity: 0.4;
		margin-top: 0.5rem;
	}

	.pickup-warn {
		font-size: 1.3rem;
		font-weight: 600;
		color: #f87171;
		margin-top: 0.5rem;
		animation: pulse 0.8s infinite;
	}

	/* Värit */
	.yellow { color: #fbbf24; }
	.yellow .unit { color: #fbbf24; opacity: 0.7; }
	.red { color: #f87171; }
	.red .unit { color: #f87171; opacity: 0.7; }
</style>
