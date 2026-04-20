<!-- Vaihe 2: Tunnistaminen -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { browser } from '$app/environment';
	import { fade, fly } from 'svelte/transition';

	const options = [
		'Ilta venyy vaikka tietäisin pitäisi mennä nukkumaan',
		'Aamulla en kuule herätystä',
		'Työpaikkani on vaarassa myöhästymisten takia',
		'Kaikki edellä mainitut'
	];

	let selected = $state<string | null>(null);
	let showMessage = $state(false);

	function select(option: string) {
		if (selected) return; // Estetään uudelleenvalinta
		selected = option;

		// Tallennetaan valinta
		if (browser) {
			localStorage.setItem('onboarding.recognition', option);
		}

		// Näytetään vahvistusviesti ja siirrytään eteenpäin
		setTimeout(() => {
			showMessage = true;
		}, 400);

		setTimeout(() => {
			goto(`${base}/tervetuloa/sopimus`);
		}, 2400);
	}
</script>

<div class="step" in:fly={{ y: 20, duration: 600 }}>
	{#if !showMessage}
		<h2 class="title">Mikä näistä on sinusta?</h2>

		<div class="cards">
			{#each options as option}
				<button
					class="card"
					class:selected={selected === option}
					onclick={() => select(option)}
					disabled={selected !== null && selected !== option}
				>
					{option}
				</button>
			{/each}
		</div>
	{:else}
		<p class="message" in:fade={{ duration: 500 }}>
			Tämä sovellus on sinua varten.
		</p>
	{/if}
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
		margin-bottom: 0.5rem;
	}

	.cards {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.card {
		padding: 16px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text);
		font-size: 0.95rem;
		line-height: 1.4;
		text-align: left;
		cursor: pointer;
		transition: border-color 0.2s, box-shadow 0.2s, opacity 0.3s;
		-webkit-tap-highlight-color: transparent;
	}

	.card:not(:disabled):active {
		border-color: var(--text-muted);
	}

	.card.selected {
		border-color: var(--accent);
		box-shadow: inset 0 0 24px rgb(249 115 22 / 0.1);
	}

	.card:disabled:not(.selected) {
		opacity: 0.3;
	}

	.message {
		font-size: 1.3rem;
		font-weight: 500;
		color: var(--text);
		text-align: center;
		padding: 2rem 0;
	}
</style>
