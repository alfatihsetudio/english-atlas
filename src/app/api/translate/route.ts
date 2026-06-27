import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { text, direction = 'id-en', sourceLang = 'Indonesia', targetLang = 'Inggris' } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Teks harus diisi.' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-lite-latest',
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json"
      }
    });

    const promptText = `Anda adalah guru bahasa Inggris. Tugas Anda:
1. Terjemahkan teks dari bahasa ${sourceLang} ke bahasa ${targetLang} yang natural.
2. Tentukan nama tense/grammar dari kalimat bahasa Inggris tersebut (baik dari teks asli jika sumbernya Inggris, atau hasil terjemahan jika sumbernya Indonesia). Jawab dengan sangat singkat berupa nama tense/strukturnya saja (contoh: "Present Simple", "Past Continuous", "Nominal Past Simple", dll). Jangan berikan penjelasan panjang lebar.
3. Berikan transkripsi fonetik (IPA) untuk teks bahasa Inggris tersebut. Jika tidak melibatkan bahasa Inggris, kosongkan saja field phonetics.
Output harus berupa JSON dengan skema persis seperti berikut:
{
  "translation": "Hasil terjemahan kalimat ke bahasa ${targetLang}",
  "grammar_feedback": "Nama Tense / Grammar singkat saja (contoh: Present Simple)",
  "phonetics": "/dɪˈɡruː.mɛnt/ (kosongkan jika bukan bahasa Inggris)"
}

Teks ${sourceLang} untuk diproses: "${text}"`;

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
