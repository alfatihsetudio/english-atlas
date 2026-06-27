import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { nodeContent } = await req.json();

    if (!nodeContent || typeof nodeContent !== 'string') {
      return NextResponse.json({ error: 'nodeContent is required' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-lite-latest',
      generationConfig: {
        temperature: 0.7,
      }
    });

    const prompt = `Anda adalah pembuat soal ujian bahasa Inggris yang profesional. Buatlah tepat 5 soal pilihan ganda berdasarkan materi tata bahasa Inggris berikut:

---
${nodeContent}
---

Pastikan soal:
1. Menguji pemahaman grammar yang tepat dan bervariasi (struktur kalimat, penggunaan auxiliary, time signal, dll.)
2. Pilihan jawaban masuk akal (tidak terlalu mudah ditebak)
3. Jawaban benar bervariasi (jangan selalu A)

Output harus berupa JSON murni TANPA markdown code block, TANPA teks tambahan apapun, langsung mulai dengan "{". Format:
{"quiz":[{"question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A"}]}

Di mana "answer" adalah huruf pilihan yang benar (A, B, C, atau D).`;

    const result = await model.generateContent(prompt);
    let rawText = result.response.text().trim();

    // Strip potential markdown fences
    rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    let parsed: { quiz: { question: string; options: string[]; answer: string }[] };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error('[Quiz API] Failed to parse JSON:', rawText);
      return NextResponse.json({ error: 'Gagal memproses respons AI. Coba lagi.' }, { status: 500 });
    }

    if (!parsed.quiz || !Array.isArray(parsed.quiz)) {
      return NextResponse.json({ error: 'Format respons AI tidak valid.' }, { status: 500 });
    }

    return NextResponse.json({ quiz: parsed.quiz });
  } catch (error: any) {
    console.error('[Quiz API] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
