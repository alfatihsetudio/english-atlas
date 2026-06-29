import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { tier, count, userId } = await req.json();

    if (!tier || typeof tier !== 'number' || tier < 1 || tier > 5) {
      return NextResponse.json({ error: 'Valid tier (1-5) is required' }, { status: 400 });
    }

    const questionCount = typeof count === 'number' ? count : 5;

    console.log(`[Generate Classic API] Mode: classic, Tier: ${tier}, User: ${userId || 'anonymous'}`);

    // Try fetching from the pre-generated pool first
    let dbQuery = supabase
      .from('pregenerated_questions')
      .select('*')
      .eq('mode', 'classic')
      .eq('tier', tier)
      .eq('is_used', false);

    if (userId) {
      dbQuery = dbQuery.eq('user_id', userId);
    } else {
      dbQuery = dbQuery.is('user_id', null);
    }

    const { data: dbQuestions, error: fetchError } = await dbQuery.limit(questionCount);

    let finalQuestions: any[] = [];

    if (!fetchError && dbQuestions && dbQuestions.length === questionCount) {
      // Reconstruct original classic question structures from raw_data column if present
      finalQuestions = dbQuestions.map(q => {
        if (q.raw_data) {
          return q.raw_data;
        }
        
        // Fallback reconstruction if raw_data is missing
        return {
          question: q.question,
          option_a: q.option_a || q.a || '',
          option_b: q.option_b || q.b || '',
          option_c: q.option_c || q.c || '',
          option_d: q.option_d || q.d || '',
          correct_answer: (q.correct_answer || q.correct || '').toLowerCase(),
          question_explanation: q.explanation,
          options_breakdown: { a: '', b: '', c: '', d: '' },
          reasoning: ''
        };
      });

      // Mark fetched questions as used
      const questionIds = dbQuestions.map(q => q.id);
      await supabase
        .from('pregenerated_questions')
        .update({ is_used: true })
        .in('id', questionIds);

      console.log(`[Generate Classic API] Served ${questionCount} classic questions from DB pool.`);
    } else {
      console.log(`[Generate Classic API] DB pool insufficient (found ${dbQuestions?.length || 0}/${questionCount}). Falling back to live Gemini generation.`);
      
      // Fallback: Generate live using Gemini
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
          focusArea = 'Tier 5 (Immortal Mastery): Fokus pada materi kompleks standar akademik IELTS (Band 7-9) seperti Inversion, Subjunctive, dan kosakata tingkat tinggi.';
          break;
        default:
          focusArea = 'Fokus pada grammar bahasa Inggris umum.';
      }

      const topics = ['Astronomi & Tata Surya', 'Bisnis & Pasar Global', 'Sejarah Peradaban Kuno', 'Budaya Populer & Hiburan', 'Lingkungan & Konservasi Alam', 'Kesehatan & Medis', 'Kecerdasan Buatan & Robotika', 'Psikologi Manusia', 'Seni Klasik & Sastra', 'Olahraga Ekstrem', 'Pariwisata Tersembunyi', 'Hukum & Keadilan', 'Evolusi Biologi', 'Arsitektur Megah', 'Mitos & Legenda Lokal', 'Penjelajahan Laut Dalam', 'Sistem Transportasi Masa Depan', 'Kuliner Tradisional Dunia'];
      const randomTopic = topics[Math.floor(Math.random() * topics.length)];

      const prompt = `Kamu adalah Professor Bahasa Inggris yang sangat teliti.
Buatlah tepat ${questionCount} soal bahasa Inggris (pilihan ganda) yang edukatif berdasarkan tingkat kesulitan ini:
Tier ${tier}: ${focusArea}

Instruksi Konteks:
- Wajib membuat konteks/topik kalimat HANYA seputar: **${randomTopic}**
- Pastikan kalimat yang dibuat SANGAT BERVARIASI dan menggunakan kosakata yang kaya terkait topik.
- ACAK POLA SOAL: Pilihan sub-materi grammar dari Fokus Area WAJIB DIACAK URUTANNYA. Jangan gunakan pola yang bisa ditebak (misal soal 1 pasti tenses, soal 2 pasti preposisi). Setiap soal harus menguji aspek yang berbeda dalam urutan yang sangat acak.

ATURAN MUTLAK SISTEM (WAJIB DIPATUHI):
1. KEAKURATAN TATA BAHASA MUTLAK (ZERO ERRORS):
   Sebelum mengembalikan data, kamu WAJIB memverifikasi ulang logika grammarmu.
2. DILARANG KERAS MELAKUKAN SELF-CORRECTION DI PENJELASAN:
   Penjelasan di dalam "question_explanation", "options_breakdown", dan "reasoning" harus LANGSUNG pada intinya, faktual, dan otoritatif.
3. VALIDASI KUNCI JAWABAN & BEDAH OPSI:
   - Pastikan kamu meletakkan satu-satunya jawaban yang benar di field "correct_answer" (harus berisi "a", "b", "c", atau "d").
4. FORMAT STRICT JSON MURNI:
   Kamu hanya boleh merespons dalam format JSON murni berupa array berisi objek tanpa ada teks pembuka, penutup, markdown, atau basa-basi apa pun.
5. BAHASA PENJELASAN (EXPLANATION LANGUAGE):
   Penjelasan di dalam field "question_explanation" dan breakdown WAJIB ditulis dalam Bahasa Indonesia.

Struktur Output JSON yang Wajib Diikuti:
[
  {
    "question": "Kalimat bahasa inggris yang menjadi soal...",
    "translation": "Terjemahan soal ke dalam Bahasa Indonesia...",
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "correct_answer": "a",
    "question_explanation": "Penjelasan mendalam tentang struktur grammar kalimat tersebut...",
    "options_breakdown": {
      "a": "Penjelasan mengapa opsi a salah/benar...",
      "b": "Penjelasan mengapa opsi b salah/benar...",
      "c": "Penjelasan mengapa opsi c salah/benar...",
      "d": "Penjelasan mengapa opsi d salah/benar..."
    },
    "reasoning": "Logika utama mengapa opsi tersebut adalah jawaban paling tepat..."
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
          console.warn(`[Generate Classic API] Live attempt ${attempt} failed:`, e.message || e);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
      }

      if (finalQuestions.length === 0) {
        console.error('[Generate Classic API] All attempts failed. Last Error:', lastError);
        return NextResponse.json({ error: 'Gagal menghasilkan soal setelah beberapa percobaan. Silakan coba lagi.' }, { status: 500 });
      }
    }

    // Trigger asynchronous refill bank
    const baseUrl = req.nextUrl.origin;
    if (userId) {
      fetch(`${baseUrl}/api/refill-bank?userId=${userId}`).catch(err => {
        console.error('[Generate Classic API] Failed to trigger refill bank in background:', err);
      });
    }

    // Return the full questions (with answers and explanations) for client-side practice interaction
    return NextResponse.json({
      questions: finalQuestions
    });

  } catch (error: any) {
    console.error('[Generate Classic API] Fatal Error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan internal server.' }, { status: 500 });
  }
}
