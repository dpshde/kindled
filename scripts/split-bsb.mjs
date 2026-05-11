#!/usr/bin/env node
/**
 * Splits public/bsb.jsonl into per-book JSONL files under public/data/bible/.
 * Each file is named by OSIS code (lowercase): gen.jsonl, exo.jsonl, etc.
 * Run with: node scripts/split-bsb.mjs
 */

import {
  readFileSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const srcPath = join(root, "bsb.jsonl");
const outDir = join(root, "public", "data", "bible");

const BSB_PREFIX_TO_OSIS = {
  Gen: "gen",
  Exod: "exo",
  Lev: "lev",
  Num: "num",
  Deut: "deu",
  Josh: "jos",
  Judg: "jdg",
  Ruth: "rut",
  "1Sam": "1sa",
  "2Sam": "2sa",
  "1Kgs": "1ki",
  "2Kgs": "2ki",
  "1Chr": "1ch",
  "2Chr": "2ch",
  Ezra: "ezr",
  Neh: "neh",
  Esth: "est",
  Job: "job",
  Ps: "psa",
  Prov: "pro",
  Eccl: "ecc",
  Song: "sng",
  Isa: "isa",
  Jer: "jer",
  Lam: "lam",
  Ezek: "ezk",
  Dan: "dan",
  Hos: "hos",
  Joel: "jol",
  Amos: "amo",
  Obad: "oba",
  Jonah: "jon",
  Mic: "mic",
  Nah: "nam",
  Hab: "hab",
  Zeph: "zep",
  Hag: "hag",
  Zech: "zec",
  Mal: "mal",
  Matt: "mat",
  Mark: "mrk",
  Luke: "luk",
  John: "jhn",
  Acts: "act",
  Rom: "rom",
  "1Cor": "1co",
  "2Cor": "2co",
  Gal: "gal",
  Eph: "eph",
  Phil: "php",
  Col: "col",
  "1Thess": "1th",
  "2Thess": "2th",
  "1Tim": "1ti",
  "2Tim": "2ti",
  Titus: "tit",
  Phlm: "phm",
  Heb: "heb",
  Jas: "jas",
  "1Pet": "1pe",
  "2Pet": "2pe",
  "1John": "1jn",
  "2John": "2jn",
  "3John": "3jn",
  Jude: "jud",
  Rev: "rev",
};

mkdirSync(outDir, { recursive: true });

for (const f of readdirSync(outDir)) {
  if (f.endsWith(".jsonl")) unlinkSync(join(outDir, f));
}

const raw = readFileSync(srcPath, "utf-8");
const lines = raw.trim().split("\n");
const buckets = new Map();

for (const line of lines) {
  if (!line.trim()) continue;
  const obj = JSON.parse(line);
  const prefix = obj.ref?.split(".")[0];
  const osisLower = BSB_PREFIX_TO_OSIS[prefix];
  if (!osisLower) continue;
  if (!buckets.has(osisLower)) buckets.set(osisLower, []);
  buckets.get(osisLower).push(line);
}

for (const [osis, entries] of buckets) {
  writeFileSync(join(outDir, `${osis}.jsonl`), entries.join("\n") + "\n");
}

console.log(
  `Split ${lines.length} verses into ${buckets.size} book files in ${outDir}`,
);
