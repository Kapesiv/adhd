<svelte:options runes={false} />

<script lang="ts">
	import {
		iltavahti,
		requestWakeLock, releaseWakeLock,
		initAudio, playTick, startAlarm, stopAlarm,
		haptic,
		startMotionDetection, stopMotionDetection
	} from '$lib/iltavahti';
	import { onMount, onDestroy } from 'svelte';

	let now = new Date();
	const timer = setInterval(() => (now = new Date()), 1000);
	let audioReady = false;
	let alarmActive = false;
	let phonePickedUp = false;
	let pickupTimeout: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		requestWakeLock();
	});

	onDestroy(() => {
		clearInterval(timer);
		releaseWakeLock();
		stopAlarm();
		stopMotionDetection();
	});

	$: state = $iltavahti;
	$: remaining = state.tasks.filter((t) => !t.done);
	$: current = remaining[0] ?? null;
	$: allDone = state.tasks.length > 0 && remaining.length === 0;

	$: bedtimeParts = state.bedtime.split(':').map(Number);
	$: bedtimeToday = (() => {
		const d = new Date();
		d.setHours(bedtimeParts[0], bedtimeParts[1], 0, 0);
		return d;
	})();
	$: minutesLeft = Math.round((bedtimeToday.getTime() - now.getTime()) / 60000);
	$: overTime = minutesLeft <= 0;

	// Hälytys kun aika yli ja tehtäviä jäljellä
	$: if (overTime && !allDone && !alarmActive && audioReady) {
		alarmActive = true;
		startAlarm();
	}
	$: if (allDone && alarmActive) {
		alarmActive = false;
		stopAlarm();
	}

	// Taustaväri kertoo kiireellisyyden — ei tarvitse lukea mitään
	$: bg = (() => {
		if (allDone) return '#0a0f0a';
		if (overTime) return '#1a0505';
		if (minutesLeft <= 15) return '#1a0f05';
		if (minutesLeft <= 45) return '#15130a';
		return '#0f1115';
	})();

	function tap() {
		// Ensimmäinen kosketus aktivoi äänet (iOS vaatii)
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

<div class="full" style="background: {bg}" role="button" tabindex="0" onclick={tap} onkeydown={(e) => e.key === 'Enter' && tap()}>
	{#if allDone}
		<div class="done">
			<p class="clock dim">{clock(now)}</p>
			{#if phonePickedUp}
				<p class="warn">Laita puhelin pois.</p>
			{:else}
				<p class="dim">Hyvää yötä.</p>
			{/if}
		</div>
	{:else}
		<p class="clock">{clock(now)}</p>

		{#if alarmActive}
			<p class="warn blink">Aika meni. Tee nyt.</p>
		{/if}

		<h1>{current?.label}</h1>

		<p class="hint">
			{#if !audioReady}
				Napauta aloittaaksesi
			{:else}
				Napauta kun tehty
			{/if}
		</p>

		<div class="dots">
			{#each state.tasks as task, i}
				<span class="dot" class:done={task.done} class:active={task.id === current?.id}></span>
			{/each}
		</div>
	{/if}
</div>

<style>
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

	h1 {
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

	.dot.done {
		background: var(--accent);
	}

	.dot.active {
		background: var(--text);
	}

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

	/* Valmis / yö */
	.done {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.done .clock {
		position: static;
		font-size: 5rem;
		font-weight: 700;
		line-height: 1;
	}

	.dim {
		opacity: 0.3;
	}
</style>
