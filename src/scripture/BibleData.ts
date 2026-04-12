// Bible book data — self-contained, derived from grab-bcv patterns

export const BOOK_CODES = [
  "GEN","EXO","LEV","NUM","DEU","JOS","JDG","RUT","1SA","2SA","1KI","2KI","1CH","2CH","EZR","NEH","EST","JOB","PSA","PRO","ECC","SNG","ISA","JER","LAM","EZK","DAN","HOS","JOL","AMO","OBA","JON","MIC","NAM","HAB","ZEP","HAG","ZEC","MAL","MAT","MRK","LUK","JHN","ACT","ROM","1CO","2CO","GAL","EPH","PHP","COL","1TH","2TH","1TI","2TI","TIT","PHM","HEB","JAS","1PE","2PE","1JN","2JN","3JN","JUD","REV",
] as const;

export type BookCode = (typeof BOOK_CODES)[number];

export const BOOK_NAMES: Record<BookCode, string> = {
  GEN:"Genesis",EXO:"Exodus",LEV:"Leviticus",NUM:"Numbers",DEU:"Deuteronomy",
  JOS:"Joshua",JDG:"Judges",RUT:"Ruth","1SA":"1 Samuel","2SA":"2 Samuel",
  "1KI":"1 Kings","2KI":"2 Kings","1CH":"1 Chronicles","2CH":"2 Chronicles",EZR:"Ezra",
  NEH:"Nehemiah",EST:"Esther",JOB:"Job",PSA:"Psalms",PRO:"Proverbs",
  ECC:"Ecclesiastes",SNG:"Song of Solomon",ISA:"Isaiah",JER:"Jeremiah",LAM:"Lamentations",
  EZK:"Ezekiel",DAN:"Daniel",HOS:"Hosea",JOL:"Joel",AMO:"Amos",
  OBA:"Obadiah",JON:"Jonah",MIC:"Micah",NAM:"Nahum",HAB:"Habakkuk",
  ZEP:"Zephaniah",HAG:"Haggai",ZEC:"Zechariah",MAL:"Malachi",MAT:"Matthew",
  MRK:"Mark",LUK:"Luke",JHN:"John",ACT:"Acts",ROM:"Romans",
  "1CO":"1 Corinthians","2CO":"2 Corinthians",GAL:"Galatians",EPH:"Ephesians",PHP:"Philippians",
  COL:"Colossians","1TH":"1 Thessalonians","2TH":"2 Thessalonians","1TI":"1 Timothy","2TI":"2 Timothy",
  TIT:"Titus",PHM:"Philemon",HEB:"Hebrews",JAS:"James","1PE":"1 Peter",
  "2PE":"2 Peter","1JN":"1 John","2JN":"2 John","3JN":"3 John",JUD:"Jude",REV:"Revelation",
};

const CHAPTER_COUNTS: Record<BookCode, number> = {
  GEN:50,EXO:40,LEV:27,NUM:36,DEU:34,JOS:24,JDG:21,RUT:4,"1SA":31,"2SA":24,
  "1KI":22,"2KI":25,"1CH":29,"2CH":36,EZR:10,NEH:13,EST:10,JOB:42,PSA:150,PRO:31,
  ECC:12,SNG:8,ISA:66,JER:52,LAM:5,EZK:48,DAN:12,HOS:14,JOL:3,AMO:9,
  OBA:1,JON:4,MIC:7,NAM:3,HAB:3,ZEP:3,HAG:2,ZEC:14,MAL:4,MAT:28,
  MRK:16,LUK:24,JHN:21,ACT:28,ROM:16,"1CO":16,"2CO":13,GAL:6,EPH:6,PHP:4,
  COL:4,"1TH":5,"2TH":3,"1TI":6,"2TI":4,TIT:3,PHM:1,HEB:13,JAS:5,"1PE":5,
  "2PE":3,"1JN":5,"2JN":1,"3JN":1,JUD:1,REV:22,
};

// Key chapters only for brevity — full counts available on demand
const VERSE_COUNTS: Record<BookCode, Record<number, number>> = {
  GEN:{1:31,2:25,3:24},EXO:{1:22,2:25,3:22,20:26},LEV:{1:17,2:16},NUM:{1:54,2:34},DEU:{1:46,5:33,6:25,28:68,34:12},
  JOS:{1:18,2:24},JDG:{1:36,2:23},RUT:{1:22,2:23,3:18,4:22},"1SA":{1:28,2:36,3:21,16:23,17:58},"2SA":{1:27,2:32,22:51,23:39,24:25},
  "1KI":{1:53,3:28,8:66,18:46,19:21},"2KI":{1:18,2:25,4:44,5:27},"1CH":{1:54,2:55,16:43,17:27,28:21,29:30},"2CH":{1:17,2:18,7:14},EZR:{1:11,2:70,9:15},
  NEH:{1:11,8:18,9:38},EST:{1:22,4:17},JOB:{1:22,2:13,38:41,42:17},PSA:{1:6,23:6,27:14,37:40,46:11,51:19,91:16,119:176,139:24,150:6},PRO:{1:33,3:35,4:27,31:31},
  ECC:{1:18,3:22,12:14},SNG:{1:17,8:14},ISA:{1:31,6:13,9:6,40:31,41:10,43:2,53:12,55:13,61:11},JER:{1:19,17:27,29:11,31:40,33:3},LAM:{1:22,3:66,5:22},
  EZK:{1:28,37:28,47:23},DAN:{1:21,3:30,6:28,9:27,12:13},HOS:{1:11,6:11,14:9},JOL:{1:20,2:32,3:21},AMO:{1:15,5:27,9:15},
  OBA:{1:21},JON:{1:17,2:10,3:10,4:11},MIC:{1:16,5:15,6:8,7:20},NAM:{1:15,3:19},HAB:{1:17,2:20,3:19},
  ZEP:{1:18,3:20},HAG:{1:15,2:23},ZEC:{1:21,9:17,14:21},MAL:{1:14,3:18,4:6},
  MAT:{1:25,5:48,6:34,7:29,28:20},MRK:{1:45,16:20},LUK:{1:80,2:52,15:32,24:53},JHN:{1:51,3:36,10:42,14:31,15:27,21:25},ACT:{1:26,2:47,28:31},
  ROM:{1:32,8:39,12:21,16:27},"1CO":{1:31,13:13,16:24},"2CO":{1:24,5:21,12:21,13:14},GAL:{1:24,5:26,6:18},EPH:{1:23,2:22,6:24},PHP:{1:30,4:23},
  COL:{1:29,4:18},"1TH":{1:10,5:28},"2TH":{1:12,3:18},"1TI":{1:20,6:21},"2TI":{1:18,4:22},TIT:{1:16,3:15},PHM:{1:25},HEB:{1:14,4:16,11:40,13:25},
  JAS:{1:27,5:20},"1PE":{1:25,5:14},"2PE":{1:21,3:18},"1JN":{1:10,5:21},"2JN":{1:13},"3JN":{1:14},JUD:{1:25},REV:{1:20,3:22,21:27,22:21},
};

export function getChapterCount(book: BookCode): number {
  return CHAPTER_COUNTS[book] ?? 1;
}

export function getVerseCount(book: BookCode, chapter: number): number | null {
  return VERSE_COUNTS[book]?.[chapter] ?? null;
}

export function buildNumericOptions(max: number, start = 1): string[] {
  return Array.from({ length: Math.max(max - start + 1, 0) }, (_, i) => String(i + start));
}

export interface StructuredDraft {
  book: BookCode | "";
  chapter: string;
  startVerse: string;
  endVerse: string;
}

export function isBookCode(v: string): v is BookCode {
  return BOOK_CODES.includes(v as BookCode);
}

export function buildRefString(d: StructuredDraft): string {
  if (!isBookCode(d.book)) return "";
  const name = BOOK_NAMES[d.book];
  if (!d.chapter) return name;
  if (!d.startVerse) return `${name} ${d.chapter}`;
  return d.endVerse
    ? `${name} ${d.chapter}:${d.startVerse}-${d.endVerse}`
    : `${name} ${d.chapter}:${d.startVerse}`;
}

export function parseStructured(input: string): StructuredDraft {
  const empty: StructuredDraft = { book: "", chapter: "", startVerse: "", endVerse: "" };
  const m = input.match(/^(\d?\s?\w+)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/i);
  if (!m) return empty;
  const bookName = m[1].trim();
  for (const code of BOOK_CODES) {
    const name = BOOK_NAMES[code].toLowerCase();
    if (name === bookName.toLowerCase() || code.toLowerCase() === bookName.toLowerCase()) {
      return {
        book: code,
        chapter: m[2] ?? "",
        startVerse: m[3] ?? "",
        endVerse: m[4] ?? "",
      };
    }
  }
  return empty;
}

export function autocompleteBooks(query: string, limit = 8): Array<{ code: BookCode; name: string }> {
  if (!query.trim()) return [];
  const q = query.toLowerCase().replace(/[^a-z0-9]/g, "");
  const results: Array<{ code: BookCode; name: string; match: number }> = [];
  for (const code of BOOK_CODES) {
    const name = BOOK_NAMES[code];
    const clean = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (clean.startsWith(q)) {
      results.push({ code, name, match: 0 });
    } else if (clean.includes(q)) {
      results.push({ code, name, match: 1 });
    }
  }
  return results
    .sort((a, b) => a.match - b.match)
    .slice(0, limit)
    .map(({ code, name }) => ({ code, name }));
}
