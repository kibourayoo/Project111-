/**
 * src/features/athan/storage/storage-service.ts
 *
 * StorageService — طبقة التخزين المحلي للمؤذّنين المحمَّلين.
 *
 * ─── المسؤولية الوحيدة ───────────────────────────────────────────────────────
 *   save(record)        ← حفظ سجل مؤذّن محمَّل في AsyncStorage
 *   get(id)             ← قراءة سجل مؤذّن واحد
 *   getAll()            ← قراءة جميع السجلات المحفوظة
 *   exists(id)          ← هل المؤذّن محمَّل؟
 *   remove(id)          ← حذف سجل مؤذّن من AsyncStorage
 *   clear()             ← حذف جميع السجلات (للاختبار أو إعادة الضبط)
 *
 * ─── ما لا يفعله ─────────────────────────────────────────────────────────────
 * - لا يتواصل مع الشبكة
 * - لا يعرف UI أو DownloadService أو AudioService
 * - لا يُنفِّذ أي تحميل
 * - لا يحذف ملفات من FileSystem (مسؤولية DownloadService)
 *
 * ─── الاعتمادية الوحيدة ──────────────────────────────────────────────────────
 *   AsyncStorage ← فقط
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  storageOk,
  storageOk0,
  storageFail,
} from './storage-types';
import type { StoredVoiceRecord, StorageResult } from './storage-types';

// ─── ثوابت مفاتيح AsyncStorage ───────────────────────────────────────────────

/** بادئة موحّدة لجميع مفاتيح هذه الطبقة */
const KEY_PREFIX  = 'athan_voice_';

/** مفتاح فهرس يحتوي على قائمة بجميع IDs المحفوظة */
const INDEX_KEY   = 'athan_voice_index';

// ─── دوال مساعدة داخلية ──────────────────────────────────────────────────────

function recordKey(id: string): string {
  return `${KEY_PREFIX}${id}`;
}

// ─── StorageService ───────────────────────────────────────────────────────────

class StorageService {

  // ── save ─────────────────────────────────────────────────────────────────────

  /**
   * يحفظ سجل مؤذّن محمَّل في AsyncStorage.
   * إذا كان السجل موجوداً مسبقاً يُحدَّث.
   *
   * يُستدعى من DownloadService بعد اكتمال التحميل.
   */
  async save(record: StoredVoiceRecord): Promise<StorageResult<void>> {
    try {
      const key   = recordKey(record.id);
      const value = JSON.stringify(record);
      await AsyncStorage.setItem(key, value);
      await this._addToIndex(record.id);
      return storageOk0(`تم حفظ سجل المؤذّن "${record.id}"`);
    } catch (err) {
      return storageFail(
        `فشل حفظ سجل "${record.id}"`,
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }

  // ── get ──────────────────────────────────────────────────────────────────────

  /**
   * يقرأ سجل مؤذّن واحد من AsyncStorage.
   * يُعيد null إذا لم يكن موجوداً.
   */
  async get(id: string): Promise<StorageResult<StoredVoiceRecord | null>> {
    try {
      const raw = await AsyncStorage.getItem(recordKey(id));
      if (!raw) return storageOk(null, `المؤذّن "${id}" غير محمَّل`);
      const record = JSON.parse(raw) as StoredVoiceRecord;
      return storageOk(record);
    } catch (err) {
      return storageFail(
        `فشل قراءة سجل "${id}"`,
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }

  // ── getAll ───────────────────────────────────────────────────────────────────

  /**
   * يقرأ جميع سجلات المؤذّنين المحمَّلين من AsyncStorage.
   * يعتمد على الفهرس لتجنب مسح كل المفاتيح.
   */
  async getAll(): Promise<StorageResult<StoredVoiceRecord[]>> {
    try {
      const ids = await this._readIndex();
      if (ids.length === 0) return storageOk([], 'لا يوجد مؤذّنون محمَّلون');

      const keys  = ids.map(recordKey);
      const pairs = await AsyncStorage.multiGet(keys);
      const records: StoredVoiceRecord[] = [];

      for (const [, value] of pairs) {
        if (value) {
          records.push(JSON.parse(value) as StoredVoiceRecord);
        }
      }

      return storageOk(records, `تم قراءة ${records.length} سجل`);
    } catch (err) {
      return storageFail(
        'فشل قراءة سجلات المؤذّنين',
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }

  // ── exists ───────────────────────────────────────────────────────────────────

  /**
   * يتحقق هل المؤذّن محمَّل ومخزَّن محلياً.
   * تُستدعى من DownloadService.isDownloaded().
   */
  async exists(id: string): Promise<boolean> {
    try {
      const raw = await AsyncStorage.getItem(recordKey(id));
      return raw !== null;
    } catch {
      return false;
    }
  }

  // ── remove ───────────────────────────────────────────────────────────────────

  /**
   * يحذف سجل مؤذّن من AsyncStorage.
   *
   * ملاحظة: لا يحذف الملف الصوتي من FileSystem.
   * DownloadService مسؤول عن حذف الملف ثم استدعاء remove().
   */
  async remove(id: string): Promise<StorageResult<void>> {
    try {
      await AsyncStorage.removeItem(recordKey(id));
      await this._removeFromIndex(id);
      return storageOk0(`تم حذف سجل المؤذّن "${id}"`);
    } catch (err) {
      return storageFail(
        `فشل حذف سجل "${id}"`,
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }

  // ── clear ────────────────────────────────────────────────────────────────────

  /**
   * يحذف جميع سجلات المؤذّنين وفهرسهم.
   * للاختبار وإعادة الضبط فقط.
   */
  async clear(): Promise<StorageResult<void>> {
    try {
      const ids  = await this._readIndex();
      const keys = [INDEX_KEY, ...ids.map(recordKey)];
      await AsyncStorage.multiRemove(keys);
      return storageOk0('تم مسح جميع السجلات');
    } catch (err) {
      return storageFail(
        'فشل مسح السجلات',
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }

  // ── إدارة الفهرس (خاص) ───────────────────────────────────────────────────────

  private async _readIndex(): Promise<string[]> {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  }

  private async _addToIndex(id: string): Promise<void> {
    const ids = await this._readIndex();
    if (!ids.includes(id)) {
      await AsyncStorage.setItem(INDEX_KEY, JSON.stringify([...ids, id]));
    }
  }

  private async _removeFromIndex(id: string): Promise<void> {
    const ids     = await this._readIndex();
    const updated = ids.filter((i) => i !== id);
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(updated));
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const storageService = new StorageService();
