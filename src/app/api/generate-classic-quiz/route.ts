import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { tier, count } = await req.json();

    if (!tier || typeof tier !== 'number' || tier < 1 || tier > 5) {
      return NextResponse.json({ error: 'Valid tier (1-5) is required' }, { status: 400 });
    }

    let focusArea = '';
    switch (tier) {
      case 1:
        focusArea = 'Tier 1 (Beginner): Fokus pada materi dasar seperti Basic Tenses (Present, Past), Articles (a/an/the), Kosakata sehari-hari, dan Singular/Plural.';
        break;
      case 2:
        focusArea = 'Tier 2 (Elementary): Fokus pada materi elementer seperti Continuous Tenses, Simple Modals, Prepositions of time/place, dan struktur kalimat dasar.';
        break;
      case 3:
        focusArea = 'Tier 3 (Intermediate): Fokus pada materi menengah seperti Perfect Tenses, Conditionals Type 1 & 2, Passive Voice dasar, dan Gerunds/Infinitives.';
        break;
      case 4:
        focusArea = 'Tier 4 (Advanced): Fokus pada materi lanjutan seperti Mixed Conditionals, Advanced Relative Clauses, Subjunctive, dan Advanced Modals.';
        break;
      case 5:
        focusArea = 'Tier 5 (Immortal Mastery): Fokus pada materi sangat kompleks seperti Inversion, pola kalimat yang menipu/jebakan grammar tingkat dewa, dan Nuances of vocabulary.';
        break;
      default:
        focusArea = 'Fokus pada grammar bahasa Inggris umum.';
    }

    const questionCount = typeof count === 'number' ? count : 5;

    const topics = ['Astronomi & Tata Surya', 'Bisnis & Pasar Global', 'Sejarah Peradaban Kuno', 'Budaya Populer & Hiburan', 'Lingkungan & Konservasi Alam', 'Kesehatan & Medis', 'Kecerdasan Buatan & Robotika', 'Psikologi Manusia', 'Seni Klasik & Sastra', 'Olahraga Ekstrem', 'Pariwisata Tersembunyi', 'Hukum & Keadilan', 'Evolusi Biologi', 'Arsitektur Megah', 'Mitos & Legenda Lokal', 'Penjelajahan Laut Dalam', 'Sistem Transportasi Masa Depan', 'Kuliner Tradisional Dunia'];
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];

    const prompt = `Anda adalah sistem Atlas Arena AI, pembuat soal ujian bahasa Inggris yang sangat ahli dan edukatif.
Buatlah tepat ${questionCount} soal bahasa Inggris (pilihan ganda) yang edukatif berdasarkan tingkat kesulitan ini:
Tier ${tier} (${['Foundation (Mudah)', 'Intermediate (Sedang)', 'Advanced (Sulit)', 'Elite (Sangat Sulit)', 'Immortal Mastery'][tier - 1] || 'Umum'}): ${focusArea}

Instruksi Khusus untuk Sesi Ini (Seed Acak: ${Date.now()}-${Math.random()}):
- Wajib membuat konteks/topik kalimat HANYA seputar: **${randomTopic}**
- Pastikan kalimat yang dibuat SANGAT BERVARIASI dan TIDAK SAMA dengan soal-soal sebelumnya. Gunakan kosakata yang kaya terkait topik tersebut.

Instruksi Output:
Anda HARUS merespons HANYA dalam bentuk format JSON murni berupa array berisi ${questionCount} objek dengan struktur persis seperti berikut:
[
  {
    "question": "Kalimat bahasa inggris yang menjadi soal...",
    "translation": "Terjemahan soal ke dalam Bahasa Indonesia...",
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "correct_answer": "a", // (harus "a", "b", "c", atau "d")
    "question_explanation": "Penjelasan mendalam tentang struktur grammar kalimat tersebut...",
    "options_breakdown": {
      "a": "Penjelasan rinci mengapa opsi a salah/benar dan fungsi strukturnya...",
      "b": "Penjelasan rinci mengapa opsi b salah/benar dan fungsi strukturnya...",
      "c": "Penjelasan rinci mengapa opsi c salah/benar dan fungsi strukturnya...",
      "d": "Penjelasan rinci mengapa opsi d salah/benar dan fungsi strukturnya..."
    },
    "reasoning": "Logika utama atau kesimpulan singkat mengapa jawaban yang benar adalah opsi tersebut..."
  }
]

Penting:
- Jangan gunakan formatting markdown \`\`\`json.
- Jangan berikan penjelasan teks apa pun di luar JSON.
- Pastikan jawaban benar bervariasi secara acak (tidak selalu "a").
- Pastikan terjemahan dan penjelasan berbahasa Indonesia yang natural, edukatif, dan mudah dipahami.`;

    const maxRetries = 3;
    let lastError = null;
    let parsed: any[] = [];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const model = genAI.getGenerativeModel({
          model: 'gemini-flash-lite-latest',
          generationConfig: { temperature: 0.9, topK: 40, maxOutputTokens: 8192, responseMimeType: "application/json" }
        });
        
        const result = await model.generateContent(prompt);
        let rawText = result.response.text().trim();

        // Extract JSON array using regex to handle chatty AI
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          rawText = jsonMatch[0];
        }

        parsed = JSON.parse(rawText);

        if (Array.isArray(parsed) && parsed.length > 0) {
          return NextResponse.json({ questions: parsed });
        } else {
          throw new Error('Data soal kosong.');
        }

      } catch (e: any) {
        lastError = e;
        console.warn(`[Generate Classic API] Attempt ${attempt} failed:`, e.message || e);
        
        if (attempt < maxRetries) {
          // Wait for 1.5 seconds before retrying
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    }

    console.error('[Generate Classic API] All attempts failed. Last Error:', lastError);
    return NextResponse.json({ error: 'Gagal menghasilkan soal setelah beberapa percobaan. Silakan coba lagi.' }, { status: 500 });

  } catch (error: any) {
    console.error('[Generate Classic API] Fatal Error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan internal server.' }, { status: 500 });
  }
}
