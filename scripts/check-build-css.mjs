import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

function stylesheets(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = join(directory, entry.name);
    return entry.isDirectory()
      ? stylesheets(filename)
      : entry.name.endsWith(".css")
        ? [filename]
        : [];
  });
}

// Prerendered HTML locations differ across local builds and the Vercel adapter.
// Check the emitted stylesheet itself, independent of the HTML output layout.
const expected = [".login-art", ".login-form-side", ".sidebar", ".calendar-cell"];
const directory = [join(root, ".vercel/output/static"), join(root, ".next/static")].find(
  existsSync,
);
if (!directory) throw new Error("Production build contains no static output directory.");
const files = stylesheets(directory);
if (!files.length) throw new Error("Production build contains no CSS assets.");
const currentStylesheet = files.find((filename) => {
  const css = readFileSync(filename, "utf8");
  return expected.every((selector) => css.includes(selector)) && !css.includes("#141412");
});
if (!currentStylesheet)
  throw new Error("Production CSS is missing the current login, sidebar or calendar styles.");
console.log("Production CSS verified: login, sidebar and calendar styles are present.");
