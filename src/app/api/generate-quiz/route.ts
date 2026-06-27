import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { currentPoints, count, difficulty } = await req.json();

    if (currentPoints === undefined || typeof currentPoints !== 'number') {
      return NextResponse.json({ error: 'currentPoints is required and must be a number' }, { status: 400 });
    }

    let focusArea = '';
    let aiPrompt = '';
    
    // Adaptive mapping
    let tierLevel = 1;
    if (currentPoints >= 2001) tierLevel = 5;
    else if (currentPoints >= 1001) tierLevel = 4;
    else if (currentPoints >= 501) tierLevel = 3;
    else if (currentPoints >= 201) tierLevel = 2;

    // Check for Battle Mode specific difficulty first
    if (difficulty === 'Tier 1: Foundation (Easy)') {
      focusArea = 'Fokus pada Materi dasar: Tenses dasar (Present/Past), Artikel, & Kosakata sehari-hari.';
      aiPrompt = 'Gunakan kalimat pendek dan sederhana. Kosa kata dasar. Gramatika jelas.';
    } else if (difficulty === 'Tier 2: Intermediate (Medium)') {
      focusArea = 'Fokus pada Materi menengah: Conditional Sentences, Passive Voice, & Perfect Tenses.';
      aiPrompt = 'Gunakan kalimat dengan 1-2 klausa. Kosa kata menengah. Ada sedikit pengecoh.';
    } else if (difficulty === 'Tier 3: Advanced (Hard)') {
      focusArea = 'Fokus pada Materi kompleks: Inversion, Subjunctive, & Advanced Relative Clauses.';
      aiPrompt = 'Gunakan kalimat panjang dan kompleks. Kosa kata akademik/tingkat lanjut. Fokus pada jebakan grammar tingkat tinggi (Inversion, Subjunctive, dll).';
    } else {
      // Adaptive Difficulty Logic based on Points
      if (tierLevel === 1) {
        focusArea = 'Fokus pada Basic Tenses (Present, Past), Articles (a/an/the), dan Singular/Plural.';
        aiPrompt = 'Gunakan kalimat pendek dan sederhana. Kosa kata dasar. Gramatika jelas.';
      } else if (tierLevel === 2) {
        focusArea = 'Fokus pada Continuous Tenses, Prepositions, dan Basic Modals.';
        aiPrompt = 'Gunakan kalimat sedang. Kosa kata menengah. Berikan pengecoh logis.';
      } else if (tierLevel === 3) {
        focusArea = 'Fokus pada Perfect Tenses, Conditionals Type 1 & 2, dan Passive Voice.';
        aiPrompt = 'Gunakan kalimat majemuk. Kosa kata tingkat atas. Pengecoh harus terlihat sangat mirip dengan jawaban benar.';
      } else if (tierLevel === 4) {
        focusArea = 'Fokus pada Mixed Conditionals, Relative Clauses, dan Advanced Modals.';
        aiPrompt = 'Gunakan kalimat panjang dengan klausa anak. Kosa kata akademik/sulit. Struktur kalimat kompleks.';
      } else if (tierLevel === 5) {
        focusArea = 'Fokus pada Inversion, Subjunctive, dan struktur kalimat yang sangat kompleks/menjebak.';
        aiPrompt = 'Gunakan kalimat sangat panjang/paragraf pendek. Kosa kata GRE/TOEFL tingkat dewa. Fokus pada pengecualian aturan grammar, Inversion, dan Subjunctive. Beri jebakan yang mematikan.';
      }
    }

    const questionCount = typeof count === 'number' ? count : 5;

    const topics = ['Astronomi & Tata Surya', 'Bisnis & Pasar Global', 'Sejarah Peradaban Kuno', 'Budaya Populer & Hiburan', 'Lingkungan & Konservasi Alam', 'Kesehatan & Medis', 'Kecerdasan Buatan & Robotika', 'Psikologi Manusia', 'Seni Klasik & Sastra', 'Olahraga Ekstrem', 'Pariwisata Tersembunyi', 'Hukum & Keadilan', 'Evolusi Biologi', 'Arsitektur Megah', 'Mitos & Legenda Lokal', 'Penjelajahan Laut Dalam', 'Sistem Transportasi Masa Depan', 'Kuliner Tradisional Dunia'];
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];

    const prompt = `Kamu adalah Professor Bahasa Inggris yang sangat teliti.
Buatlah tepat ${questionCount} soal bahasa Inggris (pilihan ganda) yang menantang.
Target Difficulty Tier: ${tierLevel}

Instruksi Kesulitan AI:
${aiPrompt}

Instruksi Konteks:
- Fokus Materi: ${focusArea}
- Wajib membuat konteks/topik kalimat HANYA seputar: **${randomTopic}**
- Pastikan kalimat yang dibuat SANGAT BERVARIASI dan TIDAK SAMA dengan soal-soal sebelumnya. Gunakan kosakata yang kaya terkait topik tersebut.

ATURAN MUTLAK SISTEM (WAJIB DIPATUHI):
1. KEAKURATAN TATA BAHASA MUTLAK (ZERO ERRORS):
   Sebelum mengembalikan data, kamu WAJIB memverifikasi ulang logika grammarmu.
   Contoh: Jika kamu membuat soal tentang Articles (a/an/the) dan titik-titik berada sebelum kata sifat berawalan konsonan (misal: "___ talented accountant"), jawaban mutlak harus "a" (bukan "an"). Jangan membuat logika grammar yang saling bertentangan secara akademik.

2. DILARANG KERAS MELAKUKAN SELF-CORRECTION DI PENJELASAN:
   Penjelasan di dalam "explanation" harus LANGSUNG pada intinya, faktual, dan otoritatif.
   DILARANG KERAS menggunakan kata-kata proses berpikir seperti "Tunggu", "Koreksi", "Mari kita lihat", "Sebenarnya", atau meralat dirimu sendiri di dalam teks keluaran. Tulis penjelasan yang sudah pasti benar sejak awal.

3. VALIDASI KUNCI JAWABAN & BEDAH OPSI:
   - Pastikan kamu meletakkan satu-satunya jawaban yang benar di field "correct_answer" (harus berisi "a", "b", "c", atau "d").
   - Penjelasan di dalam "explanation" harus selaras dan tidak bertentangan dengan kunci jawaban yang dipilih.

4. FORMAT STRICT JSON MURNI:
   Kamu hanya boleh merespons dalam format JSON murni berupa array berisi objek tanpa ada teks pembuka, penutup, markdown, atau basa-basi apa pun.

Struktur Output JSON yang Wajib Diikuti:
[
  {
    "question": "...",
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "correct_answer": "a", // (harus "a", "b", "c", atau "d")
    "explanation": "..."
  }
]`;

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
        console.warn(`[Generate Quiz API] Attempt ${attempt} failed:`, e.message || e);
        
        if (attempt < maxRetries) {
          // Wait for 1.5 seconds before retrying
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    }

    console.error('[Generate Quiz API] All attempts failed. Last Error:', lastError);
    return NextResponse.json({ error: 'Gagal menghasilkan soal setelah beberapa percobaan. Silakan coba lagi.' }, { status: 500 });

  } catch (error: any) {
    console.error('[Generate Quiz API] Fatal Error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan internal server.' }, { status: 500 });
  }
}
