'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    // Auth sekarang ditangani oleh modal di halaman utama
    router.replace('/');
  }, [router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
      <p className="text-slate-400 animate-pulse">Mengalihkan...</p>
    </div>
  );
}
