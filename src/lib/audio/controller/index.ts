/**
 * controller/index.ts
 * نقطة التصدير الموحدة لـ Audio Controller Layer
 */

// ── الأنواع ───────────────────────────────────────────────────────────────────
export type {
  AudioControllerState,
  AudioControllerStatus,
  AudioControllerResult,
  AudioControllerError,
  AudioControllerErrorCode,
  AudioControllerEventType,
  AudioControllerEvent,
  AudioControllerListener,
  AudioControllerUnsubscribe,
  ControllerStateChangedPayload,
  ControllerProgressPayload,
  ControllerErrorPayload,
} from './audio-controller-types';

// ── الكلاس والـ singleton ──────────────────────────────────────────────────────
export { AudioController, audioController } from './audio-controller';
