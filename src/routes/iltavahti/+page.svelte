<svelte:options runes={false} />

<script lang="ts">
	import { iltavahti, requestWakeLock, releaseWakeLock, initAudio, playAlarm } from '$lib/iltavahti';
	import { onDestroy, onMount } from 'svelte';

	let now = new Date();
	const timer = setInterval(() => (now = new Date()), 1000);
	onDestroy(() => {
		clearInterval(timer);
		releaseWakeLock();
	});

	let started = false;
	let alarmPlayed = false;

	$: state = $iltavahti;
	$: remaining = state.tasks.filter((t) => !t.done);
	$: currentTask = remaining[0] ?? null;
	$: doneCount = state.tasks.length - remaining.length;
	$: allDone = state.tasks.length > 0 && remaining.length === 0;
	$: stepLabel = allDone
		? ''
		: `${doneCount + 1} / ${state.tasks.length}`;

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
			if (over < 60) return `+${over} min yli`;
			return `+${Math.floor(over / 60)} h ${over % 60} min yli`;
		}
		if (minutesLeft < 60) return `${minutesLeft} min`;
		const h = Math.floor(minutesLeft / 60);
		const m = minutesLeft % 60;
		if (m === 0) return `${h} h`;
		return `${h} h ${m} min`;
	})();

	$: urgency = (() => {
		if (minutesLeft <= 0) return 'past';
		if (minutesLeft <= 15) return 'red';
		if (minutesLeft <= 45) return 'yellow';
		return 'ok';
	})();

	// Soita hälytys kun aika menee yli
	$: if (started && minutesLeft <= 0 && !alarmPlayed && !allDone) {
		playAlarm();
		alarmPlayed = true;
	}

	function start() {
		started = true;
		alarmPlayed = false;
		initAudio();
		requestWakeLock();
	}

	function complete() {
		if (currentTask) {
			iltavahti.markDone(currentTask.id);
		}
	}

	function clock(date: Date) {
		return date.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
	}
</script>

<svelte:head>
	<title>Iltavahti</title>
</svelte:head>

{#if !started}
	<div class="start-screen">
		<div class="start-clock">{clock(now)}</div>
		<p class="start-target">Nukkumaan {state.bedtime}</p>
		<p class="start-left" class:red={urgency === 'red' || urgency === 'past'} class:yellow={urgency === 'yellow'}>
			{countdownText}
		</p>
		<button class="start-btn" onclick={start}>
			Aloita iltatoimet
		</button>
		<details class="edit-bedtime">
			<summary>Vaihda aika</summary>
			<input
				type="time"
				value={state.bedtime}
				onchange={(e) => iltavahti.setBedtime((e.currentTarget as HTMLInputElement).value)}
			/>
		</details>
	</div>
{:else if allDone}
	<div class="done-screen">
		<div class="done-clock">{clock(now)}</div>
		<p class="done-text">Valmis. Laita silmät kiinni.</p>
	</div>
{:else}
	<div class="task-screen">
		<div class="countdown" class:red={urgency === 'red' || urgency === 'past'} class:yellow={urgency === 'yellow'}>
			{countdownText}
		</div>

		<div class="step">{stepLabel}</div>

		<div class="current-task">{currentTask?.label}</div>

		<button class="done-btn" onclick={complete}>
			Tehty
		</button>

		<div class="rest">
			{#each remaining.slice(1) as task (task.id)}
				<span>{task.label}</span>
			{/each}
		</div>
	</div>
{/if}

<style>
	/* Aloitusnäkymä */
	.start-screen {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 70vh;
		gap: 0.5rem;
		text-align: center;
	}

	.start-clock {
		font-size: 4rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}

	.start-target {
		font-size: 1rem;
		color: var(--text-muted);
	}

	.start-left {
		font-size: 1.5rem;
		font-weight: 600;
		margin-bottom: 2rem;
	}

	.start-btn {
		background: var(--accent);
		color: white;
		border: none;
		border-radius: 0.6rem;
		padding: 1rem 3rem;
		font: inherit;
		font-size: 1.1rem;
		font-weight: 600;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.start-btn:active {
		opacity: 0.8;
	}

	.edit-bedtime {
		margin-top: 1.5rem;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.edit-bedtime summary {
		cursor: pointer;
	}

	.edit-bedtime input {
		margin-top: 0.5rem;
		background: var(--field);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
		font: inherit;
	}

	/* Tehtävänäkymä — yksi kerrallaan */
	.task-screen {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 70vh;
		text-align: center;
		gap: 0.75rem;
	}

	.countdown {
		font-size: 3rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		line-height: 1;
		transition: color 0.5s;
	}

	.step {
		font-size: 0.8rem;
		color: var(--text-muted);
		letter-spacing: 0.05em;
	}

	.current-task {
		font-size: 1.6rem;
		font-weight: 600;
		margin: 1.5rem 0;
		max-width: 20ch;
	}

	.done-btn {
		background: var(--accent);
		color: white;
		border: none;
		border-radius: 0.6rem;
		padding: 1.2rem 4rem;
		font: inherit;
		font-size: 1.2rem;
		font-weight: 600;
		cursor: pointer;
		margin-bottom: 2rem;
		-webkit-tap-highlight-color: transparent;
	}

	.done-btn:active {
		opacity: 0.8;
	}

	.rest {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	/* Valmis-näkymä — yöpöytäkello */
	.done-screen {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 80vh;
		text-align: center;
		gap: 1rem;
	}

	.done-clock {
		font-size: 5rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		line-height: 1;
		color: var(--text-muted);
	}

	.done-text {
		font-size: 1.1rem;
		color: var(--text-muted);
	}

	/* Värit */
	.yellow {
		color: #fbbf24;
	}

	.red {
		color: #f87171;
	}
</style>
