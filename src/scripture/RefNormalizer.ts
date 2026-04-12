const BOOK_MAP: Record<string, string> = {
  genesis: "gen", exodus: "exo", leviticus: "lev", numbers: "num",
  deuteronomy: "deu", joshua: "jos", judges: "jdg", ruth: "rut",
  "1 samuel": "1sa", "2 samuel": "2sa", "1 kings": "1ki", "2 kings": "2ki",
  "1 chronicles": "1ch", "2 chronicles": "2ch", ezra: "ezr", nehemiah: "neh",
  esther: "est", job: "job", psalms: "psa", psalm: "psa",
  proverbs: "pro", ecclesiastes: "ecc", "song of solomon": "sng",
  "song of songs": "sng", isaiah: "isa", jeremiah: "jer",
  lamentations: "lam", ezekiel: "ezk", daniel: "dan", hosea: "hos",
  joel: "jol", amos: "amo", obadiah: "oba", jonah: "jon",
  micah: "mic", nahum: "nah", habakkuk: "hab", zephaniah: "zep",
  haggai: "hag", zechariah: "zec", malachi: "mal",
  matthew: "mat", mark: "mrk", luke: "luk", john: "jhn",
  acts: "act", romans: "rom", "1 corinthians": "1co",
  "2 corinthians": "2co", galatians: "gal", ephesians: "eph",
  philippians: "php", colossians: "col", "1 thessalonians": "1th",
  "2 thessalonians": "2th", "1 timothy": "1ti", "2 timothy": "2ti",
  titus: "tit", philemon: "phm", hebrews: "heb", james: "jas",
  "1 peter": "1pe", "2 peter": "2pe", "1 john": "1jn", "2 john": "2jn",
  "3 john": "3jn", jude: "jud", revelation: "rev",
};

const REF_RE = /^(1\s*|2\s*|3\s*)?(genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|samuel|kings|chronicles|ezra|nehemiah|esther|job|psalms?|proverbs|ecclesiastes|song\s+of\s+(solomon|songs)|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|corinthians|galatians|ephesians|philippians|colossians|thessalonians|timothy|titus|philemon|hebrews|james|peter|john|jude|revelation)\s+(\d+)(?::(\d+)(?:-(\d+))?)?\s*$/i;

export interface ParsedRef {
  book: string;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
  canonical: string;
  display: string;
}

export function parseRef(input: string): ParsedRef | null {
  const normalized = input.trim().replace(/\.\s*/g, " ").replace(/\s+/g, " ");
  const match = normalized.match(REF_RE);

  if (!match) {
    // Try normalized OSIS-like input (jhn.3.16)
    const osisMatch = input.match(/^([a-z0-9]{2,3})\.(\d+)\.(\d+)(?:-(\d+))?$/i);
    if (osisMatch) {
      const book = osisMatch[1].toLowerCase();
      const chapter = parseInt(osisMatch[2], 10);
      const verseStart = parseInt(osisMatch[3], 10);
      const verseEnd = osisMatch[4] ? parseInt(osisMatch[4], 10) : undefined;
      return {
        book,
        chapter,
        verseStart,
        verseEnd,
        canonical: `${book}.${chapter}.${verseStart}${verseEnd ? `-${verseEnd}` : ""}`,
        display: input,
      };
    }
    return null;
  }

  const prefix = match[1]?.trim() ?? "";
  const bookName = match[2].toLowerCase();
  const chapter = parseInt(match[3], 10);
  const verseStart = match[4] ? parseInt(match[4], 10) : undefined;
  const verseEnd = match[5] ? parseInt(match[5], 10) : undefined;

  const fullBookName = `${prefix}${bookName}`.trim();
  const bookCode = BOOK_MAP[fullBookName];
  if (!bookCode) return null;

  const canonical = verseStart
    ? `${bookCode}.${chapter}.${verseStart}${verseEnd ? `-${verseEnd}` : ""}`
    : `${bookCode}.${chapter}`;

  const display = `${prefix}${match[2]} ${chapter}${verseStart ? `:${verseStart}${verseEnd ? `-${verseEnd}` : ""}` : ""}`;

  return {
    book: bookCode,
    chapter,
    verseStart,
    verseEnd,
    canonical,
    display,
  };
}

export function formatDisplayRef(parsed: ParsedRef): string {
  return parsed.display;
}
