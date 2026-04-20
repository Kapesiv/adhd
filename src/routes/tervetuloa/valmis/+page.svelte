<!-- Vaihe 5: Valmis – ensimmäinen näky sleep budgetista -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { browser } from '$app/environment';
	import { fly } from 'svelte/transition';
	import { onMount, onDestroy } from 'svelte';

	let now = $state(new Date());
	let timer: ReturnType<typeof setInterval>;

	onMount(() => {
		// Päivitä kello joka minuutti
		timer = setInterval(() => {
			now = new Date();
		}, 60_000);
	});

	onDestroy(() => {
		clearInterval(timer);
	});

	// Laske tunteja unta jos nukahtaa nyt
	let sleepBudget = $derived.by(() => {
		const wake = browser
			? localStorage.getItem('settings.wakeTime') || '07:00'
			: '07:00';
		const [h, m] = wake.split(':').map(Number);

		const wakeDate = new Date(now);
		wakeDate.setHours(h, m, 0, 0);

		// Jos herätysaika on jo mennyt tänään → huomenna
		if (wakeDate <= now) {
			wakeDate.setDate(wakeDate.getDate() + 1);
		}

		const hours = (wakeDate.getTime() - now.getTime()) / (1000 * 60 * 60);
		return Math.max(0, hours);
	});

	// Näytä yhden desimaalin tarkkuudella
	let budgetDisplay = $derived(sleepBudget.toFixed(1));

	function finish() {
		if (browser) {
			localStorage.setItem('onboardingComplete', 'true');
		}
		goto(`${base}/`);
	}
</script>

<div class="step" in:fly={{ y: 20, duration: 600 }}>
	<div class="budget-block">
		<span class="budget-number">{budgetDisplay}</span>
		<p class="budget-label">tuntia unta jos nukahdat nyt</p>
	</div>

	<div class="texts">
		<p class="body-text">
			Tervetuloa, ensi kertaa näet oman iltasi visuaalisena.
			Tämä numero on sinun tähtesi.
		</p>
		<p class="body-text">
			Huomenaamuna saat ensimmäisen kuvaston mitä teit.
			Emme tuomitse – emme koskaan.
		</p>
	</div>

	<button class="primary-btn" onclick={finish}>
		Valmis
	</button>
</div>

<style>
	.step {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		flex: 1;
		gap: 2.5rem;
		text-align: center;
	}

	.budget-block {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.budget-number {
		font-size: 72px;
		font-weight: 300;
		line-height: 1;
		color: var(--accent);
		font-variant-numeric: tabular-nums;
	}

	.budget-label {
		font-size: 14px;
		color: var(--text-muted);
		opacity: 0.7;
	}

	.texts {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 320px;
	}

	.body-text {
		font-size: 0.95rem;
		line-height: 1.5;
		color: var(--text-muted);
	}

	.primary-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		max-width: 320px;
		height: 48px;
		padding: 0 24px;
		background: var(--text);
		color: var(--bg);
		border: none;
		border-radius: 12px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.primary-btn:active {
		opacity: 0.9;
	}
</style>
