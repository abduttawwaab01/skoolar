'use client';

import { useEffect } from 'react';
import { useLanguage } from '@/hooks/use-language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { language } = useLanguage();

  useEffect(() => {
    const html = document.documentElement;
    html.lang = language || 'en';
    html.dir = language === 'ar' ? 'rtl' : 'ltr';

    if (language === 'ar') {
      html.classList.add('lang-ar');
    } else {
      html.classList.remove('lang-ar');
    }
  }, [language]);

  return <>{children}</>;
}
