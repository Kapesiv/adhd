<svelte:options runes={false} />

<script lang="ts">
	import {
		iltavahti, getStreak, isTodayDone,
		requestWakeLock, releaseWakeLock,
		initAudio, playTick, startAlarm, stopAlarm,
		haptic,
		startMotionDetection, stopMotionDetection
	} from '$lib/iltavahti';
	import { onMount, onDestroy } from 'svelte';
	import { settings, type UserSettings } from '$lib/core/state';
	import {
		calculateDeadline,
		hoursUntilDeadline,
		sleepIfNow,
		getIntensityLevel,
		formatTime
	} from '$lib/modules/iltavahti/time-engine';
	import { downloadIcs } from '$lib/modules/iltavahti/ical';
	import { saveSettings } from '$lib/core/storage';
	import {
		subscribeToPush,
		unsubscribeFromPush,
		getSubscriptionState,
		isPushSupported,
		isIos,
		isStandalonePwa
	} from '$lib/modules/iltavahti/push-client';
	import { base } from '$app/paths';
	import { browser } from '$app/environment';
	import type { IntensityLevel } from '$lib/core/events';

	const PUSH_BACKEND_URL = import.meta.env.VITE_PUSH_BACKEND_URL as string | undefined;
	const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
	const pushConfigured = !!(PUSH_BACKEND_URL && VAPID_PUBLIC_KEY);
	const fullscreenTaskModeEnabled = false;

	// --- State ---
	let now = new Date();
	const timer = setInterval(() => (now = new Date()), 1000);
	let audioReady = false;
	let alarmActive = false;
	let phonePickedUp = false;
	let pickupTimeout: ReturnType<typeof setTimeout> | null = null;
	let showSettings = false;
	let showHelp = false;

	// "doing" = tapping through tasks, "idle" = streak/start view
	let mode: 'idle' | 'doing' | 'done' = 'idle';

	let level: IntensityLevel = 'calm';

	let autoStartChecked = false;

	onMount(() => {
		const s = $iltavahti;
		if (isTodayDone(s.completedDays ?? [])) {
			mode = 'done';
		}
	});

	// Auto-start doing-tilaan settingsien latauduttua:
	// a) notifikaatiosta tuli ?autostart=1, TAI
	// b) nukkumaanmenoaika on mennyt ja iltatoimet tekemättä
	$: if (
		fullscreenTaskModeEnabled &&
		!autoStartChecked &&
		browser &&
		mode === 'idle' &&
		$settings.onboardingDone &&
		state.tasks.length > 0 &&
		!isTodayDone(state.completedDays ?? [])
	) {
		autoStartChecked = true;
		const url = new URL(window.location.href);
		const autoRequested = url.searchParams.get('autostart') === '1';
		const past = hoursRemaining <= 0;
		if (autoRequested || past) {
			mode = 'doing';
			requestWakeLock();
			if (autoRequested) {
				url.searchParams.delete('autostart');
				history.replaceState({}, '', url.toString());
			}
		}
	}

	onDestroy(() => {
		clearInterval(timer);
		releaseWakeLock();
		stopAlarm();
		stopMotionDetection();
	});

	// Intensiteetti: laske jokaisella tikityksella
	$: deadline = calculateDeadline($settings.wakeUpTime, $settings.sleepHours);
	$: hoursRemaining = (() => {
		void now;
		return hoursUntilDeadline(deadline);
	})();
	$: hoursIfNow = (() => {
		void now;
		return sleepIfNow($settings.wakeUpTime);
	})();
	$: level = getIntensityLevel(hoursRemaining);


	let calendarSaved = false;
	function onCalendarDownload() {
		if (!browser) return;
		const url = window.location.origin + base + '/';
		downloadIcs($settings, url);
		calendarSaved = true;
		try {
			localStorage.setItem('iltavahti-calendar-installed', '1');
		} catch {
			// quota
		}
	}

	let notifPermission: NotificationPermission | 'unsupported' = 'default';
	$: if (browser && typeof Notification !== 'undefined') {
		notifPermission = Notification.permission;
	} else if (browser) {
		notifPermission = 'unsupported';
	}

	async function requestNotifPermission() {
		if (!browser || typeof Notification === 'undefined') return;
		const result = await Notification.requestPermission();
		notifPermission = result;
	}

	// --- Push subscription ---
	let pushSubscribed = false;
	let pushBusy = false;
	let pushError = '';

	onMount(async () => {
		if (!browser) return;
		const state = await getSubscriptionState();
		pushSubscribed = state.subscribed;
	});

	async function togglePushSubscription() {
		if (!pushConfigured || !PUSH_BACKEND_URL || !VAPID_PUBLIC_KEY) return;
		pushBusy = true;
		pushError = '';
		try {
			if (pushSubscribed) {
				await unsubscribeFromPush(PUSH_BACKEND_URL);
				pushSubscribed = false;
			} else {
				await subscribeToPush(PUSH_BACKEND_URL, VAPID_PUBLIC_KEY, $settings);
				pushSubscribed = true;
			}
		} catch (err) {
			pushError = err instanceof Error ? err.message : String(err);
		} finally {
			pushBusy = false;
		}
	}

	$: state = $iltavahti;
	$: streak = getStreak(state.completedDays ?? []);
	$: todayDone = isTodayDone(state.completedDays ?? []);
	$: remaining = state.tasks.filter((t) => !t.done);
	$: current = remaining[0] ?? null;
	$: allDone = state.tasks.length > 0 && remaining.length === 0;

	// Switch to done mode when all tasks completed
	$: if (allDone && mode === 'doing') {
		mode = 'done';
	}

	// Bedtime logic (deadline from settings store)
	$: minutesLeft = Math.round((deadline.getTime() - now.getTime()) / 60000);
	$: overTime = minutesLeft <= 0;

	// Alarm when overtime and still doing tasks
	$: if (overTime && mode === 'doing' && !allDone && !alarmActive && audioReady) {
		alarmActive = true;
		startAlarm();
	}
	$: if (allDone && alarmActive) {
		alarmActive = false;
		stopAlarm();
	}

	// Background color for task mode
	$: bg = (() => {
		if (mode !== 'doing') return 'var(--bg)';
		if (allDone) return '#0a0f0a';
		if (overTime) return '#1a0505';
		if (minutesLeft <= 15) return '#1a0f05';
		if (minutesLeft <= 45) return '#15130a';
		return '#0f1115';
	})();

	// Week calendar
	$: week = (() => {
		const days: { date: string; label: string; done: boolean; isToday: boolean }[] = [];
		const set = new Set(state.completedDays ?? []);
		const weekdays = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];
		for (let i = 6; i >= 0; i--) {
			const d = new Date();
			d.setDate(d.getDate() - i);
			const str = d.toISOString().slice(0, 10);
			days.push({
				date: str,
				label: weekdays[d.getDay()],
				done: set.has(str),
				isToday: i === 0
			});
		}
		return days;
	})();

	const rewards = [
		{ label: 'YouTube', url: 'https://youtube.com' },
		{ label: 'TikTok', url: 'https://tiktok.com' },
		{ label: 'Instagram', url: 'https://instagram.com' },
		{ label: 'Reddit', url: 'https://reddit.com' },
		{ label: 'X', url: 'https://x.com' }
	];

	function backToIdle() {
		mode = 'idle';
		releaseWakeLock();
		stopAlarm();
		alarmActive = false;
	}

	function startTasks() {
		if (!fullscreenTaskModeEnabled) {
			return;
		}

		mode = 'doing';
		requestWakeLock();
	}

	function tap() {
		if (!audioReady) {
			initAudio();
			audioReady = true;
		}

		if (alarmActive) {
			stopAlarm();
			alarmActive = false;
		}

		if (!current) return;

		haptic();
		playTick();
		iltavahti.markDone(current.id);

		if (remaining.length <= 1) {
			stopAlarm();
			startMotionDetection(() => {
				phonePickedUp = true;
				if (pickupTimeout) clearTimeout(pickupTimeout);
				pickupTimeout = setTimeout(() => { phonePickedUp = false; }, 4000);
			});
		}
	}

	function clock(d: Date) {
		return d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
	}

	function updateSetting<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
		settings.update((s) => {
			const next = { ...s, [key]: value };
			saveSettings(next);
			return next;
		});
	}
</script>

<svelte:head>
	<title>Iltavahti</title>
</svelte:head>

<!-- DOING: fullscreen tap mode -->
{#if mode === 'doing' && !allDone}
	<div class="full" style="background: {bg}" role="button" tabindex="0" onclick={tap} onkeydown={(e) => e.key === 'Enter' && tap()}>
		<p class="clock">
			{clock(now)}
			{#if $settings.onboardingDone}
				<span class="sleep-mini">{hoursIfNow.toFixed(1)}h</span>
			{/if}
		</p>

		{#if alarmActive}
			<p class="warn blink">Aika meni. Tee nyt.</p>
		{/if}

		<h1 class="task-name">{current?.label}</h1>

		<p class="hint">
			{#if !audioReady}
				Napauta aloittaaksesi
			{:else}
				Napauta kun tehty
			{/if}
		</p>

		<div class="dots">
			{#each state.tasks as task}
				<span class="dot" class:done={task.done} class:active={task.id === current?.id}></span>
			{/each}
		</div>
	</div>

<!-- DONE: goodnight + rewards -->
{:else if mode === 'done'}
	<div class="page">
		<div class="done-top">
			<p class="done-clock">{clock(now)}</p>
			{#if phonePickedUp}
				<p class="warn">Laita puhelin pois.</p>
			{:else}
				<p class="done-msg">Tehty. Hyvää yötä.</p>
			{/if}

			{#if streak > 0}
				<div class="streak-badge">{streak} {streak === 1 ? 'ilta' : 'iltaa'} putkeen</div>
			{/if}
		</div>

		<div class="rewards">
			<div class="reward-grid">
				{#each rewards as r}
					<a href={r.url} target="_blank" rel="noreferrer" class="reward">{r.label}</a>
				{/each}
			</div>
		</div>

		<button class="back-btn" onclick={backToIdle}>Takaisin</button>
	</div>

<!-- IDLE: streak + start -->
{:else}
	<div class="page">
		<div class="idle-top">
			<p class="idle-clock">{clock(now)}</p>
			<button class="settings-btn" onclick={() => showSettings = !showSettings}>
				{showSettings ? 'Sulje' : 'Asetukset'}
			</button>
		</div>

		{#if showSettings}
			<div class="settings-panel">
				<label class="setting-row">
					<span>Herätys</span>
					<input
						type="time"
						value={$settings.wakeUpTime}
						onchange={(e) => updateSetting('wakeUpTime', (e.currentTarget as HTMLInputElement).value)}
					/>
				</label>

				<div class="setting-row">
					<span>Unen tarve</span>
					<div class="stepper">
						<button class="step-btn" onclick={() => updateSetting('sleepHours', Math.max(5, $settings.sleepHours - 0.5))}>−</button>
						<span class="step-val">{$settings.sleepHours} h</span>
						<button class="step-btn" onclick={() => updateSetting('sleepHours', Math.min(10, $settings.sleepHours + 0.5))}>+</button>
					</div>
				</div>

				<div class="setting-row">
					<span>Nukkumaanmeno</span>
					<span class="computed-val">{formatTime(deadline)}</span>
				</div>

				<label class="setting-row">
					<span>Painostus</span>
					<select
						value={$settings.intensityPreference}
						onchange={(e) => updateSetting('intensityPreference', (e.currentTarget as HTMLSelectElement).value as UserSettings['intensityPreference'])}
					>
						<option value="light">Kevyt</option>
						<option value="medium">Keskikova</option>
						<option value="hard">Kova</option>
					</select>
				</label>
			</div>
		{/if}

		{#if $settings.onboardingDone}
			<div class="sleep-counter" data-level={level}>
				<span class="sleep-num">{hoursIfNow.toFixed(1)}</span>
				<span class="sleep-label">tuntia unta jos menet nyt</span>
				<span class="deadline-row">Nukkumaan klo {formatTime(deadline)}</span>
			</div>
		{/if}

		<div class="streak-block">
			{#if streak > 0}
				<div class="streak-num">{streak}</div>
				<p class="streak-label">{streak === 1 ? 'ilta putkeen' : 'iltaa putkeen'}</p>
			{:else}
				<p class="streak-label no-streak">Aloita tänään.</p>
			{/if}

			<div class="week">
				{#each week as day}
					<div class="day" class:done={day.done} class:today={day.isToday}>
						<span class="day-dot">{day.done ? '●' : '○'}</span>
						<span class="day-label">{day.label}</span>
					</div>
				{/each}
			</div>
		</div>

		{#if fullscreenTaskModeEnabled}
			<button class="start-btn" onclick={startTasks}>
				Tee iltatoimet
			</button>
		{:else}
			<div class="start-disabled">
				<p class="start-disabled-title">Tämä koko ruudun tehtävätila on nyt tauolla.</p>
				<p class="start-disabled-text">
					Otin sen väliaikaisesti pois käytöstä, jotta sivu ei lukitse näkymää tuohon pakottavaan tilaan.
				</p>
			</div>
		{/if}

		{#if $settings.onboardingDone}
			{#if isIos() && !isStandalonePwa()}
				<div class="install-block">
					<p class="install-title">Asenna Iltavahti kotiruutuun</p>
					<p class="install-hint">iPhonella push-muistutukset toimivat <b>vain</b> kun sovellus on avattu kotiruudulta. Tee näin:</p>
					<ol class="install-steps">
						<li><span class="step-num">1</span> Paina <span class="pill">Jaa <span class="share-ico">⎙</span></span> Safarin alapalkista</li>
						<li><span class="step-num">2</span> Valitse <span class="pill">Lisää Koti-valikkoon</span></li>
						<li><span class="step-num">3</span> Paina <span class="pill">Lisää</span> oikeassa yläkulmassa</li>
						<li><span class="step-num">4</span> Avaa Iltavahti kotiruudun ikonista</li>
					</ol>
				</div>
			{/if}

			<div class="reach-block">
				<p class="reach-title">Tavoittaminen</p>
				<p class="reach-hint">Iltavahti ei voi soittaa sinulle suljettuna. Lataa kalenterimuistutukset tai tilaa push — puhelin huutaa vaikka olet TikTokissa.</p>
				<button class="reach-btn" onclick={onCalendarDownload}>
					{calendarSaved ? '✓ Ladattu — avaa kalenterissa' : 'Lataa kalenterimuistutukset'}
				</button>

				{#if pushConfigured && isPushSupported()}
					{#if isIos() && !isStandalonePwa()}
						<p class="reach-warn">Asenna ensin kotiruutuun yllä olevien ohjeiden mukaan.</p>
					{:else}
						<button
							class="reach-btn secondary"
							onclick={togglePushSubscription}
							disabled={pushBusy}
						>
							{pushBusy
								? 'Hetki...'
								: pushSubscribed
									? '✓ Push päällä — peru'
									: 'Tilaa push-muistutukset'}
						</button>
						{#if pushError}
							<p class="reach-warn">{pushError}</p>
						{/if}
					{/if}
				{/if}

				{#if notifPermission === 'default' && !pushConfigured}
					<button class="reach-btn secondary" onclick={requestNotifPermission}>
						Salli notifikaatiot tässä selaimessa
					</button>
				{:else if notifPermission === 'denied'}
					<p class="reach-warn">Notifikaatiot estetty. Salli selaimen asetuksista.</p>
				{/if}
			</div>
		{/if}

		<div class="rewards locked-section">
			<p class="rewards-hint">Tee ensin iltatoimet.</p>
			<div class="reward-grid">
				{#each rewards as r}
					<div class="reward locked">{r.label}</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

{#if mode !== 'doing'}
	<div class="help-dock">
		<button
			class="help-fab"
			type="button"
			aria-expanded={showHelp}
			aria-controls="ios-help-panel"
			onclick={() => (showHelp = !showHelp)}
		>
			<span class="help-fab-icon">?</span>
			<span>{showHelp ? 'Sulje apu' : 'Apua iPhonessa'}</span>
		</button>

		{#if showHelp}
			<section class="help-panel" id="ios-help-panel">
				<div class="help-head">
					<div>
						<p class="help-kicker">Nopea ohje</p>
						<h2>Avaa tämä iPhonessa appina</h2>
					</div>
					<button class="help-close" type="button" aria-label="Sulje ohje" onclick={() => (showHelp = false)}>
						×
					</button>
				</div>

				<p class="help-text">
					Pushit toimivat iPhonessa vain, kun Iltavahti on lisätty kotiruutuun ja avattu sieltä.
				</p>

				<ol class="help-steps">
					<li>Avaa tämä sivu iPhonen <b>Safarissa</b>, ei Chromessa tai jonkin sovelluksen sisällä.</li>
					<li>Paina alareunan <b>Jaa</b>-nappia.</li>
					<li>Valitse <b>Lisää Koti-valikkoon</b>.</li>
					<li>Paina oikeasta yläkulmasta <b>Lisää</b>.</li>
					<li>Avaa Iltavahti kotiruudun uudesta ikonista.</li>
					<li>Paina tässä sovelluksessa <b>Tilaa push-muistutukset</b> ja hyväksy ilmoitukset.</li>
				</ol>

				<div class="help-status">
					<p><b>Safari:</b> {isIos() ? 'kyllä' : 'avaa tällä iPhonessa Safarissa'}</p>
					<p><b>Kotiruutu-appi:</b> {isStandalonePwa() ? 'auki kotiruudulta' : 'ei vielä'}</p>
					<p><b>Push:</b> {pushConfigured ? 'valmis kytkettäväksi' : 'backend ei ole tässä buildissä päällä'}</p>
				</div>

				<p class="help-note">
					Jos et näe kohtaa <b>Lisää Koti-valikkoon</b>, olet todennäköisesti väärässä selaimessa.
					Kopioi linkki Safariin ja yritä uudestaan.
				</p>
			</section>
		{/if}
	</div>
{/if}


<style>
	/* ── Page (idle & done views) ── */
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		max-width: 400px;
		margin: 0 auto;
		padding: 2rem 1.25rem;
		min-height: 100vh;
		min-height: 100dvh;
	}

	/* ── Idle top ── */
	.idle-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.idle-clock {
		font-size: 1.8rem;
		font-weight: 300;
		font-variant-numeric: tabular-nums;
		color: var(--text);
		letter-spacing: 0.05em;
	}

	/* ── Settings ── */
	.settings-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 0.8rem;
		cursor: pointer;
		padding: 0.25rem 0;
	}

	.settings-panel {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		padding: 1rem;
	}

	.setting-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.9rem;
	}

	.setting-row input[type='time'],
	.setting-row select {
		background: var(--field);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 0.4rem 0.6rem;
		font: inherit;
		font-size: 0.9rem;
	}

	.stepper {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.step-btn {
		width: 2rem;
		height: 2rem;
		border-radius: 0.4rem;
		border: 1px solid var(--border);
		background: var(--field);
		color: var(--text);
		font-size: 1.1rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.step-val {
		font-size: 0.9rem;
		font-variant-numeric: tabular-nums;
		min-width: 3rem;
		text-align: center;
	}

	.computed-val {
		font-size: 0.9rem;
		color: var(--accent);
		font-weight: 600;
	}

	/* ── Sleep counter ── */
	.sleep-counter {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 1.5rem 1rem;
		border-radius: 0.75rem;
		background: var(--bg-card);
		border: 1px solid var(--border);
		text-align: center;
		transition: border-color 0.5s, background 0.5s;
	}
	.sleep-counter[data-level='gentle'] {
		border-color: var(--intensity-gentle);
	}
	.sleep-counter[data-level='warning'] {
		border-color: var(--intensity-warning);
		background: rgba(255, 112, 67, 0.08);
	}
	.sleep-counter[data-level='urgent'] {
		border-color: var(--intensity-urgent);
		background: rgba(255, 82, 82, 0.12);
	}
	.sleep-counter[data-level='overdue'] {
		border-color: var(--intensity-overdue);
		background: rgba(224, 64, 251, 0.12);
	}
	.sleep-num {
		font-size: 3.5rem;
		font-weight: 200;
		font-variant-numeric: tabular-nums;
		line-height: 1;
		background: linear-gradient(45deg, #fff, #7eb2ff);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}
	.sleep-label {
		font-size: 0.85rem;
		color: var(--text-muted);
	}
	.deadline-row {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin-top: 0.4rem;
	}
	.sleep-mini {
		display: inline-block;
		margin-left: 0.6rem;
		font-size: 0.95rem;
		color: var(--text);
		opacity: 0.6;
		font-variant-numeric: tabular-nums;
	}

	/* ── Streak ── */
	.streak-block {
		text-align: center;
		padding: 2rem 0 1rem;
	}

	.streak-num {
		font-size: 5rem;
		font-weight: 800;
		line-height: 1;
		color: var(--accent);
	}

	.streak-label {
		font-size: 1rem;
		color: var(--text-muted);
		margin-top: 0.25rem;
	}

	.no-streak {
		font-size: 1.2rem;
		color: var(--text);
		padding: 2rem 0;
	}

	.week {
		display: flex;
		justify-content: center;
		gap: 0.75rem;
		margin-top: 1.5rem;
	}

	.day {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
	}

	.day-dot {
		font-size: 1.1rem;
		color: var(--border);
	}

	.day.done .day-dot { color: var(--accent); }
	.day.today .day-dot { color: var(--text); }
	.day.today.done .day-dot { color: var(--accent); }

	.day-label {
		font-size: 0.65rem;
		color: var(--text-muted);
		text-transform: uppercase;
	}

	.day.today .day-label {
		color: var(--text);
		font-weight: 600;
	}

	/* ── Start button ── */
	.start-btn {
		display: block;
		width: 100%;
		text-align: center;
		padding: 1.2rem;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: 0.75rem;
		font-size: 1.15rem;
		font-weight: 600;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.start-btn:active {
		opacity: 0.85;
	}

	.start-disabled {
		padding: 1rem 1.05rem;
		border-radius: 0.75rem;
		background: var(--bg-card);
		border: 1px dashed rgb(249 115 22 / 0.35);
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.start-disabled-title {
		font-size: 0.98rem;
		font-weight: 700;
		color: var(--text);
	}

	.start-disabled-text {
		font-size: 0.85rem;
		line-height: 1.45;
		color: var(--text-muted);
	}

	/* ── Install guide (iOS home screen) ── */
	.install-block {
		padding: 1.1rem 1rem;
		border-radius: 0.75rem;
		background: linear-gradient(135deg, rgba(249, 115, 22, 0.12), rgba(249, 115, 22, 0.04));
		border: 1px solid var(--accent);
	}
	.install-title {
		font-size: 1rem;
		font-weight: 700;
		color: var(--text);
		margin-bottom: 0.4rem;
	}
	.install-hint {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin-bottom: 0.85rem;
		line-height: 1.45;
	}
	.install-steps {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}
	.install-steps li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		line-height: 1.35;
	}
	.step-num {
		flex-shrink: 0;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--accent);
		color: #fff;
		font-size: 0.8rem;
		font-weight: 700;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.15rem 0.5rem;
		border-radius: 0.4rem;
		background: var(--bg);
		border: 1px solid var(--border);
		font-size: 0.85rem;
		color: var(--text);
	}
	.share-ico {
		font-size: 0.95rem;
		transform: translateY(-1px);
	}

	/* ── Reach (calendar / notifications) ── */
	.reach-block {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 1rem;
		border-radius: 0.75rem;
		background: var(--bg-card);
		border: 1px solid var(--border);
	}
	.reach-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.reach-hint {
		font-size: 0.85rem;
		color: var(--text-muted);
		line-height: 1.4;
	}
	.reach-btn {
		padding: 0.85rem 1rem;
		border-radius: 0.5rem;
		background: var(--accent);
		color: #fff;
		border: none;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
	}
	.reach-btn.secondary {
		background: transparent;
		color: var(--text);
		border: 1px solid var(--border);
	}
	.reach-btn:active {
		opacity: 0.85;
	}
	.reach-warn {
		font-size: 0.8rem;
		color: var(--danger);
	}

	/* ── Rewards ── */
	.rewards-hint {
		font-size: 0.8rem;
		color: var(--text-muted);
		text-align: center;
		margin-bottom: 0.75rem;
	}

	.reward-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
	}

	.reward {
		text-align: center;
		padding: 0.85rem 0.5rem;
		border-radius: 0.6rem;
		font-size: 0.85rem;
		font-weight: 500;
		text-decoration: none;
		background: var(--bg-card);
		border: 1px solid var(--border);
		color: var(--text);
	}

	.reward:active {
		border-color: var(--accent);
	}

	.reward.locked {
		color: var(--text-muted);
		opacity: 0.3;
	}

	/* ── Done view ── */
	.done-top {
		text-align: center;
		padding: 4rem 0 2rem;
	}

	.done-clock {
		font-size: 4rem;
		font-weight: 700;
		line-height: 1;
		color: var(--text);
		opacity: 0.3;
	}

	.done-msg {
		font-size: 1rem;
		color: var(--text-muted);
		margin-top: 1rem;
	}

	.streak-badge {
		display: inline-block;
		margin-top: 1.5rem;
		padding: 0.4rem 1rem;
		background: var(--accent-dim);
		color: var(--accent);
		border-radius: 2rem;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.back-btn {
		background: none;
		border: 1px solid var(--border);
		color: var(--text-muted);
		font-size: 0.85rem;
		padding: 0.6rem 1.2rem;
		border-radius: 0.5rem;
		cursor: pointer;
		align-self: center;
		margin-top: auto;
	}

	/* ── Fullscreen task mode ── */
	.full {
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 2rem;
		gap: 1rem;
		transition: background 2s;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		touch-action: manipulation;
		user-select: none;
		-webkit-user-select: none;
		z-index: 200;
	}

	.clock {
		font-size: 1.2rem;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		position: absolute;
		top: 3rem;
	}

	.task-name {
		font-size: clamp(2rem, 8vw, 3.5rem);
		font-weight: 700;
		line-height: 1.15;
		max-width: 14ch;
	}

	.hint {
		font-size: 0.9rem;
		color: var(--text-muted);
		margin-top: 1rem;
	}

	.dots {
		display: flex;
		gap: 0.5rem;
		position: absolute;
		bottom: 3rem;
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--border);
	}

	.dot.done { background: var(--accent); }
	.dot.active { background: var(--text); }

	.warn {
		color: #f87171;
		font-size: 1.2rem;
		font-weight: 600;
	}

	.blink {
		animation: blink 1s infinite;
	}

	@keyframes blink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.3; }
	}

	.help-dock {
		position: fixed;
		left: 1rem;
		bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
		z-index: 120;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.75rem;
		max-width: min(22rem, calc(100vw - 2rem));
		pointer-events: none;
	}

	.help-fab {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.7rem 0.95rem;
		border-radius: 999px;
		border: 1px solid rgb(249 115 22 / 0.35);
		background: rgb(20 24 31 / 0.92);
		color: var(--text);
		backdrop-filter: blur(10px);
		box-shadow: 0 10px 30px rgb(0 0 0 / 0.25);
		cursor: pointer;
		font-size: 0.88rem;
		font-weight: 600;
		pointer-events: auto;
	}

	.help-fab-icon {
		width: 1.4rem;
		height: 1.4rem;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--accent);
		color: white;
		font-size: 0.9rem;
		font-weight: 700;
	}

	.help-panel {
		width: min(22rem, calc(100vw - 2rem));
		padding: 1rem;
		border-radius: 1rem;
		background: rgb(19 24 34 / 0.96);
		border: 1px solid rgb(249 115 22 / 0.2);
		box-shadow: 0 20px 60px rgb(0 0 0 / 0.34);
		backdrop-filter: blur(14px);
		pointer-events: auto;
	}

	.help-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 0.65rem;
	}

	.help-kicker {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--accent);
		margin-bottom: 0.15rem;
	}

	.help-head h2 {
		font-size: 1.1rem;
		line-height: 1.15;
	}

	.help-close {
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		border: 1px solid var(--border);
		background: var(--field);
		color: var(--text);
		font-size: 1.3rem;
		cursor: pointer;
	}

	.help-text,
	.help-note,
	.help-status p {
		font-size: 0.84rem;
		line-height: 1.45;
		color: var(--text-muted);
	}

	.help-steps {
		margin: 0.85rem 0;
		padding-left: 1.1rem;
		display: grid;
		gap: 0.45rem;
		font-size: 0.88rem;
		line-height: 1.4;
	}

	.help-status {
		display: grid;
		gap: 0.35rem;
		padding: 0.8rem;
		border-radius: 0.75rem;
		background: rgb(255 255 255 / 0.03);
		border: 1px solid var(--border);
		margin-bottom: 0.75rem;
	}

	.help-status b,
	.help-note b,
	.help-steps b {
		color: var(--text);
	}

	@media (max-width: 640px) {
		.help-dock {
			left: 0.75rem;
			right: 0.75rem;
			bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
			max-width: none;
		}

		.help-panel {
			width: min(100%, 28rem);
		}

		.help-fab {
			max-width: 100%;
		}
	}
</style>
