/**
 * Free-vibration modes of an elastic block — pure, tested, ANALYSIS ONLY.
 * Never imported by client code. It backs the tested claim (see
 * tests/impact-sound.test.ts, "the cube's own ring is negligible") that a
 * block landing flat on concrete is heard through the floor's thud, not its
 * own ring — which is why impact-sound.ts leaves the ring out.
 *
 * Method: Rayleigh–Ritz, as used in resonant ultrasound spectroscopy
 * (Visscher, Migliori, Bell & Reinert, "On the normal modes of free vibration
 * of inhomogeneous and anisotropic elastic objects", J. Acoust. Soc. Am. 90,
 * 2154 (1991)). Each displacement component is expanded in products of
 * Legendre polynomials P_l(x/a) P_m(y/b) P_n(z/c) with l + m + n ≤ N; with
 * that basis the mass matrix is diagonal, so the eigenproblem is an ordinary
 * symmetric one. It splits exactly into eight blocks by mirror symmetry
 * (a mode is even or odd under each of the three mirror planes), each solved
 * by cyclic Jacobi rotation.
 *
 * Units: density 1, shear modulus 1 — so the shear wave speed is 1 — and
 * lengths as given. Frequencies come out as angular frequency ω in those
 * units; for a cube of half-edge 1 the dimensionless frequency
 * Ω = f·L / c_t (L = edge, c_t = shear wave speed) is ω / π.
 */

export interface BoxMode {
	/** Angular frequency (units: c_t / length). */
	omega: number;
	/** Mode shape: coefficients over `basis` (mass-normalised). */
	coeffs: Float64Array;
}

export interface BoxModel {
	halfDims: [number, number, number];
	poisson: number;
	order: number;
	/** Basis functions: displacement component i ∈ {0,1,2} × Legendre degrees. */
	basis: { i: number; l: number; m: number; n: number; norm: number }[];
	modes: BoxMode[];
}

// ── Legendre polynomials and 1-D integrals ─────────────────────────────────

/** P_n(s) and P_n'(s) for n = 0..N, by the three-term recurrence. */
function legendre(N: number, s: number): { p: number[]; dp: number[] } {
	const p = [1, s];
	const dp = [0, 1];
	for (let n = 1; n < N; n++) {
		p.push(((2 * n + 1) * s * p[n] - n * p[n - 1]) / (n + 1));
		// P'_{n+1} = P'_{n-1} + (2n+1) P_n
		dp.push(dp[n - 1] + (2 * n + 1) * p[n]);
	}
	return { p: p.slice(0, N + 1), dp: dp.slice(0, N + 1) };
}

/** Gauss–Legendre nodes and weights on [-1, 1] (Newton on P_n). */
export function gaussLegendre(n: number): { x: number[]; w: number[] } {
	const x: number[] = [];
	const w: number[] = [];
	for (let k = 1; k <= n; k++) {
		let t = Math.cos((Math.PI * (k - 0.25)) / (n + 0.5));
		for (let it = 0; it < 100; it++) {
			const { p, dp } = legendre(n, t);
			const dt = p[n] / dp[n];
			t -= dt;
			if (Math.abs(dt) < 1e-15) break;
		}
		const { dp } = legendre(n, t);
		x.push(t);
		w.push(2 / ((1 - t * t) * dp[n] * dp[n]));
	}
	return { x, w };
}

/** 1-D integral tables on [-1,1]: D00 = ∫P P, D10 = ∫P' P, D11 = ∫P' P'. */
function tables(N: number): { D00: number[][]; D10: number[][]; D11: number[][] } {
	const { x, w } = gaussLegendre(N + 2); // exact for degree ≤ 2N+3
	const D00 = Array.from({ length: N + 1 }, () => new Array(N + 1).fill(0));
	const D10 = Array.from({ length: N + 1 }, () => new Array(N + 1).fill(0));
	const D11 = Array.from({ length: N + 1 }, () => new Array(N + 1).fill(0));
	for (let q = 0; q < x.length; q++) {
		const { p, dp } = legendre(N, x[q]);
		for (let a = 0; a <= N; a++) {
			for (let b = 0; b <= N; b++) {
				D00[a][b] += w[q] * p[a] * p[b];
				D10[a][b] += w[q] * dp[a] * p[b];
				D11[a][b] += w[q] * dp[a] * dp[b];
			}
		}
	}
	return { D00, D10, D11 };
}

// ── Symmetric eigensolver (cyclic Jacobi) ──────────────────────────────────

/** Eigenvalues and eigenvectors (columns of V) of a symmetric matrix. */
export function jacobiEigen(Ain: number[][]): { values: number[]; vectors: number[][] } {
	const n = Ain.length;
	const A = Ain.map((r) => r.slice());
	const V = Array.from({ length: n }, (_, i) => {
		const r = new Array(n).fill(0);
		r[i] = 1;
		return r;
	});
	for (let sweep = 0; sweep < 100; sweep++) {
		let off = 0;
		let diag = 0;
		for (let i = 0; i < n; i++) {
			diag += A[i][i] * A[i][i];
			for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
		}
		if (off <= 1e-26 * Math.max(diag, 1)) break;
		for (let p = 0; p < n; p++) {
			for (let q = p + 1; q < n; q++) {
				const apq = A[p][q];
				if (Math.abs(apq) < 1e-300) continue;
				const theta = (A[q][q] - A[p][p]) / (2 * apq);
				const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
				const c = 1 / Math.sqrt(t * t + 1);
				const s = t * c;
				for (let k = 0; k < n; k++) {
					const akp = A[k][p];
					const akq = A[k][q];
					A[k][p] = c * akp - s * akq;
					A[k][q] = s * akp + c * akq;
				}
				for (let k = 0; k < n; k++) {
					const apk = A[p][k];
					const aqk = A[q][k];
					A[p][k] = c * apk - s * aqk;
					A[q][k] = s * apk + c * aqk;
				}
				for (let k = 0; k < n; k++) {
					const vkp = V[k][p];
					const vkq = V[k][q];
					V[k][p] = c * vkp - s * vkq;
					V[k][q] = s * vkp + c * vkq;
				}
			}
		}
	}
	return { values: A.map((r, i) => r[i]), vectors: V };
}

// ── The Rayleigh–Ritz model ─────────────────────────────────────────────────

/**
 * All free-vibration modes of an isotropic elastic box with half-dimensions
 * `halfDims`, Poisson's ratio `poisson`, density 1 and shear modulus 1,
 * using Legendre products up to total degree `order`. Modes are returned in
 * ascending frequency, rigid-body modes (ω ≈ 0) included.
 */
export function solveBox(halfDims: [number, number, number], poisson: number, order = 8): BoxModel {
	const mu = 1;
	const lam = (2 * mu * poisson) / (1 - 2 * poisson);
	const N = order;
	const { D00, D10, D11 } = tables(N);
	const h = halfDims;

	const basis: BoxModel['basis'] = [];
	for (let i = 0; i < 3; i++) {
		for (let l = 0; l <= N; l++) {
			for (let m = 0; m <= N - l; m++) {
				for (let n = 0; n <= N - l - m; n++) {
					const norm = Math.sqrt(
						((2 * h[0]) / (2 * l + 1)) * ((2 * h[1]) / (2 * m + 1)) * ((2 * h[2]) / (2 * n + 1))
					);
					basis.push({ i, l, m, n, norm });
				}
			}
		}
	}

	/** ∫ ∂_da φ_A · ∂_db φ_B dV over the box (da/db = -1 for no derivative). */
	const deg = (b: (typeof basis)[number], ax: number) => (ax === 0 ? b.l : ax === 1 ? b.m : b.n);
	function integral(A: (typeof basis)[number], B: (typeof basis)[number], da: number, db: number): number {
		let v = 1;
		for (let ax = 0; ax < 3; ax++) {
			const a = deg(A, ax);
			const b = deg(B, ax);
			const dA = da === ax;
			const dB = db === ax;
			if (dA && dB) v *= D11[a][b] / h[ax];
			else if (dA) v *= D10[a][b];
			else if (dB) v *= D10[b][a];
			else v *= D00[a][b] * h[ax];
			if (v === 0) return 0;
		}
		return v / (A.norm * B.norm);
	}

	// Mirror-symmetry class: parity under x→-x, y→-y, z→-z of the field.
	const cls = (b: (typeof basis)[number]) =>
		((b.l + (b.i === 0 ? 1 : 0)) & 1) | (((b.m + (b.i === 1 ? 1 : 0)) & 1) << 1) | (((b.n + (b.i === 2 ? 1 : 0)) & 1) << 2);

	const modes: BoxMode[] = [];
	for (let c = 0; c < 8; c++) {
		const idx = basis.map((b, k) => (cls(b) === c ? k : -1)).filter((k) => k >= 0);
		const K = idx.map(() => new Array(idx.length).fill(0));
		for (let r = 0; r < idx.length; r++) {
			const A = basis[idx[r]];
			for (let s = r; s < idx.length; s++) {
				const B = basis[idx[s]];
				// K = λ ∫∂_i φ ∂_k φ' + μ δ_ik Σ_j ∫∂_j φ ∂_j φ' + μ ∫∂_k φ ∂_i φ'
				let v = lam * integral(A, B, A.i, B.i) + mu * integral(A, B, B.i, A.i);
				if (A.i === B.i) for (let j = 0; j < 3; j++) v += mu * integral(A, B, j, j);
				K[r][s] = K[s][r] = v;
			}
		}
		const { values, vectors } = jacobiEigen(K);
		values.forEach((ev, e) => {
			const coeffs = new Float64Array(basis.length);
			idx.forEach((k, r) => (coeffs[k] = vectors[r][e]));
			modes.push({ omega: Math.sqrt(Math.max(ev, 0)), coeffs });
		});
	}
	modes.sort((a, b) => a.omega - b.omega);
	return { halfDims, poisson, order, basis, modes };
}

/** Displacement of `mode` at a point (box coordinates). */
export function displacement(model: BoxModel, mode: BoxMode, x: number, y: number, z: number): [number, number, number] {
	const N = model.order;
	const [a, b, c] = model.halfDims;
	const px = legendre(N, x / a).p;
	const py = legendre(N, y / b).p;
	const pz = legendre(N, z / c).p;
	const u: [number, number, number] = [0, 0, 0];
	model.basis.forEach((f, k) => {
		const w = mode.coeffs[k];
		if (w !== 0) u[f.i] += (w * px[f.l] * py[f.m] * pz[f.n]) / f.norm;
	});
	return u;
}

// ── Excitation by a landing ────────────────────────────────────────────────

/**
 * How strongly a landing on the bottom face (z = -c, floor pushing +z) excites
 * `mode`, and how much sound it can then radiate. Returns
 *  · `force`: the generalised force ∫ w(x,y) u_z dA for a load spread over
 *    the face with density w = (1 + tilt·x/a) / area — `tilt` shifts the
 *    centroid of the landing toward one edge, since no real drop lands
 *    perfectly flat (a perfectly flat, centred landing excites only the
 *    fully symmetric modes);
 *  · `surface`: RMS normal surface motion over all six faces — what the mode
 *    radiates with, once excited (radiation efficiency ≈ 1, see below).
 * Both are for the mass-normalised mode, so `force × surface` is the relative
 * sound-pressure amplitude of that mode after a unit impulse.
 */
export function landingCoupling(
	model: BoxModel,
	mode: BoxMode,
	tilt: number,
	quad = 8
): { force: number; surface: number } {
	const [a, b, c] = model.halfDims;
	const { x: gx, w: gw } = gaussLegendre(quad);

	let force = 0;
	for (let i = 0; i < quad; i++) {
		for (let j = 0; j < quad; j++) {
			const x = gx[i] * a;
			const y = gx[j] * b;
			const wt = gw[i] * gw[j] * a * b; // dA
			const load = (1 + (tilt * x) / a) / (4 * a * b);
			force += wt * load * displacement(model, mode, x, y, -c)[2];
		}
	}

	let s2 = 0;
	let area = 0;
	const faces: { axis: number; sign: number }[] = [];
	for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) faces.push({ axis, sign });
	for (const { axis, sign } of faces) {
		const [u, v] = [0, 1, 2].filter((k) => k !== axis);
		const H = model.halfDims;
		for (let i = 0; i < quad; i++) {
			for (let j = 0; j < quad; j++) {
				const p = [0, 0, 0];
				p[axis] = sign * H[axis];
				p[u] = gx[i] * H[u];
				p[v] = gx[j] * H[v];
				const wt = gw[i] * gw[j] * H[u] * H[v];
				const d = displacement(model, mode, p[0], p[1], p[2]);
				s2 += wt * d[axis] * d[axis];
				area += wt;
			}
		}
	}
	return { force, surface: Math.sqrt(s2 / area) };
}

/** Spectrum of a half-sine force pulse of duration τ, relative to its DC
 *  value: |F̂(f)| / F̂(0) = |cos(π f τ)| / |1 − (2 f τ)²|. Argument: f·τ. */
export function halfSineSpectrum(ft: number): number {
	const d = 1 - 4 * ft * ft;
	if (Math.abs(d) < 1e-9) return Math.PI / 4;
	return Math.abs(Math.cos(Math.PI * ft) / d);
}
