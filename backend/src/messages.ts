// Anti-habituation: pool of varied messages per reminder slot.
// Cron picks pseudorandomly based on day-of-year so the same day is
// deterministic but consecutive days differ.

export type SlotKey = 'pre2h' | 'pre1h' | 'pre30' | 'now';

export interface Message {
	title: string;
	body: string;
}

const pool: Record<SlotKey, Message[]> = {
	pre2h: [
		{ title: 'Ilta lähestyy', body: 'Avaa Iltavahti ja aloita rauhoittuminen.' },
		{ title: '2h nukkumaanmenoon', body: 'Laita näyttöaika hiljalleen pois.' },
		{ title: 'Hidasta vauhtia', body: 'Katso vielä mitä on tekemättä.' },
		{ title: 'Aika muistaa', body: 'Huomenna on uusi päivä. Valmistaudu.' }
	],
	pre1h: [
		{ title: '1 tunti jäljellä', body: 'Aloita iltatoimet nyt.' },
		{ title: 'Tunti nukkumaanmenoon', body: 'Avaa Iltavahti — tee lista.' },
		{ title: 'Ei enää venytetä', body: 'Tunti. Sitten nukkumaan.' },
		{ title: 'Tässä ja nyt', body: 'Lopeta mitä teet. Avaa Iltavahti.' }
	],
	pre30: [
		{ title: '30 minuuttia', body: 'Lopeta nyt. Oikeasti.' },
		{ title: 'Puoli tuntia', body: 'Pese hampaat ja laite laturiin.' },
		{ title: 'Viimeinen sprintti', body: '30 min. Avaa Iltavahti.' },
		{ title: 'Pysähdy hetkeksi', body: 'Iltatoimet puoleen tuntiin.' }
	],
	now: [
		{ title: 'NUKKUMAAN', body: 'Aika on nyt. Avaa Iltavahti.' },
		{ title: 'Nyt on aika', body: 'Puhelin pois. Silmät kiinni.' },
		{ title: 'Sänky odottaa', body: 'Ei enää selaamista.' },
		{ title: 'Huomenna kiität itseäsi', body: 'Laita puhelin laturiin.' }
	]
};

export function pickMessage(slot: SlotKey, dayKey: number): Message {
	const list = pool[slot];
	const idx = Math.abs(dayKey) % list.length;
	return list[idx];
}

export function dayOfYearUTC(now: Date): number {
	const start = Date.UTC(now.getUTCFullYear(), 0, 0);
	return Math.floor((now.getTime() - start) / (24 * 3600 * 1000));
}
