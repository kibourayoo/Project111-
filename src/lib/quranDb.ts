import * as SQLite from 'expo-sqlite';

export interface Surah {
  id: number;
  name: string;
  type: 'مكية' | 'مدنية';
  ayahCount: number;
  pageNumber: number;
}

export interface Juz {
  id: number;
  nameAr: string;
  startSurah: string;
  startPage: number;
}

// بيانات السور الـ 114
const SURAHS: Surah[] = [
  { id: 1,   name: 'الفاتحة',       type: 'مكية',  ayahCount: 7,   pageNumber: 1 },
  { id: 2,   name: 'البقرة',        type: 'مدنية', ayahCount: 286, pageNumber: 2 },
  { id: 3,   name: 'آل عمران',      type: 'مدنية', ayahCount: 200, pageNumber: 50 },
  { id: 4,   name: 'النساء',        type: 'مدنية', ayahCount: 176, pageNumber: 77 },
  { id: 5,   name: 'المائدة',       type: 'مدنية', ayahCount: 120, pageNumber: 106 },
  { id: 6,   name: 'الأنعام',       type: 'مكية',  ayahCount: 165, pageNumber: 128 },
  { id: 7,   name: 'الأعراف',       type: 'مكية',  ayahCount: 206, pageNumber: 151 },
  { id: 8,   name: 'الأنفال',       type: 'مدنية', ayahCount: 75,  pageNumber: 177 },
  { id: 9,   name: 'التوبة',        type: 'مدنية', ayahCount: 129, pageNumber: 187 },
  { id: 10,  name: 'يونس',          type: 'مكية',  ayahCount: 109, pageNumber: 208 },
  { id: 11,  name: 'هود',           type: 'مكية',  ayahCount: 123, pageNumber: 221 },
  { id: 12,  name: 'يوسف',          type: 'مكية',  ayahCount: 111, pageNumber: 235 },
  { id: 13,  name: 'الرعد',         type: 'مدنية', ayahCount: 43,  pageNumber: 249 },
  { id: 14,  name: 'إبراهيم',       type: 'مكية',  ayahCount: 52,  pageNumber: 255 },
  { id: 15,  name: 'الحجر',         type: 'مكية',  ayahCount: 99,  pageNumber: 262 },
  { id: 16,  name: 'النحل',         type: 'مكية',  ayahCount: 128, pageNumber: 267 },
  { id: 17,  name: 'الإسراء',       type: 'مكية',  ayahCount: 111, pageNumber: 282 },
  { id: 18,  name: 'الكهف',         type: 'مكية',  ayahCount: 110, pageNumber: 293 },
  { id: 19,  name: 'مريم',          type: 'مكية',  ayahCount: 98,  pageNumber: 305 },
  { id: 20,  name: 'طه',            type: 'مكية',  ayahCount: 135, pageNumber: 312 },
  { id: 21,  name: 'الأنبياء',      type: 'مكية',  ayahCount: 112, pageNumber: 322 },
  { id: 22,  name: 'الحج',          type: 'مدنية', ayahCount: 78,  pageNumber: 332 },
  { id: 23,  name: 'المؤمنون',      type: 'مكية',  ayahCount: 118, pageNumber: 342 },
  { id: 24,  name: 'النور',         type: 'مدنية', ayahCount: 64,  pageNumber: 350 },
  { id: 25,  name: 'الفرقان',       type: 'مكية',  ayahCount: 77,  pageNumber: 359 },
  { id: 26,  name: 'الشعراء',       type: 'مكية',  ayahCount: 227, pageNumber: 367 },
  { id: 27,  name: 'النمل',         type: 'مكية',  ayahCount: 93,  pageNumber: 377 },
  { id: 28,  name: 'القصص',         type: 'مكية',  ayahCount: 88,  pageNumber: 385 },
  { id: 29,  name: 'العنكبوت',      type: 'مكية',  ayahCount: 69,  pageNumber: 396 },
  { id: 30,  name: 'الروم',         type: 'مكية',  ayahCount: 60,  pageNumber: 404 },
  { id: 31,  name: 'لقمان',         type: 'مكية',  ayahCount: 34,  pageNumber: 411 },
  { id: 32,  name: 'السجدة',        type: 'مكية',  ayahCount: 30,  pageNumber: 415 },
  { id: 33,  name: 'الأحزاب',       type: 'مدنية', ayahCount: 73,  pageNumber: 418 },
  { id: 34,  name: 'سبأ',           type: 'مكية',  ayahCount: 54,  pageNumber: 428 },
  { id: 35,  name: 'فاطر',          type: 'مكية',  ayahCount: 45,  pageNumber: 434 },
  { id: 36,  name: 'يس',            type: 'مكية',  ayahCount: 83,  pageNumber: 440 },
  { id: 37,  name: 'الصافات',       type: 'مكية',  ayahCount: 182, pageNumber: 446 },
  { id: 38,  name: 'ص',             type: 'مكية',  ayahCount: 88,  pageNumber: 453 },
  { id: 39,  name: 'الزمر',         type: 'مكية',  ayahCount: 75,  pageNumber: 458 },
  { id: 40,  name: 'غافر',          type: 'مكية',  ayahCount: 85,  pageNumber: 467 },
  { id: 41,  name: 'فصلت',          type: 'مكية',  ayahCount: 54,  pageNumber: 477 },
  { id: 42,  name: 'الشورى',        type: 'مكية',  ayahCount: 53,  pageNumber: 483 },
  { id: 43,  name: 'الزخرف',        type: 'مكية',  ayahCount: 89,  pageNumber: 489 },
  { id: 44,  name: 'الدخان',        type: 'مكية',  ayahCount: 59,  pageNumber: 496 },
  { id: 45,  name: 'الجاثية',       type: 'مكية',  ayahCount: 37,  pageNumber: 499 },
  { id: 46,  name: 'الأحقاف',       type: 'مكية',  ayahCount: 35,  pageNumber: 502 },
  { id: 47,  name: 'محمد',          type: 'مدنية', ayahCount: 38,  pageNumber: 507 },
  { id: 48,  name: 'الفتح',         type: 'مدنية', ayahCount: 29,  pageNumber: 511 },
  { id: 49,  name: 'الحجرات',       type: 'مدنية', ayahCount: 18,  pageNumber: 515 },
  { id: 50,  name: 'ق',             type: 'مكية',  ayahCount: 45,  pageNumber: 518 },
  { id: 51,  name: 'الذاريات',      type: 'مكية',  ayahCount: 60,  pageNumber: 520 },
  { id: 52,  name: 'الطور',         type: 'مكية',  ayahCount: 49,  pageNumber: 523 },
  { id: 53,  name: 'النجم',         type: 'مكية',  ayahCount: 62,  pageNumber: 526 },
  { id: 54,  name: 'القمر',         type: 'مكية',  ayahCount: 55,  pageNumber: 528 },
  { id: 55,  name: 'الرحمن',        type: 'مدنية', ayahCount: 78,  pageNumber: 531 },
  { id: 56,  name: 'الواقعة',       type: 'مكية',  ayahCount: 96,  pageNumber: 534 },
  { id: 57,  name: 'الحديد',        type: 'مدنية', ayahCount: 29,  pageNumber: 537 },
  { id: 58,  name: 'المجادلة',      type: 'مدنية', ayahCount: 22,  pageNumber: 542 },
  { id: 59,  name: 'الحشر',         type: 'مدنية', ayahCount: 24,  pageNumber: 545 },
  { id: 60,  name: 'الممتحنة',      type: 'مدنية', ayahCount: 13,  pageNumber: 549 },
  { id: 61,  name: 'الصف',          type: 'مدنية', ayahCount: 14,  pageNumber: 551 },
  { id: 62,  name: 'الجمعة',        type: 'مدنية', ayahCount: 11,  pageNumber: 553 },
  { id: 63,  name: 'المنافقون',     type: 'مدنية', ayahCount: 11,  pageNumber: 554 },
  { id: 64,  name: 'التغابن',       type: 'مدنية', ayahCount: 18,  pageNumber: 556 },
  { id: 65,  name: 'الطلاق',        type: 'مدنية', ayahCount: 12,  pageNumber: 558 },
  { id: 66,  name: 'التحريم',       type: 'مدنية', ayahCount: 12,  pageNumber: 560 },
  { id: 67,  name: 'الملك',         type: 'مكية',  ayahCount: 30,  pageNumber: 562 },
  { id: 68,  name: 'القلم',         type: 'مكية',  ayahCount: 52,  pageNumber: 564 },
  { id: 69,  name: 'الحاقة',        type: 'مكية',  ayahCount: 52,  pageNumber: 566 },
  { id: 70,  name: 'المعارج',       type: 'مكية',  ayahCount: 44,  pageNumber: 568 },
  { id: 71,  name: 'نوح',           type: 'مكية',  ayahCount: 28,  pageNumber: 570 },
  { id: 72,  name: 'الجن',          type: 'مكية',  ayahCount: 28,  pageNumber: 572 },
  { id: 73,  name: 'المزمل',        type: 'مكية',  ayahCount: 20,  pageNumber: 574 },
  { id: 74,  name: 'المدثر',        type: 'مكية',  ayahCount: 56,  pageNumber: 575 },
  { id: 75,  name: 'القيامة',       type: 'مكية',  ayahCount: 40,  pageNumber: 577 },
  { id: 76,  name: 'الإنسان',       type: 'مدنية', ayahCount: 31,  pageNumber: 578 },
  { id: 77,  name: 'المرسلات',      type: 'مكية',  ayahCount: 50,  pageNumber: 580 },
  { id: 78,  name: 'النبأ',         type: 'مكية',  ayahCount: 40,  pageNumber: 582 },
  { id: 79,  name: 'النازعات',      type: 'مكية',  ayahCount: 46,  pageNumber: 583 },
  { id: 80,  name: 'عبس',           type: 'مكية',  ayahCount: 42,  pageNumber: 585 },
  { id: 81,  name: 'التكوير',       type: 'مكية',  ayahCount: 29,  pageNumber: 586 },
  { id: 82,  name: 'الانفطار',      type: 'مكية',  ayahCount: 19,  pageNumber: 587 },
  { id: 83,  name: 'المطففين',      type: 'مكية',  ayahCount: 36,  pageNumber: 587 },
  { id: 84,  name: 'الانشقاق',      type: 'مكية',  ayahCount: 25,  pageNumber: 589 },
  { id: 85,  name: 'البروج',        type: 'مكية',  ayahCount: 22,  pageNumber: 590 },
  { id: 86,  name: 'الطارق',        type: 'مكية',  ayahCount: 17,  pageNumber: 591 },
  { id: 87,  name: 'الأعلى',        type: 'مكية',  ayahCount: 19,  pageNumber: 591 },
  { id: 88,  name: 'الغاشية',       type: 'مكية',  ayahCount: 26,  pageNumber: 592 },
  { id: 89,  name: 'الفجر',         type: 'مكية',  ayahCount: 30,  pageNumber: 593 },
  { id: 90,  name: 'البلد',         type: 'مكية',  ayahCount: 20,  pageNumber: 594 },
  { id: 91,  name: 'الشمس',         type: 'مكية',  ayahCount: 15,  pageNumber: 595 },
  { id: 92,  name: 'الليل',         type: 'مكية',  ayahCount: 21,  pageNumber: 595 },
  { id: 93,  name: 'الضحى',         type: 'مكية',  ayahCount: 11,  pageNumber: 596 },
  { id: 94,  name: 'الشرح',         type: 'مكية',  ayahCount: 8,   pageNumber: 596 },
  { id: 95,  name: 'التين',         type: 'مكية',  ayahCount: 8,   pageNumber: 597 },
  { id: 96,  name: 'العلق',         type: 'مكية',  ayahCount: 19,  pageNumber: 597 },
  { id: 97,  name: 'القدر',         type: 'مكية',  ayahCount: 5,   pageNumber: 598 },
  { id: 98,  name: 'البيِّنة',      type: 'مدنية', ayahCount: 8,   pageNumber: 598 },
  { id: 99,  name: 'الزلزلة',       type: 'مدنية', ayahCount: 8,   pageNumber: 599 },
  { id: 100, name: 'العاديات',      type: 'مكية',  ayahCount: 11,  pageNumber: 599 },
  { id: 101, name: 'القارعة',       type: 'مكية',  ayahCount: 11,  pageNumber: 600 },
  { id: 102, name: 'التكاثر',       type: 'مكية',  ayahCount: 8,   pageNumber: 600 },
  { id: 103, name: 'العصر',         type: 'مكية',  ayahCount: 3,   pageNumber: 601 },
  { id: 104, name: 'الهمزة',        type: 'مكية',  ayahCount: 9,   pageNumber: 601 },
  { id: 105, name: 'الفيل',         type: 'مكية',  ayahCount: 5,   pageNumber: 601 },
  { id: 106, name: 'قريش',          type: 'مكية',  ayahCount: 4,   pageNumber: 602 },
  { id: 107, name: 'الماعون',       type: 'مكية',  ayahCount: 7,   pageNumber: 602 },
  { id: 108, name: 'الكوثر',        type: 'مكية',  ayahCount: 3,   pageNumber: 602 },
  { id: 109, name: 'الكافرون',      type: 'مكية',  ayahCount: 6,   pageNumber: 603 },
  { id: 110, name: 'النصر',         type: 'مدنية', ayahCount: 3,   pageNumber: 603 },
  { id: 111, name: 'المسد',         type: 'مكية',  ayahCount: 5,   pageNumber: 603 },
  { id: 112, name: 'الإخلاص',       type: 'مكية',  ayahCount: 4,   pageNumber: 604 },
  { id: 113, name: 'الفلق',         type: 'مكية',  ayahCount: 5,   pageNumber: 604 },
  { id: 114, name: 'الناس',         type: 'مكية',  ayahCount: 6,   pageNumber: 604 },
];

// أسماء الأجزاء بالعربية
const JUZ_NAMES = [
  'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس',
  'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر',
  'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر',
  'السادس عشر', 'السابع عشر', 'الثامن عشر', 'التاسع عشر', 'العشرون',
  'الحادي والعشرون', 'الثاني والعشرون', 'الثالث والعشرون', 'الرابع والعشرون', 'الخامس والعشرون',
  'السادس والعشرون', 'السابع والعشرون', 'الثامن والعشرون', 'التاسع والعشرون', 'الثلاثون',
];

// بيانات الأجزاء: اسم السورة البادئة ورقم صفحتها
const JUZS: Juz[] = [
  { id: 1,  nameAr: `الجزء ${JUZ_NAMES[0]}`,             startSurah: 'الفاتحة',    startPage: 1 },
  { id: 2,  nameAr: `الجزء ${JUZ_NAMES[1]}`,             startSurah: 'البقرة',     startPage: 22 },
  { id: 3,  nameAr: `الجزء ${JUZ_NAMES[2]}`,             startSurah: 'البقرة',     startPage: 42 },
  { id: 4,  nameAr: `الجزء ${JUZ_NAMES[3]}`,             startSurah: 'آل عمران',   startPage: 62 },
  { id: 5,  nameAr: `الجزء ${JUZ_NAMES[4]}`,             startSurah: 'النساء',     startPage: 82 },
  { id: 6,  nameAr: `الجزء ${JUZ_NAMES[5]}`,             startSurah: 'النساء',     startPage: 102 },
  { id: 7,  nameAr: `الجزء ${JUZ_NAMES[6]}`,             startSurah: 'المائدة',    startPage: 121 },
  { id: 8,  nameAr: `الجزء ${JUZ_NAMES[7]}`,             startSurah: 'الأنعام',    startPage: 141 },
  { id: 9,  nameAr: `الجزء ${JUZ_NAMES[8]}`,             startSurah: 'الأعراف',    startPage: 161 },
  { id: 10, nameAr: `الجزء ${JUZ_NAMES[9]}`,             startSurah: 'الأنفال',    startPage: 181 },
  { id: 11, nameAr: `الجزء ${JUZ_NAMES[10]}`,            startSurah: 'التوبة',     startPage: 201 },
  { id: 12, nameAr: `الجزء ${JUZ_NAMES[11]}`,            startSurah: 'هود',        startPage: 221 },
  { id: 13, nameAr: `الجزء ${JUZ_NAMES[12]}`,            startSurah: 'يوسف',       startPage: 241 },
  { id: 14, nameAr: `الجزء ${JUZ_NAMES[13]}`,            startSurah: 'الحجر',      startPage: 261 },
  { id: 15, nameAr: `الجزء ${JUZ_NAMES[14]}`,            startSurah: 'الإسراء',    startPage: 281 },
  { id: 16, nameAr: `الجزء ${JUZ_NAMES[15]}`,            startSurah: 'الكهف',      startPage: 301 },
  { id: 17, nameAr: `الجزء ${JUZ_NAMES[16]}`,            startSurah: 'الأنبياء',   startPage: 321 },
  { id: 18, nameAr: `الجزء ${JUZ_NAMES[17]}`,            startSurah: 'المؤمنون',   startPage: 341 },
  { id: 19, nameAr: `الجزء ${JUZ_NAMES[18]}`,            startSurah: 'الفرقان',    startPage: 361 },
  { id: 20, nameAr: `الجزء ${JUZ_NAMES[19]}`,            startSurah: 'النمل',      startPage: 381 },
  { id: 21, nameAr: `الجزء ${JUZ_NAMES[20]}`,            startSurah: 'العنكبوت',   startPage: 401 },
  { id: 22, nameAr: `الجزء ${JUZ_NAMES[21]}`,            startSurah: 'الأحزاب',    startPage: 421 },
  { id: 23, nameAr: `الجزء ${JUZ_NAMES[22]}`,            startSurah: 'يس',         startPage: 441 },
  { id: 24, nameAr: `الجزء ${JUZ_NAMES[23]}`,            startSurah: 'الزمر',      startPage: 461 },
  { id: 25, nameAr: `الجزء ${JUZ_NAMES[24]}`,            startSurah: 'فصلت',       startPage: 481 },
  { id: 26, nameAr: `الجزء ${JUZ_NAMES[25]}`,            startSurah: 'الأحقاف',    startPage: 501 },
  { id: 27, nameAr: `الجزء ${JUZ_NAMES[26]}`,            startSurah: 'الذاريات',   startPage: 521 },
  { id: 28, nameAr: `الجزء ${JUZ_NAMES[27]}`,            startSurah: 'المجادلة',   startPage: 541 },
  { id: 29, nameAr: `الجزء ${JUZ_NAMES[28]}`,            startSurah: 'الملك',      startPage: 561 },
  { id: 30, nameAr: `الجزء ${JUZ_NAMES[29]}`,            startSurah: 'النبأ',      startPage: 581 },
];

let _db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!_db) {
    _db = await SQLite.openDatabaseAsync('quran.db');
  }
  return _db;
}

export async function initQuranDb(): Promise<void> {
  const db = await getDb();

  // إنشاء جداول السور والأجزاء إن لم تكن موجودة
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS surahs (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      ayah_count INTEGER NOT NULL,
      page_number INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS juzs (
      id INTEGER PRIMARY KEY,
      name_ar TEXT NOT NULL,
      start_surah TEXT NOT NULL,
      start_page INTEGER NOT NULL
    );
  `);

  // تحقق إذا كانت البيانات مُدرجة مسبقاً
  const surahCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM surahs'
  );
  if (surahCount && surahCount.count === 0) {
    // إدراج بيانات السور
    await db.withTransactionAsync(async () => {
      for (const s of SURAHS) {
        await db.runAsync(
          'INSERT INTO surahs (id, name, type, ayah_count, page_number) VALUES (?, ?, ?, ?, ?)',
          [s.id, s.name, s.type, s.ayahCount, s.pageNumber]
        );
      }
    });
  }

  const juzCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM juzs'
  );
  if (juzCount && juzCount.count === 0) {
    // إدراج بيانات الأجزاء
    await db.withTransactionAsync(async () => {
      for (const j of JUZS) {
        await db.runAsync(
          'INSERT INTO juzs (id, name_ar, start_surah, start_page) VALUES (?, ?, ?, ?)',
          [j.id, j.nameAr, j.startSurah, j.startPage]
        );
      }
    });
  }
}

export async function getSurahs(): Promise<Surah[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: number; name: string; type: string; ayah_count: number; page_number: number;
  }>('SELECT * FROM surahs ORDER BY id ASC');
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    type: r.type as 'مكية' | 'مدنية',
    ayahCount: r.ayah_count,
    pageNumber: r.page_number,
  }));
}

export async function getJuzs(): Promise<Juz[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: number; name_ar: string; start_surah: string; start_page: number;
  }>('SELECT * FROM juzs ORDER BY id ASC');
  return rows.map(r => ({
    id: r.id,
    nameAr: r.name_ar,
    startSurah: r.start_surah,
    startPage: r.start_page,
  }));
}
