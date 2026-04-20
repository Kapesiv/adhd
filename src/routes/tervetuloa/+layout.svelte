<!-- Onboarding-layout: koko ruudun overlay tumma gradient -->
<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { browser } from '$app/environment';

	let { children } = $props();

	// Vaiheiden polut järjestyksessä
	const stepKeys = ['', 'tunnistaminen', 'sopimus', 'intensiteetti', 'valmis'];

	// Nykyinen vaihe polun perusteella
	let currentStep = $derived.by(() => {
		const after = $page.url.pathname
			.replace(`${base}/tervetuloa`, '')
			.replace(/^\//, '');
		const idx = stepKeys.indexOf(after);
		return idx >= 0 ? idx : 0;
	});

	// Ohita onboarding kokonaan
	function skip() {
		if (browser) {
			localStorage.setItem('onboardingComplete', 'true');
			goto(`${base}/`);
		}
	}
</script>

<div class="onboarding">
	<button class="skip" onclick={skip}>Ohita</button>

	<div class="content">
		{@render children()}
	</div>

	<!-- Etenemispisteet -->
	<div class="progress">
		{#each stepKeys as _, i}
			<span
				class="dot"
				class:active={i === currentStep}
				class:done={i < currentStep}
			></span>
		{/each}
	</div>
</div>

<style>
	.onboarding {
		position: fixed;
		inset: 0;
		background: linear-gradient(to bottom, #0f1115, #1a1d24);
		display: flex;
		flex-direction: column;
		align-items: center;
		z-index: 100;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.skip {
		position: absolute;
		top: 16px;
		right: 16px;
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 0.85rem;
		cursor: pointer;
		padding: 8px 12px;
		z-index: 10;
	}

	.content {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		width: 100%;
		max-width: 420px;
		padding: 24px;
	}

	.progress {
		display: flex;
		gap: 8px;
		padding: 24px;
		padding-bottom: calc(24px + env(safe-area-inset-bottom, 0));
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--border);
		transition: background 0.3s;
	}

	.dot.active {
		background: var(--text);
	}

	.dot.done {
		background: var(--accent);
	}
</style>
