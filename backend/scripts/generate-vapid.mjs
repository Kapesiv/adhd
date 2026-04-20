// Generoi VAPID-avainpari push-ilmoituksia varten
import webPush from 'web-push';

const vapidKeys = webPush.generateVAPIDKeys();

console.log('\n--- VAPID-avaimet ---\n');
console.log('Public key:');
console.log(vapidKeys.publicKey);
console.log('\nPrivate key:');
console.log(vapidKeys.privateKey);
console.log('\n--- Lisää Cloudflare Workeriin: ---\n');
console.log(`npx wrangler secret put VAPID_PUBLIC_KEY`);
console.log(`npx wrangler secret put VAPID_PRIVATE_KEY`);
console.log('\nLiitä avaimet kun wrangler kysyy.\n');
