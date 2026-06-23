import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEM_PROMPT = `Anda adalah kamus bahasa Inggris profesional kelas dunia seperti Oxford dan Cambridge. Berikan definisi lengkap untuk setiap kata yang dicari pengguna. Selalu balas HANYA dalam format JSON yang valid, tanpa markdown, tanpa penjelasan tambahan di luar JSON. Format JSON yang wajib digunakan adalah sebagai berikut:
{
  "word": "kata asli dalam bahasa Inggris",
  "phonetic": "/transkripsi fonetik IPA/",
  "part_of_speech": "noun / verb / adjective / adverb / dll",
  "definitions": [
    "Definisi pertama dalam bahasa Indonesia yang jelas dan profesional",
    "Definisi kedua (jika ada)"
  ],
  "examples": [
    "Example sentence in English.",
    "Another example sentence."
  ],
  "synonyms": ["synonym1", "synonym2", "synonym3"]
}
Jika kata tidak dikenal atau bukan bahasa Inggris yang valid, tetap balas dalam format JSON dengan pesan yang informatif di kolom definitions.`;

export async function POST(req: NextRequest) {
  try {
    const { word } = await req.json();

    if (!word || typeof word !== 'string' || word.trim().length === 0) {
      return NextResponse.json({ error: 'Kata harus diisi.' }, { status: 400 });
    }

    const trimmedWord = word.trim().toLowerCase();

    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-lite-latest',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const prompt = `Cari kata ini: "${trimmedWord}"`;
    const result = await model.generateContent(prompt);
    const rawText = result.response.text().trim();

    try {
      const parsed = JSON.parse(rawText);
      return NextResponse.json(parsed);
    } catch {
      // Fallback: try to extract JSON
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return NextResponse.json(parsed);
      }
      throw new Error('Gagal memparse respons JSON dari AI.');
    }
  } catch (error: any) {
    console.error('[Dictionary API] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
