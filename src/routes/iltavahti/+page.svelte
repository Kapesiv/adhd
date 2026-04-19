<svelte:options runes={false} />

<script lang="ts">
	import { iltavahti } from '$lib/iltavahti';
	import { onDestroy } from 'svelte';

	let now = new Date();
	const timer = setInterval(() => (now = new Date()), 1000);
	onDestroy(() => clearInterval(timer));

	let newTask = '';

	$: state = $iltavahti;
	$: doneCount = state.tasks.filter((t) => t.done).length;
	$: totalCount = state.tasks.length;
	$: allDone = totalCount > 0 && doneCount === totalCount;
	$: progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

	$: bedtimeParts = state.bedtime.split(':').map(Number);
	$: bedtimeToday = (() => {
		const d = new Date();
		d.setHours(bedtimeParts[0], bedtimeParts[1], 0, 0);
		return d;
	})();
	$: minutesLeft = Math.floor((bedtimeToday.getTime() - now.getTime()) / 60000);

	$: timeLabel = (() => {
		if (minutesLeft <= 0) return 'Nukkumaanmenoaika on nyt!';
		if (minutesLeft < 60) return `${minutesLeft} min jäljellä`;
		const h = Math.floor(minutesLeft / 60);
		const m = minutesLeft % 60;
		return `${h} h ${m} min jäljellä`;
	})();

	$: urgency = (() => {
		if (minutesLeft <= 0) return 'past';
		if (minutesLeft <= 15) return 'urgent';
		if (minutesLeft <= 45) return 'soon';
		return 'ok';
	})();

	function clock(date: Date) {
		return date.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
	}

	function addTask() {
		if (!newTask.trim()) return;
		iltavahti.addTask(newTask);
		newTask = '';
	}
</script>

<svelte:head>
	<title>Iltavahti</title>
</svelte:head>

<div class="page">
	<header class="header">
		<h1>Iltavahti</h1>
		<div class="clock" class:urgent={urgency === 'urgent'} class:past={urgency === 'past'}>
			{clock(now)}
		</div>
	</header>

	<section class="bedtime-bar" class:urgent={urgency === 'urgent'} class:past={urgency === 'past'} class:soon={urgency === 'soon'}>
		<div class="bedtime-info">
			<span>Nukkumaan {state.bedtime}</span>
			<span class="time-left">{timeLabel}</span>
		</div>
		<div class="progress-track">
			<div class="progress-fill" style="width: {progress}%"></div>
		</div>
		<span class="progress-label">{doneCount}/{totalCount} tehty</span>
	</section>

	{#if allDone}
		<div class="done-banner">
			Kaikki tehty! Hyvää yötä.
		</div>
	{/if}

	<section class="tasks">
		{#each state.tasks as task (task.id)}
			<button
				type="button"
				class="task-row"
				class:checked={task.done}
				onclick={() => iltavahti.toggleTask(task.id)}
			>
				<span class="checkbox">{task.done ? '✓' : ''}</span>
				<span class="task-label">{task.label}</span>
			</button>
		{/each}
	</section>

	<form class="add-row" onsubmit={(e) => { e.preventDefault(); addTask(); }}>
		<input
			bind:value={newTask}
			placeholder="Lisää oma tehtävä..."
		/>
		<button type="submit" disabled={!newTask.trim()}>+</button>
	</form>

	<details class="settings-block">
		<summary>Nukkumaanmenoaika</summary>
		<input
			type="time"
			value={state.bedtime}
			onchange={(e) => iltavahti.setBedtime((e.currentTarget as HTMLInputElement).value)}
		/>
	</details>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	h1 {
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.03em;
	}

	.clock {
		font-size: 1.5rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--text-soft);
	}

	.clock.urgent {
		color: #fbbf24;
	}

	.clock.past {
		color: #f87171;
	}

	.bedtime-bar {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 1rem;
		padding: 0.85rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.bedtime-bar.soon {
		border-color: rgb(251 191 36 / 0.3);
	}

	.bedtime-bar.urgent {
		border-color: rgb(251 191 36 / 0.5);
		background: rgb(251 191 36 / 0.06);
	}

	.bedtime-bar.past {
		border-color: rgb(248 113 113 / 0.5);
		background: rgb(248 113 113 / 0.06);
	}

	.bedtime-info {
		display: flex;
		justify-content: space-between;
		font-size: 0.85rem;
	}

	.time-left {
		color: var(--text-muted);
	}

	.progress-track {
		height: 6px;
		background: var(--pill);
		border-radius: 3px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--accent);
		border-radius: 3px;
		transition: width 0.3s ease;
	}

	.progress-label {
		font-size: 0.7rem;
		color: var(--text-muted);
		text-align: right;
	}

	.done-banner {
		text-align: center;
		padding: 1rem;
		background: rgb(74 222 128 / 0.1);
		border: 1px solid rgb(74 222 128 / 0.3);
		border-radius: 1rem;
		color: #4ade80;
		font-weight: 600;
	}

	.tasks {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.task-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.85rem 1rem;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 0.85rem;
		color: var(--text);
		cursor: pointer;
		text-align: left;
		transition: opacity 0.15s;
		width: 100%;
	}

	.task-row.checked {
		opacity: 0.45;
	}

	.checkbox {
		width: 1.5rem;
		height: 1.5rem;
		border: 2px solid var(--border);
		border-radius: 0.4rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.85rem;
		flex-shrink: 0;
		color: var(--accent);
	}

	.task-row.checked .checkbox {
		background: var(--accent);
		border-color: var(--accent);
		color: white;
	}

	.task-label {
		font-size: 0.95rem;
	}

	.task-row.checked .task-label {
		text-decoration: line-through;
	}

	.add-row {
		display: flex;
		gap: 0.5rem;
	}

	.add-row input {
		flex: 1;
		background: var(--field);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 0.85rem;
		padding: 0.7rem 0.85rem;
		font: inherit;
	}

	.add-row button {
		background: var(--accent);
		color: white;
		border: none;
		border-radius: 0.85rem;
		width: 2.8rem;
		font-size: 1.3rem;
		font-weight: 700;
		cursor: pointer;
	}

	.add-row button:disabled {
		opacity: 0.3;
	}

	.settings-block {
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.settings-block summary {
		cursor: pointer;
		padding: 0.5rem 0;
	}

	.settings-block input[type='time'] {
		margin-top: 0.5rem;
		background: var(--field);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 0.85rem;
		padding: 0.7rem 0.85rem;
		font: inherit;
		width: 100%;
	}
</style>
