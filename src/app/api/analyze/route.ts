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
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json'
      }
    });

    const promptText = `Kamu adalah penganalisis grammar. Saya akan memberikan sebuah kalimat. Kamu harus menentukan Tense dari kalimat tersebut, beserta komponen Waktu dan Bentuk dasarnya. Balas **HANYA** dengan objek JSON (tidak boleh ada teks markdown lain, murni JSON) dengan format berikut:
{
  "highlightedTitles": ["Present", "Simple", "Present Simple"],
  "analysis": {
    "grammar": "nama tense (misal: Present Simple)",
    "translation": "terjemahan kalimat ke bahasa Indonesia",
    "meaning": "maksud atau tujuan dari kalimat tersebut",
    "why": "penjelasan singkat mengapa tense ini digunakan untuk kalimat tersebut",
    "error": "penjelasan singkat apa yang salah dari penulisan atau grammar kalimat tersebut (jika tidak ada kesalahan, tulis 'Tidak ada')"
  }
}

Pilihan judul yang valid untuk 'highlightedTitles' HANYA: ['Present', 'Past', 'Future', 'Simple', 'Continuous', 'Perfect', 'Perfect Continuous', 'Present Simple', 'Present Continuous', 'Present Perfect', 'Present Perfect Continuous', 'Past Simple', 'Past Continuous', 'Past Perfect', 'Past Perfect Continuous', 'Future Simple', 'Future Continuous', 'Future Perfect', 'Future Perfect Continuous']. 

Contoh Input: 'i want to eat'. 
Contoh Output valid:
{
  "highlightedTitles": ["Present", "Simple", "Present Simple"],
  "analysis": {
    "grammar": "Present Simple",
    "translation": "Saya ingin makan",
    "meaning": "Menyatakan keinginan saat ini",
    "why": "Karena menyatakan kondisi atau fakta yang terjadi pada waktu sekarang.",
    "error": "Terdapat kesalahan kapitalisasi pada kata 'i', seharusnya menggunakan huruf kapital 'I'."
  }
}

Kalimat yang harus dianalisis: "${sentence}"`;

    const result = await model.generateContent(promptText);
    let rawText = result.response.text();
    console.log('Raw AI Response:', rawText);
    let cleanText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    let parsedData: any = {};
    try {
      parsedData = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('Failed to parse JSON from Gemini:', rawText);
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    return NextResponse.json({ 
      highlightedTitles: parsedData.highlightedTitles || [], 
      analysis: parsedData.analysis || null 
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
