import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { sentence, ruleContext } = await req.json();

    if (!sentence || typeof sentence !== 'string') {
      return NextResponse.json({ error: 'Kalimat harus diisi.' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-lite-latest',
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json"
      }
    });

    const promptText = `Kamu adalah guru bahasa Inggris yang ahli dalam menganalisis tata bahasa (grammar).
Tugas kamu adalah memeriksa kalimat bahasa Inggris berikut: "${sentence}".

${ruleContext ? `Periksa secara khusus apakah kalimat ini mengikuti kaidah tata bahasa dari "${ruleContext}". Jika kalimat ini tidak mengikuti kaidah "${ruleContext}" (misalnya tenses-nya salah atau polanya tidak sesuai), maka anggap salah (\`is_correct: false\`).` : ''}

Periksa kebenaran tata bahasa (grammar), ejaan, dan kecocokan subjek-kata kerja (subject-verb agreement).

Balas dengan format JSON yang memiliki struktur persis seperti berikut:
{
  "is_correct": true atau false (apakah kalimat tersebut 100% benar secara grammar),
  "explanation": "Penjelasan detail namun ringkas dalam Bahasa Indonesia mengenai kebenaran kalimat tersebut, letak kesalahannya (jika ada), dan bagaimana bentuk yang benar."
}

Teks untuk diperiksa: "${sentence}"`;

    const result = await model.generateContent(promptText);
    const rawText = result.response.text().trim();
    
    console.log('Grammar Check API raw response:', rawText);
    
    try {
      const parsedData = JSON.parse(rawText);
      return NextResponse.json(parsedData);
    } catch (parseError) {
      let cleanText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(cleanText);
      return NextResponse.json(parsedData);
    }
  } catch (error: any) {
    console.error('Grammar Check API Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
