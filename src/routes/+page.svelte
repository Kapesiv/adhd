<svelte:options runes={false} />

<script lang="ts">
	import { base } from '$app/paths';
	import { iltavahti, getStreak, isTodayDone } from '$lib/iltavahti';

	$: state = $iltavahti;
	$: streak = getStreak(state.completedDays ?? []);
	$: todayDone = isTodayDone(state.completedDays ?? []);

	const rewards = [
		{ label: 'YouTube', url: 'https://youtube.com' },
		{ label: 'TikTok', url: 'https://tiktok.com' },
		{ label: 'Instagram', url: 'https://instagram.com' },
		{ label: 'Reddit', url: 'https://reddit.com' },
		{ label: 'X', url: 'https://x.com' }
	];

	// Viimeiset 7 päivää kalenteriin
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
</script>

<svelte:head>
	<title>ADHD-työkalut</title>
</svelte:head>

<div class="page">

	<!-- Streak -->
	<div class="streak-block">
		{#if streak > 0}
			<div class="streak-num">{streak}</div>
			<p class="streak-label">{streak === 1 ? 'ilta putkeen' : 'iltaa putkeen'}</p>
		{:else}
			<p class="streak-label">Ei vielä putkea. Aloita tänään.</p>
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

	<!-- Iltatoimet-nappi tai valmis -->
	{#if todayDone}
		<div class="done-msg">Tämän illan tehtävät tehty.</div>
	{:else}
		<a href="{base}/iltavahti" class="start-btn">
			Tee iltatoimet
		</a>
	{/if}

	<!-- Palkintosivut — lukittu tai auki -->
	<div class="rewards">
		<p class="rewards-title">{todayDone ? 'Ansaittu.' : 'Tee ensin iltatoimet.'}</p>
		<div class="reward-grid">
			{#each rewards as r}
				{#if todayDone}
					<a href={r.url} target="_blank" rel="noreferrer" class="reward open">{r.label}</a>
				{:else}
					<div class="reward locked">{r.label}</div>
				{/if}
			{/each}
		</div>
	</div>

</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		max-width: 400px;
		margin: 0 auto;
	}

	/* Streak */
	.streak-block {
		text-align: center;
		padding: 1.5rem 0 0.5rem;
	}

	.streak-num {
		font-size: 4rem;
		font-weight: 800;
		line-height: 1;
		color: var(--accent);
	}

	.streak-label {
		font-size: 1rem;
		color: var(--text-muted);
		margin-top: 0.25rem;
	}

	.week {
		display: flex;
		justify-content: center;
		gap: 0.75rem;
		margin-top: 1.25rem;
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

	.day.done .day-dot {
		color: var(--accent);
	}

	.day.today .day-dot {
		color: var(--text);
	}

	.day.today.done .day-dot {
		color: var(--accent);
	}

	.day-label {
		font-size: 0.65rem;
		color: var(--text-muted);
		text-transform: uppercase;
	}

	.day.today .day-label {
		color: var(--text);
		font-weight: 600;
	}

	/* Nappi */
	.start-btn {
		display: block;
		text-align: center;
		padding: 1.1rem;
		background: var(--accent);
		color: white;
		text-decoration: none;
		border-radius: 0.75rem;
		font-size: 1.1rem;
		font-weight: 600;
		-webkit-tap-highlight-color: transparent;
	}

	.start-btn:active {
		opacity: 0.85;
	}

	.done-msg {
		text-align: center;
		padding: 1rem;
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	/* Palkinnot */
	.rewards {
		padding-top: 0.5rem;
	}

	.rewards-title {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin-bottom: 0.75rem;
		text-align: center;
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
	}

	.reward.open {
		background: var(--bg-card);
		border: 1px solid var(--border);
		color: var(--text);
	}

	.reward.open:active {
		border-color: var(--accent);
	}

	.reward.locked {
		background: var(--bg-card);
		border: 1px solid var(--border);
		color: var(--text-muted);
		opacity: 0.35;
	}
</style>
