import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const AI_PROVIDER = (process.env.AI_PROVIDER || 'openrouter').toLowerCase();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

const LOCAL_LLM_BASE_URL = process.env.LOCAL_LLM_BASE_URL || 'http://localhost:8080/v1';
const LOCAL_LLM_API_KEY = process.env.LOCAL_LLM_API_KEY || '';

const FETCH_TIMEOUT_MS = AI_PROVIDER === 'local' ? 60000 : 30000;

const AI_MODELS = AI_PROVIDER === 'local'
  ? [process.env.LOCAL_LLM_MODEL || 'default']
  : [
      'mistralai/mistral-7b-instruct:free',
      'huggingfaceh4/zephyr-7b-beta:free',
      'microsoft/phi-3-mini-4k-instruct:free',
      'google/gemma-4-31b-it:free',
      'nvidia/nemotron-3-super-120b-a12b:free',
      'qwen/qwen3-8b',
      'microsoft/phi-4-mini-instruct',
      'meta-llama/llama-3.1-8b-instruct',
      'mistralai/ministral-8b-2512',
      'qwen/qwen-2.5-7b-instruct',
      'liquid/lfm-2.5-1.2b-instruct:free',
      'z-ai/glm-4.5-air:free',
      'openrouter/free',
    ];

async function callAI(messages: Array<{ role: string; content: string }>, model: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const baseUrl = AI_PROVIDER === 'local' ? LOCAL_LLM_BASE_URL : OPENROUTER_BASE_URL;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (AI_PROVIDER === 'local') {
      if (LOCAL_LLM_API_KEY) headers['Authorization'] = `Bearer ${LOCAL_LLM_API_KEY}`;
    } else {
      headers['Authorization'] = `Bearer ${OPENROUTER_API_KEY}`;
      headers['HTTP-Referer'] = process.env.NEXTAUTH_URL || 'https://skoolar.org';
      headers['X-Title'] = 'Skoolar';
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      signal: controller.signal,
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices?.[0]?.message?.content || null;
    }

    const error = await response.text();
    console.warn(`AI model ${model} returned ${response.status}: ${error.slice(0, 200)}`);
    return null;
  } catch (error) {
    console.warn(`AI model ${model} failed:`, error instanceof Error ? error.message.slice(0, 100) : error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function generateAISuggestion(
  score: number,
  totalMarks: number,
  passingMarks: number,
  applicantName: string,
  examTitle: string,
  questions: any[],
  answers: any
): Promise<string | null> {
  if (!OPENROUTER_API_KEY) return null;

  const percentage = (score / totalMarks) * 100;
  
  // Format answers for AI context (if manageable)
  let answersContext = '';
  if (answers && typeof answers === 'object') {
    const answerEntries = Object.entries(answers);
    if (answerEntries.length > 0) {
      answersContext = "\n\nAnswers Provided:\n" + answerEntries.map(([qId, val]) => {
        const question = questions.find(q => q.id === qId);
        if (!question) return '';
        return `Q: ${question.questionText}\nA: ${val}`;
      }).join('\n');
    }
  }

  const prompt = `You are an automated school admissions assistant evaluating an applicant's submission.
Exam/Interview Title: ${examTitle}
Applicant: ${applicantName}
Objective Score: ${score} out of ${totalMarks} (${percentage.toFixed(1)}%)
Passing Threshold: ${passingMarks}
${answersContext.substring(0, 2000)} // Truncate to avoid prompt bloat

Task:
Provide a concise 2-sentence admission or interview evaluation. 
1. Determine if the applicant is "Recommended", "Borderline", or "Not Recommended" based on their score and any provided answers.
2. If there are essay/descriptive answers, briefly note their quality.
Stay professional and objective.`;

  try {
    // Try each model with fallback
    for (const model of AI_MODELS) {
      const content = await callAI([
        { role: 'system', content: 'You are an objective AI school admission and HR assistant.' },
        { role: 'user', content: prompt }
      ], model);

      if (content) return content;
    }

    return null;
  } catch (error) {
    console.error('Failed to generate AI suggestion:', error);
    return null;
  }
}

function generateRuleBasedSuggestion(score: number, totalMarks: number, passingMarks: number): string {
  const percentage = (score / Number(totalMarks)) * 100;
  const passPercentage = (Number(passingMarks) / Number(totalMarks)) * 100;

  if (percentage >= passPercentage + 15) {
    return `Highly Recommended. The applicant scored exceptionally well (${percentage.toFixed(1)}%), safely above the ${passPercentage.toFixed(1)}% threshold.`;
  } else if (percentage >= passPercentage) {
    return `Recommended. The applicant met the minimum requirements with a score of ${percentage.toFixed(1)}%.`;
  } else if (percentage >= passPercentage - 10) {
    return `Borderline. The applicant scored ${percentage.toFixed(1)}%, falling slightly below the passing mark. Further review or interview suggested.`;
  } else {
    return `Not Recommended. The applicant scored ${percentage.toFixed(1)}%, which is well below the passing threshold.`;
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const {
      applicantName, applicantEmail, applicantPhone, applicantAddress,
      answers, securityViolations, tabSwitchCount, timeTakenSeconds, attemptId
    } = body;

    // If attemptId provided, resolve name from existing record
    let resolvedName = applicantName;
    if (!resolvedName && attemptId) {
      const existing = await db.entranceExamAttempt.findUnique({ where: { id: attemptId }, select: { applicantName: true } });
      if (existing) resolvedName = existing.applicantName;
    }

    if (!resolvedName) {
      return NextResponse.json({ error: 'Applicant name is required' }, { status: 400 });
    }

    const exam = await db.entranceExam.findUnique({
      where: { id },
      include: {
        questions: true,
        school: true
      }
    });

    if (!exam || exam.deletedAt || !exam.isActive) {
      return NextResponse.json({ error: 'Exam not found or inactive' }, { status: 404 });
    }

    // Auto-grade objective questions
    let autoScore = 0;
    const parsedAnswers = typeof answers === 'string' ? JSON.parse(answers) : answers;

    if (parsedAnswers && typeof parsedAnswers === 'object') {
      for (const question of exam.questions) {
        if (!question.correctAnswer) continue;
        
        const studentAnswer = parsedAnswers[question.id];
        if (studentAnswer === undefined || studentAnswer === null) continue;
        
        if (question.type === 'MCQ' || question.type === 'TRUE_FALSE') {
          if (String(studentAnswer).trim().toLowerCase() === String(question.correctAnswer).trim().toLowerCase()) {
            autoScore += question.marks;
          }
        } else if (question.type === 'MULTI_SELECT') {
          let correctOptions: string[];
          try {
            correctOptions = typeof question.correctAnswer === 'string'
              ? JSON.parse(question.correctAnswer)
              : question.correctAnswer;
          } catch { correctOptions = [String(question.correctAnswer)]; }
          if (!Array.isArray(correctOptions)) correctOptions = [String(correctOptions)];
          
          const studentArr = Array.isArray(studentAnswer) ? studentAnswer : [studentAnswer];
          const studentNorm = studentArr.map((a: unknown) => String(a).trim().toLowerCase()).sort();
          const correctNorm = correctOptions.map((a: string) => a.trim().toLowerCase()).sort();
          
          if (studentNorm.length === correctNorm.length && studentNorm.every((v: string, i: number) => v === correctNorm[i])) {
            autoScore += question.marks;
          }
        } else if (question.type === 'SHORT_ANSWER' || question.type === 'FILL_BLANK') {
          const correctKeywords = String(question.correctAnswer).trim().toLowerCase();
          const studentText = String(studentAnswer).trim().toLowerCase();
          if (studentText.includes(correctKeywords) || correctKeywords.includes(studentText)) {
            autoScore += question.marks;
          }
        }
      }
    }

    // Generate Suggestions (AI + Rule-based fallback)
    let finalSuggestion = '';
    const aiSuggestion = await generateAISuggestion(autoScore, exam.totalMarks, exam.passingMarks, resolvedName, exam.title, exam.questions, parsedAnswers);
    const ruleBasedSuggestion = generateRuleBasedSuggestion(autoScore, exam.totalMarks, exam.passingMarks);

    if (aiSuggestion) {
      finalSuggestion = `[AI System Analysis]: ${aiSuggestion}\n\n[Rule-Based System]: ${ruleBasedSuggestion}`;
    } else {
      finalSuggestion = `[System Assessment]: ${ruleBasedSuggestion}`;
    }

    // Update existing attempt (registered via entrance-exams flow) or create new one
    let attempt;
    if (attemptId) {
      attempt = await db.entranceExamAttempt.update({
        where: { id: attemptId },
        data: {
          answers: answers ? JSON.stringify(answers) : null,
          autoScore,
          finalScore: autoScore,
          status: 'submitted',
          registrationStatus: 'pending_review',
          securityViolations: securityViolations ? JSON.stringify(securityViolations) : null,
          tabSwitchCount: tabSwitchCount || 0,
          timeTakenSeconds: timeTakenSeconds || null,
          aiSuggestions: finalSuggestion,
          submittedAt: new Date(),
        },
      });
    } else {
      attempt = await db.entranceExamAttempt.create({
        data: {
          entranceExamId: id,
          applicantName,
          applicantEmail,
          applicantPhone,
          applicantAddress,
          answers: answers ? JSON.stringify(answers) : null,
          autoScore,
          finalScore: autoScore,
          status: 'submitted',
          registrationStatus: 'pending_review',
          securityViolations: securityViolations ? JSON.stringify(securityViolations) : null,
          tabSwitchCount: tabSwitchCount || 0,
          timeTakenSeconds: timeTakenSeconds || null,
          aiSuggestions: finalSuggestion,
          submittedAt: new Date(),
        },
      });
    }

    // Notify School Admins
    const admins = await db.user.findMany({
      where: {
        schoolId: exam.schoolId,
        role: { in: ['SCHOOL_ADMIN', 'DIRECTOR'] },
        isActive: true
      }
    });

    if (admins.length > 0) {
      await db.notification.createMany({
        data: admins.map(admin => ({
          userId: admin.id,
          schoolId: exam.schoolId,
          title: 'New Entrance Exam Submission',
          message: `${resolvedName} has completed "${exam.title}" with a score of ${autoScore}/${exam.totalMarks}.`,
          type: 'info',
          category: 'exam',
          actionUrl: `/dashboard?view=entrance-exams&attemptId=${attempt.id}`
        }))
      });
    }

    return NextResponse.json({ 
      message: 'Exam submitted successfully',
      data: { score: autoScore, total: exam.totalMarks } 
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
