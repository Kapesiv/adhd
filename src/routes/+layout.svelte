<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';

	if (browser && 'serviceWorker' in navigator) {
		navigator.serviceWorker.register('/sw.js');
	}

	const navItems = [
		{ label: 'Koti', href: '/' },
		{ label: 'Iltavahti', href: '/iltavahti' },
		{ label: 'Asetukset', href: '/asetukset' }
	];

	let { children } = $props();
</script>

<div class="app-shell">
	<main class="content">
		{@render children()}
	</main>

	<nav class="tab-bar">
		{#each navItems as item}
			<a
				href={item.href}
				class="tab-item"
				class:active={$page.url.pathname === item.href}
			>
				{item.label}
			</a>
		{/each}
	</nav>
</div>

<style>
	.app-shell {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		min-height: 100dvh;
	}

	.content {
		flex: 1;
		width: 100%;
		max-width: var(--max-width);
		margin: 0 auto;
		padding: 2rem;
		padding-bottom: 5rem;
	}

	.tab-bar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		gap: 2rem;
		background: var(--bg-nav);
		border-top: 1px solid var(--border);
		padding: 0.75rem 1rem;
		padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0));
		z-index: 100;
	}

	.tab-item {
		text-decoration: none;
		color: var(--text-muted);
		font-size: 0.85rem;
		font-weight: 500;
		transition: color 0.15s;
	}

	.tab-item.active {
		color: var(--text);
	}

	@media (max-width: 640px) {
		.content {
			padding: 1.25rem 1rem;
			padding-bottom: 5rem;
		}

		.tab-bar {
			gap: 0;
		}

		.tab-item {
			flex: 1;
			text-align: center;
			font-size: 0.8rem;
		}
	}
</style>
