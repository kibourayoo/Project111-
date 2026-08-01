/**
 * معايرة البوصلة — كشف وإدارة حالة المعايرة
 * استناداً إلى مستوى دقة المستشعر (accuracy)
 */

/** مستوى دقة المستشعر */
export type CalibrationLevel =
  | 'uncalibrated'   // لم تبدأ المعايرة بعد
  | 'low'            // دقة منخفضة — يحتاج معايرة
  | 'medium'         // دقة متوسطة — مقبول
  | 'high';          // دقة عالية — ممتاز

/** حالة المعايرة الكاملة */
export interface CalibrationState {
  level: CalibrationLevel;
  /** نسبة الدقة [0, 1] */
  score: number;
  /** هل يحتاج المستخدم للدوران لتحسين المعايرة؟ */
  needsRotation: boolean;
  message: string;
}

/** عتبات الدقة */
const ACCURACY_LOW = 0.3;
const ACCURACY_MED = 0.6;

/**
 * تقييم مستوى المعايرة بناءً على تباين قراءات المغناطيسية
 * يُحسب من آخر N قراءة
 */
export function evaluateCalibration(
  headingHistory: number[]
): CalibrationState {
  if (headingHistory.length < 5) {
    return {
      level: 'uncalibrated',
      score: 0,
      needsRotation: true,
      message: 'جارٍ تهيئة البوصلة…',
    };
  }

  // حساب الانحراف المعياري للقراءات الأخيرة
  const n = Math.min(headingHistory.length, 20);
  const recent = headingHistory.slice(-n);
  const mean = recent.reduce((s, v) => s + v, 0) / n;
  const variance = recent.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  // تحويل الانحراف إلى score — انحراف أقل = دقة أعلى
  // stdDev > 30° = خام جداً، stdDev < 3° = ممتاز
  const normalizedStd = Math.min(stdDev, 30) / 30;
  const score = 1 - normalizedStd;

  if (score < ACCURACY_LOW) {
    return {
      level: 'low',
      score,
      needsRotation: true,
      message: 'حرّك هاتفك على شكل رقم 8 لتحسين الدقة',
    };
  }
  if (score < ACCURACY_MED) {
    return {
      level: 'medium',
      score,
      needsRotation: false,
      message: 'دقة متوسطة — يمكنك البدء',
    };
  }
  return {
    level: 'high',
    score,
    needsRotation: false,
    message: 'البوصلة معايَرة بشكل ممتاز',
  };
}

/**
 * إضافة قراءة جديدة للتاريخ (حد أقصى 50 قراءة)
 */
export function appendHeadingHistory(
  history: number[],
  newHeading: number
): number[] {
  const updated = [...history, newHeading];
  return updated.length > 50 ? updated.slice(-50) : updated;
}
