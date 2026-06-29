import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { currentPoints, count, difficulty, userId, mode } = await req.json();

    if (currentPoints === undefined || typeof currentPoints !== 'number') {
      return NextResponse.json({ error: 'currentPoints is required and must be a number' }, { status: 400 });
    }

    const questionCount = typeof count === 'number' ? count : 5;

    // Determine tier level matching updated rank system ranges
    let tierLevel = 1;
    if (currentPoints >= 7001) tierLevel = 5;
    else if (currentPoints >= 4001) tierLevel = 4;
    else if (currentPoints >= 2001) tierLevel = 3;
    else if (currentPoints >= 501) tierLevel = 2;

    console.log(`[Generate Quiz API] Mode: ranked, Tier: ${tierLevel}, User: ${userId || 'anonymous'}`);

    // Try fetching from the pre-generated pool first
    let dbQuery = supabase
      .from('pregenerated_questions')
      .select('*')
      .eq('mode', 'ranked')
      .eq('tier', tierLevel)
      .eq('is_used', false);

    if (userId) {
      dbQuery = dbQuery.eq('user_id', userId);
    } else {
      dbQuery = dbQuery.is('user_id', null);
    }

    const { data: dbQuestions, error: fetchError } = await dbQuery.limit(questionCount);

    let finalQuestions: any[] = [];
    let isFromPool = false;

    if (!fetchError && dbQuestions && dbQuestions.length === questionCount) {
      finalQuestions = dbQuestions;
      isFromPool = true;

      // Mark fetched questions as used
      const questionIds = dbQuestions.map(q => q.id);
      await supabase
        .from('pregenerated_questions')
        .update({ is_used: true })
        .in('id', questionIds);

      console.log(`[Generate Quiz API] Served ${questionCount} questions from DB pool.`);
    } else {
      console.log(`[Generate Quiz API] DB pool insufficient (found ${dbQuestions?.length || 0}/${questionCount}). Falling back to live Gemini generation.`);
      
      // Fallback: Generate live using Gemini
      let focusArea = '';
      let aiPrompt = '';

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
        focusArea = 'Fokus pada Advanced Inversion, Subjunctive, dan Mixed Conditionals.';
        aiPrompt = 'Gunakan kalimat kompleks standar akademik IELTS (Band 7-9). Kosakata tingkat lanjut yang tepat guna. Fokus pada penerapan grammar tingkat tinggi dan berikan pilihan pengecoh yang kuat.';
      }

      // Check for Battle Mode specific difficulty override
      if (difficulty === 'Tier 1: Foundation (Easy)') {
        focusArea = 'Fokus pada Materi dasar: Tenses dasar (Present/Past), Artikel, & Kosakata sehari-hari.';
        aiPrompt = 'Gunakan kalimat pendek dan sederhana. Kosa kata dasar. Gramatika jelas.';
      } else if (difficulty === 'Tier 2: Intermediate (Medium)') {
        focusArea = 'Fokus pada Materi menengah: Conditional Sentences, Passive Voice, & Perfect Tenses.';
        aiPrompt = 'Gunakan kalimat dengan 1-2 klausa. Kosa kata menengah. Ada sedikit pengecoh.';
      } else if (difficulty === 'Tier 3: Elite (Hard)') {
        focusArea = 'Fokus pada Materi lanjutan: Advanced Modals, Subjunctive Mood, & Inversion.';
        aiPrompt = 'Gunakan kalimat panjang/kompleks. Kosa kata tingkat tinggi (TOEFL/IELTS). Pengecoh kuat.';
      }

      const topics = ['Astronomi & Tata Surya', 'Bisnis & Pasar Global', 'Sejarah Peradaban Kuno', 'Budaya Populer & Hiburan', 'Lingkungan & Konservasi Alam', 'Kesehatan & Medis', 'Kecerdasan Buatan & Robotika', 'Psikologi Manusia', 'Seni Klasik & Sastra', 'Olahraga Ekstrem', 'Pariwisata Tersembunyi', 'Hukum & Keadilan', 'Evolusi Biologi', 'Arsitektur Megah', 'Mitos & Legenda Lokal', 'Penjelajahan Laut Dalam', 'Sistem Transportasi Masa Depan', 'Kuliner Tradisional Dunia'];
      const randomTopic = topics[Math.floor(Math.random() * topics.length)];

      const prompt = `Kamu adalah Professor Bahasa Inggris yang sangat teliti.
Buatlah tepat ${questionCount} soal bahasa Inggris (pilihan ganda) yang menantang.
Target Difficulty Tier: ${tierLevel}
Fokus Area: ${focusArea}
Gaya Kalimat: ${aiPrompt}

Instruksi Konteks:
- Wajib membuat konteks/topik kalimat HANYA seputar: **${randomTopic}**
- Pastikan kalimat yang dibuat SANGAT BERVARIASI dan menggunakan kosakata yang kaya terkait topik.
- ACAK POLA SOAL: Pilihan sub-materi grammar dari Fokus Area WAJIB DIACAK URUTANNYA. Jangan gunakan pola yang bisa ditebak (misal soal 1 pasti tenses, soal 2 pasti preposisi). Setiap soal harus menguji aspek yang berbeda dalam urutan yang sangat acak.

ATURAN MUTLAK SISTEM (WAJIB DIPATUHI):
1. KEAKURATAN TATA BAHASA MUTLAK (ZERO ERRORS):
   Sebelum mengembalikan data, kamu WAJIB memverifikasi ulang logika grammarmu.
2. DILARANG KERAS MELAKUKAN SELF-CORRECTION DI PENJELASAN:
   Penjelasan di dalam "explanation" harus LANGSUNG pada intinya, faktual, dan otoritatif.
3. VALIDASI KUNCI JAWABAN & BEDAH OPSI:
   - Pastikan kamu meletakkan satu-satunya jawaban yang benar di field "correct_answer" (harus berisi "a", "b", "c", atau "d").
4. FORMAT STRICT JSON MURNI:
   Kamu hanya boleh merespons dalam format JSON murni berupa array berisi objek tanpa ada teks pembuka, penutup, markdown, atau basa-basi apa pun.
5. BAHASA PENJELASAN (EXPLANATION LANGUAGE):
   Penjelasan di dalam field "explanation" WAJIB ditulis dalam Bahasa Indonesia yang baik, terstruktur, dan mudah dipahami. Jelaskan dengan singkat namun jelas mengapa jawaban tersebut benar dan opsi lainnya kurang tepat.

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

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const model = genAI.getGenerativeModel({
            model: 'gemini-flash-lite-latest',
            generationConfig: { temperature: 0.7, topK: 40, maxOutputTokens: 8192, responseMimeType: "application/json" }
          });
          
          const result = await model.generateContent(prompt);
          let rawText = result.response.text().trim();

          // Robustly extract JSON array between outermost brackets
          const startIndex = rawText.indexOf('[');
          const endIndex = rawText.lastIndexOf(']');
          if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            rawText = rawText.substring(startIndex, endIndex + 1);
          }

          const parsed = JSON.parse(rawText);

          if (Array.isArray(parsed) && parsed.length === questionCount) {
            finalQuestions = parsed;
            break;
          } else {
            throw new Error('Data soal kosong atau jumlah tidak cocok.');
          }
        } catch (e: any) {
          lastError = e;
          console.warn(`[Generate Quiz API] Live attempt ${attempt} failed:`, e.message || e);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
      }

      if (finalQuestions.length === 0) {
        console.error('[Generate Quiz API] All attempts failed. Last Error:', lastError);
        return NextResponse.json({ error: 'Gagal menghasilkan soal setelah beberapa percobaan. Silakan coba lagi.' }, { status: 500 });
      }
    }

    // 4. Create secure quiz session record
    const clientQuestions = finalQuestions.map(q => ({
      question: q.question,
      option_a: q.option_a || q.a || '',
      option_b: q.option_b || q.b || '',
      option_c: q.option_c || q.c || '',
      option_d: q.option_d || q.d || ''
    }));

    const correctAnswers = finalQuestions.map(q => (q.correct_answer || q.correct || '').toLowerCase());
    const explanations = finalQuestions.map(q => q.explanation || q.question_explanation || '');

    const isBattle = mode === 'battle';

    const { data: sessionData, error: sessionError } = await supabase
      .from('quiz_sessions')
      .insert({
        user_id: userId || null,
        mode: isBattle ? 'battle' : 'ranked',
        tier: tierLevel,
        questions: clientQuestions,
        correct_answers: correctAnswers,
        explanations: explanations,
        is_submitted: false
      })
      .select()
      .single();

    if (sessionError) {
      console.error('[Generate Quiz API] Error creating quiz session:', sessionError);
      return NextResponse.json({ error: 'Gagal membuat sesi kuis.' }, { status: 500 });
    }

    // 5. Trigger asynchronous refill bank
    const baseUrl = req.nextUrl.origin;
    if (userId) {
      fetch(`${baseUrl}/api/refill-bank?userId=${userId}`).catch(err => {
        console.error('[Generate Quiz API] Failed to trigger refill bank in background:', err);
      });
    }

    // If battle mode, attach correct answers to response since Battle Mode relies on instant client feedback.
    if (isBattle) {
      clientQuestions.forEach((q, idx) => {
         (q as any).correct_answer = correctAnswers[idx];
         (q as any).explanation = explanations[idx];
      });
    }

    // 6. Return secure payload (or with answers for battle mode)
    return NextResponse.json({
      sessionId: sessionData.id,
      questions: clientQuestions
    });

  } catch (error: any) {
    console.error('[Generate Quiz API] Fatal Error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan internal server.' }, { status: 500 });
  }
}
