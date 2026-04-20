<!-- Vaihe 4: Intensiteettitaso -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { browser } from '$app/environment';
	import { fade, fly } from 'svelte/transition';

	interface Level {
		id: 'light' | 'medium' | 'hard';
		emoji: string;
		name: string;
		desc: string;
		tagline: string;
	}

	const levels: Level[] = [
		{
			id: 'light',
			emoji: '🌿',
			name: 'Kevyt',
			desc: 'Muistutuksia ja visuaalisia vihjeitä. Sinä päätät muun.',
			tagline: 'Sopiva kun haluan itsenäisyyttä'
		},
		{
			id: 'medium',
			emoji: '🔥',
			name: 'Keskikova',
			desc: 'Muistutukset kovenevat jos jatkan valvomista. Vaativat pientä huomiota ennen kuin voin jatkaa.',
			tagline: 'Sopiva kun haluan oikeasti muutoksen'
		},
		{
			id: 'hard',
			emoji: '⚡',
			name: 'Kova',
			desc: 'Iltaan tulee fyysisiä esteitä. Vaikea ohittaa. Pelastaa aamuni.',
			tagline: 'Sopiva kun mitään muuta ei ole toiminut'
		}
	];

	let selected = $state<string | null>(null);

	function select(level: Level) {
		selected = level.id;
		if (browser) {
			localStorage.setItem('settings.intensityLevel', level.id);
		}
	}
</script>

<div class="step" in:fly={{ y: 20, duration: 600 }}>
	<h2 class="title">Kuinka kovasti tarvitset apua?</h2>

	<div class="cards">
		{#each levels as level}
			<button
				class="card"
				class:selected={selected === level.id}
				onclick={() => select(level)}
			>
				<div class="card-header">
					<span class="emoji">{level.emoji}</span>
					<span class="name">{level.name}</span>
				</div>
				<p class="card-desc">{level.desc}</p>
				<p class="card-tagline">{level.tagline}</p>
			</button>
		{/each}
	</div>

	{#if selected}
		<p class="hint" in:fade={{ duration: 400 }}>
			Voit vaihtaa tätä milloin tahansa asetuksista.
		</p>

		<button
			class="primary-btn"
			in:fade={{ duration: 400 }}
			onclick={() => goto(`${base}/tervetuloa/valmis`)}
		>
			Jatka →
		</button>
	{/if}
</div>

<style>
	.step {
		display: flex;
		flex-direction: column;
		justify-content: center;
		flex: 1;
		gap: 1.25rem;
	}

	.title {
		font-size: 1.4rem;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 0.25rem;
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
		text-align: left;
		cursor: pointer;
		transition: border-color 0.2s, box-shadow 0.2s;
		-webkit-tap-highlight-color: transparent;
	}

	.card:active {
		border-color: var(--text-muted);
	}

	.card.selected {
		border-color: var(--accent);
		box-shadow: inset 0 0 24px rgb(249 115 22 / 0.1);
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
	}

	.emoji {
		font-size: 1.2rem;
	}

	.name {
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--text);
	}

	.card-desc {
		font-size: 0.9rem;
		line-height: 1.4;
		color: var(--text-muted);
		margin-bottom: 8px;
	}

	.card-tagline {
		font-size: 0.8rem;
		color: var(--text-muted);
		opacity: 0.6;
		font-style: italic;
	}

	.hint {
		font-size: 0.85rem;
		color: var(--text-muted);
		text-align: center;
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

	.primary-btn:active {
		opacity: 0.9;
	}
</style>
