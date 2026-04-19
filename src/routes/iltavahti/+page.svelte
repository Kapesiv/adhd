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
		if (minutesLeft <= 0) return 'Aika meni';
		if (minutesLeft < 60) return `${minutesLeft} min`;
		const h = Math.floor(minutesLeft / 60);
		const m = minutesLeft % 60;
		return `${h} h ${m} min`;
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
	<header class="top">
		<div>
			<h1>Iltavahti</h1>
			<p class="meta">Nukkumaan {state.bedtime} &middot; {timeLabel}</p>
		</div>
		<div class="clock" class:urgent={urgency === 'urgent' || urgency === 'past'}>
			{clock(now)}
		</div>
	</header>

	<div class="bar">
		<div class="bar-fill" class:urgent={urgency === 'urgent' || urgency === 'past'} style="width: {progress}%"></div>
	</div>

	{#if allDone}
		<p class="done">Kaikki tehty. Hyvää yötä.</p>
	{/if}

	<section class="tasks">
		{#each state.tasks as task (task.id)}
			<button
				type="button"
				class="task"
				class:checked={task.done}
				onclick={() => iltavahti.toggleTask(task.id)}
			>
				<span class="check">{task.done ? '✓' : ''}</span>
				<span class:strike={task.done}>{task.label}</span>
			</button>
		{/each}
	</section>

	<form class="add" onsubmit={(e) => { e.preventDefault(); addTask(); }}>
		<input bind:value={newTask} placeholder="Lisää tehtävä..." />
		<button type="submit" disabled={!newTask.trim()}>+</button>
	</form>

	<details class="bedtime-edit">
		<summary>Vaihda nukkumaanmenoaika</summary>
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

	.top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	h1 {
		font-size: 1.3rem;
		font-weight: 600;
	}

	.meta {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin-top: 0.1rem;
	}

	.clock {
		font-size: 1.4rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--text-muted);
	}

	.clock.urgent {
		color: #f87171;
	}

	.bar {
		height: 4px;
		background: var(--border);
		border-radius: 2px;
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		background: var(--accent);
		border-radius: 2px;
		transition: width 0.3s;
	}

	.bar-fill.urgent {
		background: #f87171;
	}

	.done {
		color: #4ade80;
		font-size: 0.9rem;
	}

	.tasks {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.task {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.8rem 1rem;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 0.6rem;
		color: var(--text);
		font: inherit;
		font-size: 0.9rem;
		text-align: left;
		cursor: pointer;
	}

	.task.checked {
		opacity: 0.4;
	}

	.check {
		width: 1.3rem;
		height: 1.3rem;
		border: 2px solid var(--border);
		border-radius: 0.3rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		flex-shrink: 0;
	}

	.task.checked .check {
		background: var(--accent);
		border-color: var(--accent);
		color: white;
	}

	.strike {
		text-decoration: line-through;
	}

	.add {
		display: flex;
		gap: 0.5rem;
	}

	.add input {
		flex: 1;
		background: var(--field);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 0.6rem;
		padding: 0.65rem 0.85rem;
		font: inherit;
		font-size: 0.9rem;
	}

	.add button {
		background: var(--bg-card);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 0.6rem;
		width: 2.6rem;
		font-size: 1.2rem;
		cursor: pointer;
	}

	.add button:disabled {
		opacity: 0.3;
	}

	.bedtime-edit {
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.bedtime-edit summary {
		cursor: pointer;
	}

	.bedtime-edit input {
		margin-top: 0.5rem;
		background: var(--field);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 0.6rem;
		padding: 0.65rem 0.85rem;
		font: inherit;
	}
</style>
