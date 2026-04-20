<!-- Vaihe 3: Sopimus – herätysaika ja unentarve -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { browser } from '$app/environment';
	import { fly } from 'svelte/transition';

	let wakeTime = $state('07:00');
	let sleepHours = $state(7);

	// Viimeinen nukkumaanmenoaika: herätys − unta − 15 min (nukahtamisaika)
	let bedtime = $derived.by(() => {
		const [h, m] = wakeTime.split(':').map(Number);
		const totalMin = h * 60 + m - sleepHours * 60 - 15;
		const adjusted = totalMin < 0 ? totalMin + 1440 : totalMin;
		const bh = Math.floor(adjusted / 60);
		const bm = Math.round(adjusted % 60);
		return `${String(bh).padStart(2, '0')}:${String(bm).padStart(2, '0')}`;
	});

	// Sänkyyn 15 min ennen nukkumaanmenoa
	let prepareTime = $derived.by(() => {
		const [h, m] = wakeTime.split(':').map(Number);
		const totalMin = h * 60 + m - sleepHours * 60 - 30;
		const adjusted = totalMin < 0 ? totalMin + 1440 : totalMin;
		const bh = Math.floor(adjusted / 60);
		const bm = Math.round(adjusted % 60);
		return `${String(bh).padStart(2, '0')}:${String(bm).padStart(2, '0')}`;
	});

	// Molemmat arvot asetettu (oletus riittää)
	let canProceed = $derived(wakeTime.length > 0 && sleepHours >= 5);

	function proceed() {
		if (browser) {
			localStorage.setItem('settings.wakeTime', wakeTime);
			localStorage.setItem('settings.sleepHours', String(sleepHours));
		}
		goto(`${base}/tervetuloa/intensiteetti`);
	}
</script>

<div class="step" in:fly={{ y: 20, duration: 600 }}>
	<h2 class="title">Tehdään sopimus</h2>
	<p class="desc">
		Sinä päätät aamulla milloin pitää mennä nukkumaan.
		Minä muistutan sinua iltaisin. Yhdessä pelastetaan aamu.
	</p>

	<div class="fields">
		<label class="field">
			<span class="label">Milloin herätys?</span>
			<input type="time" bind:value={wakeTime} class="time-input" />
		</label>

		<label class="field">
			<span class="label">Paljonko unta tarvitset?</span>
			<span class="range-value">{sleepHours} h</span>
			<input
				type="range"
				min="5"
				max="10"
				step="0.5"
				bind:value={sleepHours}
				class="range-input"
			/>
		</label>
	</div>

	<div class="result">
		<p>Viimeinen nukkumaanmenoaikasi: <strong>{bedtime}</strong></p>
		<p class="result-sub">
			Lähde valmiiksi sänkyyn klo <strong>{prepareTime}</strong>,
			niin ehdit nukahtaa ajoissa.
		</p>
	</div>

	<button class="primary-btn" disabled={!canProceed} onclick={proceed}>
		Hyvä, jatketaan →
	</button>
</div>

<style>
	.step {
		display: flex;
		flex-direction: column;
		justify-content: center;
		flex: 1;
		gap: 1.5rem;
	}

	.title {
		font-size: 1.4rem;
		font-weight: 600;
		color: var(--text);
	}

	.desc {
		font-size: 0.95rem;
		line-height: 1.5;
		color: var(--text-muted);
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.label {
		font-size: 0.9rem;
		color: var(--text);
		font-weight: 500;
	}

	.time-input {
		background: var(--field);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 12px 16px;
		font: inherit;
		font-size: 1.1rem;
		appearance: none;
		-webkit-appearance: none;
	}

	.range-value {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--accent);
		font-variant-numeric: tabular-nums;
	}

	.range-input {
		width: 100%;
		accent-color: var(--accent);
		height: 6px;
	}

	.result {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.result p {
		font-size: 0.95rem;
		color: var(--text);
	}

	.result strong {
		color: var(--accent);
	}

	.result-sub {
		font-size: 0.85rem !important;
		color: var(--text-muted) !important;
	}

	.primary-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
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

	.primary-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.primary-btn:not(:disabled):active {
		opacity: 0.9;
	}
</style>
