// A short WAV made in the test: mono, 16-bit, a 250 Hz tone (five whole cycles a window) whose loudness is given per 20 ms window (0 to 1).
export function toneWav(windows: number[], sampleRate = 24000): Uint8Array {
  const size = sampleRate / 50;
  const n = windows.length * size;
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sampleRate, 24);
  b.writeUInt32LE(sampleRate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 250 * i) / sampleRate) * 30000 * windows[Math.floor(i / size)]!), 44 + i * 2);
  return new Uint8Array(b);
}
