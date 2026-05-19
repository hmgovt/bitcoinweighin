/**
 * One-shot QR generator for the tip jar.
 *
 *   npx tsx scripts/generate-tip-qr.ts
 *
 * Writes two static SVGs (white-on-transparent for the dark theme) that
 * the TipJar component inlines. The Lightning Address and on-chain
 * address are stable — re-run only if either changes.
 */
import QRCode from 'qrcode';

const LN_ADDRESS = 'tips@bitcoinweighin.com';
const BTC_ADDRESS = 'bc1qaam6e5xmqxwxpwwns02jf7t7hvhnkqwyxc92qj';

const opts = {
	type: 'svg' as const,
	margin: 1,
	color: { dark: '#ffffff', light: '#00000000' },
};

await QRCode.toFile('static/images/tip-qr.svg', LN_ADDRESS, opts);
console.log('Generated static/images/tip-qr.svg');

await QRCode.toFile(
	'static/images/tip-qr-onchain.svg',
	`bitcoin:${BTC_ADDRESS}`,
	opts,
);
console.log('Generated static/images/tip-qr-onchain.svg');
