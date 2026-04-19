<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';

	if (browser && 'serviceWorker' in navigator) {
		navigator.serviceWorker.register('/sw.js');
	}

	interface NavItem {
		label: string;
		href: string;
		icon: string;
		disabled: boolean;
	}

	const navItems: NavItem[] = [
		{ label: 'Etusivu', href: '/', icon: '🏠', disabled: false },
		{ label: 'Iltavahti', href: '/iltavahti', icon: '🌙', disabled: false },
		{ label: 'Aamurituaali', href: '/aamurituaali', icon: '☀️', disabled: true },
		{ label: 'Asetukset', href: '/asetukset', icon: '⚙️', disabled: false }
	];

	let { children } = $props();
</script>

<div class="app-shell">
	<main class="content">
		{@render children()}
	</main>

	<nav class="tab-bar">
		{#each navItems as item}
			{#if item.disabled}
				<div class="tab-item disabled">
					<span class="tab-icon">{item.icon}</span>
					<span class="tab-label">{item.label}</span>
					<span class="tab-badge">Tulossa</span>
				</div>
			{:else}
				<a
					href={item.href}
					class="tab-item"
					class:active={$page.url.pathname === item.href}
				>
					<span class="tab-icon">{item.icon}</span>
					<span class="tab-label">{item.label}</span>
				</a>
			{/if}
		{/each}
	</nav>
</div>

<style>
	.app-shell {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		min-height: 100dvh;
		max-width: var(--max-width);
		margin: 0 auto;
	}

	.content {
		flex: 1;
		padding: 1.5rem 1rem;
		padding-bottom: 5.5rem;
	}

	.tab-bar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		background: var(--bg-nav);
		border-top: 1px solid var(--border);
		padding-bottom: env(safe-area-inset-bottom, 0);
		z-index: 100;
	}

	.tab-bar > :global(*) {
		max-width: calc(var(--max-width) / 4);
	}

	.tab-item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
		padding: 0.5rem 0.25rem 0.4rem;
		text-decoration: none;
		color: var(--text-muted);
		font-size: 0.65rem;
		transition: color 0.15s;
		position: relative;
		max-width: 125px;
	}

	.tab-item.active {
		color: var(--accent);
	}

	.tab-item.disabled {
		opacity: 0.4;
		cursor: default;
	}

	.tab-icon {
		font-size: 1.25rem;
		line-height: 1;
	}

	.tab-label {
		font-weight: 500;
	}

	.tab-badge {
		font-size: 0.5rem;
		color: var(--text-muted);
		position: absolute;
		bottom: 0.15rem;
	}
</style>
