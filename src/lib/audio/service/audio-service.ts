/**
 * src/lib/audio/service/audio-service.ts
 *
 * طبقة Integration — AudioService (Facade)
 *
 * ─── المسؤولية ───────────────────────────────────────────────────────────────
 * AudioService هو نقطة الدخول الوحيدة لبقية التطبيق.
 * بقية التطبيق لا تعرف شيئاً عن:
 *   PlaylistManager / AudioController / AudioRuntime / AudioSession
 *
 * ─── ما يعتمد عليه ───────────────────────────────────────────────────────────
 *   playlistManager   ← للعمليات الرئيسية (queue / navigation / events)
 *   audioController   ← للعمليات غير المتاحة عبر PlaylistManager فقط:
 *                         pause() / resume() / stop() / getStatus().currentTime
 *   audioPath()       ← لبناء مسار الملف عند تشغيل سورة
 *
 * ─── العمليات ────────────────────────────────────────────────────────────────
 *
 *   ── التشغيل ──
 *   playSurah(options)       ← تشغيل سورة من حزمة مُثبَّتة
 *   playPlaylist(options)    ← تشغيل قائمة تشغيل كاملة
 *   playSingle(track)        ← تشغيل ملف منفرد
 *
 *   ── التحكم ──
 *   stop()                   ← إيقاف التشغيل (يحتفظ بالقائمة)
 *   pause()                  ← إيقاف مؤقت
 *   resume()                 ← استكمال التشغيل
 *   next()                   ← المسار التالي
 *   previous()               ← المسار السابق
 *
 *   ── القراءة ──
 *   getStatus()              ← لقطة كاملة تجمع Playlist + Controller
 *   getCurrent()             ← المسار الحالي أو null
 *
 *   ── الأحداث ──
 *   on(type, listener)       ← الاشتراك في حدث
 *   off(type, listener)      ← إلغاء الاشتراك
 *
 *   ── دورة الحياة ──
 *   dispose()                ← تحرير الموارد
 *
 * ─── ملاحظة معمارية ─────────────────────────────────────────────────────────
 * pause() / resume() / stop() تستدعي audioController مباشرة لأن PlaylistManager
 * لا يُعرِّض هذه العمليات. هذه الاستدعاءات محصورة داخل AudioService ولا تُكشف
 * لبقية التطبيق.
 */

import { playlistManager } from '../playlist/playlist-manager';
import { audioController } from '../controller';
import { audioPath }       from '../audio-storage';
import { AUDIO_FILE_EXTENSION } from '../constants';

import type {
  AudioTrack,
  AudioServiceResult,
  AudioServiceStatus,
  AudioServiceState,
  AudioServiceEventType,
  AudioServiceListener,
  AudioServiceUnsubscribe,
  SurahPlayOptions,
  PlaylistPlayOptions,
} from './audio-service-types';

// ─── مساعدات بناء النتائج ────────────────────────────────────────────────────

function ok0(message: string): AudioServiceResult<void> {
  return { success: true, message };
}

function fail<T = void>(message: string, cause?: unknown): AudioServiceResult<T> {
  return {
    success: false,
    message,
    error: {
      code:    'PLAY_FAILED',
      message,
      cause,
    },
  };
}

// ─── AudioService ─────────────────────────────────────────────────────────────

export class AudioService {

  // ── التشغيل ─────────────────────────────────────────────────────────────────

  /**
   * يشغّل سورة واحدة من حزمة صوتية مُثبَّتة.
   *
   * يبني مسار الملف من:
   *   audioPath(packageType, packageId) / {surahNumber:3digits}.mp3
   *
   * ثم يستبدل القائمة بعنصر واحد ويبدأ التشغيل.
   */
  async playSurah(options: SurahPlayOptions): Promise<AudioServiceResult<void>> {
    const { packageId, packageType, surahNumber, title, durationSeconds } = options;

    if (surahNumber < 1 || surahNumber > 114) {
      return fail(`رقم السورة غير صالح: ${surahNumber} — يجب أن يكون بين 1 و114`);
    }

    const paddedNum = String(surahNumber).padStart(3, '0');
    const uri       = `${audioPath(packageType, packageId)}/${paddedNum}${AUDIO_FILE_EXTENSION}`;

    const track: AudioTrack = {
      id:    `${packageId}-surah-${paddedNum}`,
      uri,
      title: title ?? `سورة ${surahNumber}`,
      durationSeconds,
    };

    const setResult = await playlistManager.setQueue([track]);
    if (!setResult.success) return setResult;

    return playlistManager.play(0);
  }

  /**
   * يشغّل قائمة تشغيل كاملة.
   * يستبدل القائمة الحالية ويبدأ من startIndex (الافتراضي: 0).
   */
  async playPlaylist(options: PlaylistPlayOptions): Promise<AudioServiceResult<void>> {
    const { items, startIndex = 0 } = options;

    if (items.length === 0) {
      return fail('القائمة فارغة — لا يمكن التشغيل');
    }

    const setResult = await playlistManager.setQueue(items);
    if (!setResult.success) return setResult;

    return playlistManager.play(startIndex);
  }

  /**
   * يشغّل ملفاً صوتياً منفرداً.
   * يستبدل القائمة بعنصر واحد ويبدأ التشغيل.
   */
  async playSingle(track: AudioTrack): Promise<AudioServiceResult<void>> {
    const setResult = await playlistManager.setQueue([track]);
    if (!setResult.success) return setResult;

    return playlistManager.play(0);
  }

  // ── التحكم ──────────────────────────────────────────────────────────────────

  /**
   * يوقف التشغيل مع الاحتفاظ بالقائمة.
   *
   * ملاحظة: يستدعي audioController.stop() مباشرة لأن PlaylistManager
   * لا يُعرِّض عملية إيقاف بدون مسح القائمة.
   * يمزامن PlaylistManager حالته تلقائياً عبر اشتراك 'playback:stopped'.
   */
  async stop(): Promise<AudioServiceResult<void>> {
    const result = await audioController.stop();
    if (!result.success) {
      return fail(result.message, result.error?.cause);
    }
    return ok0('تم إيقاف التشغيل');
  }

  /**
   * يوقف التشغيل مؤقتاً مع الاحتفاظ بالموضع.
   *
   * ملاحظة: يستدعي audioController.pause() مباشرة لأن PlaylistManager
   * لا يُعرِّض عملية الإيقاف المؤقت.
   */
  pause(): AudioServiceResult<void> {
    const result = audioController.pause();
    if (!result.success) {
      return fail(result.message, result.error?.cause);
    }
    return ok0('تم الإيقاف المؤقت');
  }

  /**
   * يستكمل التشغيل من نقطة الإيقاف.
   *
   * ملاحظة: يستدعي audioController.resume() مباشرة لأن PlaylistManager
   * لا يُعرِّض عملية الاستكمال.
   */
  resume(): AudioServiceResult<void> {
    const result = audioController.resume();
    if (!result.success) {
      return fail(result.message, result.error?.cause);
    }
    return ok0('تم استكمال التشغيل');
  }

  /**
   * ينتقل للمسار التالي ويشغّله.
   */
  async next(): Promise<AudioServiceResult<void>> {
    return playlistManager.next();
  }

  /**
   * ينتقل للمسار السابق ويشغّله.
   */
  async previous(): Promise<AudioServiceResult<void>> {
    return playlistManager.previous();
  }

  // ── القراءة ─────────────────────────────────────────────────────────────────

  /**
   * يُعيد لقطة كاملة تجمع حالة Playlist + حالة Controller.
   */
  getStatus(): AudioServiceStatus {
    const playlist   = playlistManager.getStatus();
    const controller = audioController.getStatus();

    return {
      state:        playlist.state         as AudioServiceState,
      current:      playlist.current,
      queue:        playlist.queue,
      currentIndex: playlist.currentIndex,
      hasNext:      playlist.hasNext,
      hasPrevious:  playlist.hasPrevious,
      totalCount:   playlist.totalCount,
      currentTime:  controller.currentTime,
      duration:     controller.duration,
      isBuffering:  controller.isBuffering,
      uri:          controller.uri,
    };
  }

  /**
   * يُعيد المسار الحالي أو null إذا كانت القائمة فارغة.
   */
  getCurrent(): AudioTrack | null {
    return playlistManager.getCurrent();
  }

  // ── الأحداث ─────────────────────────────────────────────────────────────────

  /**
   * يُسجّل مستمعاً لنوع حدث محدد.
   * الأحداث المتاحة:
   *   queue:changed   ← تغيّرت قائمة التشغيل
   *   track:changed   ← تغيّر المسار الحالي
   *   state:changed   ← تغيّرت حالة التشغيل
   *   playlist:ended  ← انتهت القائمة
   *   playback:error  ← خطأ في التشغيل
   *
   * @returns دالة إلغاء الاشتراك
   */
  on<TPayload = unknown>(
    type:     AudioServiceEventType,
    listener: AudioServiceListener<TPayload>,
  ): AudioServiceUnsubscribe {
    return playlistManager.on<TPayload>(type, listener);
  }

  /**
   * يُلغي تسجيل مستمع يدوياً.
   */
  off<TPayload = unknown>(
    type:     AudioServiceEventType,
    listener: AudioServiceListener<TPayload>,
  ): void {
    playlistManager.off<TPayload>(type, listener);
  }

  // ── دورة الحياة ─────────────────────────────────────────────────────────────

  /**
   * يحرّر موارد PlaylistManager.
   * يُستدعى عند إغلاق التطبيق أو عند الحاجة لإعادة التهيئة الكاملة.
   */
  dispose(): void {
    playlistManager.dispose();
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const audioService = new AudioService();
