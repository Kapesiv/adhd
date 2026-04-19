<svelte:options runes={false} />

<script lang="ts">
	import { onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import {
		focusBrowser,
		workspaceStateLabels,
		type Session,
		type WorkspaceItem,
		type WorkspaceState
	} from '$lib/focus-browser';

	const quickIntentChips = [
		'Tarvitsen tämän vain nykyisen päätöksen tekemiseen.',
		'Tämä auttaa minua viimeistelemään nykyisen tehtävän.',
		'Tämä on kiinnostava, mutta ei tämän hetken tärkein asia.',
		'Haluan parkkeerata tämän, jotta se ei karkaa mielestä.'
	];

	const workspaceStates: WorkspaceState[] = ['now', 'later', 'parked'];

	type PendingItem = {
		title: string;
		url: string;
		state: WorkspaceState;
		intent: string;
		urgency: number;
	};

	let sessionTitle = '';
	let sessionGoal = '';

	let draftTitle = '';
	let draftUrl = '';
	let draftState: WorkspaceState = get(focusBrowser).settings.defaultState;
	let draftIntent = '';
	let draftUrgency = 3;

	let checkpointSummary = '';
	let checkpointNextStep = '';
	let pinnedItemId: string | null = null;
	let checkpointSessionId = '';

	let pauseOpen = false;
	let pauseRemaining = 0;
	let timerHandle: ReturnType<typeof setInterval> | null = null;
	let pendingItem: PendingItem | null = null;

	$: appState = $focusBrowser;
	$: sessions = [...appState.sessions].sort(
		(left, right) => +new Date(right.updatedAt) - +new Date(left.updatedAt)
	);
	$: activeSession = sessions.find((session) => session.id === appState.activeSessionId) ?? sessions[0] ?? null;
	$: latestCheckpoint = activeSession?.checkpoints[0] ?? null;
	$: recoverySessions = sessions.slice(0, 4);
	$: guardrailSummary = [
		`${appState.settings.pauseSeconds}s pysähdys`,
		appState.settings.askIntent ? 'tarkoitus kysytään' : 'ei tarkoituskysymystä',
		`kynnys ${appState.settings.urgeThreshold}/5 parkkiin`
	];

	$: if (activeSession && checkpointSessionId !== activeSession.id) {
		checkpointSummary = latestCheckpoint?.summary ?? '';
		checkpointNextStep = latestCheckpoint?.nextStep ?? '';
		pinnedItemId =
			latestCheckpoint?.pinnedItemId ??
			activeSession.items.find((item) => item.state === 'now')?.id ??
			activeSession.items[0]?.id ??
			null;
		checkpointSessionId = activeSession.id;
	}

	onDestroy(() => {
		stopTimer();
	});

	function createSession() {
		if (!sessionTitle.trim() || !sessionGoal.trim()) {
			return;
		}

		focusBrowser.createSession({
			title: sessionTitle,
			goal: sessionGoal
		});

		sessionTitle = '';
		sessionGoal = '';
	}

	function normalizeUrl(raw: string) {
		const trimmed = raw.trim();
		if (!trimmed) {
			return '';
		}

		if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
			return trimmed;
		}

		if (trimmed.includes('.')) {
			return `https://${trimmed}`;
		}

		return trimmed;
	}

	function startAddFlow() {
		if (!activeSession || !draftTitle.trim()) {
			return;
		}

		const settings = get(focusBrowser).settings;
		const normalizedUrl = normalizeUrl(draftUrl);

		if (settings.requireUrl && !normalizedUrl) {
			return;
		}

		pendingItem = {
			title: draftTitle.trim(),
			url: normalizedUrl || `focus://${draftTitle.trim().toLowerCase().replaceAll(/\s+/g, '-')}`,
			state: draftState,
			intent: draftIntent.trim(),
			urgency: draftUrgency
		};

		if (settings.pauseSeconds > 0 || settings.askIntent) {
			pauseOpen = true;
			pauseRemaining = settings.pauseSeconds;
			stopTimer();

			if (pauseRemaining > 0) {
				timerHandle = setInterval(() => {
					if (pauseRemaining <= 1) {
						pauseRemaining = 0;
						stopTimer();
						return;
					}

					pauseRemaining -= 1;
				}, 1000);
			}

			return;
		}

		commitPendingItem();
	}

	function stopTimer() {
		if (timerHandle) {
			clearInterval(timerHandle);
			timerHandle = null;
		}
	}

	function closePause() {
		pauseOpen = false;
		pendingItem = null;
		stopTimer();
	}

	function commitPendingItem(forceState?: WorkspaceState) {
		if (!activeSession || !pendingItem) {
			return;
		}

		focusBrowser.addItem(activeSession.id, {
			...pendingItem,
			state: forceState ?? pendingItem.state,
			intent:
				pendingItem.intent ||
				(forceState === 'parked'
					? 'Parkkeerattu, jotta voin palata tähän hallitusti myöhemmin.'
					: 'Lisätty nykyiseen työtilaan harkinnan jälkeen.')
		});

		resetDraft();
		pauseOpen = false;
		pendingItem = null;
		stopTimer();
	}

	function resetDraft() {
		const settings = get(focusBrowser).settings;

		draftTitle = '';
		draftUrl = '';
		draftIntent = '';
		draftUrgency = 3;
		draftState = settings.defaultState;
	}

	function saveCheckpoint() {
		if (!activeSession || !checkpointSummary.trim() || !checkpointNextStep.trim()) {
			return;
		}

		focusBrowser.saveCheckpoint(activeSession.id, {
			summary: checkpointSummary,
			nextStep: checkpointNextStep,
			pinnedItemId: pinnedItemId || null
		});
	}

	function setSession(sessionId: string) {
		focusBrowser.setActiveSession(sessionId);
	}

	function setStatus(sessionId: string, status: Session['status']) {
		focusBrowser.updateSessionStatus(sessionId, status);
	}

	function moveItem(item: WorkspaceItem, nextState: WorkspaceState) {
		if (!activeSession || item.state === nextState) {
			return;
		}

		focusBrowser.moveItem(activeSession.id, item.id, nextState);
	}

	function itemsByState(session: Session | null, state: WorkspaceState) {
		return session?.items.filter((item) => item.state === state) ?? [];
	}

	function formatTime(timestamp: string) {
		return new Intl.DateTimeFormat('fi-FI', {
			day: 'numeric',
			month: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(timestamp));
	}

	function isReadyToOpen() {
		const settings = get(focusBrowser).settings;
		return pauseRemaining === 0 && (!settings.askIntent || Boolean(draftIntent.trim()));
	}
</script>

<svelte:head>
	<title>Fokus-selain</title>
	<meta
		name="description"
		content="ADHD-ystävällinen fokus-selaimen prototyyppi, jossa voit ohjata tabitulvaa sessioneilla, parkilla ja checkpointilla."
	/>
</svelte:head>

<div class="page">
	<section class="hero card">
		<div>
			<p class="eyebrow">Fokus-selain / oma käyttö ensin</p>
			<h1>Rakenna itsellesi selain, joka pakottaa pysähtymään.</h1>
			<p class="lede">
				Tämä prototyyppi ei yritä voittaa tabikaaosta näyttämällä lisää tabeja, vaan muuttamalla
				sitä hetkeä, jossa uusi ajatus yrittää avata uuden suunnan.
			</p>
		</div>

		<div class="guardrails">
			{#each guardrailSummary as line}
				<span>{line}</span>
			{/each}
		</div>
	</section>

	<section class="influences">
		<div class="section-head">
			<h2>Mihin voit vaikuttaa tässä protossa</h2>
			<a href="/asetukset">Säädä vipuja</a>
		</div>

		<div class="influence-grid">
			<article class="mini-card">
				<h3>Pysähdys ennen avausta</h3>
				<p>Pakollinen hengitystila ennen kuin uusi sivu tulee työmuistiin mukaan.</p>
			</article>
			<article class="mini-card">
				<h3>Tarkoitus ääneen</h3>
				<p>Kirjoitat miksi avaat tämän juuri nyt, jolloin impulssi muuttuu päätökseksi.</p>
			</article>
			<article class="mini-card">
				<h3>Parkki kiinnostaville harhapoluille</h3>
				<p>Et menetä ideaa, mutta et myöskään anna sen kaapata aktiivista sessiota.</p>
			</article>
			<article class="mini-card">
				<h3>Checkpoint paluuta varten</h3>
				<p>Kirjoitat lyhyen “missä olin menossa” -muistin ennen kuin fokus hajoaa.</p>
			</article>
		</div>
	</section>

	<section class="sessions">
		<div class="section-head">
			<h2>Palautusnäkymä</h2>
			<span>{recoverySessions.length} sessiota tallessa</span>
		</div>

		<div class="recovery-list">
			{#each recoverySessions as session, index}
				<button
					type="button"
					class:active-card={activeSession?.id === session.id}
					class:nudged={appState.settings.recoveryNudge && index === 0}
					class="recovery-card"
					onclick={() => setSession(session.id)}
				>
					<div class="recovery-top">
						<strong>{session.title}</strong>
						<span class="status {session.status}">{session.status}</span>
					</div>
					<p>{session.goal}</p>
					<div class="recovery-meta">
						<span>{session.items.length} sivua</span>
						<span>Päivitetty {formatTime(session.updatedAt)}</span>
					</div>
				</button>
			{/each}
		</div>
	</section>

	<section class="split">
		<div class="column">
			<div class="card">
				<div class="section-head">
					<h2>Luo uusi sessio</h2>
					<span>Yksi tavoite kerrallaan</span>
				</div>

				<form class="stack" onsubmit={(event) => event.preventDefault()}>
					<label>
						<span>Session nimi</span>
						<input bind:value={sessionTitle} placeholder="Esim. kirjoita tarjous valmiiksi" />
					</label>

					<label>
						<span>Mikä on tämän session tavoite?</span>
						<textarea
							bind:value={sessionGoal}
							rows="3"
							placeholder="Mikä konkreettinen asia valmistuu, jos pysyt tässä sessiossa?"
						></textarea>
					</label>

					<button type="button" class="primary" onclick={createSession}>Aloita uusi sessio</button>
				</form>
			</div>

			{#if activeSession}
				<div class="card active-session">
					<div class="section-head">
						<h2>Aktiivinen sessio</h2>
						<div class="status-actions">
							<button type="button" onclick={() => setStatus(activeSession.id, 'active')}>Aktiivinen</button>
							<button type="button" onclick={() => setStatus(activeSession.id, 'paused')}>Tauolla</button>
							<button type="button" onclick={() => setStatus(activeSession.id, 'done')}>Valmis</button>
						</div>
					</div>

					<h3>{activeSession.title}</h3>
					<p class="goal">{activeSession.goal}</p>

					<div class="stats">
						<div>
							<strong>{itemsByState(activeSession, 'now').length}</strong>
							<span>Nyt</span>
						</div>
						<div>
							<strong>{itemsByState(activeSession, 'later').length}</strong>
							<span>Myöhemmin</span>
						</div>
						<div>
							<strong>{itemsByState(activeSession, 'parked').length}</strong>
							<span>Parkissa</span>
						</div>
					</div>

					{#if latestCheckpoint}
						<div class="checkpoint-preview">
							<p class="label">Viimeisin checkpoint</p>
							<strong>{latestCheckpoint.summary}</strong>
							<p>{latestCheckpoint.nextStep}</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<div class="column">
			<div class="card">
				<div class="section-head">
					<h2>Avaa harkiten</h2>
					<span>Uusi sivu kulkee pysähdyksen läpi</span>
				</div>

				<form class="stack" onsubmit={(event) => event.preventDefault()}>
					<label>
						<span>Mitä olet avaamassa?</span>
						<input bind:value={draftTitle} placeholder="Esim. lääkärin artikkeli tai bugiraportti" />
					</label>

					<label>
						<span>URL tai muistilappu</span>
						<input bind:value={draftUrl} placeholder="example.com tai oma muistipolku" />
					</label>

					<label>
						<span>Missä tämän kuuluisi elää?</span>
						<select bind:value={draftState}>
							{#each workspaceStates as state}
								<option value={state}>{workspaceStateLabels[state]}</option>
							{/each}
						</select>
					</label>

					<label>
						<span>Kuinka voimakas impulssi tämä on? {draftUrgency}/5</span>
						<input bind:value={draftUrgency} type="range" min="1" max="5" />
					</label>

					<label>
						<span>Miksi avaat tämän juuri nyt?</span>
						<textarea
							bind:value={draftIntent}
							rows="3"
							placeholder="Kirjoita yksi lause, joka perustelee tämän nykyiselle tehtävälle."
						></textarea>
					</label>

					{#if appState.settings.showReasonChips}
						<div class="chip-row">
							{#each quickIntentChips as chip}
								<button type="button" class="chip" onclick={() => (draftIntent = chip)}>{chip}</button>
							{/each}
						</div>
					{/if}

					<button type="button" class="primary" onclick={startAddFlow} disabled={!activeSession}>
						Avaa session läpi
					</button>
				</form>
			</div>

			{#if activeSession}
				<div class="card">
					<div class="section-head">
						<h2>Tallenna checkpoint</h2>
						<span>Anna paluulle selvä lähtöpiste</span>
					</div>

					<form class="stack" onsubmit={(event) => event.preventDefault()}>
						<label>
							<span>Mitä olit tekemässä?</span>
							<textarea bind:value={checkpointSummary} rows="3"></textarea>
						</label>

						<label>
							<span>Mikä on seuraava askel?</span>
							<textarea bind:value={checkpointNextStep} rows="3"></textarea>
						</label>

						<label>
							<span>Kiinnitä tärkein sivu</span>
							<select bind:value={pinnedItemId}>
								<option value="">Ei kiinnitystä</option>
								{#each activeSession.items as item}
									<option value={item.id}>{item.title}</option>
								{/each}
							</select>
						</label>

						<button type="button" class="primary ghost" onclick={saveCheckpoint}>
							Tallenna checkpoint
						</button>
					</form>
				</div>
			{/if}
		</div>
	</section>

	{#if activeSession}
		<section class="board">
			<div class="section-head">
				<h2>{activeSession.title}</h2>
				<span>Pidä työmuisti näkyvänä, muu parkkiin</span>
			</div>

			<div class="board-grid">
				{#each workspaceStates as state}
					<div class="lane">
						<div class="lane-head">
							<h3>{workspaceStateLabels[state]}</h3>
							<span>{itemsByState(activeSession, state).length}</span>
						</div>

						<div class="lane-items">
							{#if itemsByState(activeSession, state).length === 0}
								<p class="empty">Ei sivuja tässä tilassa.</p>
							{/if}

							{#each itemsByState(activeSession, state) as item}
								<article class:highlight={item.id === pinnedItemId} class="item-card">
									<div class="item-top">
										<div>
											<h4>{item.title}</h4>
											<a href={item.url} target="_blank" rel="noreferrer">{item.url}</a>
										</div>
										<span class:warn={item.urgency >= appState.settings.urgeThreshold} class="urge">
											Impulssi {item.urgency}/5
										</span>
									</div>

									<p>{item.intent}</p>

									<div class="item-actions">
										{#each workspaceStates as candidate}
											<button
												type="button"
												class:current={candidate === item.state}
												onclick={() => moveItem(item, candidate)}
											>
												{workspaceStateLabels[candidate]}
											</button>
										{/each}
									</div>
								</article>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}
</div>

{#if pauseOpen && pendingItem}
	<div class="overlay">
		<section class="pause-card">
			<p class="eyebrow">Pysähdy ennen avausta</p>
			<h2>{pendingItem.title}</h2>
			<p class="pause-text">
				{#if pauseRemaining > 0}
					Odota hetki. Tavoite on erottaa “haluan klikata” siitä, onko tämä oikeasti hyödyllinen nykyiseen sessioon.
				{:else}
					Nyt päätä tietoisesti: otatko tämän mukaan, siirrätkö myöhemmäksi vai parkkeeraatko pois näkyvistä.
				{/if}
			</p>

			<div class="countdown">{pauseRemaining > 0 ? `${pauseRemaining}s` : 'Valmis päätökseen'}</div>

			{#if pendingItem.urgency >= appState.settings.urgeThreshold}
				<p class="warning">
					Tämä näyttää impulsiiviselta avaukselta. Parkki voi olla parempi kuin “nyt”.
				</p>
			{/if}

			<div class="pause-actions">
				<button type="button" class="ghost" onclick={closePause}>Peruuta</button>
				<button type="button" class="ghost" onclick={() => commitPendingItem('parked')}>
					Parkkeeraa tämä
				</button>
				<button type="button" class="primary" onclick={() => commitPendingItem()} disabled={!isReadyToOpen()}>
					Avaa harkiten
				</button>
			</div>
		</section>
	</div>
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.card,
	.recovery-card,
	.lane,
	.pause-card,
	.mini-card {
		background:
			linear-gradient(180deg, rgb(255 255 255 / 0.03), transparent 45%),
			var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 1.25rem;
		box-shadow: 0 20px 45px rgb(0 0 0 / 0.18);
	}

	.hero {
		padding: 1.3rem;
		display: grid;
		gap: 1rem;
	}

	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.16em;
		font-size: 0.68rem;
		color: var(--accent-soft);
		margin-bottom: 0.5rem;
	}

	h1 {
		font-size: clamp(2rem, 7vw, 3.3rem);
		line-height: 0.96;
		letter-spacing: -0.04em;
		max-width: 12ch;
	}

	.lede {
		color: var(--text-muted);
		max-width: 58ch;
		margin-top: 0.8rem;
	}

	.guardrails {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
	}

	.guardrails span,
	.recovery-meta span,
	.status,
	.countdown,
	.lane-head span {
		background: var(--pill);
		border: 1px solid rgb(255 255 255 / 0.06);
		border-radius: 999px;
		padding: 0.35rem 0.7rem;
		font-size: 0.78rem;
	}

	.section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.8rem;
	}

	.section-head h2 {
		font-size: 1.1rem;
		letter-spacing: -0.03em;
	}

	.section-head a,
	.section-head span,
	.goal,
	.empty,
	.pause-text,
	.warning,
	.item-card p,
	.recovery-card p {
		color: var(--text-muted);
	}

	.influence-grid,
	.recovery-list,
	.board-grid,
	.split {
		display: grid;
		gap: 0.9rem;
	}

	.influence-grid {
		grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
	}

	.mini-card {
		padding: 1rem;
	}

	.mini-card h3 {
		margin-bottom: 0.4rem;
		font-size: 0.98rem;
	}

	.recovery-list {
		grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
	}

	.recovery-card {
		padding: 1rem;
		text-align: left;
		cursor: pointer;
	}

	.recovery-card.active-card {
		border-color: var(--accent);
		transform: translateY(-2px);
	}

	.recovery-card.nudged {
		box-shadow:
			0 20px 45px rgb(0 0 0 / 0.18),
			inset 0 0 0 1px rgb(249 115 22 / 0.26);
	}

	.recovery-top,
	.item-top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.8rem;
	}

	.recovery-top strong,
	.active-session h3 {
		font-size: 1.02rem;
		letter-spacing: -0.03em;
	}

	.recovery-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.9rem;
	}

	.status.active {
		color: var(--accent);
	}

	.status.paused {
		color: #fbbf24;
	}

	.status.done {
		color: #4ade80;
	}

	.split {
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
	}

	.column {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.card {
		padding: 1rem;
	}

	.stack {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	label span,
	.label {
		font-size: 0.8rem;
		color: var(--text-soft);
	}

	input,
	select,
	textarea,
	button {
		font: inherit;
	}

	input,
	select,
	textarea {
		width: 100%;
		background: var(--field);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 0.95rem;
		padding: 0.85rem 0.95rem;
	}

	textarea {
		resize: vertical;
		min-height: 5rem;
	}

	input[type='range'] {
		padding: 0;
		background: transparent;
		border: none;
	}

	button {
		border: none;
		cursor: pointer;
	}

	.primary,
	.status-actions button,
	.item-actions button,
	.chip,
	.ghost {
		border-radius: 999px;
		padding: 0.75rem 1rem;
	}

	.primary {
		background: linear-gradient(135deg, var(--accent), var(--accent-strong));
		color: #fffaf5;
		font-weight: 700;
	}

	.primary:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.ghost,
	.status-actions button,
	.item-actions button,
	.chip {
		background: var(--pill);
		color: var(--text);
		border: 1px solid rgb(255 255 255 / 0.06);
	}

	.primary.ghost {
		background: linear-gradient(135deg, rgb(249 115 22 / 0.18), rgb(217 70 239 / 0.12));
		color: var(--text);
	}

	.chip-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.status-actions,
	.item-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.65rem;
		margin-top: 1rem;
	}

	.stats div,
	.checkpoint-preview {
		background: var(--field);
		border-radius: 1rem;
		padding: 0.85rem;
		border: 1px solid var(--border);
	}

	.stats strong {
		font-size: 1.25rem;
		display: block;
		margin-bottom: 0.15rem;
	}

	.checkpoint-preview {
		margin-top: 0.9rem;
	}

	.board-grid {
		grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
	}

	.lane {
		padding: 0.9rem;
	}

	.lane-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.8rem;
	}

	.lane-items {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.item-card {
		padding: 0.85rem;
		background: var(--field);
		border: 1px solid var(--border);
		border-radius: 1rem;
	}

	.item-card.highlight {
		border-color: var(--accent);
		box-shadow: inset 0 0 0 1px rgb(249 115 22 / 0.25);
	}

	.item-card h4 {
		margin-bottom: 0.25rem;
	}

	.item-card a {
		color: var(--accent-soft);
		font-size: 0.8rem;
		word-break: break-all;
	}

	.item-card p {
		margin: 0.8rem 0;
	}

	.urge.warn {
		color: #ffd3b3;
		background: rgb(249 115 22 / 0.22);
	}

	.item-actions .current {
		background: rgb(249 115 22 / 0.18);
		border-color: rgb(249 115 22 / 0.3);
	}

	.overlay {
		position: fixed;
		inset: 0;
		background: rgb(5 8 14 / 0.72);
		display: grid;
		place-items: center;
		padding: 1rem;
		z-index: 200;
		backdrop-filter: blur(16px);
	}

	.pause-card {
		max-width: 32rem;
		padding: 1.2rem;
		width: 100%;
	}

	.pause-card h2 {
		font-size: 1.45rem;
		letter-spacing: -0.03em;
		margin-bottom: 0.5rem;
	}

	.countdown {
		display: inline-flex;
		margin: 1rem 0 0.8rem;
		font-size: 1rem;
	}

	.warning {
		margin-bottom: 0.9rem;
		color: #ffd3b3;
	}

	.pause-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	@media (max-width: 640px) {
		.page {
			gap: 0.85rem;
		}

		h1 {
			max-width: 100%;
		}

		.section-head {
			align-items: flex-start;
			flex-direction: column;
		}

		.stats {
			grid-template-columns: 1fr;
		}
	}
</style>
