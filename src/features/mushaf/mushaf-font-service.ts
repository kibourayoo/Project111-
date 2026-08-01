/**
 * mushaf-font-service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * نظام مركزي لإدارة أصول المصحف القرآني (خطوط + بيانات الصفحات)
 *
 * دورة حياة التحميل الكامل:
 *   1. downloadAll()       — يُنزّل الخطوط TTF وملفات JSON معاً من R2
 *   2. loadFontsIntoRN()   — Font.loadAsync في ذاكرة React Native
 *   3. areFontsReady()     — التحقق النهائي قبل السماح بدخول المصحف
 *
 * التخزين المحلي:
 *   {documentDirectory}/mushaf-fonts/QCF_P{NNN}.TTF
 *   {documentDirectory}/mushaf-fonts/QCF_BSML.TTF
 *   {documentDirectory}/mushaf-fonts/page-{NNN}.json
 *
 * التنزيل:
 *   Cloudflare R2 — pub-1a7d153d7f184dd8bf6ac09f4d74c831.r2.dev
 *     /fonts/QCF_BSML.TTF
 *     /fonts/QCF_P{NNN}.TTF
 *     /pages/page-{NNN}.json
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Directory, File, Paths } from 'expo-file-system';
import * as Font from 'expo-font';
import { fetch } from 'expo/fetch';

// ─── ثوابت ────────────────────────────────────────────────────────────────────

/** مجلد تخزين أصول المصحف داخل documentDirectory */
export const MUSHAF_FONTS_DIR = 'mushaf-fonts';

const R2_FONTS = 'https://pub-1a7d153d7f184dd8bf6ac09f4d74c831.r2.dev/fonts';
const R2_PAGES = 'https://pub-1a7d153d7f184dd8bf6ac09f4d74c831.r2.dev/pages';

/** إجمالي صفحات المصحف */
export const MUSHAF_TOTAL_PAGES = 604;

/** الحد الأدنى لحجم ملف TTF الصالح (بالبايت) */
const MIN_FONT_BYTES = 4096;  // 4 KB
/** الحد الأدنى لحجم ملف JSON الصالح (بالبايت) */
const MIN_JSON_BYTES = 10;    // 10 B

// ─── تعريف الخطوط ─────────────────────────────────────────────────────────────

export interface MushafFontDef {
  fileName: string;
  fontName: string;
  url: string;
}

/** خط البسملة */
const FONT_BSML: MushafFontDef = {
  fileName: 'QCF_BSML.TTF',
  fontName: 'QCF_BSML',
  url: `${R2_FONTS}/QCF_BSML.TTF`,
};

/** خط كل صفحة من صفحات المصحف */
function pageFontDef(pageNum: number): MushafFontDef {
  const pad = String(pageNum).padStart(3, '0');
  return {
    fileName: `QCF_P${pad}.TTF`,
    fontName: `QCF_P${pad}`,
    url: `${R2_FONTS}/QCF_P${pad}.TTF`,
  };
}

/** اسم ملف JSON لصفحة */
function pageJsonFileName(pageNum: number): string {
  return `page-${String(pageNum).padStart(3, '0')}.json`;
}

/** رابط JSON لصفحة من R2 */
function pageJsonUrl(pageNum: number): string {
  return `${R2_PAGES}/${pageJsonFileName(pageNum)}`;
}

/** جميع الخطوط المطلوبة (BSML + P001–P604) */
export function getAllFontDefs(): MushafFontDef[] {
  const fonts: MushafFontDef[] = [FONT_BSML];
  for (let i = 1; i <= MUSHAF_TOTAL_PAGES; i++) {
    fonts.push(pageFontDef(i));
  }
  return fonts;
}

// للتوافق مع الكود القديم الذي يستورد MUSHAF_FONTS
export const MUSHAF_FONTS: MushafFontDef[] = [FONT_BSML, pageFontDef(1)];

// ─── أنواع النتائج ────────────────────────────────────────────────────────────

export interface FontCheckResult {
  allPresent: boolean;
  missing: string[];
}

export interface DownloadProgress {
  /** المرحلة الحالية */
  phase: 'fonts' | 'pages';
  /** اسم الملف الجاري تنزيله */
  currentFile: string;
  /** عدد الملفات المكتملة في هذه المرحلة */
  completed: number;
  /** إجمالي ملفات هذه المرحلة */
  total: number;
  /** النسبة المئوية لهذه المرحلة (0–100) */
  phasePercent: number;
  /** النسبة المئوية الكلية (0–100) */
  overallPercent: number;
}

/** للتوافق مع الكود القديم */
export type FontDownloadProgress = DownloadProgress;

export type FontDownloadCallback = (progress: DownloadProgress) => void;

export interface FontDownloadResult {
  success: boolean;
  error?: string;
}

// ─── MushafFontService ────────────────────────────────────────────────────────

class MushafFontService {
  private _loaded = false;

  // ── أداة مساعدة لتنزيل ملف واحد وكتابته ────────────────────────────────────
  private async _downloadFile(
    url: string,
    dir: InstanceType<typeof Directory>,
    fileName: string,
    minBytes: number,
  ): Promise<FontDownloadResult> {
    const file = new File(dir, fileName);

    // تجاوز إن كان الملف صالحاً
    if (file.exists && file.size >= minBytes) {
      return { success: true };
    }

    const response = await fetch(url);
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status} — ${url}`,
      };
    }

    const buffer = await response.arrayBuffer();

    if (file.exists) file.delete();
    file.create();
    const handle = file.open();
    try {
      handle.writeBytes(new Uint8Array(buffer));
    } finally {
      handle.close();
    }

    const saved = new File(dir, fileName);
    if (!saved.exists || saved.size < minBytes) {
      return {
        success: false,
        error: `حجم غير صالح بعد الحفظ: ${fileName} (${saved.size ?? 0} بايت)`,
      };
    }
    return { success: true };
  }

  // ── checkFontsExist ─────────────────────────────────────────────────────────

  checkFontsExist(): FontCheckResult {
    const dir = new Directory(Paths.document, MUSHAF_FONTS_DIR);
    if (!dir.exists) {
      return {
        allPresent: false,
        missing: getAllFontDefs().map((f) => f.fileName),
      };
    }
    const missing: string[] = [];
    for (const font of getAllFontDefs()) {
      const file = new File(dir, font.fileName);
      if (!file.exists || file.size < MIN_FONT_BYTES) {
        missing.push(font.fileName);
      }
    }
    return { allPresent: missing.length === 0, missing };
  }

  // ── downloadAll ─────────────────────────────────────────────────────────────

  /**
   * يُنزّل أصول المصحف الكاملة من R2:
   *   المرحلة ١: خطوط TTF  (BSML + P001–P604)
   *   المرحلة ٢: ملفات JSON (page-001.json … page-604.json)
   *
   * يتجاوز الملفات الموجودة مسبقاً بشكل تلقائي.
   */
  async downloadAll(
    onProgress?: FontDownloadCallback,
  ): Promise<FontDownloadResult> {
    try {
      const dir = new Directory(Paths.document, MUSHAF_FONTS_DIR);
      if (!dir.exists) dir.create({ intermediates: true });

      const fonts = getAllFontDefs();
      const totalFonts = fonts.length;
      const totalPages = MUSHAF_TOTAL_PAGES;
      const totalFiles = totalFonts + totalPages;

      // ── المرحلة ١: الخطوط ──────────────────────────────────────────────────
      for (let i = 0; i < totalFonts; i++) {
        const font = fonts[i];
        const overallDone = i;

        onProgress?.({
          phase: 'fonts',
          currentFile: font.fileName,
          completed: i,
          total: totalFonts,
          phasePercent: Math.round((i / totalFonts) * 100),
          overallPercent: Math.round((overallDone / totalFiles) * 100),
        });

        const result = await this._downloadFile(
          font.url, dir, font.fileName, MIN_FONT_BYTES,
        );
        if (!result.success) {
          return { success: false, error: `خطأ في تنزيل الخط: ${result.error}` };
        }

        onProgress?.({
          phase: 'fonts',
          currentFile: font.fileName,
          completed: i + 1,
          total: totalFonts,
          phasePercent: Math.round(((i + 1) / totalFonts) * 100),
          overallPercent: Math.round(((overallDone + 1) / totalFiles) * 100),
        });
      }

      // ── المرحلة ٢: ملفات JSON ──────────────────────────────────────────────
      for (let p = 1; p <= totalPages; p++) {
        const fileName = pageJsonFileName(p);
        const url = pageJsonUrl(p);
        const overallDone = totalFonts + (p - 1);

        onProgress?.({
          phase: 'pages',
          currentFile: fileName,
          completed: p - 1,
          total: totalPages,
          phasePercent: Math.round(((p - 1) / totalPages) * 100),
          overallPercent: Math.round((overallDone / totalFiles) * 100),
        });

        const result = await this._downloadFile(
          url, dir, fileName, MIN_JSON_BYTES,
        );
        if (!result.success) {
          return { success: false, error: `خطأ في تنزيل الصفحة: ${result.error}` };
        }

        onProgress?.({
          phase: 'pages',
          currentFile: fileName,
          completed: p,
          total: totalPages,
          phasePercent: Math.round((p / totalPages) * 100),
          overallPercent: Math.round(((overallDone + 1) / totalFiles) * 100),
        });
      }

      return { success: true };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  /**
   * للتوافق مع الكود القديم — يُنزّل الخطوط الأساسية فقط
   * @deprecated استخدم downloadAll() بدلاً منه
   */
  async downloadFonts(
    fontsToDownload: MushafFontDef[] = MUSHAF_FONTS,
    onProgress?: FontDownloadCallback,
  ): Promise<FontDownloadResult> {
    try {
      const dir = new Directory(Paths.document, MUSHAF_FONTS_DIR);
      if (!dir.exists) dir.create({ intermediates: true });

      const total = fontsToDownload.length;
      for (let i = 0; i < total; i++) {
        const font = fontsToDownload[i];

        onProgress?.({
          phase: 'fonts',
          currentFile: font.fileName,
          completed: i,
          total,
          phasePercent: Math.round((i / total) * 100),
          overallPercent: Math.round((i / total) * 100),
        });

        const result = await this._downloadFile(
          font.url, dir, font.fileName, MIN_FONT_BYTES,
        );
        if (!result.success) {
          return { success: false, error: result.error };
        }

        onProgress?.({
          phase: 'fonts',
          currentFile: font.fileName,
          completed: i + 1,
          total,
          phasePercent: Math.round(((i + 1) / total) * 100),
          overallPercent: Math.round(((i + 1) / total) * 100),
        });
      }
      return { success: true };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  // ── loadFontsIntoRN ─────────────────────────────────────────────────────────

  async loadFontsIntoRN(): Promise<FontDownloadResult> {
    if (this._loaded) return { success: true };

    try {
      const dir = new Directory(Paths.document, MUSHAF_FONTS_DIR);
      const fontMap: Record<string, { uri: string }> = {};

      for (const font of getAllFontDefs()) {
        const file = new File(dir, font.fileName);
        if (!file.exists) {
          return {
            success: false,
            error: `ملف الخط غير موجود: ${font.fileName}`,
          };
        }
        fontMap[font.fontName] = { uri: file.uri };
      }

      await Font.loadAsync(fontMap);
      this._loaded = true;
      return { success: true };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  // ── areFontsReady ───────────────────────────────────────────────────────────

  areFontsReady(): boolean {
    if (!this._loaded) return false;
    return this.checkFontsExist().allPresent;
  }

  // ── checkPagesExist ─────────────────────────────────────────────────────────

  /** فحص وجود ملفات JSON للصفحات محلياً */
  checkPagesExist(): { allPresent: boolean; missingCount: number } {
    const dir = new Directory(Paths.document, MUSHAF_FONTS_DIR);
    if (!dir.exists) return { allPresent: false, missingCount: MUSHAF_TOTAL_PAGES };
    let missing = 0;
    for (let p = 1; p <= MUSHAF_TOTAL_PAGES; p++) {
      const file = new File(dir, pageJsonFileName(p));
      if (!file.exists || file.size < MIN_JSON_BYTES) missing++;
    }
    return { allPresent: missing === 0, missingCount: missing };
  }

  // ── getFontUri ──────────────────────────────────────────────────────────────

  getFontUri(fontName: string): string | null {
    const def = getAllFontDefs().find((f) => f.fontName === fontName);
    if (!def) return null;
    const dir = new Directory(Paths.document, MUSHAF_FONTS_DIR);
    const file = new File(dir, def.fileName);
    return file.exists ? file.uri : null;
  }

  resetLoaded(): void {
    this._loaded = false;
  }
}

export const mushafFontService = new MushafFontService();
