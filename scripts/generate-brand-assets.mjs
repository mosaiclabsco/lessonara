// SVGs in public/brand are the source for every generated image.
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");
const root = new URL("../", import.meta.url);
const mark = await readFile(new URL("public/brand/logo.svg", root));
const full = await readFile(new URL("public/brand/complete-logo.svg", root));
await writeFile(new URL("src/app/icon.svg", root), mark);
await writeFile(
  new URL("src/app/apple-icon.png", root),
  await sharp(mark).resize(180, 180).png().toBuffer(),
);
const png = await sharp(full, { density: 288 }).png().toBuffer();
await writeFile(new URL("public/brand/complete-logo.png", root), png);
await writeFile(
  new URL("src/lib/brand-image.json", root),
  JSON.stringify({ fullLogoPng: png.toString("base64") }, null, 2) + "\n",
);
const icons = await Promise.all(
  [16, 32, 48].map((size) => sharp(mark).resize(size, size).png().toBuffer()),
);
const header = Buffer.alloc(6 + icons.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icons.length, 4);
let offset = header.length;
icons.forEach((icon, i) => {
  const p = 6 + i * 16,
    size = [16, 32, 48][i];
  header[p] = size;
  header[p + 1] = size;
  header.writeUInt16LE(1, p + 4);
  header.writeUInt16LE(32, p + 6);
  header.writeUInt32LE(icon.length, p + 8);
  header.writeUInt32LE(offset, p + 12);
  offset += icon.length;
});
await writeFile(new URL("src/app/favicon.ico", root), Buffer.concat([header, ...icons]));
await writeFile(
  new URL("desktop/icon.png", root),
  await sharp(mark).resize(1024, 1024).png().toBuffer(),
);
const iconset = new URL("file:///private/tmp/lessonara-brand.iconset/");
await mkdir(iconset, { recursive: true });
for (const size of [16, 32, 128, 256, 512])
  for (const scale of [1, 2])
    await writeFile(
      new URL(`icon_${size}x${size}${scale === 2 ? "@2x" : ""}.png`, iconset),
      await sharp(mark)
        .resize(size * scale, size * scale)
        .png()
        .toBuffer(),
    );
console.log(
  "Brand assets generated from the supplied SVGs. Run iconutil for desktop/icon.icns on macOS.",
);
