/**
 * download-extractor.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * طبقة فك الضغط — المرحلة 22.
 *
 * المسؤولية الوحيدة:
 *   فك ضغط ملف ZIP من مسار مؤقت إلى مجلد وجهة.
 *
 * ما تفعله:
 *   1. التحقق من وجود ملف ZIP.
 *   2. إنشاء مجلد الوجهة إذا لم يكن موجوداً.
 *   3. فك الضغط بالكامل عبر react-native-zip-archive.
 *   4. التأكد أن مجلد الوجهة موجود بعد الاستخراج.
 *   5. إعادة ExtractResult (نجاح/فشل + المسار).
 *
 * ما لا تفعله (محظور صارم):
 *   - لا قراءة manifest.json
 *   - لا checksum أو Validation
 *   - لا PackageState
 *   - لا installPackage
 *   - لا Registry
 *   - لا حذف ملف ZIP
 *
 * عند الفشل:
 *   يُحذف المجلد الجزئي (إن وُجد) — ملف ZIP يُترك للـ Worker.
 *
 * المكتبة المستخدمة: react-native-zip-archive
 *   - native — لا تحمّل الذاكرة بالكامل
 *   - واجهة بسيطة: unzip(source, target): Promise<string>
 *   - مُحافظ عليها ومستقرة (إصدارات SDK 55 تدعمها)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Directory, File, Paths } from 'expo-file-system';
import { unzip }                  from 'react-native-zip-archive';

// ─── ExtractResult ────────────────────────────────────────────────────────────

/**
 * نتيجة عملية فك الضغط.
 *
 * success = true  → extractedPath يحتوي على المسار الكامل للمجلد.
 * success = false → error يحتوي على سبب الفشل، extractedPath فارغ.
 */
export interface ExtractResult {
  readonly success:       boolean;
  readonly extractedPath: string;
  readonly error?:        string;
}

// ─── IZipExtractor ────────────────────────────────────────────────────────────

/**
 * واجهة طبقة فك الضغط.
 *
 * يعتمد Worker على هذه الواجهة فقط — لا على DownloadExtractor مباشرة.
 * يمكن استبدال DownloadExtractor بأي تنفيذ آخر بدون تعديل Worker.
 *
 * @param zipPath  - مسار نسبي لملف ZIP (نسبة لـ Paths.cache)
 * @param destPath - مسار نسبي للمجلد الهدف (نسبة لـ Paths.cache)
 */
export interface IZipExtractor {
  extract(zipPath: string, destPath: string): Promise<ExtractResult>;
}

// ─── DownloadExtractor ────────────────────────────────────────────────────────

/**
 * تنفيذ حقيقي لـ IZipExtractor — يستخدم react-native-zip-archive.
 *
 * دورة الحياة:
 *   1. حلّ zipPath و destPath إلى مسارات مطلقة بالنسبة لـ Paths.cache
 *   2. تحقق من وجود ملف ZIP — إذا غاب: فشل فوري
 *   3. أنشئ مجلد الوجهة إذا لم يكن موجوداً
 *   4. استدعِ unzip(absZipPath, absDestPath)
 *   5. تأكد أن مجلد الوجهة موجود بعد الاستخراج
 *   6. عند الفشل: احذف المجلد الجزئي (ولا تلمس ZIP)
 *   7. أعد ExtractResult
 */
export class DownloadExtractor implements IZipExtractor {

  async extract(zipPath: string, destPath: string): Promise<ExtractResult> {
    const absZip  = this._resolveAbsPath(zipPath);
    const absDestDir = this._resolveAbsPath(destPath);

    const zipFile = new File(absZip);
    const destDir = new Directory(absDestDir);

    // ── 1. تحقق من وجود ملف ZIP ───────────────────────────────────────────────
    if (!zipFile.exists) {
      return {
        success:       false,
        extractedPath: '',
        error:         `ملف ZIP غير موجود: ${zipPath}`,
      };
    }

    // ── 2. أنشئ مجلد الوجهة إذا لم يكن موجوداً ───────────────────────────────
    if (!destDir.exists) {
      destDir.create({ intermediates: true });
    }

    // ── 3. فك الضغط ───────────────────────────────────────────────────────────
    try {
      // unzip تتوقع مسارات نظام ملفات بدون بادئة file://
      const fsZip  = this._toFsPath(absZip);
      const fsDest = this._toFsPath(absDestDir);

      await unzip(fsZip, fsDest);

      // ── 4. تأكد من وجود مجلد الوجهة بعد الاستخراج ────────────────────────
      if (!new Directory(absDestDir).exists) {
        return {
          success:       false,
          extractedPath: '',
          error:         'فشل فك الضغط — مجلد الوجهة غير موجود بعد الاستخراج',
        };
      }

      return {
        success:       true,
        extractedPath: fsDest,
      };

    } catch (err) {
      // ── 5. عند الفشل: احذف المجلد الجزئي ولا تلمس ZIP ──────────────────────
      try {
        if (new Directory(absDestDir).exists) {
          new Directory(absDestDir).delete();
        }
      } catch {
        // تجاهل أخطاء التنظيف
      }

      return {
        success:       false,
        extractedPath: '',
        error: err instanceof Error
          ? err.message
          : 'خطأ غير متوقع أثناء فك الضغط',
      };
    }
  }

  // ── مساعدات المسار ──────────────────────────────────────────────────────────

  /**
   * يُحوّل مساراً نسبياً إلى URI مطلق بالنسبة لـ Paths.cache.
   * مثال: "audio/temp/job-abc.zip" → "file:///data/user/.../cache/audio/temp/job-abc.zip"
   */
  private _resolveAbsPath(relativePath: string): string {
    const base = Paths.cache.uri.replace(/\/+$/, '');
    return `${base}/${relativePath}`;
  }

  /**
   * يُزيل بادئة file:// من URI للحصول على مسار نظام الملفات المباشر.
   * react-native-zip-archive تحتاج المسار بدون file://.
   *
   * مثال: "file:///data/user/0/.../cache/audio/temp/x.zip"
   *   → "/data/user/0/.../cache/audio/temp/x.zip"
   */
  private _toFsPath(uri: string): string {
    return uri.startsWith('file://') ? uri.slice(7) : uri;
  }
}
