/**
 * src/lib/audio/service/index.ts
 * نقطة التصدير الموحدة لطبقة AudioService.
 */

// ── الأنواع ───────────────────────────────────────────────────────────────────
export type {
  AudioTrack,
  AudioServiceState,
  AudioServiceResult,
  AudioServiceStatus,
  AudioServiceEventType,
  AudioServiceEvent,
  AudioServiceListener,
  AudioServiceUnsubscribe,
  SurahPlayOptions,
  PlaylistPlayOptions,
} from './audio-service-types';

// ── Class + Singleton ─────────────────────────────────────────────────────────
export { AudioService, audioService } from './audio-service';
