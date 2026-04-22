import type { UserSettings } from '$lib/core/state';

export interface CalendarEventDraft {
	title: string;
	date: string; // YYYY-MM-DD
	time?: string | null; // HH:MM
	durationMinutes?: number;
	description?: string;
}

interface ReminderTemplate {
	uid: string;
	summary: string;
	description: string;
	offsetMinutesBeforeBedtime: number;
}

const reminders: ReminderTemplate[] = [
	{
		uid: 'iltavahti-2h',
		summary: 'Concentra: 2h nukkumaanmenoon',
		description: 'Aleta rauhoittumaan. Avaa Concentra.',
		offsetMinutesBeforeBedtime: 120
	},
	{
		uid: 'iltavahti-1h',
		summary: 'Concentra: 1h jäljellä',
		description: 'Aloita iltatoimet. Avaa Concentra.',
		offsetMinutesBeforeBedtime: 60
	},
	{
		uid: 'iltavahti-30m',
		summary: 'Concentra: 30 min',
		description: 'Lopeta puuhat. Avaa Concentra.',
		offsetMinutesBeforeBedtime: 30
	},
	{
		uid: 'iltavahti-now',
		summary: 'NUKKUMAAN NYT',
		description: 'Nukkumaanmenoaika. Avaa Concentra.',
		offsetMinutesBeforeBedtime: 0
	}
];

function pad(n: number): string {
	return n.toString().padStart(2, '0');
}

function formatLocal(d: Date): string {
	return (
		`${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
		`T${pad(d.getHours())}${pad(d.getMinutes())}00`
	);
}

function formatUtc(d: Date): string {
	return (
		`${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
		`T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
	);
}

function escapeIcs(text: string): string {
	return text
		.replace(/\\/g, '\\\\')
		.replace(/\n/g, '\\n')
		.replace(/,/g, '\\,')
		.replace(/;/g, '\\;');
}

function toDateParts(date: string): { year: number; month: number; day: number } {
	const [year, month, day] = date.split('-').map(Number);
	return { year, month, day };
}

function formatDateValue(date: string): string {
	const { year, month, day } = toDateParts(date);
	return `${year}${pad(month)}${pad(day)}`;
}

function bedtimeMinutes(settings: UserSettings): number {
	const [wh, wm] = settings.wakeUpTime.split(':').map(Number);
	const total = wh * 60 + wm - settings.sleepHours * 60;
	return ((total % (24 * 60)) + 24 * 60) % (24 * 60);
}

export function generateIcs(settings: UserSettings, appUrl: string): string {
	const now = new Date();
	const dtStamp = formatUtc(now);
	const bedMin = bedtimeMinutes(settings);

	const lines: string[] = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Concentra//Concentra Reminders//FI',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH'
	];

	for (const r of reminders) {
		const eventMin = ((bedMin - r.offsetMinutesBeforeBedtime) % (24 * 60) + 24 * 60) % (24 * 60);
		const eH = Math.floor(eventMin / 60);
		const eM = eventMin % 60;

		const start = new Date();
		start.setHours(eH, eM, 0, 0);
		if (start <= now) start.setDate(start.getDate() + 1);

		const end = new Date(start.getTime() + 5 * 60 * 1000);

		lines.push(
			'BEGIN:VEVENT',
			`UID:${r.uid}@iltavahti.local`,
			`DTSTAMP:${dtStamp}`,
			`DTSTART:${formatLocal(start)}`,
			`DTEND:${formatLocal(end)}`,
			'RRULE:FREQ=DAILY',
			`SUMMARY:${escapeIcs(r.summary)}`,
			`DESCRIPTION:${escapeIcs(r.description + '\n' + appUrl)}`,
			`URL:${escapeIcs(appUrl)}`,
			'BEGIN:VALARM',
			'ACTION:DISPLAY',
			`DESCRIPTION:${escapeIcs(r.summary)}`,
			'TRIGGER:-PT0M',
			'END:VALARM',
			'END:VEVENT'
		);
	}

	lines.push('END:VCALENDAR');
	return lines.join('\r\n') + '\r\n';
}

export function generateSingleEventIcs(event: CalendarEventDraft, appUrl: string): string {
	const now = new Date();
	const dtStamp = formatUtc(now);
	const durationMinutes = event.durationMinutes ?? 60;
	const lines: string[] = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Concentra//Concentra Calendar Event//FI',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		'BEGIN:VEVENT',
		`UID:concentra-event-${Date.now()}@iltavahti.local`,
		`DTSTAMP:${dtStamp}`
	];

	if (event.time) {
		const [hours, minutes] = event.time.split(':').map(Number);
		const { year, month, day } = toDateParts(event.date);
		const start = new Date(year, month - 1, day, hours, minutes, 0, 0);
		const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
		lines.push(
			`DTSTART:${formatLocal(start)}`,
			`DTEND:${formatLocal(end)}`
		);
	} else {
		const startDate = formatDateValue(event.date);
		const nextDay = new Date(`${event.date}T00:00:00`);
		nextDay.setDate(nextDay.getDate() + 1);
		const endDate = formatDateValue(
			`${nextDay.getFullYear()}-${pad(nextDay.getMonth() + 1)}-${pad(nextDay.getDate())}`
		);
		lines.push(
			`DTSTART;VALUE=DATE:${startDate}`,
			`DTEND;VALUE=DATE:${endDate}`
		);
	}

	lines.push(
		`SUMMARY:${escapeIcs(event.title)}`,
		`DESCRIPTION:${escapeIcs(event.description ?? `Luotu Concentra-sivulta\n${appUrl}`)}`,
		`URL:${escapeIcs(appUrl)}`
	);

	if (event.time) {
		lines.push(
			'BEGIN:VALARM',
			'ACTION:DISPLAY',
			`DESCRIPTION:${escapeIcs(event.title)}`,
			'TRIGGER:-PT30M',
			'END:VALARM'
		);
	}

	lines.push('END:VEVENT', 'END:VCALENDAR');
	return lines.join('\r\n') + '\r\n';
}

export function downloadIcs(settings: UserSettings, appUrl: string): void {
	const ics = generateIcs(settings, appUrl);
	const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = 'concentra.ics';
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadSingleEventIcs(event: CalendarEventDraft, appUrl: string): void {
	const ics = generateSingleEventIcs(event, appUrl);
	const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'concentra-event'}.ics`;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
