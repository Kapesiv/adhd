<script lang="ts">
	import { iltavahti } from '$lib/iltavahti';
</script>

<svelte:head>
	<title>ADHD-työkalut</title>
</svelte:head>

<div class="page">
	<h1>Terve.</h1>

	<a href="/iltavahti" class="card">
		<div>
			<h2>Iltavahti</h2>
			<p>Iltatoimet listana, kello käy.</p>
		</div>
		<span class="arrow">&rarr;</span>
	</a>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	h1 {
		font-size: 1.5rem;
		font-weight: 600;
	}

	.card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		text-decoration: none;
		color: var(--text);
		transition: border-color 0.15s;
	}

	.card:hover {
		border-color: var(--text-muted);
	}

	.card h2 {
		font-size: 1rem;
		font-weight: 600;
	}

	.card p {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin-top: 0.15rem;
	}

	.arrow {
		font-size: 1.2rem;
		color: var(--text-muted);
	}
</style>
