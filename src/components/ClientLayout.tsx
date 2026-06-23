'use client';

import dynamic from 'next/dynamic';

// Load chatbot dynamically agar tidak SSR (karena pakai useState/browser APIs)
const EnglishTutorChat = dynamic(() => import('@/components/EnglishTutorChat'), {
  ssr: false,
});

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <EnglishTutorChat />
    </>
  );
}
