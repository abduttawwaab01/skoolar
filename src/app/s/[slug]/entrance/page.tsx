import { notFound } from 'next/navigation';
import { getSchoolFromSlug } from '@/lib/school-cache';
import { parseSectionVisibility } from '@/lib/school-utils';
import { db } from '@/lib/db';
import { EntranceWizard } from '@/components/entrance/entrance-wizard';

export const revalidate = 3600;

export default async function SchoolEntrancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const school = await getSchoolFromSlug(slug);
  if (!school || !school.isPublished) return notFound();
  const visibility = parseSectionVisibility(school.sectionVisibility);
  if (!visibility.entranceExam) return notFound();

  const exam = await db.entranceExam.findFirst({
    where: { schoolId: school.id, isActive: true, deletedAt: null },
    include: {
      school: { select: { id: true, name: true, logo: true, primaryColor: true } },
      questions: { orderBy: { order: 'asc' }, select: { id: true, type: true, questionText: true, options: true, marks: true, mediaUrl: true, order: true } },
    },
  });

  if (!exam) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-10 max-w-md text-center">
          <SchoolIcon />
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Entrance Exam Available</h2>
          <p className="text-gray-500">There is no active entrance exam for {school.name} at this time. Please check back later or contact the school directly.</p>
        </div>
      </div>
    );
  }

  const examData = {
    id: exam.id,
    title: exam.title,
    description: exam.description,
    type: exam.type,
    duration: exam.duration,
    instructions: exam.instructions,
    totalMarks: exam.totalMarks,
    school: exam.school,
    questions: exam.questions,
    securitySettings: exam.securitySettings ? JSON.parse(exam.securitySettings) : null,
    allowCalculator: exam.allowCalculator,
    calculatorMode: exam.calculatorMode as 'none' | 'basic' | 'scientific' | 'both',
  };

  return <EntranceWizard initialExam={examData} hideHeader />;
}

function SchoolIcon() {
  return (
    <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    </svg>
  );
}
