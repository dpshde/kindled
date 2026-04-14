#!/usr/bin/env node
/**
 * Arrow html/svg templates use <!--¤--> placeholders. Unquoted attributes like
 * class=<!--¤--> break HTML parsing when --> terminates early. Quote bindings:
 *   class=${x} -> class="${x}"
 */
import fs from "node:fs";
import path from "node:path";

const ATTR_START = /(^|[\s/>])([@a-zA-Z][\w-]*)=\$\{/g;

function skipString(src, i, quote) {
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === "\\") {
      j += 2;
      continue;
    }
    if (c === quote) return j + 1;
    j++;
  }
  return src.length;
}

function skipLineComment(src, i) {
  let j = i + 2;
  while (j < src.length && src[j] !== "\n") j++;
  return j;
}

function skipBlockComment(src, i) {
  let j = i + 2;
  while (j < src.length - 1) {
    if (src[j] === "*" && src[j + 1] === "/") return j + 2;
    j++;
  }
  return src.length;
}

/** Skip from opening `{` of `${{` to the matching `}` (expression end). */
function skipBraceExpression(src, openBrace) {
  let j = openBrace;
  let depth = 0;
  while (j < src.length) {
    const c = src[j];
    if (c === "/" && src[j + 1] === "/") {
      j = skipLineComment(src, j);
      continue;
    }
    if (c === "/" && src[j + 1] === "*") {
      j = skipBlockComment(src, j);
      continue;
    }
    if (c === "'" || c === '"') {
      j = skipString(src, j, c);
      continue;
    }
    if (c === "`") {
      j++;
      while (j < src.length) {
        const t = src[j];
        if (t === "\\") {
          j += 2;
          continue;
        }
        if (t === "`") {
          j++;
          break;
        }
        if (t === "$" && src[j + 1] === "{") {
          j = skipBraceExpression(src, j + 1) + 1;
          continue;
        }
        j++;
      }
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return j;
    }
    j++;
  }
  return j;
}

function transformTemplateBody(body) {
  let out = "";
  let i = 0;
  ATTR_START.lastIndex = 0;
  let m;
  while ((m = ATTR_START.exec(body)) !== null) {
    const matchStart = m.index;
    const prefix = m[1];
    const attr = m[2];
    const dollar = matchStart + prefix.length + attr.length + 1; // index of "$" in "${...}"
    out += body.slice(i, dollar);
    const openBrace = dollar + 1; // "{" of "${"
    const closeBrace = skipBraceExpression(body, openBrace);
    out += `"${body.slice(dollar, closeBrace + 1)}"`;
    i = closeBrace + 1;
    ATTR_START.lastIndex = i;
  }
  out += body.slice(i);
  return out;
}

function transformFile(filePath) {
  let src = fs.readFileSync(filePath, "utf8");
  const tagNames = ["html", "svg"];
  let out = "";
  let pos = 0;
  while (pos < src.length) {
    let found = -1;
    let tag = "";
    for (const t of tagNames) {
      const idx = src.indexOf(`${t}\``, pos);
      if (idx !== -1 && (found === -1 || idx < found)) {
        found = idx;
        tag = t;
      }
    }
    if (found === -1) {
      out += src.slice(pos);
      break;
    }
    out += src.slice(pos, found);
    const tick = found + tag.length + 1;
    let j = tick;
    while (j < src.length) {
      const c = src[j];
      if (c === "\\") {
        j += 2;
        continue;
      }
      if (c === "`") {
        const body = src.slice(tick, j);
        out += `${tag}\`${transformTemplateBody(body)}\``;
        pos = j + 1;
        break;
      }
      if (c === "$" && src[j + 1] === "{") {
        const openBrace = j + 1;
        j = skipBraceExpression(src, openBrace) + 1;
        continue;
      }
      j++;
    }
    if (j >= src.length) {
      out += src.slice(found);
      break;
    }
  }
  if (out !== src) fs.writeFileSync(filePath, out);
}

const root = path.join(import.meta.dirname, "..");
const targets = [
  "src/ui/icons/icons.ts",
  "src/capture/scripture-capture-view.ts",
  "src/capture/note-capture-view.ts",
  "src/hearth/hearth-view.ts",
  "src/hearth/passage-view.ts",
  "src/hearth/passage-view-modal.ts",
  "src/ritual/threshold-view.ts",
  "src/ritual/quiet-close-view.ts",
];
for (const rel of targets) transformFile(path.join(root, rel));
