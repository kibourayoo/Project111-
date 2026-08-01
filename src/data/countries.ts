/**
 * countries.ts
 * قائمة الدول المدعومة — لإضافة دولة جديدة أضف سطرًا واحدًا فقط.
 * file: رمز الملف المقابل في src/data/cities/<code>.json
 */
export type Country = {
  code: string;   // ISO 3166-1 alpha-2 (uppercase)
  name: string;   // الاسم بالعربية
  emoji: string;  // علم الدولة
};

export const COUNTRIES: Country[] = [
  { code: 'SA', name: 'السعودية',               emoji: '🇸🇦' },
  { code: 'DZ', name: 'الجزائر',                emoji: '🇩🇿' },
  { code: 'MA', name: 'المغرب',                 emoji: '🇲🇦' },
  { code: 'TN', name: 'تونس',                   emoji: '🇹🇳' },
  { code: 'LY', name: 'ليبيا',                  emoji: '🇱🇾' },
  { code: 'EG', name: 'مصر',                    emoji: '🇪🇬' },
  { code: 'AE', name: 'الإمارات العربية المتحدة', emoji: '🇦🇪' },
  { code: 'QA', name: 'قطر',                    emoji: '🇶🇦' },
  { code: 'PS', name: 'فلسطين',                 emoji: '🇵🇸' },
];
