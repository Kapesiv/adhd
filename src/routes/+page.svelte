<script lang="ts">
	import { browser } from '$app/environment';

	interface BeforeInstallPromptEvent extends Event {
		prompt(): Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	let deferredPrompt: BeforeInstallPromptEvent | null = $state(null);
	let installed = $state(false);

	if (browser) {
		// Check if already installed
		if (window.matchMedia('(display-mode: standalone)').matches) {
			installed = true;
		}

		window.addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault();
			deferredPrompt = e as BeforeInstallPromptEvent;
		});

		window.addEventListener('appinstalled', () => {
			installed = true;
			deferredPrompt = null;
		});
	}

	async function installPWA() {
		if (!deferredPrompt) return;
		await deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		if (outcome === 'accepted') {
			installed = true;
		}
		deferredPrompt = null;
	}

	interface Module {
		name: string;
		description: string;
		icon: string;
		ready: boolean;
	}

	const modules: Module[] = [
		{
			name: 'Iltavahti',
			description: 'Iltatoimien ohjattu rutiini parempaan uneen',
			icon: '🌙',
			ready: false
		},
		{
			name: 'Aloituskone',
			description: 'Käynnistä päivä ilman päätösväsymystä',
			icon: '🚀',
			ready: false
		},
		{
			name: 'Muistikeskus',
			description: 'Nopea muistiinpano joka ei häviä',
			icon: '🧠',
			ready: false
		}
	];
</script>

<div class="page">
	<header class="hero">
		<h1>ADHD<span class="accent">-app</span></h1>
		<p class="subtitle">Työkalupakki aivoillesi</p>
	</header>

	<section class="modules">
		{#each modules as mod}
			<div class="card" class:disabled={!mod.ready}>
				<span class="card-icon">{mod.icon}</span>
				<div class="card-body">
					<h2>{mod.name}</h2>
					<p>{mod.description}</p>
				</div>
				{#if !mod.ready}
					<span class="badge">Tulossa</span>
				{/if}
			</div>
		{/each}
	</section>

	{#if !installed}
		<section class="install">
			<button
				class="install-btn"
				onclick={installPWA}
				disabled={!deferredPrompt}
			>
				{#if deferredPrompt}
					Asenna kotinäytölle
				{:else}
					Asenna kotinäytölle
				{/if}
			</button>
			{#if !deferredPrompt}
				<p class="install-hint">
					Käytä Chromen/Safarin "Lisää kotinäytölle" -valikkoa
				</p>
			{/if}
		</section>
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.hero {
		text-align: center;
		padding: 1.5rem 0 0.5rem;
	}

	h1 {
		font-size: 2rem;
		font-weight: 800;
		letter-spacing: -0.02em;
	}

	.accent {
		color: var(--accent);
	}

	.subtitle {
		color: var(--text-muted);
		font-size: 0.95rem;
		margin-top: 0.25rem;
	}

	.modules {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		padding: 1rem;
		transition: opacity 0.15s;
	}

	.card.disabled {
		opacity: 0.5;
	}

	.card-icon {
		font-size: 1.75rem;
		flex-shrink: 0;
	}

	.card-body {
		flex: 1;
		min-width: 0;
	}

	.card-body h2 {
		font-size: 1rem;
		font-weight: 600;
	}

	.card-body p {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin-top: 0.15rem;
	}

	.badge {
		font-size: 0.65rem;
		font-weight: 600;
		color: var(--accent);
		background: var(--accent-dim);
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
		white-space: nowrap;
	}

	.install {
		text-align: center;
		padding-top: 0.5rem;
	}

	.install-btn {
		width: 100%;
		padding: 0.85rem 1.5rem;
		background: var(--accent);
		color: white;
		font-size: 1rem;
		font-weight: 600;
		border: none;
		border-radius: 0.75rem;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.install-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.install-btn:not(:disabled):active {
		opacity: 0.8;
	}

	.install-hint {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin-top: 0.5rem;
	}
</style>
