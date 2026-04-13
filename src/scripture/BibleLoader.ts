// Bible data loader — streams BSB.jsonl for verse lookup

export interface BibleVerse {
  ref: string;        // "Gen.1.1"
  book: string;     // "Genesis"
  chapter: string;  // "1"
  verseNum: string;  // "1"
  text: string;
  events?: string[];
  entities?: string[];
}

export interface BibleBook {
  name: string;
  code: string;     // "Gen", "Exo", etc.
  chapters: number;
  versesPerChapter: Record<number, number>;
}

let verseCache: Map<string, BibleVerse> | null = null;
let bookIndex: Map<string, BibleBook> | null = null;
let loadPromise: Promise<void> | null = null;

export async function loadBibleData(): Promise<void> {
  if (loadPromise) return loadPromise;
  if (verseCache) return;

  loadPromise = (async () => {
    const response = await fetch('/bsb.jsonl');
    if (!response.ok) throw new Error('Failed to load Bible data');

    const text = await response.text();
    const lines = text.trim().split('\n');

    verseCache = new Map();
    bookIndex = new Map();

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const verse: BibleVerse = JSON.parse(line);
        verseCache.set(verse.ref, verse);

        // Build book index
        const bookCode = verse.ref.split('.')[0];
        if (!bookIndex.has(bookCode)) {
          bookIndex.set(bookCode, {
            name: verse.book,
            code: bookCode,
            chapters: 0,
            versesPerChapter: {},
          });
        }
        const book = bookIndex.get(bookCode)!;
        const chapter = parseInt(verse.chapter, 10);
        const verseNum = parseInt(verse.verseNum, 10);

        if (chapter > book.chapters) book.chapters = chapter;
        if (!book.versesPerChapter[chapter] || verseNum > book.versesPerChapter[chapter]) {
          book.versesPerChapter[chapter] = verseNum;
        }
      } catch {
        // Skip malformed lines
      }
    }
  })();

  return loadPromise;
}

export async function getVerse(ref: string): Promise<BibleVerse | null> {
  await loadBibleData();
  return verseCache?.get(ref) ?? null;
}

export async function getChapterVerses(bookCode: string, chapter: number): Promise<BibleVerse[]> {
  await loadBibleData();
  const verses: BibleVerse[] = [];

  const book = bookIndex?.get(bookCode);
  if (!book) return verses;

  const maxVerse = book.versesPerChapter[chapter] ?? 0;
  for (let i = 1; i <= maxVerse; i++) {
    const ref = `${bookCode}.${chapter}.${i}`;
    const verse = verseCache?.get(ref);
    if (verse) verses.push(verse);
  }

  return verses;
}

export async function getBooks(): Promise<BibleBook[]> {
  await loadBibleData();
  return Array.from(bookIndex?.values() ?? []).sort((a, b) => {
    // Canonical order: Gen, Exo, Lev...
    const order = ['Gen','Exo','Lev','Num','Deu','Jos','Jdg','Rut','1Sa','2Sa','1Ki','2Ki','1Ch','2Ch','Ezr','Neh','Est','Job','Psa','Pro','Ecc','Sng','Isa','Jer','Lam','Ezk','Dan','Hos','Joe','Amo','Oba','Jon','Mic','Nah','Hab','Zep','Hag','Zec','Mal','Mat','Mrk','Luk','Jhn','Act','Rom','1Co','2Co','Gal','Eph','Php','Col','1Th','2Th','1Ti','2Ti','Tit','Phm','Heb','Jas','1Pe','2Pe','1Jn','2Jn','3Jn','Jud','Rev'];
    return order.indexOf(a.code) - order.indexOf(b.code);
  });
}

export async function getBook(nameOrCode: string): Promise<BibleBook | null> {
  await loadBibleData();
  // Try exact code match first
  if (bookIndex?.has(nameOrCode)) return bookIndex.get(nameOrCode)!;
  // Try name match
  for (const book of bookIndex?.values() ?? []) {
    if (book.name.toLowerCase() === nameOrCode.toLowerCase()) return book;
  }
  return null;
}

export async function parseAndFetch(input: string): Promise<{verses: BibleVerse[]; display: string} | null> {
  await loadBibleData();

  // Parse "Genesis 1:1-3" or "Gen 1:1" etc.
  const match = input.match(/^(\d?\s*\w+)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/i);
  if (!match) return null;

  const [, bookPart, chapterStr, startVerseStr, endVerseStr] = match;
  const chapter = parseInt(chapterStr, 10);
  const startVerse = startVerseStr ? parseInt(startVerseStr, 10) : 1;
  const endVerse = endVerseStr ? parseInt(endVerseStr, 10) : (startVerseStr ? startVerse : undefined);

  const book = await getBook(bookPart.trim());
  if (!book) return null;

  const verses: BibleVerse[] = [];
  const maxChapterVerse = book.versesPerChapter[chapter] ?? 0;
  const actualEnd = endVerse ?? maxChapterVerse;

  for (let v = startVerse; v <= actualEnd && v <= maxChapterVerse; v++) {
    const ref = `${book.code}.${chapter}.${v}`;
    const verse = verseCache?.get(ref);
    if (verse) verses.push(verse);
  }

  const display = endVerse && endVerse !== startVerse
    ? `${book.name} ${chapter}:${startVerse}-${actualEnd}`
    : `${book.name} ${chapter}:${startVerse}`;

  return { verses, display };
}
