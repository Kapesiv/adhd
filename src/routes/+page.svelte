<svelte:options runes={false} />

<script lang="ts">
	import {
		iltavahti, getStreak, isTodayDone,
		initAudio, playTick,
		haptic
	} from '$lib/iltavahti';
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { settings, type UserSettings } from '$lib/core/state';
	import {
		calculateDeadline,
		hoursUntilDeadline,
		sleepIfNow,
		getIntensityLevel,
		formatTime
	} from '$lib/modules/iltavahti/time-engine';
	import { downloadIcs, downloadSingleEventIcs } from '$lib/modules/iltavahti/ical';
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

	type SetupStep = 1 | 2 | 3;
	type PlannedCalendarEntry = {
		id: string;
		title: string;
		date: string;
		time: string | null;
		durationMinutes: number;
		raw: string;
		createdAt: number;
	};

	const PUSH_BACKEND_URL = import.meta.env.VITE_PUSH_BACKEND_URL as string | undefined;
	const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
	const pushConfigured = !!(PUSH_BACKEND_URL && VAPID_PUBLIC_KEY);
	const IPHONE_SETUP_KEY = 'concentra-iphone-setup-v1';
	const CALENDAR_ENTRIES_KEY = 'concentra-calendar-entries-v1';
	const distractionOptions = ['TikTok', 'Instagram', 'Reddit', 'YouTube', 'Safari', 'X'];
	// --- State ---
	let now = new Date();
	let minuteTickTimeout: ReturnType<typeof setTimeout> | null = null;
	let minuteTickInterval: ReturnType<typeof setInterval> | null = null;
	let audioReady = false;
	let showSettings = false;
	let showHelp = false;

	let mode: 'idle' | 'done' = 'idle';
	let showAll = false;
	let setupStep: SetupStep = 1;
	let distractionApps = ['TikTok', 'Instagram', 'Reddit'];
	let iphoneSetupDone = false;
	let editingIphoneSetup = false;
	let setupHydrated = false;
	let calendarHydrated = false;
	let quickCalendarInput = '';
	let quickCalendarError = '';
	let quickCalendarSuccess = '';
	let calendarEntries: PlannedCalendarEntry[] = [];

	let level: IntensityLevel = 'calm';

	function updateNow() {
		now = new Date();
	}

	function startMinuteClock() {
		updateNow();
		const msUntilNextMinute = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
		minuteTickTimeout = setTimeout(() => {
			updateNow();
			minuteTickInterval = setInterval(updateNow, 60000);
		}, msUntilNextMinute + 20);
	}

	onMount(() => {
		startMinuteClock();
		const s = $iltavahti;
		if (isTodayDone(s.completedDays ?? [])) {
			mode = 'done';
		}
	});

	onDestroy(() => {
		if (minuteTickTimeout) clearTimeout(minuteTickTimeout);
		if (minuteTickInterval) clearInterval(minuteTickInterval);
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
		try {
			const raw = localStorage.getItem(IPHONE_SETUP_KEY);
			if (raw) {
				const saved = JSON.parse(raw) as {
					distractionApps?: unknown;
					setupStep?: unknown;
					iphoneSetupDone?: unknown;
				};
				if (Array.isArray(saved.distractionApps)) {
					distractionApps = saved.distractionApps.filter((value): value is string => typeof value === 'string');
				}
				if (saved.setupStep === 1 || saved.setupStep === 2 || saved.setupStep === 3) {
					setupStep = saved.setupStep;
				}
				if (typeof saved.iphoneSetupDone === 'boolean') {
					iphoneSetupDone = saved.iphoneSetupDone;
				}
			}
		} catch {
			// ignore broken local state
		}

		try {
			const rawEntries = localStorage.getItem(CALENDAR_ENTRIES_KEY);
			if (rawEntries) {
				const savedEntries = JSON.parse(rawEntries) as PlannedCalendarEntry[];
				if (Array.isArray(savedEntries)) {
					calendarEntries = savedEntries.filter((entry) =>
						entry &&
						typeof entry === 'object' &&
						typeof entry.id === 'string' &&
						typeof entry.title === 'string' &&
						typeof entry.date === 'string' &&
						(typeof entry.time === 'string' || entry.time === null) &&
						typeof entry.durationMinutes === 'number' &&
						typeof entry.raw === 'string' &&
						typeof entry.createdAt === 'number'
					);
				}
			}
		} catch {
			// ignore broken local state
		}

		const state = await getSubscriptionState();
		pushSubscribed = state.subscribed;
		setupHydrated = true;
		calendarHydrated = true;
	});

	$: if (browser && setupHydrated) {
		localStorage.setItem(
			IPHONE_SETUP_KEY,
			JSON.stringify({
				distractionApps,
				setupStep,
				iphoneSetupDone
			})
		);
	}

	$: if (browser && calendarHydrated) {
		localStorage.setItem(CALENDAR_ENTRIES_KEY, JSON.stringify(calendarEntries));
	}

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
	$: totalDays = (state.completedDays ?? []).length;
	$: todayDone = isTodayDone(state.completedDays ?? []);

	// Vaihtelevat viestit — ei koskaan samaa kahta kertaa peräkkäin
	const idleMessages = [
		'Hei. Ilta alkaa olla tässä.',
		'Oisko iltatoimien aika?',
		'Pieni rutiini, iso vaikutus.',
		'Viisi juttua ja vapaa olet.',
		'Huominen kiittää.',
	];
	const doneMessages = [
		'Hienosti meni. Hyvää yötä.',
		'Tehty! Huominen kiittää.',
		'Ja taas yksi ilta hoidettu.',
		'Hyvin toimittu. Lepää hyvin.',
		'Nyt on lupa nukkua.',
	];
	function pickMessage(messages: string[], seed: number): string {
		return messages[seed % messages.length];
	}

	function completeTask(taskId: string) {
		haptic();
		playTick();
		if (!audioReady) {
			initAudio();
			audioReady = true;
		}
		iltavahti.markDone(taskId);
	}

	$: dateSeed = new Date().getDate();
	$: criticalOnly = hoursRemaining < 1;
	$: visibleTasks = showAll
		? state.tasks
		: criticalOnly
			? state.tasks.filter((t) => t.priority === 'critical')
			: state.tasks;
	$: nextTask = visibleTasks.find((task) => !task.done) ?? null;
	$: hiddenCount = criticalOnly ? state.tasks.length - visibleTasks.length : 0;
	$: remaining = visibleTasks.filter((t) => !t.done);
	$: allDone = visibleTasks.length > 0 && remaining.length === 0;
	$: sortedCalendarEntries = [...calendarEntries].sort((a, b) => {
		const left = `${a.date}T${a.time ?? '23:59'}`;
		const right = `${b.date}T${b.time ?? '23:59'}`;
		return left.localeCompare(right);
	});

	// Switch to done mode when all visible tasks completed
	$: if (allDone && mode === 'idle' && !todayDone) {
		iltavahti.completeToday();
		mode = 'done';
	}

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

	// --- Spotify soundscapes ---
	const SPOTIFY_KEY = 'concentra-spotify-v1';
	const defaultPlaylists = [
		{ label: 'ADHD Unimusiikki', id: '3AQjqe3GLROVtW8xssG0oK' },
		{ label: 'Valkoinen kohina', id: '7D4g8rEVa6DjVfpMm5ztZK' },
		{ label: 'Syvä uni', id: '2fO8tqzaPUEUtaICpqi3Th' },
		{ label: 'Rauhoittava 432 Hz', id: '2CNX0SyrIjpxjJw5HIae4Z' },
	];
	let activePlaylist: string | null = null;
	let customSpotifyUrl = '';
	let savedCustomUrl = '';
	let showCustomInput = false;

	onMount(() => {
		try {
			const raw = localStorage.getItem(SPOTIFY_KEY);
			if (raw) {
				const saved = JSON.parse(raw);
				if (typeof saved.customUrl === 'string') {
					savedCustomUrl = saved.customUrl;
					customSpotifyUrl = saved.customUrl;
				}
			}
		} catch { /* ignore */ }
	});

	function getSpotifyEmbedUrl(playlistId: string): string {
		return `https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`;
	}

	function getCustomEmbedUrl(url: string): string | null {
		// Extract playlist/track/album ID from Spotify URL
		const match = url.match(/open\.spotify\.com\/(playlist|track|album)\/([a-zA-Z0-9]+)/);
		if (match) {
			return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`;
		}
		return null;
	}

	function selectPlaylist(id: string) {
		activePlaylist = activePlaylist === id ? null : id;
	}

	function saveCustomPlaylist() {
		const embedUrl = getCustomEmbedUrl(customSpotifyUrl);
		if (embedUrl) {
			savedCustomUrl = customSpotifyUrl;
			activePlaylist = 'custom';
			showCustomInput = false;
			try {
				localStorage.setItem(SPOTIFY_KEY, JSON.stringify({ customUrl: savedCustomUrl }));
			} catch { /* quota */ }
		}
	}

	function backToIdle() {
		mode = 'idle';
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

	function openOnboarding() {
		goto(`${base}/tervetuloa`);
	}

	function toggleDistractionApp(label: string) {
		if (distractionApps.includes(label)) {
			distractionApps = distractionApps.filter((item) => item !== label);
			return;
		}
		distractionApps = [...distractionApps, label];
	}

	function finishIphoneSetup() {
		iphoneSetupDone = true;
		editingIphoneSetup = false;
	}

	function editIphoneSetup() {
		editingIphoneSetup = true;
		iphoneSetupDone = false;
		setupStep = 1;
	}

	function pad2(value: number): string {
		return value.toString().padStart(2, '0');
	}

	function parseQuickCalendarEntry(raw: string): Omit<PlannedCalendarEntry, 'id' | 'createdAt'> {
		const trimmed = raw.trim().replace(/\s+/g, ' ');
		const match = trimmed.match(/^(\d{1,2})[.,/](\d{1,2})(?:[.,/](\d{2,4}))?\s+(.+)$/);
		if (!match) {
			throw new Error('Kirjoita muodossa esim. 27.5 terapia 14:00');
		}

		const day = Number(match[1]);
		const month = Number(match[2]);
		const yearPart = match[3];
		let titlePart = match[4].trim();
		const timeMatch = titlePart.match(/\b(\d{1,2})[:.](\d{2})\b/);
		let time: string | null = null;

		if (timeMatch) {
			const hours = Number(timeMatch[1]);
			const minutes = Number(timeMatch[2]);
			if (hours > 23 || minutes > 59) {
				throw new Error('Kellonaika ei näytä oikealta');
			}
			time = `${pad2(hours)}:${pad2(minutes)}`;
			titlePart = titlePart.replace(timeMatch[0], '').replace(/\s+/g, ' ').trim();
		}

		if (!titlePart) {
			throw new Error('Kirjoita päivämäärän jälkeen myös asian nimi');
		}

		let year = new Date().getFullYear();
		if (yearPart) {
			year = yearPart.length === 2 ? Number(`20${yearPart}`) : Number(yearPart);
		}

		const candidate = new Date(year, month - 1, day);
		if (
			candidate.getFullYear() !== year ||
			candidate.getMonth() !== month - 1 ||
			candidate.getDate() !== day
		) {
			throw new Error('Päivämäärä ei näytä oikealta');
		}

		if (!yearPart) {
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			if (candidate < today) {
				candidate.setFullYear(candidate.getFullYear() + 1);
			}
		}

		return {
			title: titlePart,
			date: `${candidate.getFullYear()}-${pad2(candidate.getMonth() + 1)}-${pad2(candidate.getDate())}`,
			time,
			durationMinutes: 60,
			raw: trimmed
		};
	}

	function formatCalendarEntry(entry: PlannedCalendarEntry): string {
		const [year, month, day] = entry.date.split('-').map(Number);
		const date = new Date(year, month - 1, day);
		const dateLabel = date.toLocaleDateString('fi-FI', { day: 'numeric', month: 'numeric' });
		return entry.time ? `${dateLabel} klo ${entry.time}` : dateLabel;
	}

	function createCalendarEntry() {
		if (!browser) return;
		quickCalendarError = '';
		quickCalendarSuccess = '';
		try {
			const parsed = parseQuickCalendarEntry(quickCalendarInput);
			const entry: PlannedCalendarEntry = {
				id: browser && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
				createdAt: Date.now(),
				...parsed
			};
			calendarEntries = [entry, ...calendarEntries];
			const appUrl = window.location.origin + base + '/';
			downloadSingleEventIcs(entry, appUrl);
			quickCalendarInput = '';
			quickCalendarSuccess = 'Kalenterimerkintä luotu. Hyväksy se kalenterissa.';
		} catch (error) {
			quickCalendarError = error instanceof Error ? error.message : 'Merkintää ei voitu lukea';
		}
	}

	function redownloadCalendarEntry(entry: PlannedCalendarEntry) {
		if (!browser) return;
		const appUrl = window.location.origin + base + '/';
		downloadSingleEventIcs(entry, appUrl);
		quickCalendarSuccess = 'Kalenterimerkintä avattu uudelleen.';
		quickCalendarError = '';
	}

	function removeCalendarEntry(id: string) {
		calendarEntries = calendarEntries.filter((entry) => entry.id !== id);
	}
</script>

<svelte:head>
	<title>Concentra</title>
</svelte:head>

<!-- DONE: goodnight + rewards -->
{#if mode === 'done'}
	<div class="page">
		<div class="done-top">
			<p class="done-clock">{clock(now)}</p>
			<p class="done-msg">{pickMessage(doneMessages, dateSeed)}</p>

			{#if totalDays > 0}
				<div class="total-badge">{totalDays} {totalDays === 1 ? 'ilta' : 'iltaa'} hoidettu</div>
			{/if}
		</div>

		<div class="soundscape-block">
			<p class="soundscape-kicker">Rauhoitu</p>
			<h2 class="soundscape-title">Valitse iltaääni</h2>
			<p class="soundscape-desc">Musiikki tai kohina auttaa ADHD-aivoja rauhoittumaan. Paina ja kuuntele.</p>

			<div class="soundscape-grid">
				{#each defaultPlaylists as pl}
					<button
						class="soundscape-btn"
						class:active={activePlaylist === pl.id}
						onclick={() => selectPlaylist(pl.id)}
					>
						{pl.label}
					</button>
				{/each}
				<button
					class="soundscape-btn"
					class:active={activePlaylist === 'custom'}
					onclick={() => {
						if (savedCustomUrl) {
							selectPlaylist('custom');
						} else {
							showCustomInput = !showCustomInput;
						}
					}}
				>
					{savedCustomUrl ? 'Oma lista' : '+ Oma linkki'}
				</button>
			</div>

			{#if showCustomInput || (activePlaylist === 'custom' && !savedCustomUrl)}
				<div class="custom-input-row">
					<input
						type="url"
						class="custom-input"
						placeholder="open.spotify.com/playlist/..."
						bind:value={customSpotifyUrl}
						onkeydown={(e) => { if (e.key === 'Enter') saveCustomPlaylist(); }}
					/>
					<button class="custom-save-btn" onclick={saveCustomPlaylist}>Tallenna</button>
				</div>
			{/if}

			{#if activePlaylist && activePlaylist !== 'custom'}
				<div class="spotify-embed">
					<iframe
						title="Spotify"
						src={getSpotifyEmbedUrl(activePlaylist)}
						width="100%"
						height="152"
						frameborder="0"
						allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
						loading="lazy"
						style="border-radius: 12px;"
					></iframe>
				</div>
			{:else if activePlaylist === 'custom' && savedCustomUrl}
				{@const embedUrl = getCustomEmbedUrl(savedCustomUrl)}
				{#if embedUrl}
					<div class="spotify-embed">
						<iframe
							title="Spotify"
							src={embedUrl}
							width="100%"
							height="152"
							frameborder="0"
							allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
							loading="lazy"
							style="border-radius: 12px;"
						></iframe>
					</div>
				{/if}
			{/if}

			{#if savedCustomUrl && activePlaylist !== 'custom'}
				<button class="soundscape-edit" onclick={() => { showCustomInput = true; activePlaylist = 'custom'; }}>
					Muokkaa omaa linkkiä
				</button>
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

				<button class="onboarding-link" type="button" onclick={openOnboarding}>
					Avaa aloitusohjeet uudelleen
				</button>
			</div>
		{/if}

		{#if $settings.onboardingDone}
			<div class="sleep-counter" data-level={level}>
				<span class="sleep-num">{hoursIfNow.toFixed(1)}</span>
				<span class="sleep-label">tuntia unta jos menet nyt</span>
				<span class="deadline-row">Nukkumaan klo {formatTime(deadline)}</span>
			</div>
		{/if}

		<div class="progress-block">
			{#if totalDays > 0}
				<div class="total-num">{totalDays}</div>
				<p class="total-label">{totalDays === 1 ? 'ilta hoidettu' : 'iltaa hoidettu'}</p>
			{:else}
				<p class="total-label first-time">{pickMessage(idleMessages, dateSeed)}</p>
			{/if}

			<div class="week">
				{#each week as day}
					<div class="day" class:done={day.done} class:today={day.isToday}>
						<span class="day-dot"></span>
						<span class="day-label">{day.label}</span>
					</div>
				{/each}
			</div>
		</div>

		<div class="mode-block">
			<div class="mode-copy">
				<p class="mode-kicker">Illan paketti</p>
				<h2>Tee yksi asia kerrallaan</h2>
				<p class="mode-text">
					{#if criticalOnly}
						Myöhä on jo, joten keskity vain tärkeimpiin. Täydellinen ilta ei ole vaatimus.
					{:else}
						Kaikki apu on tässä samassa näkymässä. Sinun ei tarvitse valita mitään tilaa ennen aloittamista.
					{/if}
				</p>
				{#if nextTask}
					<p class="mode-text"><b>Aloita tästä:</b> {nextTask.label}</p>
				{/if}
			</div>
		</div>

		<div class="checklist">
			{#if criticalOnly && !showAll}
				<p class="checklist-hint">Myöhä jo — nämä riittää tänään.</p>
			{:else}
				<p class="checklist-hint">Paina tehtävä valmiiksi heti kun se on tehty.</p>
			{/if}

			{#each visibleTasks as task}
				<button
					class="check-item"
					class:checked={task.done}
					onclick={() => { if (!task.done) { completeTask(task.id); } }}
					disabled={task.done}
				>
					<span class="check-dot"></span>
					<span class="check-label">{task.label}</span>
				</button>
			{/each}

			{#if hiddenCount > 0}
				<button class="show-more-btn" onclick={() => showAll = !showAll}>
					{showAll ? 'Näytä vain tärkeät' : `Näytä myös loput (${hiddenCount})`}
				</button>
			{/if}
		</div>

		{#if $settings.onboardingDone}
			<div class="iphone-setup-block" class:setup-summary={iphoneSetupDone && !editingIphoneSetup}>
				{#if iphoneSetupDone && !editingIphoneSetup}
					<div class="setup-head">
						<div>
							<p class="setup-kicker">IPhone-ilta-setup</p>
							<h2>Setup valmiina</h2>
						</div>
					</div>

					<p class="setup-text">Iltasuunta on nyt rakennettu. Voit palata tähän myöhemmin, jos haluat vaihtaa appeja tai käydä ohjeen uudelleen.</p>

					<div class="setup-selected">
						{#each distractionApps as app}
							<span>{app}</span>
						{/each}
					</div>

					<div class="setup-status">
						<div class="setup-status-row">
							<span>Muistutukset</span>
							<strong>{pushSubscribed || notifPermission === 'granted' ? 'Päällä tai sallittu' : 'Tarkista vielä'}</strong>
						</div>
						<div class="setup-status-row">
							<span>Lukittavat appit</span>
							<strong>{distractionApps.length} valittu</strong>
						</div>
					</div>

					<div class="setup-nav">
						<button class="reach-btn secondary" onclick={editIphoneSetup}>
							Muokkaa setupia
						</button>
					</div>
				{:else}
					<div class="setup-head">
						<div>
							<p class="setup-kicker">IPhone-ilta-setup</p>
							<h2>
								{#if setupStep === 1}
									Valitse häiriöappit
								{:else if setupStep === 2}
									Laita muistutukset päälle
								{:else}
									Laita iltasuoja iPhoneen
								{/if}
							</h2>
						</div>
						<div class="setup-dots" aria-label="Setupin eteneminen">
							<span class:active={setupStep === 1}></span>
							<span class:active={setupStep === 2}></span>
							<span class:active={setupStep === 3}></span>
						</div>
					</div>

					{#if setupStep === 1}
						<p class="setup-text">Valitse vain ne appit, jotka vievät sinut pois iltarutiinista. Ei tarvitse valita kaikkea.</p>
						<div class="setup-app-grid">
							{#each distractionOptions as app}
								<button class:selected={distractionApps.includes(app)} onclick={() => toggleDistractionApp(app)}>
									{app}
								</button>
							{/each}
						</div>
						<p class="setup-note">Näitä käytetään seuraavassa vaiheessa, kun laitat iPhonelle iltarajat.</p>
					{:else if setupStep === 2}
						{#if isIos() && !isStandalonePwa()}
							<p class="setup-text">Jotta muistutukset toimivat iPhonessa kunnolla, avaa Concentra kotinäytöltä appina.</p>
							<div class="setup-steps">
								<div class="setup-step"><span class="step-num">1</span><span>Paina Safarissa <span class="pill">Jaa ⎙</span></span></div>
								<div class="setup-step"><span class="step-num">2</span><span>Valitse <span class="pill">Lisää Koti-valikkoon</span></span></div>
								<div class="setup-step"><span class="step-num">3</span><span>Avaa Concentra kotinäytön ikonista</span></div>
							</div>
						{:else}
							<p class="setup-text">Laita muistutukset päälle, jotta Concentra voi pysäyttää sinut oikealla hetkellä.</p>
							<button
								class="reach-btn"
								onclick={pushConfigured && isPushSupported() ? togglePushSubscription : requestNotifPermission}
								disabled={pushBusy}
							>
								{#if pushConfigured && isPushSupported()}
									{pushBusy
										? 'Hetki...'
										: pushSubscribed
											? '✓ Muistutukset päällä'
											: 'Laita muistutukset päälle'}
								{:else}
									Salli ilmoitukset tässä selaimessa
								{/if}
							</button>
							{#if pushError}
								<p class="reach-warn">{pushError}</p>
							{:else if notifPermission === 'denied'}
								<p class="reach-warn">Ilmoitukset on estetty. Salli ne iPhonen asetuksista.</p>
							{/if}
						{/if}
					{:else}
						<p class="setup-text">Tee tämä kerran iPhonessa, niin ilta ei karkaa yhtä helposti käsistä.</p>
						<div class="setup-steps">
							<div class="setup-step">
								<span class="step-num">1</span>
								<span>Avaa <span class="pill">Asetukset</span> → <span class="pill">Ruutuaika</span> → <span class="pill">Appirajat</span></span>
							</div>
							<div class="setup-step">
								<span class="step-num">2</span>
								<span>Lisää nämä appit rajalle:</span>
							</div>
						</div>
						<div class="setup-selected">
							{#each distractionApps as app}
								<span>{app}</span>
							{/each}
						</div>
						<p class="setup-note">Jos haluat kovemman stopin, pidä appia pohjassa ja valitse <b>Vaadi Face ID</b>.</p>
						<button class="reach-btn secondary" onclick={onCalendarDownload}>
							{calendarSaved ? '✓ Kalenteri ladattu' : 'Lataa varmuudeksi kalenterimuistutukset'}
						</button>
					{/if}

					<div class="setup-nav">
						{#if setupStep > 1}
							<button class="reach-btn secondary" onclick={() => (setupStep = (setupStep - 1) as SetupStep)}>
								Takaisin
							</button>
						{/if}
						{#if setupStep < 3}
							<button class="reach-btn" onclick={() => (setupStep = (setupStep + 1) as SetupStep)}>
								Jatka
							</button>
						{:else}
							<button class="reach-btn" onclick={finishIphoneSetup}>
								Valmis
							</button>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		<div class="calendar-capture-block">
			<div class="calendar-head">
				<div>
					<p class="calendar-kicker">Kalenteri</p>
					<h2>Kirjoita merkintä nopeasti</h2>
				</div>
				<p class="calendar-helper">Esim. `27.5 terapia 14:00` tai `28.5 laskun eräpäivä`</p>
			</div>

			<div class="calendar-compose">
				<input
					class="calendar-input"
					type="text"
					bind:value={quickCalendarInput}
					placeholder="27.5 terapia 14:00"
					onkeydown={(event) => {
						if (event.key === 'Enter') {
							event.preventDefault();
							createCalendarEntry();
						}
					}}
				/>
				<button class="reach-btn" type="button" onclick={createCalendarEntry}>
					Lisää kalenteriin
				</button>
			</div>

			<p class="calendar-note">
				Concentra tekee kalenterimerkinnän valmiiksi. Hyväksyt sen kerran, ja se menee puhelimen kalenteriin.
			</p>

			{#if quickCalendarError}
				<p class="reach-warn">{quickCalendarError}</p>
			{:else if quickCalendarSuccess}
				<p class="calendar-success">{quickCalendarSuccess}</p>
			{/if}

			{#if sortedCalendarEntries.length > 0}
				<div class="calendar-list">
					{#each sortedCalendarEntries as entry}
						<div class="calendar-item">
							<div class="calendar-item-copy">
								<strong>{entry.title}</strong>
								<span>{formatCalendarEntry(entry)}</span>
							</div>
							<div class="calendar-item-actions">
								<button class="reach-btn secondary" type="button" onclick={() => redownloadCalendarEntry(entry)}>
									Avaa uudelleen
								</button>
								<button class="reach-btn secondary calendar-delete" type="button" onclick={() => removeCalendarEntry(entry.id)}>
									Poista
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

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
					Pushit toimivat iPhonessa vain, kun Concentra on lisätty kotiruutuun ja avattu sieltä.
				</p>

				<ol class="help-steps">
					<li>Avaa tämä sivu iPhonen <b>Safarissa</b>, ei Chromessa tai jonkin sovelluksen sisällä.</li>
					<li>Paina alareunan <b>Jaa</b>-nappia.</li>
					<li>Valitse <b>Lisää Koti-valikkoon</b>.</li>
					<li>Paina oikeasta yläkulmasta <b>Lisää</b>.</li>
					<li>Avaa Concentra kotiruudun uudesta ikonista.</li>
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


<style>
	/* ── Page ── */
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
		max-width: 420px;
		margin: 0 auto;
		padding: 2.5rem 1.5rem;
		min-height: 100vh;
		min-height: 100dvh;
		animation: fadeIn 0.4s ease;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(6px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* ── Idle top ── */
	.idle-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.idle-clock {
		font-size: 2rem;
		font-weight: 200;
		font-variant-numeric: tabular-nums;
		color: var(--text);
		letter-spacing: 0.08em;
	}

	/* ── Settings ── */
	.settings-btn {
		background: var(--field);
		border: 1px solid var(--border);
		color: var(--text-dim);
		font-size: 0.78rem;
		font-weight: 500;
		cursor: pointer;
		padding: 0.4rem 0.85rem;
		border-radius: 2rem;
		letter-spacing: 0.02em;
		transition: border-color 0.2s;
	}
	.settings-btn:active {
		border-color: var(--accent);
	}

	.settings-panel {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-xl);
		padding: 1.25rem;
		animation: slideDown 0.25s ease;
		contain: layout paint;
	}

	.onboarding-link {
		width: 100%;
		padding: 0.8rem 0.95rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		background: var(--field);
		color: var(--text-dim);
		font: inherit;
		font-size: 0.88rem;
		text-align: center;
		cursor: pointer;
		transition: border-color 0.2s, color 0.2s, background 0.2s;
	}
	.onboarding-link:active {
		border-color: var(--accent);
		color: var(--text);
		background: var(--accent-dim);
	}

	@keyframes slideDown {
		from { opacity: 0; transform: translateY(-8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.setting-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.9rem;
		color: var(--text-dim);
	}

	.setting-row input[type='time'],
	.setting-row select {
		background: var(--field);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 0.45rem 0.65rem;
		font: inherit;
		font-size: 0.9rem;
		transition: border-color 0.2s;
	}
	.setting-row input[type='time']:focus,
	.setting-row select:focus {
		outline: none;
		border-color: var(--border-focus);
	}

	.stepper {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.step-btn {
		width: 2.2rem;
		height: 2.2rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		background: var(--field);
		color: var(--text);
		font-size: 1.15rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: border-color 0.15s, background 0.15s;
	}
	.step-btn:active {
		border-color: var(--accent);
		background: var(--accent-dim);
	}

	.step-val {
		font-size: 0.9rem;
		font-variant-numeric: tabular-nums;
		min-width: 3.2rem;
		text-align: center;
		color: var(--text);
		font-weight: 500;
	}

	.computed-val {
		font-size: 0.95rem;
		color: var(--accent);
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	/* ── Sleep counter ── */
	.sleep-counter {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		padding: 2rem 1.25rem;
		border-radius: var(--radius-xl);
		background: var(--bg-card);
		border: 1px solid var(--border);
		text-align: center;
		transition: border-color 0.8s ease, background 0.8s ease, box-shadow 0.8s ease;
		contain: layout paint;
	}
	.sleep-counter[data-level='gentle'] {
		border-color: rgba(255, 171, 64, 0.3);
		box-shadow: 0 0 30px rgba(255, 171, 64, 0.05);
	}
	.sleep-counter[data-level='warning'] {
		border-color: rgba(255, 112, 67, 0.4);
		background: rgba(255, 112, 67, 0.06);
		box-shadow: 0 0 40px rgba(255, 112, 67, 0.08);
	}
	.sleep-counter[data-level='urgent'] {
		border-color: rgba(255, 82, 82, 0.4);
		background: rgba(255, 82, 82, 0.08);
		box-shadow: 0 0 40px rgba(255, 82, 82, 0.1);
	}
	.sleep-counter[data-level='overdue'] {
		border-color: rgba(224, 64, 251, 0.4);
		background: rgba(224, 64, 251, 0.08);
		box-shadow: 0 0 40px rgba(224, 64, 251, 0.1);
	}
	.sleep-num {
		font-size: 4rem;
		font-weight: 100;
		font-variant-numeric: tabular-nums;
		line-height: 1;
		background: linear-gradient(135deg, #ffffff 20%, #7eb2ff 80%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		filter: drop-shadow(0 0 20px rgba(126, 178, 255, 0.15));
	}
	.sleep-label {
		font-size: 0.82rem;
		color: var(--text-muted);
		letter-spacing: 0.03em;
	}
	.deadline-row {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin-top: 0.5rem;
		padding: 0.3rem 0.8rem;
		background: var(--field);
		border-radius: 2rem;
	}

	/* ── Progress (kumulatiivinen) ── */
	.progress-block {
		text-align: center;
		padding: 1.5rem 0 0.5rem;
	}

	.total-num {
		font-size: 4.5rem;
		font-weight: 800;
		line-height: 1;
		background: linear-gradient(135deg, var(--accent) 0%, #fbbf24 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		filter: drop-shadow(0 0 20px var(--accent-glow));
	}

	.total-label {
		font-size: 0.9rem;
		color: var(--text-muted);
		margin-top: 0.4rem;
		letter-spacing: 0.03em;
	}

	.first-time {
		font-size: 1.15rem;
		color: var(--text-dim);
		padding: 1.5rem 0;
		font-weight: 300;
	}

	.week {
		display: flex;
		justify-content: center;
		gap: 0.85rem;
		margin-top: 1.5rem;
	}

	.day {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
	}

	.day-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.08);
		transition: background 0.3s, box-shadow 0.3s;
	}

	.day.done .day-dot {
		background: var(--accent);
		box-shadow: 0 0 8px var(--accent-glow);
	}
	.day.today .day-dot {
		background: rgba(255, 255, 255, 0.25);
		box-shadow: 0 0 6px rgba(255, 255, 255, 0.1);
	}
	.day.today.done .day-dot {
		background: var(--accent);
		box-shadow: 0 0 10px var(--accent-glow);
	}

	.day-label {
		font-size: 0.6rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 500;
	}

	.day.today .day-label {
		color: var(--text);
		font-weight: 700;
	}

	/* ── Evening helper ── */
	.mode-block {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		padding: 1.15rem 1.2rem;
		border-radius: var(--radius-xl);
		background: var(--bg-card);
		border: 1px solid var(--border);
		contain: layout paint;
	}

	.mode-block {
		border-color: rgba(255, 112, 67, 0.28);
		box-shadow: 0 0 0 1px rgba(255, 112, 67, 0.08), 0 18px 45px rgba(0, 0, 0, 0.18);
	}

	.mode-kicker {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--accent);
	}

	.mode-copy h2 {
		font-size: 1.2rem;
		line-height: 1.15;
		color: var(--text);
	}

	.mode-text {
		font-size: 0.86rem;
		line-height: 1.45;
		color: var(--text-muted);
	}

	/* ── Checklist ── */
	.checklist {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		contain: layout paint;
	}

	.check-item {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 1.1rem 1.2rem;
		border-radius: var(--radius-md);
		background: var(--bg-card);
		border: 1px solid var(--border);
		color: var(--text);
		font-size: 0.95rem;
		font-weight: 400;
		cursor: pointer;
		text-align: left;
		transition: all 0.3s ease;
		-webkit-tap-highlight-color: transparent;
	}

	.check-item:active:not(:disabled) {
		border-color: var(--accent);
		background: var(--accent-dim);
		transform: scale(0.98);
	}

	.check-item.checked {
		opacity: 0.35;
		border-color: transparent;
	}

	.check-dot {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		border: 2px solid rgba(255, 255, 255, 0.15);
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.3s ease;
		font-size: 0;
	}

	.check-item.checked .check-dot {
		background: var(--accent);
		border-color: var(--accent);
		box-shadow: 0 0 10px var(--accent-glow);
	}
	.check-item.checked .check-dot::after {
		content: '';
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: white;
	}

	.check-label {
		flex: 1;
		line-height: 1.3;
	}

	.check-item.checked .check-label {
		text-decoration: line-through;
		text-decoration-color: var(--text-muted);
	}

	.checklist-hint {
		font-size: 0.82rem;
		color: var(--text-muted);
		text-align: center;
		padding: 0.25rem 0;
		font-weight: 300;
		letter-spacing: 0.02em;
	}

	.show-more-btn {
		background: none;
		border: 1px dashed rgba(255, 255, 255, 0.08);
		color: var(--text-muted);
		font-size: 0.8rem;
		padding: 0.7rem;
		border-radius: var(--radius-md);
		cursor: pointer;
		text-align: center;
		transition: border-color 0.2s, color 0.2s;
	}
	.show-more-btn:active {
		border-color: var(--border);
		color: var(--text-dim);
	}

	/* ── iPhone setup ── */
	.iphone-setup-block {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.25rem;
		border-radius: var(--radius-xl);
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.03));
		border: 1px solid var(--border);
		contain: layout paint;
	}

	.iphone-setup-block.setup-summary {
		gap: 0.9rem;
	}

	.setup-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.setup-kicker {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--accent);
		margin-bottom: 0.2rem;
	}

	.setup-head h2 {
		font-size: 1.15rem;
		line-height: 1.2;
	}

	.setup-dots {
		display: flex;
		gap: 0.35rem;
		padding-top: 0.15rem;
	}

	.setup-dots span {
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.12);
	}

	.setup-dots span.active {
		background: var(--accent);
		box-shadow: 0 0 10px var(--accent-glow);
	}

	.setup-text,
	.setup-note {
		font-size: 0.86rem;
		line-height: 1.5;
		color: var(--text-muted);
	}

	.setup-app-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.6rem;
	}

	.setup-app-grid button {
		padding: 0.9rem 1rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		background: var(--field);
		color: var(--text-dim);
		font: inherit;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: border-color 0.18s, background 0.18s, color 0.18s, transform 0.12s;
	}

	.setup-app-grid button.selected {
		background: var(--accent-dim);
		border-color: rgba(249, 115, 22, 0.35);
		color: var(--text);
	}

	.setup-app-grid button:active {
		transform: scale(0.98);
	}

	.setup-steps {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.setup-step {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
		font-size: 0.88rem;
		line-height: 1.45;
		color: var(--text);
	}

	.setup-selected {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
	}

	.setup-selected span {
		padding: 0.45rem 0.8rem;
		border-radius: 999px;
		background: var(--field);
		border: 1px solid var(--border);
		color: var(--text);
		font-size: 0.82rem;
		font-weight: 600;
	}

	.setup-status {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.setup-status-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 0.8rem 0.95rem;
		border-radius: var(--radius-md);
		background: var(--field);
		border: 1px solid var(--border);
		font-size: 0.84rem;
		color: var(--text-dim);
	}

	.setup-status-row strong {
		color: var(--text);
		font-size: 0.88rem;
	}

	.setup-nav {
		display: flex;
		justify-content: flex-end;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	.step-num {
		flex-shrink: 0;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--accent);
		color: #fff;
		font-size: 0.75rem;
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
		background: var(--field);
		border: 1px solid var(--border);
		font-size: 0.82rem;
		color: var(--text);
	}
	.reach-btn {
		padding: 0.9rem 1rem;
		border-radius: var(--radius-md);
		background: var(--accent);
		color: #fff;
		border: none;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: transform 0.15s, opacity 0.15s;
	}
	.reach-btn:active {
		transform: scale(0.98);
		opacity: 0.9;
	}
	.reach-btn.secondary {
		background: var(--field);
		color: var(--text-dim);
		border: 1px solid var(--border);
	}
	.reach-warn {
		font-size: 0.78rem;
		color: var(--danger);
	}

	.calendar-capture-block {
		display: flex;
		flex-direction: column;
		gap: 0.95rem;
		padding: 1.25rem;
		border-radius: var(--radius-xl);
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.03));
		border: 1px solid var(--border);
		contain: layout paint;
	}

	.calendar-head {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.calendar-kicker {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--accent);
	}

	.calendar-head h2 {
		font-size: 1.1rem;
		line-height: 1.2;
	}

	.calendar-helper,
	.calendar-note,
	.calendar-item-copy span,
	.calendar-success {
		font-size: 0.84rem;
		line-height: 1.45;
		color: var(--text-muted);
	}

	.calendar-compose {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.calendar-input {
		width: 100%;
		padding: 0.95rem 1rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		background: var(--field);
		color: var(--text);
		font: inherit;
		font-size: 0.95rem;
	}

	.calendar-input:focus {
		outline: none;
		border-color: var(--border-focus);
	}

	.calendar-list {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.calendar-item {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 0.95rem 1rem;
		border-radius: var(--radius-md);
		background: var(--field);
		border: 1px solid var(--border);
	}

	.calendar-item-copy {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.calendar-item-copy strong {
		font-size: 0.95rem;
		color: var(--text);
	}

	.calendar-item-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.calendar-delete {
		color: var(--text-muted);
	}

	/* ── Rewards ── */
	.rewards-hint {
		font-size: 0.78rem;
		color: var(--text-muted);
		text-align: center;
		margin-bottom: 0.75rem;
		letter-spacing: 0.02em;
	}

	.reward-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
	}

	.reward {
		text-align: center;
		padding: 0.9rem 0.5rem;
		border-radius: var(--radius-md);
		font-size: 0.82rem;
		font-weight: 500;
		text-decoration: none;
		background: var(--bg-card);
		border: 1px solid var(--border);
		color: var(--text);
		transition: border-color 0.2s, transform 0.15s;
	}

	.reward:active {
		border-color: var(--accent);
		transform: scale(0.97);
	}

	.reward.locked {
		color: var(--text-muted);
		opacity: 0.25;
	}

	/* ── Soundscape / Spotify ── */
	.soundscape-block {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1.25rem;
		border-radius: var(--radius-xl);
		background: linear-gradient(180deg, rgba(30, 215, 96, 0.06), rgba(30, 215, 96, 0.02));
		border: 1px solid rgba(30, 215, 96, 0.15);
		contain: layout paint;
	}

	.soundscape-kicker {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #1ed760;
	}

	.soundscape-title {
		font-size: 1.15rem;
		line-height: 1.2;
	}

	.soundscape-desc {
		font-size: 0.84rem;
		line-height: 1.45;
		color: var(--text-muted);
	}

	.soundscape-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
	}

	.soundscape-btn {
		padding: 0.85rem 0.75rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		background: var(--field);
		color: var(--text-dim);
		font: inherit;
		font-size: 0.84rem;
		font-weight: 500;
		cursor: pointer;
		transition: border-color 0.18s, background 0.18s, color 0.18s, transform 0.12s;
		text-align: center;
	}

	.soundscape-btn.active {
		background: rgba(30, 215, 96, 0.12);
		border-color: rgba(30, 215, 96, 0.35);
		color: #1ed760;
		font-weight: 600;
	}

	.soundscape-btn:active {
		transform: scale(0.97);
	}

	.spotify-embed {
		animation: fadeIn 0.3s ease;
	}

	.custom-input-row {
		display: flex;
		gap: 0.5rem;
	}

	.custom-input {
		flex: 1;
		padding: 0.7rem 0.85rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		background: var(--field);
		color: var(--text);
		font: inherit;
		font-size: 0.84rem;
	}

	.custom-input:focus {
		outline: none;
		border-color: #1ed760;
	}

	.custom-input::placeholder {
		color: var(--text-muted);
	}

	.custom-save-btn {
		padding: 0.7rem 1rem;
		border-radius: var(--radius-sm);
		border: none;
		background: #1ed760;
		color: #000;
		font: inherit;
		font-size: 0.84rem;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
	}

	.custom-save-btn:active {
		opacity: 0.85;
	}

	.soundscape-edit {
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 0.78rem;
		cursor: pointer;
		text-align: center;
		padding: 0.3rem;
	}

	.soundscape-edit:active {
		color: var(--text);
	}

	/* ── Done view ── */
	.done-top {
		text-align: center;
		padding: 5rem 0 2rem;
	}

	.done-clock {
		font-size: 4.5rem;
		font-weight: 100;
		line-height: 1;
		color: var(--text);
		opacity: 0.15;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.05em;
	}

	.done-msg {
		font-size: 1.05rem;
		color: var(--text-dim);
		margin-top: 1.25rem;
		font-weight: 300;
		letter-spacing: 0.02em;
	}

	.total-badge {
		display: inline-block;
		margin-top: 1.75rem;
		padding: 0.5rem 1.2rem;
		background: var(--accent-dim);
		color: var(--accent);
		border-radius: 2rem;
		font-size: 0.82rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		box-shadow: 0 0 20px var(--accent-glow);
	}

	.back-btn {
		background: var(--field);
		border: 1px solid var(--border);
		color: var(--text-muted);
		font-size: 0.82rem;
		padding: 0.65rem 1.4rem;
		border-radius: 2rem;
		cursor: pointer;
		align-self: center;
		margin-top: auto;
		transition: border-color 0.2s;
	}
	.back-btn:active {
		border-color: var(--border-focus);
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

	@media (min-width: 980px) {
		.page {
			max-width: 1280px;
			padding: 3.25rem 2.75rem 5.5rem;
			column-gap: 1.75rem;
			row-gap: 1.75rem;
			display: grid;
			grid-template-columns: minmax(360px, 440px) minmax(520px, 1fr);
			align-content: start;
			align-items: start;
		}

		.idle-top,
		.settings-panel,
		.iphone-setup-block,
		.calendar-capture-block,
		.rewards.locked-section {
			grid-column: 1 / -1;
		}

		.sleep-counter,
		.mode-block {
			grid-column: 1;
		}

		.progress-block,
		.checklist {
			grid-column: 2;
		}

		.idle-top {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding-top: 0.35rem;
		}

		.idle-clock {
			font-size: 2.4rem;
		}

		.settings-panel,
		.sleep-counter,
		.progress-block,
		.iphone-setup-block,
		.calendar-capture-block,
		.rewards.locked-section,
		.checklist {
			background: var(--bg-card);
			border: 1px solid var(--border);
			border-radius: var(--radius-xl);
			box-shadow: 0 24px 80px rgba(0, 0, 0, 0.22);
		}

		.progress-block {
			padding: 1.75rem 1.25rem;
			min-height: 100%;
			display: flex;
			flex-direction: column;
			justify-content: center;
		}

		.checklist {
			padding: 1.1rem;
			gap: 0.7rem;
			position: sticky;
			top: 2rem;
		}

		.check-item {
			padding: 1.15rem 1.25rem;
			font-size: 1rem;
		}

		.iphone-setup-block,
		.calendar-capture-block,
		.rewards.locked-section {
			padding: 1.45rem;
		}

		.iphone-setup-block {
			display: grid;
			grid-template-columns: minmax(0, 1.25fr) minmax(280px, 0.75fr);
			column-gap: 1.2rem;
			align-items: start;
		}

		.iphone-setup-block.setup-summary {
			grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
		}

		.iphone-setup-block .setup-head,
		.iphone-setup-block .setup-text,
		.iphone-setup-block .setup-status {
			grid-column: 1;
		}

		.iphone-setup-block .setup-app-grid,
		.iphone-setup-block .setup-steps,
		.iphone-setup-block .setup-note {
			grid-column: 1 / -1;
		}

		.iphone-setup-block .setup-selected,
		.iphone-setup-block .reach-btn.secondary,
		.iphone-setup-block .reach-btn:not(.secondary),
		.iphone-setup-block .reach-warn,
		.iphone-setup-block .setup-nav {
			grid-column: 2;
		}

		.iphone-setup-block .setup-app-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.iphone-setup-block .setup-selected {
			align-self: start;
			justify-content: flex-start;
			padding: 0.1rem 0 0;
		}

		.iphone-setup-block .setup-nav {
			align-self: end;
			justify-content: flex-end;
		}

		.iphone-setup-block .reach-btn,
		.iphone-setup-block .reach-warn {
			align-self: start;
		}

		.iphone-setup-block.setup-summary .setup-nav,
		.iphone-setup-block.setup-summary .setup-selected,
		.iphone-setup-block.setup-summary .setup-status {
			grid-column: 2;
		}

		.iphone-setup-block.setup-summary .setup-text,
		.iphone-setup-block.setup-summary .setup-head {
			grid-column: 1;
		}

		.calendar-capture-block {
			display: grid;
			grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
			column-gap: 1.2rem;
			align-items: start;
		}

		.calendar-capture-block .calendar-head,
		.calendar-capture-block .calendar-compose,
		.calendar-capture-block .calendar-note,
		.calendar-capture-block .reach-warn,
		.calendar-capture-block .calendar-success {
			grid-column: 1;
		}

		.calendar-capture-block .calendar-list {
			grid-column: 2;
			grid-row: 1 / span 5;
		}

		.calendar-capture-block .calendar-compose {
			flex-direction: row;
			align-items: stretch;
		}

		.calendar-capture-block .calendar-compose .reach-btn {
			flex: 0 0 210px;
		}
		
		.rewards.locked-section .reward-grid,
		.page > .rewards:not(.locked-section) .reward-grid {
			grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		}

		.page > .done-top,
		.page > .rewards:not(.locked-section),
		.page > .back-btn {
			grid-column: 1 / -1;
			max-width: 760px;
			width: 100%;
			margin-left: auto;
			margin-right: auto;
		}

		.page > .rewards:not(.locked-section) {
			padding: 0 1rem;
		}

		.done-top {
			padding: 6rem 0 1.5rem;
		}

		.done-clock {
			font-size: 5.25rem;
		}

		.back-btn {
			margin-top: 1rem;
		}

		.help-dock {
			left: 1.5rem;
			bottom: 1.5rem;
		}
	}

	@media (max-width: 640px) {
		.calendar-item-actions {
			flex-direction: column;
		}

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
