import * as esbuild from "esbuild";
import { readdirSync, copyFileSync, statSync } from "fs";
import { join, relative } from "path";
import { mkdirSync, rmSync, watch } from "fs";

const outDir = "dist-www";

const staticFileDirs = ["www", "src"];
const staticFilePattern = /\.(html|css|json)$/;

function findFiles(dir, matches, result) {
  for (const file of readdirSync(dir)) {
    const filepath = join(dir, file);
    const stat = statSync(filepath);
    if (stat.isDirectory()) {
      findFiles(filepath, result);
    } else if (matches.test(file)) {
      result.push(filepath);
    }
  }
}

function copyStaticFiles() {
  for (const fromDir of staticFileDirs) {
    const files = [];
    findFiles(fromDir, staticFilePattern, files);
    for (const file of files) {
      const dest = join(outDir, relative(fromDir, file));
      copyFileSync(file, dest);
    }
  }
}

console.log(`Clearing ${outDir}...`);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
console.log("Copying static files...");
copyStaticFiles();

console.log("Running esbuild...");
const ctx = await esbuild.context({
  entryPoints: ["www/main.tsx"],
  outdir: outDir,
  bundle: true,
  format: "esm",
  target: ["es2020"],
  sourcemap: true,
});

if (process.argv.includes("--serve")) {
  await ctx.watch();
  const { hosts, port } = await ctx.serve({
    servedir: "./dist-www/",
  });
  console.log(`Now serving on http://localhost:${port}`);

  for (const dir of ["www", "src"]) {
    watch(dir, { persistent: false, recursive: true }, (eventType, filename) => {
      if (staticFilePattern.test(filename)) {
        console.log(`Copying static files due to change in: ${filename}`);
        copyStaticFiles();
      }
    });
  }
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log("Built successfully.");
}
