/**
 * Builds the Manhattan meshes off the main thread (~0.7 s of earcut on a
 * laptop, more on a phone) and hands the buffers back without copying.
 */
import { buildManhattan } from './manhattanGeometry.js';
import meta from '../manhattan-map.json';

self.onmessage = async (e: MessageEvent<{ url: string }>) => {
	try {
		const res = await fetch(e.data.url);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const buf = await res.arrayBuffer();
		const m = buildManhattan(buf, meta);
		// The raw lot outlines too: the stage slices the part-owned lot itself.
		const S = meta.sections;
		const lotRings = {
			polyStart: new Uint32Array(buf.slice(S['lots.polyStart'].offset, S['lots.polyStart'].offset + S['lots.polyStart'].length * 4)),
			ringStart: new Uint32Array(buf.slice(S['lots.ringStart'].offset, S['lots.ringStart'].offset + S['lots.ringStart'].length * 4)),
			coords: new Int16Array(buf.slice(S['lots.coords'].offset, S['lots.coords'].offset + S['lots.coords'].length * 2)),
		};
		const transfer: Transferable[] = [];
		for (const mesh of [m.land, m.parks, m.lots, m.buildings]) {
			transfer.push(mesh.positions.buffer, mesh.index.buffer);
			if (mesh.shade) transfer.push(mesh.shade.buffer);
		}
		for (const a of [m.lotIndexStart, m.bldIndexByLot, m.prefixBounds, m.lotCentroid, m.lotArea, m.prefixMaxHeight])
			transfer.push(a.buffer);
		transfer.push(lotRings.polyStart.buffer, lotRings.ringStart.buffer, lotRings.coords.buffer);
		(self as unknown as Worker).postMessage({ ok: true, buffers: m, lotRings }, transfer);
	} catch (err) {
		(self as unknown as Worker).postMessage({ ok: false, error: String(err) });
	}
};
