import { cp, mkdir, rm } from "node:fs/promises";

const files = ["index.html", "style.css", "code.js", "cs.woff2", "favicon.ico"];

await rm("dist", { recursive: true, force: true });
await mkdir("dist");
await Promise.all(files.map((file) => cp(file, `dist/${file}`)));
