import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { text, sourceLang, targetLang } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Teks harus diisi.' }, { status: 400 });
    }

    if (!sourceLang || !targetLang) {
      return NextResponse.json({ error: 'Bahasa sumber dan target harus diisi.' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-lite-latest',
    });

    const promptText = `Anda adalah seorang penerjemah profesional kelas dunia. 
Tugas Anda sangat sederhana: Terjemahkan teks yang diberikan dari bahasa ${sourceLang} ke bahasa ${targetLang}. 
Pastikan terjemahannya terdengar natural, akurat, dan sesuai dengan konteks bahasa tujuan.
PENTING: Jangan tambahkan penjelasan, intro, atau catatan apa pun. Cukup kembalikan hasil terjemahannya secara langsung.

Teks untuk diterjemahkan:
"${text}"`;

    const result = await model.generateContent(promptText);
    const rawText = result.response.text().trim();
    
    // Kadang AI masih menaruh quotes jika kita menggunakan quotes pada prompt
    let cleanText = rawText;
    if (cleanText.startsWith('"') && cleanText.endsWith('"')) {
      cleanText = cleanText.slice(1, -1);
    }

    return NextResponse.json({ translation: cleanText.trim() });
  } catch (error: any) {
    console.error('Advanced Translate API Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
