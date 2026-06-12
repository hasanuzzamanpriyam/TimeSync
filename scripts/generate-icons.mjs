import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import zlib from "zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, "..", "icons");

function createPNG(width, height, r, g, b) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf) {
    let crc = 0xffffffff;
    const table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c;
    }
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type, "ascii");
    const crcData = Buffer.concat([typeB, data]);
    const crcV = Buffer.alloc(4);
    crcV.writeUInt32BE(crc32(crcData));
    return Buffer.concat([len, typeB, data, crcV]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowSize = 1 + width * 3;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const off = y * rowSize;
    raw[off] = 0;
    for (let x = 0; x < width; x++) {
      const p = off + 1 + x * 3;
      raw[p] = r;
      raw[p + 1] = g;
      raw[p + 2] = b;
    }
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const ICONS = [
  { file: "32x32.png", size: 32 },
  { file: "128x128.png", size: 128 },
  { file: "128x128@2x.png", size: 256 },
  { file: "icon.png", size: 512 },
  { file: "Square30x30Logo.png", size: 30 },
  { file: "Square44x44Logo.png", size: 44 },
  { file: "Square71x71Logo.png", size: 71 },
  { file: "Square89x89Logo.png", size: 89 },
  { file: "Square107x107Logo.png", size: 107 },
  { file: "Square142x142Logo.png", size: 142 },
  { file: "Square150x150Logo.png", size: 150 },
  { file: "Square284x284Logo.png", size: 284 },
  { file: "Square310x310Logo.png", size: 310 },
  { file: "StoreLogo.png", size: 50 },
];

mkdirSync(ICONS_DIR, { recursive: true });

for (const icon of ICONS) {
  const png = createPNG(icon.size, icon.size, 59, 130, 246);
  writeFileSync(join(ICONS_DIR, icon.file), png);
  console.log(`  Created ${icon.file} (${icon.size}x${icon.size})`);
}

// ico format (Windows) — just include the 32x32 PNG as raw (simple approach)
const ico32 = createPNG(32, 32, 59, 130, 246);
writeFileSync(join(ICONS_DIR, "icon.ico"), ico32);
console.log("  Created icon.ico");

// icns is complex; just copy the 256px PNG for now
const icns = createPNG(256, 256, 59, 130, 246);
writeFileSync(join(ICONS_DIR, "icon.icns"), icns);
console.log("  Created icon.icns (placeholder)");

console.log("\nDone! Icons generated in icons/");
