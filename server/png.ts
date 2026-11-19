import { deflateSync } from "node:zlib";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBytes, data]);
  const output = Buffer.alloc(body.length + 8);
  output.writeUInt32BE(data.length, 0);
  body.copy(output, 4);
  output.writeUInt32BE(crc32(body), body.length + 4);
  return output;
}

export type Pixel = readonly [red: number, green: number, blue: number, alpha?: number];

/** Minimal deterministic RGBA PNG encoder; used only for demo seed images. */
export function createPng(
  width: number,
  height: number,
  pixel: (x: number, y: number) => Pixel,
): Buffer {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;

    for (let x = 0; x < width; x += 1) {
      const [red, green, blue, alpha = 255] = pixel(x, y);
      const offset = rowStart + 1 + x * 4;
      raw[offset] = red;
      raw[offset + 1] = green;
      raw[offset + 2] = blue;
      raw[offset + 3] = alpha;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

/** Small deterministic value noise so compressed demo images have real weight. */
function noise(seed: number, x: number, y: number): number {
  let value = (x * 374761393 + y * 668265263 + seed * 69069) | 0;
  value = (value ^ (value >>> 13)) * 1274126177;
  value = value ^ (value >>> 16);
  return (value & 0xff) / 255;
}

export function sharedSeededPng(): Buffer {
  const width = 720;
  const height = 480;
  const seed = 41;

  return createPng(width, height, (x, y) => {
    const u = x / width;
    const v = y / height;
    const base = mix(236, 255, v);
    const ringA = Math.hypot(u - 0.34, v - 0.52);
    const ringB = Math.hypot(u - 0.66, v - 0.48);
    const glow = Math.max(0, 1 - ringA / 0.31);
    const glowTwo = Math.max(0, 1 - ringB / 0.25);
    const stripe = Math.sin((u + v) * 22) > 0.72 ? 6 : 0;
    const grain = (noise(seed, x, y) - 0.5) * 10;

    return [
      clamp(base - 6 + glow * 12 + glowTwo * 34 + stripe + grain),
      clamp(base + 2 + glow * 42 - glowTwo * 2 + stripe + grain),
      clamp(base - 10 + glow * 34 + glowTwo * 10 + stripe + grain),
    ];
  });
}

export function sunsetSeededPng(): Buffer {
  const width = 640;
  const height = 420;
  const seed = 97;

  return createPng(width, height, (x, y) => {
    const u = x / width;
    const v = y / height;
    const sun = Math.hypot(u - 0.66, v - 0.38);
    const sunGlow = Math.max(0, 1 - sun / 0.2);
    const horizon = v > 0.62 ? (v - 0.62) / 0.38 : 0;
    const grain = (noise(seed, x, y) - 0.5) * 9;

    return [
      clamp(mix(250, 219, v) + sunGlow * 55 + grain),
      clamp(mix(180, 106, v) + sunGlow * 32 + grain),
      clamp(mix(132, 96, v) + sunGlow * 8 - horizon * 22 + grain),
    ];
  });
}

export function coffeeSeededPng(): Buffer {
  const width = 560;
  const height = 400;
  const seed = 173;

  return createPng(width, height, (x, y) => {
    const u = x / width;
    const v = y / height;
    const cup = Math.hypot(u - 0.46, v - 0.54) / 0.27;
    const handle = Math.hypot(u - 0.75, v - 0.52);
    const inCup = cup < 1;
    const inHandle = handle > 0.14 && handle < 0.22 && v < 0.6 && v > 0.4;
    const steam = Math.abs(Math.sin((u - 0.42) * 18 + v * 7)) < 0.12 && v < 0.36;
    const grain = (noise(seed, x, y) - 0.5) * 8;

    if (inCup) {
      return [clamp(118 + grain), clamp(78 + grain), clamp(52 + grain)];
    }
    if (inHandle) {
      return [clamp(196 + grain), clamp(159 + grain), clamp(120 + grain)];
    }
    if (steam) {
      return [clamp(232 + grain), clamp(223 + grain), clamp(210 + grain)];
    }

    return [
      clamp(mix(242, 229, v) + (u - 0.5) * 8 + grain),
      clamp(mix(238, 222, v) + (u - 0.5) * 4 + grain),
      clamp(mix(222, 204, v) - (u - 0.5) * 6 + grain),
    ];
  });
}
