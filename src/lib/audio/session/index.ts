/**
 * session/index.ts
 * نقطة التصدير الموحدة لـ Audio Session Layer
 */

// ── الأنواع ───────────────────────────────────────────────────────────────────
export type {
  AudioSessionState,
  AudioSessionConfig,
  AudioSessionResult,
  AudioSessionError,
  AudioSessionErrorCode,
  AudioSessionEventType,
  AudioSessionEvent,
  AudioSessionListener,
  AudioSessionUnsubscribe,
  AudioInterruptionMode,
  AudioRoute,
  SessionStateChangedPayload,
  SessionConfiguredPayload,
  SessionErrorPayload,
} from './audio-session-types';

// ── الثوابت ───────────────────────────────────────────────────────────────────
export { DEFAULT_SESSION_CONFIG } from './audio-session-types';

// ── الكلاس والـ singleton ──────────────────────────────────────────────────────
export { AudioSession, audioSession } from './audio-session';
