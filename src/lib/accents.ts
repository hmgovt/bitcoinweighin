/** Each hero commodity's accent colour — tabs, readouts, clips, the 1 BTC answer. */
export function commodityAccent(id: string): string {
	switch (id) {
		case 'gold':
			return '#d4a14a';
		case 'silver':
			return '#c5cdd6';
		case 'pu238':
			return '#7ed4ff';
		case 'cocaine':
			return '#e8e0d2';
		case 'cash':
			return '#85bb65';
		default:
			return '#d4a14a';
	}
}
