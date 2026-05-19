<script lang="ts">
	let copyLnConfirmed = $state(false);
	let copyBtcConfirmed = $state(false);

	const LN_ADDRESS = 'tips@bitcoinweighin.com';
	const BTC_ADDRESS = 'bc1qaam6e5xmqxwxpwwns02jf7t7hvhnkqwyxc92qj';

	async function copy(value: string, which: 'ln' | 'btc') {
		try {
			await navigator.clipboard.writeText(value);
			if (which === 'ln') {
				copyLnConfirmed = true;
				setTimeout(() => (copyLnConfirmed = false), 1500);
			} else {
				copyBtcConfirmed = true;
				setTimeout(() => (copyBtcConfirmed = false), 1500);
			}
		} catch {
			window.prompt('Copy this address:', value);
		}
	}
</script>

<footer class="tip-jar">
	<div class="tip-jar__inner">
		<p class="tip-jar__heading">
			Tips via Lightning:
			<a href="lightning:{LN_ADDRESS}" class="tip-jar__address">{LN_ADDRESS}</a>
		</p>
		<p class="tip-jar__copy">
			Plug the amount into the slider to see what you just sent.
		</p>

		<div class="tip-jar__row">
			<img
				src="/images/tip-qr.svg"
				alt="QR code for tips@bitcoinweighin.com"
				class="tip-jar__qr"
				width="120"
				height="120"
			/>
			<button
				type="button"
				class="tip-jar__btn"
				onclick={() => copy(LN_ADDRESS, 'ln')}
			>
				{copyLnConfirmed ? 'Copied ✓' : 'Copy address'}
			</button>
		</div>

		<details class="tip-jar__details">
			<summary>Or send on-chain</summary>
			<div class="tip-jar__onchain">
				<p class="tip-jar__hint">Use this for larger amounts.</p>
				<a href="bitcoin:{BTC_ADDRESS}" class="tip-jar__btc">{BTC_ADDRESS}</a>
				<div class="tip-jar__row">
					<img
						src="/images/tip-qr-onchain.svg"
						alt="On-chain Bitcoin QR code"
						class="tip-jar__qr"
						width="120"
						height="120"
					/>
					<button
						type="button"
						class="tip-jar__btn"
						onclick={() => copy(BTC_ADDRESS, 'btc')}
					>
						{copyBtcConfirmed ? 'Copied ✓' : 'Copy address'}
					</button>
				</div>
			</div>
		</details>
	</div>
</footer>

<style>
	.tip-jar {
		/* Self-contained dark band so the footer reads correctly whether the
		   page above it is dark (/, bg-zinc-950) or light (/methodology, /data). */
		background: #09090b; /* zinc-950 */
		border-top: 1px solid #27272a; /* zinc-800 */
		padding: 32px 16px 48px;
		color: #d4d4d8; /* zinc-300 */
	}
	.tip-jar__inner {
		max-width: 672px; /* matches the main column (max-w-2xl) */
		margin: 0 auto;
	}
	.tip-jar__heading {
		margin: 0;
		font-size: 15px;
		color: #e4e4e7; /* zinc-200 */
	}
	.tip-jar__address {
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		color: #fbbf24; /* amber-400 */
		text-decoration: none;
		border-bottom: 1px dashed #3f3f46; /* zinc-700 */
	}
	.tip-jar__address:hover {
		border-bottom-color: #fbbf24;
	}
	.tip-jar__copy {
		margin: 6px 0 18px;
		font-size: 13px;
		color: #9aa0a6;
	}
	.tip-jar__row {
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
	}
	.tip-jar__qr {
		display: block;
		width: 120px;
		height: 120px;
		background: transparent;
	}
	.tip-jar__btn {
		background: transparent;
		color: #e4e4e7;
		border: 1px solid #3f3f46; /* zinc-700 */
		border-radius: 4px;
		padding: 8px 14px;
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 12px;
		cursor: pointer;
		transition: border-color 120ms ease, color 120ms ease;
	}
	.tip-jar__btn:hover {
		border-color: #71717a; /* zinc-500 */
		color: #fafafa;
	}
	.tip-jar__btn:focus-visible {
		outline: none;
		border-color: #f59e0b; /* amber-500 */
	}
	.tip-jar__details {
		margin-top: 24px;
		font-size: 13px;
	}
	.tip-jar__details > summary {
		cursor: pointer;
		color: #9aa0a6;
		list-style: none;
		user-select: none;
		padding: 4px 0;
	}
	.tip-jar__details > summary::-webkit-details-marker {
		display: none;
	}
	.tip-jar__details > summary::after {
		content: ' ▸';
		font-size: 11px;
		display: inline-block;
		transition: transform 120ms ease;
	}
	.tip-jar__details[open] > summary::after {
		transform: rotate(90deg);
	}
	.tip-jar__details > summary:hover {
		color: #e4e4e7;
	}
	.tip-jar__onchain {
		margin-top: 14px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.tip-jar__hint {
		margin: 0;
		font-size: 12px;
		color: #71717a;
	}
	.tip-jar__btc {
		font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
		font-variant-numeric: tabular-nums;
		font-size: 12px;
		color: #e4e4e7;
		word-break: break-all;
		text-decoration: none;
		border-bottom: 1px dashed #3f3f46;
		align-self: flex-start;
	}
	.tip-jar__btc:hover {
		border-bottom-color: #fbbf24;
		color: #fbbf24;
	}
</style>
