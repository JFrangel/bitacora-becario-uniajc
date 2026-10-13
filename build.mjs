import { copyFile, mkdir } from "node:fs/promises";

const output = new URL("./dist-public/", import.meta.url);
await mkdir(output, { recursive: true });
for (const file of ["index.html", "app.js", "styles.css"]) {
  await copyFile(new URL(`./${file}`, import.meta.url), new URL(file, output));
}
