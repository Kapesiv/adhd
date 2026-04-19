import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			manifest: false,
			workbox: {
				globPatterns: ['client/**/*.{js,css,html,ico,png,svg,webp,woff,woff2}']
			}
		})
	]
});
