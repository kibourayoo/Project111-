/**
 * src/features/audio/index.ts
 *
 * نقطة التصدير الوحيدة لطبقة Application Integration.
 *
 * جميع شاشات التطبيق تستورد من هنا فقط.
 * لا شاشة تستورد من:
 *   src/lib/audio/service
 *   src/lib/audio/playlist
 *   src/lib/audio/controller
 *   src/lib/audio/runtime
 *   src/lib/audio/session
 */

// ── الأنواع ───────────────────────────────────────────────────────────────────
export type {
  SurahTrack,
  AudioPlayerState,
  AudioPlayerStatus,
  AudioPlayerResult,
  AudioPlayerEventType,
  AudioPlayerListener,
  AudioPlayerUnsubscribe,
  SurahChangedPayload,
  ListChangedPayload,
  PlayerStateChangedPayload,
  PlayerErrorPayload,
} from './audio-player-types';

// ── Class + Singleton ─────────────────────────────────────────────────────────
export { AudioPlayer, audioPlayer } from './audio-player';
