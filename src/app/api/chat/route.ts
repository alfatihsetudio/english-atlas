import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const getSystemPrompt = (username: string) => `Anda adalah tutor bahasa Inggris yang ramah dan membantu bernama "Atlas". Anda sedang berbicara dengan murid bernama ${username}. Sapa dia atau gunakan namanya sesekali dalam penjelasan agar terasa personal. Jawab pertanyaan user dengan singkat, jelas, dan berikan contoh nyata jika diperlukan. Fokus pada grammar, kosa kata, dan tata bahasa Inggris. Format jawaban Anda dengan rapi menggunakan baris baru untuk pemisah yang jelas. Jika user bertanya di luar topik bahasa Inggris, arahkan kembali dengan sopan. Gunakan bahasa Indonesia dalam penjelasan, tetapi contoh dalam bahasa Inggris. Jangan terlalu panjang, maksimal 200 kata per jawaban.`;

export async function POST(req: NextRequest) {
  try {
    const { message, history, username } = await req.json();
    const userToGreet = username || 'Siswa';

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-lite-latest',
      systemInstruction: getSystemPrompt(userToGreet),
      generationConfig: {
        temperature: 0.7,
      }
    });

    // Build chat history for context
    const chat = model.startChat({
      history: (history || []).map((msg: { role: string; text: string }) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
      })),
    });

    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    return NextResponse.json({ reply: responseText });
  } catch (error: any) {
    console.error('[Chat API] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
