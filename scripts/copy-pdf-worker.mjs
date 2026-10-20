import { copyFile, mkdir, cp } from "node:fs/promises";
await mkdir(new URL("../public/", import.meta.url), { recursive: true });
await copyFile(
  new URL("../node_modules/pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
  new URL("../public/pdf.worker.min.mjs", import.meta.url),
);

for (const folder of ["cmaps", "standard_fonts", "wasm"])
  await cp(
    new URL(`../node_modules/pdfjs-dist/${folder}/`, import.meta.url),
    new URL(`../public/pdf-assets/${folder}/`, import.meta.url),
    { recursive: true },
  );
