import { copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const outDir = join(root, "mobile-www");
const apiBase = (process.env.MOBILE_API_BASE || "").replace(/\/$/, "");

await rm(outDir, { recursive: true, force: true });
await mkdir(join(outDir, "assets"), { recursive: true });

for (const file of ["index.html", "styles.css", "app.js", "manifest.webmanifest", "icon.svg", "sw.js"]) {
  await copyFile(join(root, file), join(outDir, file));
}

const privateAssets = new Set(["lingyu-voice-reference.flac", "clone-voice-test.mp3"]);

for (const file of await readdir(join(root, "assets"))) {
  if (privateAssets.has(file)) continue;
  await copyFile(join(root, "assets", file), join(outDir, "assets", file));
}

await writeFile(
  join(outDir, "config.js"),
  `window.LINGYU_CONFIG = {\n  apiBase: ${JSON.stringify(apiBase)}\n};\n`,
  "utf8"
);

console.log(`Prepared mobile web assets in ${outDir}`);
console.log(apiBase ? `Mobile API base: ${apiBase}` : "Mobile API base is empty. Set MOBILE_API_BASE before packaging.");
