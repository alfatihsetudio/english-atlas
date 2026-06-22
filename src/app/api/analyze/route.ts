import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { sentence } = await req.json();

    if (!sentence || typeof sentence !== 'string') {
      return NextResponse.json({ error: 'Sentence is required' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-lite-latest',
    });

    const promptText = `Kamu adalah penganalisis grammar. Saya akan memberikan sebuah kalimat. Kamu harus menentukan Tense dari kalimat tersebut, beserta komponen Waktu dan Bentuk dasarnya. Balas **HANYA** dengan array JSON berisi string judul node yang tepat (tidak boleh ada teks markdown lain, murni JSON). Pilihan judul yang valid HANYA: ['Present', 'Past', 'Future', 'Simple', 'Continuous', 'Perfect', 'Perfect Continuous', 'Present Simple', 'Present Continuous', 'Present Perfect', 'Present Perfect Continuous', 'Past Simple', 'Past Continuous', 'Past Perfect', 'Past Perfect Continuous', 'Future Simple', 'Future Continuous', 'Future Perfect', 'Future Perfect Continuous']. Contoh Input: 'I was eating'. Contoh Output valid: ["Past", "Continuous", "Past Continuous"]
Kalimat yang harus dianalisis: "${sentence}"`;

    const result = await model.generateContent(promptText);
    let rawText = result.response.text();
    console.log('Raw AI Response:', rawText);
    let cleanText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    let highlightedTitles: string[] = [];
    try {
      highlightedTitles = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('Failed to parse JSON from Gemini:', rawText);
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    return NextResponse.json({ highlightedTitles });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
