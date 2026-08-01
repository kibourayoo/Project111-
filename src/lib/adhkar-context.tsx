import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* الأذكار الافتراضية — مصدر الحقيقة المشترك بين جميع الشاشات */
export const DEFAULT_ADHKAR = [
  'سُبْحَانَ اللَّهِ',
  'الْحَمْدُ لِلَّهِ',
  'اللَّهُ أَكْبَرُ',
];

const STORAGE_KEY = 'adhkar_order';

type AdhkarContextType = {
  adhkar: string[];
  setAdhkar: (list: string[]) => void;
};

const AdhkarContext = createContext<AdhkarContextType>({
  adhkar: DEFAULT_ADHKAR,
  setAdhkar: () => {},
});

export function AdhkarProvider({ children }: { children: React.ReactNode }) {
  const [adhkar, setAdhkarState] = useState<string[]>(DEFAULT_ADHKAR);

  /* تحميل الترتيب المحفوظ عند بدء التطبيق */
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: string[] = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAdhkarState(parsed);
          }
        }
      } catch { /* استخدام القائمة الافتراضية عند حدوث خطأ */ }
    })();
  }, []);

  /* حفظ الترتيب تلقائياً عند كل تغيير */
  const setAdhkar = useCallback((list: string[]) => {
    setAdhkarState(list);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list)).catch(() => {});
  }, []);

  return (
    <AdhkarContext.Provider value={{ adhkar, setAdhkar }}>
      {children}
    </AdhkarContext.Provider>
  );
}

export function useAdhkar() {
  return useContext(AdhkarContext);
}
