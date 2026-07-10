import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFeatureListPdf, featureListFilename } from "../lib/feature-list-pdf";

async function main() {
  const generatedAt = new Date();
  const pdf = await buildFeatureListPdf(generatedAt);
  const filename = featureListFilename(generatedAt);
  const outDir = path.join(process.cwd(), "brand");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, filename);
  await writeFile(outPath, pdf);
  console.log(outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
