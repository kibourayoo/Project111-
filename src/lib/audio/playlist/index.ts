/**
 * src/lib/audio/playlist/index.ts
 * نقطة التصدير الموحدة لطبقة Playlist / Queue.
 */

// ── الأنواع والواجهات ────────────────────────────────────────────────────────
export type {
  PlaylistItem,
  PlaylistState,
  PlaylistStatus,
  PlaylistResult,
  PlaylistError,
  PlaylistErrorCode,
  PlaylistEventType,
  PlaylistEvent,
  PlaylistListener,
  PlaylistUnsubscribe,
  PlaylistStateChangedPayload,
  PlaylistTrackChangedPayload,
  PlaylistQueueChangedPayload,
  PlaylistErrorPayload,
} from './playlist-types';

// ── Class + Singleton ────────────────────────────────────────────────────────
export { PlaylistManager, playlistManager } from './playlist-manager';
