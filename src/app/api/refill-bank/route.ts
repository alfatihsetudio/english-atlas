import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // 1. Scan all modes and tiers to find one that needs refilling (count < 30)
    let targetMode: 'classic' | 'ranked' | null = null;
    let targetTier: number | null = null;
    let currentCount = 30;

    const modes: ('classic' | 'ranked')[] = ['ranked', 'classic'];
    const tiers = [1, 2, 3, 4, 5];

    for (const m of modes) {
      for (const t of tiers) {
        const { count, error } = await supabase
          .from('pregenerated_questions')
          .select('*', { count: 'exact', head: true })
          .eq('mode', m)
          .eq('tier', t)
          .eq('user_id', userId)
          .eq('is_used', false);

        if (error) {
          console.error(`[Refill Bank] Error counting ${m} tier ${t}:`, error);
          continue;
        }

        const countVal = count || 0;
        if (countVal < 30 && countVal < currentCount) {
          targetMode = m;
          targetTier = t;
          currentCount = countVal;
        }
      }
    }

    if (!targetMode || targetTier === null) {
      return NextResponse.json({ status: 'full', message: 'All pools are full (>= 30 questions each)' });
    }

    console.log(`[Refill Bank] Refilling ${targetMode} tier ${targetTier}. Current count: ${currentCount}`);

    // 2. Generate 10 questions for the selected mode and tier
    const questionsToGenerate = 10;
    let prompt = '';

    if (targetMode === 'ranked') {
      let focusArea = '';
      let aiPrompt = '';

      if (targetTier === 1) {
        focusArea = 'Fokus pada Basic Tenses (Present, Past), Articles (a/an/the), dan Singular/Plural.';
        aiPrompt = 'Gunakan kalimat pendek dan sederhana. Kosa kata dasar. Gramatika jelas.';
      } else if (targetTier === 2) {
        focusArea = 'Fokus pada Continuous Tenses, Prepositions, dan Basic Modals.';
        aiPrompt = 'Gunakan kalimat sedang. Kosa kata menengah. Berikan pengecoh logis.';
      } else if (targetTier === 3) {
        focusArea = 'Fokus pada Perfect Tenses, Conditionals Type 1 & 2, dan Passive Voice.';
        aiPrompt = 'Gunakan kalimat majemuk. Kosa kata tingkat atas. Pengecoh harus terlihat sangat mirip dengan jawaban benar.';
      } else if (targetTier === 4) {
        focusArea = 'Fokus pada Mixed Conditionals, Relative Clauses, dan Advanced Modals.';
        aiPrompt = 'Gunakan kalimat panjang dengan klausa anak. Kosa kata akademik/sulit. Struktur kalimat kompleks.';
      } else if (targetTier === 5) {
        focusArea = 'Fokus pada Advanced Inversion, Subjunctive, dan Mixed Conditionals.';
        aiPrompt = 'Gunakan kalimat kompleks standar akademik IELTS (Band 7-9). Kosakata tingkat lanjut yang tepat guna. Fokus pada penerapan grammar tingkat tinggi dan berikan pilihan pengecoh yang kuat.';
      }

      const topics = ['Astronomi & Tata Surya', 'Bisnis & Pasar Global', 'Sejarah Peradaban Kuno', 'Budaya Populer & Hiburan', 'Lingkungan & Konservasi Alam', 'Kesehatan & Medis', 'Kecerdasan Buatan & Robotika', 'Psikologi Manusia', 'Seni Klasik & Sastra', 'Olahraga Ekstrem', 'Pariwisata Tersembunyi', 'Hukum & Keadilan', 'Evolusi Biologi', 'Arsitektur Megah', 'Mitos & Legenda Lokal', 'Penjelajahan Laut Dalam', 'Sistem Transportasi Masa Depan', 'Kuliner Tradisional Dunia'];
      const randomTopic = topics[Math.floor(Math.random() * topics.length)];

      prompt = `Kamu adalah Professor Bahasa Inggris yang sangat teliti.
Buatlah tepat ${questionsToGenerate} soal bahasa Inggris (pilihan ganda) yang menantang.
Target Difficulty Tier: ${targetTier}
Fokus Area: ${focusArea}
Gaya Kalimat: ${aiPrompt}

Instruksi Konteks:
- Wajib membuat konteks/topik kalimat HANYA seputar: **${randomTopic}**
- Pastikan kalimat yang dibuat SANGAT BERVARIASI dan TIDAK SAMA dengan soal-soal sebelumnya. Gunakan kosakata yang kaya terkait topik tersebut.

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
    } else {
      // Classic Mode
      let focusArea = '';
      if (targetTier === 1) {
        focusArea = 'Tier 1 (Beginner): Fokus pada materi dasar seperti Basic Tenses (Present, Past), Articles (a/an/the), Kosakata sehari-hari, dan Singular/Plural.';
      } else if (targetTier === 2) {
        focusArea = 'Tier 2 (Elementary): Fokus pada materi elementer seperti Continuous Tenses, Simple Modals, Prepositions of time/place, dan struktur kalimat dasar.';
      } else if (targetTier === 3) {
        focusArea = 'Tier 3 (Intermediate): Fokus pada materi menengah seperti Perfect Tenses, Conditionals Type 1 & 2, Passive Voice dasar, dan Gerunds/Infinitives.';
      } else if (targetTier === 4) {
        focusArea = 'Tier 4 (Advanced): Fokus pada materi lanjutan seperti Mixed Conditionals, Advanced Relative Clauses, Subjunctive, dan Advanced Modals.';
      } else if (targetTier === 5) {
        focusArea = 'Tier 5 (Immortal Mastery): Fokus pada materi kompleks standar akademik IELTS (Band 7-9) seperti Inversion, Subjunctive, dan kosakata tingkat tinggi.';
      }

      const topics = ['Astronomi & Tata Surya', 'Bisnis & Pasar Global', 'Sejarah Peradaban Kuno', 'Budaya Populer & Hiburan', 'Lingkungan & Konservasi Alam', 'Kesehatan & Medis', 'Kecerdasan Buatan & Robotika', 'Psikologi Manusia', 'Seni Klasik & Sastra', 'Olahraga Ekstrem', 'Pariwisata Tersembunyi', 'Hukum & Keadilan', 'Evolusi Biologi', 'Arsitektur Megah', 'Mitos & Legenda Lokal', 'Penjelajahan Laut Dalam', 'Sistem Transportasi Masa Depan', 'Kuliner Tradisional Dunia'];
      const randomTopic = topics[Math.floor(Math.random() * topics.length)];

      prompt = `Kamu adalah Professor Bahasa Inggris yang sangat teliti.
Buatlah tepat ${questionsToGenerate} soal bahasa Inggris (pilihan ganda) yang edukatif berdasarkan tingkat kesulitan ini:
Tier ${targetTier}: ${focusArea}

Instruksi Konteks:
- Wajib membuat konteks/topik kalimat HANYA seputar: **${randomTopic}**
- Pastikan kalimat yang dibuat SANGAT BERVARIASI dan TIDAK SAMA dengan soal-soal sebelumnya. Gunakan kosakata yang kaya terkait topik tersebut.

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
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-lite-latest',
      generationConfig: { temperature: 0.7, responseMimeType: 'application/json' }
    });

    const result = await model.generateContent(prompt);
    const rawText = result.response.text().trim();
    const sanitizeJson = (str: string) => {
      return str
        .replace(/\/\/.*/g, '') // Remove single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
        .replace(/,(\s*[\]}])/g, '$1') // Remove trailing commas
        .trim();
    };

    const extractValidJson = (str: string): string => {
      const firstBracket = str.indexOf('[');
      const firstBrace = str.indexOf('{');
      
      if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
        let count = 0;
        let inString = false;
        let escape = false;
        for (let i = firstBracket; i < str.length; i++) {
          const char = str[i];
          if (escape) { escape = false; continue; }
          if (char === '\\') { escape = true; continue; }
          if (char === '"') { inString = !inString; continue; }
          if (!inString) {
            if (char === '[') count++;
            if (char === ']') {
              count--;
              if (count === 0) return str.substring(firstBracket, i + 1);
            }
          }
        }
      } else if (firstBrace !== -1) {
        let count = 0;
        let inString = false;
        let escape = false;
        for (let i = firstBrace; i < str.length; i++) {
          const char = str[i];
          if (escape) { escape = false; continue; }
          if (char === '\\') { escape = true; continue; }
          if (char === '"') { inString = !inString; continue; }
          if (!inString) {
            if (char === '{') count++;
            if (char === '}') {
              count--;
              if (count === 0) return str.substring(firstBrace, i + 1);
            }
          }
        }
      }
      return str;
    };

    let parsed: any[] = [];
    try {
      const sanitized = sanitizeJson(rawText);
      parsed = JSON.parse(sanitized);
    } catch (e) {
      const extracted = extractValidJson(rawText);
      try {
        parsed = JSON.parse(sanitizeJson(extracted));
      } catch (err2) {
        // If it's an object wrapping the array, try parsing it
        try {
          const parsedObj = JSON.parse(sanitizeJson(extracted));
          for (const key in parsedObj) {
            if (Array.isArray(parsedObj[key])) {
              parsed = parsedObj[key];
              break;
            }
          }
        } catch (err3) {
          throw err2; // throw original parsing error if extraction failed
        }
      }
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('AI generated invalid structure');
    }

    const findOption = (obj: any, letter: 'a' | 'b' | 'c' | 'd'): string => {
      const keys = Object.keys(obj);
      const regex = new RegExp(`^(option|opt|choice|answer|select)?_?${letter}$`, 'i');
      for (const key of keys) {
        if (regex.test(key)) return obj[key] || '';
      }
      return '';
    };

    const findCorrectAnswer = (obj: any): string => {
      const keys = Object.keys(obj);
      const regex = /^(correct_answer|correctAnswer|correct|answer|key)$/i;
      for (const key of keys) {
        if (regex.test(key)) {
          const val = obj[key];
          if (typeof val === 'string') return val.trim().toLowerCase();
        }
      }
      return (obj.correct_answer || obj.correct || '').toLowerCase();
    };

    const findExplanation = (obj: any): string => {
      const keys = Object.keys(obj);
      const regex = /^(question_explanation|explanation|reason|reasoning|analysis|desc|description)$/i;
      for (const key of keys) {
        if (regex.test(key)) return obj[key] || '';
      }
      return '';
    };

    // 3. Format and insert into DB
    const insertData = parsed.map((q) => {
      let finalExplanation = '';
      if (targetMode === 'classic') {
        const explText = findExplanation(q) || q.question_explanation || '';
        const breakA = q.options_breakdown?.a || q.optionsBreakdown?.a || '';
        const breakB = q.options_breakdown?.b || q.optionsBreakdown?.b || '';
        const breakC = q.options_breakdown?.c || q.optionsBreakdown?.c || '';
        const breakD = q.options_breakdown?.d || q.optionsBreakdown?.d || '';
        const reasoningText = q.reasoning || q.reason || '';
        finalExplanation = `${explText}\n\n**Analisis Opsi:**\n- A: ${breakA}\n- B: ${breakB}\n- C: ${breakC}\n- D: ${breakD}\n\n**Alasan Utama:**\n${reasoningText}`;
      } else {
        finalExplanation = findExplanation(q) || q.explanation || '';
      }

      return {
        mode: targetMode,
        tier: targetTier,
        user_id: userId,
        question: q.question || q.text || '',
        option_a: findOption(q, 'a'),
        option_b: findOption(q, 'b'),
        option_c: findOption(q, 'c'),
        option_d: findOption(q, 'd'),
        correct_answer: findCorrectAnswer(q),
        explanation: finalExplanation,
        raw_data: q,
        is_used: false
      };
    });

    const { error: insertError } = await supabase.from('pregenerated_questions').insert(insertData);
    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      status: 'refilled',
      mode: targetMode,
      tier: targetTier,
      added: insertData.length
    });

  } catch (error: any) {
    console.error('[Refill Bank] Fatal Error:', error);
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }
}
