<script lang="ts">
	import '../app.css';
	import { browser } from '$app/environment';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	if (browser && 'serviceWorker' in navigator) {
		navigator.serviceWorker.register(`${base}/sw.js`);
	}

	let { children } = $props();

	// Onboarding-tarkistus: ohjaa /tervetuloa jos ei valmis
	onMount(() => {
		const done = localStorage.getItem('onboardingComplete');
		const path = $page.url.pathname;
		const isOnboarding = path.startsWith(`${base}/tervetuloa`);
		const isSettings = path.startsWith(`${base}/asetukset`);

		if (!done && !isOnboarding && !isSettings) {
			goto(`${base}/tervetuloa`, { replaceState: true });
		}
	});
</script>

{@render children()}

<style>
	:global(body) {
		overflow-x: hidden;
	}
</style>
