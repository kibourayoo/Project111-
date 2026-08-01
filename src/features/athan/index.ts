/**
 * src/features/athan/index.ts
 *
 * نقطة التصدير الوحيدة لميزة الأذان.
 *
 * شاشة الأذان تستورد من هنا فقط.
 * لا تستورد من: AudioService / PlaylistManager / AudioController / ...
 */

// ── الأنواع ───────────────────────────────────────────────────────────────────
export type {
  Muezzin,
  AthanPlayerState,
  AthanPlayerStatus,
  AthanPlayerResult,
  AthanStatusCallback,
  AthanUnsubscribe,
} from './athan-types';

// ── الكتالوج ──────────────────────────────────────────────────────────────────
export { MUEZZINS, DEFAULT_MUEZZIN }   from './athan-catalog';

// ── الخدمة ────────────────────────────────────────────────────────────────────
export { athanService }                from './athan-service';

// ── الـ Hook ──────────────────────────────────────────────────────────────────
export { useAthanPlayer }              from './use-athan-player';
export type { UseAthanPlayerReturn }   from './use-athan-player';
