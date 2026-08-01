/**
 * runtime/index.ts
 * نقطة التصدير الموحدة لـ Audio Runtime Layer
 */

// ── الأنواع ───────────────────────────────────────────────────────────────────
export type {
  AudioPlaybackState,
  AudioRuntimeStatus,
  AudioRuntimeResult,
  AudioRuntimeError,
  AudioRuntimeErrorCode,
  AudioRuntimeEventType,
  AudioRuntimeEvent,
  AudioRuntimeListener,
  AudioRuntimeUnsubscribe,
  PlaybackProgressPayload,
  StateChangedPayload,
  PlaybackErrorPayload,
} from './audio-runtime-types';

// ── الكلاس والـ singleton ──────────────────────────────────────────────────────
export { AudioRuntime, audioRuntime } from './audio-runtime';
