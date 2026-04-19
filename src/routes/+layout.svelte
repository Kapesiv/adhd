<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';

	interface NavItem {
		label: string;
		href: string;
		icon: string;
	}

	const navItems: NavItem[] = [
		{ label: 'Fokus', href: '/', icon: '◉' },
		{ label: 'Asetukset', href: '/asetukset', icon: '⌘' }
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
				<span class="tab-icon">{item.icon}</span>
				<span class="tab-label">{item.label}</span>
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
		max-width: calc(var(--max-width) / 2);
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

	.tab-icon {
		font-size: 1.1rem;
		line-height: 1;
		font-weight: 700;
	}

	.tab-label {
		font-weight: 600;
		letter-spacing: 0.02em;
	}
</style>
