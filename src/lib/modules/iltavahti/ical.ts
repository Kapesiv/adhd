import type { UserSettings } from '$lib/core/state';

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
