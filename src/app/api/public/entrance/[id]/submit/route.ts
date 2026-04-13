import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

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
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp:free', // Using a reliable free model
        messages: [
          { role: 'system', content: 'You are an objective AI school admission and HR assistant.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices?.[0]?.message?.content || null;
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
      answers, securityViolations, tabSwitchCount, timeTakenSeconds
    } = body;

    if (!applicantName) {
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
        if (studentAnswer !== undefined && studentAnswer !== null) {
          if (question.type === 'MCQ' || question.type === 'TRUE_FALSE') {
             // Basic exact match for single choice
             if (String(studentAnswer).trim().toLowerCase() === String(question.correctAnswer).trim().toLowerCase()) {
                autoScore += question.marks;
             }
          }
           // Multi-select / fill blank logic could go here if implemented on frontend
        }
      }
    }

    // Generate Suggestions (AI + Rule-based fallback)
    let finalSuggestion = '';
    const aiSuggestion = await generateAISuggestion(autoScore, exam.totalMarks, exam.passingMarks, applicantName, exam.title, exam.questions, parsedAnswers);
    const ruleBasedSuggestion = generateRuleBasedSuggestion(autoScore, exam.totalMarks, exam.passingMarks);

    if (aiSuggestion) {
      finalSuggestion = `[AI System Analysis]: ${aiSuggestion}\n\n[Rule-Based System]: ${ruleBasedSuggestion}`;
    } else {
      finalSuggestion = `[System Assessment]: ${ruleBasedSuggestion}`;
    }

    // Create Attempt
    const attempt = await db.entranceExamAttempt.create({
      data: {
        entranceExamId: id,
        applicantName,
        applicantEmail,
        applicantPhone,
        applicantAddress,
        answers: answers ? JSON.stringify(answers) : null,
        autoScore,
        finalScore: autoScore, // Assuming final is auto for now, admin can override
        status: 'submitted',
        securityViolations: securityViolations ? JSON.stringify(securityViolations) : null,
        tabSwitchCount: tabSwitchCount || 0,
        timeTakenSeconds: timeTakenSeconds || null,
        aiSuggestions: finalSuggestion,
        submittedAt: new Date(),
      }
    });

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
          message: `${applicantName} has completed "${exam.title}" with a score of ${autoScore}/${exam.totalMarks}.`,
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
