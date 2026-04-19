<svelte:options runes={false} />

<script lang="ts">
	import { iltavahti } from '$lib/iltavahti';

	$: state = $iltavahti;
</script>

<svelte:head>
	<title>Asetukset</title>
</svelte:head>

<div class="page">
	<h1>Asetukset</h1>

	<section class="card">
		<h2>Nukkumaanmenoaika</h2>
		<input
			type="time"
			value={state.bedtime}
			onchange={(e) => iltavahti.setBedtime((e.currentTarget as HTMLInputElement).value)}
		/>
	</section>

	<section class="card">
		<h2>Lukitse puhelin automaattisesti</h2>
		<p>iPhonen Keskittymistila estää kaikki appit paitsi tämän. Aseta kerran, toimii joka ilta.</p>

		<div class="steps">
			<div class="step">
				<span class="num">1</span>
				<div>
					<strong>Luo Keskittymistila</strong>
					<p>Asetukset → Keskittyminen → + → Oma → nimeä "Ilta"</p>
				</div>
			</div>
			<div class="step">
				<span class="num">2</span>
				<div>
					<strong>Salli vain Safari</strong>
					<p>Ilta-tila → Appit → valitse "Salli vain valitut" → lisää Safari</p>
				</div>
			</div>
			<div class="step">
				<span class="num">3</span>
				<div>
					<strong>Ajasta automaattisesti</strong>
					<p>Ilta-tila → Ajastus → lisää aikataulu → esim. joka päivä klo {state.bedtime.split(':')[0]}:00 – 06:00</p>
				</div>
			</div>
			<div class="step">
				<span class="num">4</span>
				<div>
					<strong>Valmis</strong>
					<p>Puhelin lukittuu joka ilta. Avaa Safari → tämä sivu → tee iltatoimet → palkintosivut avautuvat.</p>
				</div>
			</div>
		</div>
	</section>

	<section class="card">
		<h2>Pikakomento: avaa Iltavahti yhdellä napilla</h2>
		<div class="steps">
			<div class="step">
				<span class="num">1</span>
				<div>
					<strong>Avaa Pikakomennat (Shortcuts)</strong>
					<p>Etsi "Pikakomennat" Spotlightilla tai sovelluskirjastosta</p>
				</div>
			</div>
			<div class="step">
				<span class="num">2</span>
				<div>
					<strong>Luo uusi → Lisää toiminto → "Avaa URL-osoitteet"</strong>
					<p>Kirjoita: kapesiv.github.io/adhd/iltavahti</p>
				</div>
			</div>
			<div class="step">
				<span class="num">3</span>
				<div>
					<strong>Lisää kotinäytölle</strong>
					<p>Nimeä "Iltavahti" ja valitse ikoni</p>
				</div>
			</div>
		</div>
	</section>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 500px;
		margin: 0 auto;
	}

	h1 {
		font-size: 1.3rem;
		font-weight: 600;
	}

	.card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		padding: 1rem 1.25rem;
	}

	.card h2 {
		font-size: 1rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
	}

	.card > p {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin-bottom: 1rem;
	}

	.card input[type='time'] {
		background: var(--field);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 0.6rem 0.75rem;
		font: inherit;
		width: 100%;
	}

	.steps {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.step {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
	}

	.num {
		width: 1.6rem;
		height: 1.6rem;
		background: var(--accent);
		color: white;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 700;
		flex-shrink: 0;
		margin-top: 0.1rem;
	}

	.step strong {
		font-size: 0.9rem;
		display: block;
	}

	.step p {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin-top: 0.15rem;
	}
</style>
