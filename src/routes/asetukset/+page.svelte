<svelte:options runes={false} />

<script lang="ts">
	import { focusBrowser, workspaceStateLabels, type WorkspaceState } from '$lib/focus-browser';

	const states: WorkspaceState[] = ['now', 'later', 'parked'];

	let settings = $focusBrowser.settings;

	$: settings = $focusBrowser.settings;

	function patchSettings<K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) {
		focusBrowser.updateSettings({ [key]: value });
	}
</script>

<svelte:head>
	<title>Asetukset</title>
</svelte:head>

<div class="page">
	<section class="hero card">
		<p class="eyebrow">Guardrails</p>
		<h1>Säädä, kuinka paljon selain hidastaa sinua ennen uutta suuntaa.</h1>
		<p class="lede">
			Näillä säädöillä voit testata, mikä oikeasti auttaa sinua pysähtymään: aika, kysymys,
			parkki vai palautus.
		</p>
	</section>

	<section class="grid">
		<article class="card">
			<div class="section-head">
				<h2>Pysähdys</h2>
				<span>{settings.pauseSeconds}s</span>
			</div>
			<p class="muted">Kuinka pitkä tauko ennen kuin uusi sivu voidaan oikeasti lisätä sessioon.</p>
			<input
				type="range"
				min="0"
				max="30"
				step="1"
				value={settings.pauseSeconds}
				onchange={(event) => patchSettings('pauseSeconds', Number((event.currentTarget as HTMLInputElement).value))}
			/>
		</article>

		<article class="card">
			<div class="section-head">
				<h2>Tarkoituskysymys</h2>
				<label class="switch">
					<input
						type="checkbox"
						checked={settings.askIntent}
						onchange={(event) => patchSettings('askIntent', (event.currentTarget as HTMLInputElement).checked)}
					/>
					<span>Vaadi perustelu ennen avausta</span>
				</label>
			</div>
			<p class="muted">
				Kun tämä on päällä, “avaa harkiten” aktivoituu vasta kun kirjoitat miksi sivu kuuluu
				nykyiseen sessioon.
			</p>
		</article>

		<article class="card">
			<div class="section-head">
				<h2>URL-kuri</h2>
				<label class="switch">
					<input
						type="checkbox"
						checked={settings.requireUrl}
						onchange={(event) => patchSettings('requireUrl', (event.currentTarget as HTMLInputElement).checked)}
					/>
					<span>Vaadi URL tai muistipolku</span>
				</label>
			</div>
			<p class="muted">
				Estää epämääräistä “avaan jotain” -käyttäytymistä. Kun tämä on pois päältä, voit lisätä
				pelkän ajatuksen.
			</p>
		</article>

		<article class="card">
			<div class="section-head">
				<h2>Impulssikynnys</h2>
				<span>{settings.urgeThreshold}/5</span>
			</div>
			<p class="muted">
				Kun uuden sivun impulssiarvo ylittää tämän, käyttöliittymä ehdottaa näkyvästi parkkeeramista.
			</p>
			<input
				type="range"
				min="1"
				max="5"
				step="1"
				value={settings.urgeThreshold}
				onchange={(event) => patchSettings('urgeThreshold', Number((event.currentTarget as HTMLInputElement).value))}
			/>
		</article>

		<article class="card">
			<div class="section-head">
				<h2>Oletustila uusille sivuille</h2>
			</div>
			<p class="muted">
				Voit ohjata selainta suosimaan heti parkkia tai myöhempää koria, jos “nyt” on sinulle liian
				helppo valinta.
			</p>
			<select
				value={settings.defaultState}
				onchange={(event) =>
					patchSettings('defaultState', (event.currentTarget as HTMLSelectElement).value as WorkspaceState)}
			>
				{#each states as state}
					<option value={state}>{workspaceStateLabels[state]}</option>
				{/each}
			</select>
		</article>

		<article class="card">
			<div class="section-head">
				<h2>Nopeat syyt</h2>
				<label class="switch">
					<input
						type="checkbox"
						checked={settings.showReasonChips}
						onchange={(event) =>
							patchSettings('showReasonChips', (event.currentTarget as HTMLInputElement).checked)}
					/>
					<span>Näytä valmiit perustelut</span>
				</label>
			</div>
			<p class="muted">
				Hyvä silloin, kun pysähtyminen onnistuu helpommin valitsemalla lause kuin kirjoittamalla tyhjästä.
			</p>
		</article>

		<article class="card">
			<div class="section-head">
				<h2>Palautusnudge</h2>
				<label class="switch">
					<input
						type="checkbox"
						checked={settings.recoveryNudge}
						onchange={(event) =>
							patchSettings('recoveryNudge', (event.currentTarget as HTMLInputElement).checked)}
					/>
					<span>Korosta viimeisin checkpoint</span>
				</label>
			</div>
			<p class="muted">
				Tämä pitää paluun näkyvänä. Jos huomaat jumiutuvasi vanhoihin sessioihin, voit kytkeä tämän pois.
			</p>
		</article>
	</section>

	<section class="card tips">
		<h2>Miten tätä kannattaa käyttää</h2>
		<ul>
			<li>Aloita tiukalla pysähdyksellä, esimerkiksi 12–20 sekuntia.</li>
			<li>Jos kirjoittaminen tuntuu raskaalta, pidä nopeat syyt päällä mutta älä poista tarkoituskysymystä.</li>
			<li>Jos jokainen kiinnostava linkki vetää mukaansa, vaihda oletustilaksi `Parkki` viikon kokeiluksi.</li>
			<li>Jos tuntuu että kaikki silti paisuu, nosta impulssikynnän näkyvyyttä pitämällä raja 3/5:ssa.</li>
		</ul>
	</section>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.card {
		background:
			linear-gradient(180deg, rgb(255 255 255 / 0.03), transparent 45%),
			var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 1.25rem;
		padding: 1rem;
		box-shadow: 0 20px 45px rgb(0 0 0 / 0.18);
	}

	.hero h1 {
		font-size: clamp(1.9rem, 7vw, 3rem);
		letter-spacing: -0.04em;
		line-height: 0.98;
		max-width: 14ch;
	}

	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.16em;
		font-size: 0.68rem;
		color: var(--accent-soft);
		margin-bottom: 0.5rem;
	}

	.lede,
	.muted {
		color: var(--text-muted);
	}

	.lede {
		margin-top: 0.8rem;
		max-width: 58ch;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
		gap: 0.9rem;
	}

	.section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.8rem;
	}

	.section-head h2 {
		font-size: 1rem;
		letter-spacing: -0.03em;
	}

	.section-head span {
		background: var(--pill);
		border: 1px solid rgb(255 255 255 / 0.06);
		border-radius: 999px;
		padding: 0.35rem 0.7rem;
		font-size: 0.78rem;
	}

	input,
	select {
		width: 100%;
		margin-top: 0.9rem;
	}

	input,
	select {
		font: inherit;
	}

	input[type='range'] {
		accent-color: var(--accent);
	}

	select {
		background: var(--field);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 0.95rem;
		padding: 0.85rem 0.95rem;
	}

	.switch {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.92rem;
	}

	.switch input {
		width: auto;
		margin: 0;
	}

	.tips ul {
		margin-left: 1rem;
		display: grid;
		gap: 0.55rem;
		color: var(--text-muted);
	}

	@media (max-width: 640px) {
		.section-head {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
