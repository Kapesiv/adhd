<script lang="ts">
	import '../app.css';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { settings } from '$lib/core/state';
	import { loadSettings } from '$lib/core/storage';

	let { children } = $props();

	onMount(async () => {
		if (browser && 'serviceWorker' in navigator) {
			const registrations = await navigator.serviceWorker.getRegistrations();
			await Promise.all(registrations.map((registration) => registration.unregister()));
		}

		const saved = await loadSettings();
		if (saved) settings.set(saved);
	});
</script>

{@render children()}

<style>
	:global(body) {
		overflow-x: hidden;
	}
</style>
