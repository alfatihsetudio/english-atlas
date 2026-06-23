import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { tenseName } = await req.json();

    if (!tenseName || typeof tenseName !== 'string') {
      return NextResponse.json({ error: 'Nama tenses harus diisi.' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-lite-latest',
    });

    const promptText = `Kamu adalah guru bahasa Inggris yang ahli.
Tugas kamu adalah membuat contoh kalimat alternatif yang unik, menarik, dan lazim digunakan sehari-hari untuk materi tenses: "${tenseName}".

Buatkan contoh dalam format teks yang rapi dan terstruktur seperti berikut (tulis arti dalam bahasa Indonesia):

• VERBAL:
  (+) [Kalimat positif bahasa Inggris] (Artinya dalam bahasa Indonesia)
  (-) [Kalimat negatif bahasa Inggris] (Artinya dalam bahasa Indonesia)
  (?) [Kalimat tanya bahasa Inggris] (Artinya dalam bahasa Indonesia)

• NOMINAL:
  (+) [Kalimat positif bahasa Inggris] (Artinya dalam bahasa Indonesia)
  (-) [Kalimat negatif bahasa Inggris] (Artinya dalam bahasa Indonesia)
  (?) [Kalimat tanya bahasa Inggris] (Artinya dalam bahasa Indonesia)

Pastikan kalimat bahasa Inggrisnya gramatikal dan akurat 100% mengikuti kaidah "${tenseName}".
Balas HANYA dengan teks contoh tersebut tanpa pembuka, penutup, atau tanda markdown code block.`;

    const result = await model.generateContent(promptText);
    const rawText = result.response.text().trim();

    return NextResponse.json({ examples: rawText });
  } catch (error: any) {
    console.error('Generate Example API Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
