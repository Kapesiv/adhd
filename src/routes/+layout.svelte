<script lang="ts">
	import '../app.css';
	import { browser } from '$app/environment';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { settings } from '$lib/core/state';
	import { loadSettings } from '$lib/core/storage';

	if (browser && 'serviceWorker' in navigator) {
		navigator.serviceWorker.register(`${base}/sw.js`);
	}

	let { children } = $props();

	onMount(async () => {
		const saved = await loadSettings();
		if (saved) settings.set(saved);

		const path = $page.url.pathname;
		const isOnboarding = path.startsWith(`${base}/tervetuloa`);
		if (!saved?.onboardingDone && !isOnboarding) {
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
