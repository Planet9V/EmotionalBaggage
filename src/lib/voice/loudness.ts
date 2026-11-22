// The loudness of a take, for the administrator's comparison: integrated loudness in LUFS (ITU-R BS.1770-4, mono:
// K-weighting, 400 ms blocks overlapping by 75 %, an absolute gate at -70 LUFS and a relative gate 10 LU below) and
// the sample peak in dBFS. The K-weighting filters are worked out for any sample rate (the formulation libebur128
// uses), so a 24 kHz take is measured as a 48 kHz one would be. Pure.

type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number };

function shelf(fs: number): Biquad {
  const G = 3.999843853973347;
  const f0 = 1681.974450955533;
  const Q = 0.7071752369554196;
  const K = Math.tan((Math.PI * f0) / fs);
  const Vh = 10 ** (G / 20);
  const Vb = Vh ** 0.4996667741545416;
  const a0 = 1 + K / Q + K * K;
  return { b0: (Vh + (Vb * K) / Q + K * K) / a0, b1: (2 * (K * K - Vh)) / a0, b2: (Vh - (Vb * K) / Q + K * K) / a0, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q + K * K) / a0 };
}

function highPass(fs: number): Biquad {
  const f0 = 38.13547087602444;
  const Q = 0.5003270373238773;
  const K = Math.tan((Math.PI * f0) / fs);
  const a0 = 1 + K / Q + K * K;
  return { b0: 1, b1: -2, b2: 1, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q + K * K) / a0 };
}

function run(f: Biquad, x: Float64Array): Float64Array {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = f.b0 * x[i]! + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2;
    x2 = x1;
    x1 = x[i]!;
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}

const lufsOf = (meanSquare: number) => -0.691 + 10 * Math.log10(meanSquare);

/** Integrated loudness in LUFS, rounded to 0.1; null for silence or a clip with no sound above the gate. */
export function integratedLoudness(samples: Float32Array, sampleRate: number): number | null {
  if (!samples.length || !(sampleRate > 0)) return null;
  const k = run(highPass(sampleRate), run(shelf(sampleRate), Float64Array.from(samples)));
  const block = Math.round(0.4 * sampleRate);
  const step = Math.round(0.1 * sampleRate);
  const powers: number[] = [];
  if (k.length < block) {
    let s = 0;
    for (const v of k) s += v * v;
    powers.push(s / k.length);
  } else {
    for (let start = 0; start + block <= k.length; start += step) {
      let s = 0;
      for (let i = start; i < start + block; i++) s += k[i]! * k[i]!;
      powers.push(s / block);
    }
  }
  const loud = powers.filter((p) => p > 0 && lufsOf(p) > -70);
  if (!loud.length) return null;
  const relative = lufsOf(loud.reduce((a, b) => a + b, 0) / loud.length) - 10;
  const gated = loud.filter((p) => lufsOf(p) > relative);
  if (!gated.length) return null;
  return Math.round(lufsOf(gated.reduce((a, b) => a + b, 0) / gated.length) * 10) / 10;
}

/** The highest sample, in dBFS rounded to 0.1; null for silence. */
export function samplePeak(samples: Float32Array): number | null {
  let peak = 0;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  return peak > 0 ? Math.round(20 * Math.log10(peak) * 10) / 10 : null;
}
