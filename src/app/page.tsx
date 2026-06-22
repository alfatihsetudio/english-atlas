import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-900 p-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
          English Atlas
        </h1>
        <p className="text-xl text-slate-600">
          Peta interaktif komprehensif untuk menguasai tata bahasa Inggris dengan lebih mudah dan terstruktur.
        </p>
        <div className="pt-8">
          <Link 
            href="/login" 
            className="inline-flex h-12 items-center justify-center rounded-full bg-indigo-600 px-8 text-sm font-medium text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2"
          >
            Mulai Belajar / Login
          </Link>
        </div>
      </div>
    </div>
  );
}
