import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Teks harus diisi.' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-lite-latest',
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const promptText = `Anda adalah guru bahasa Inggris. Tugas Anda:
1. Terjemahkan teks Indonesia ke Inggris yang natural.
2. Periksa grammar-nya.
3. Jelaskan umpan balik grammar secara detail namun ringkas sepenuhnya dalam Bahasa Indonesia secara ramah dan profesional (jangan gunakan Bahasa Inggris dalam penjelasan/catatan feedback ini, kecuali untuk menyebutkan istilah grammar atau contoh kata).
Output harus berupa JSON dengan skema persis seperti berikut:
{
  "translation": "Hasil terjemahan kalimat ke bahasa Inggris",
  "grammar_feedback": "Penjelasan grammar (ditulis dalam Bahasa Indonesia), kesalahan tata bahasa jika ada, atau tips perbaikan"
}

Teks Indonesia untuk diproses: "${text}"`;

    const result = await model.generateContent(promptText);
    const rawText = result.response.text().trim();
    
    console.log('Translate API raw response:', rawText);
    
    try {
      const parsedData = JSON.parse(rawText);
      return NextResponse.json(parsedData);
    } catch (parseError) {
      console.error('Failed to parse JSON from Gemini, attempting fallback cleaning:', rawText);
      let cleanText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(cleanText);
      return NextResponse.json(parsedData);
    }
  } catch (error: any) {
    console.error('Translate API Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
