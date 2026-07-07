import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';
import { NextRequest, NextResponse } from 'next/server';
import { resolveTeacherId } from '@/lib/api-helpers';

function mapFrontendSettingsToDb(settings: Record<string, unknown>) {
  const ss: Record<string, unknown> = {};
  if (settings.blockCopyPaste !== undefined) ss.blockCopyPaste = settings.blockCopyPaste;
  if (settings.monitorTabSwitch !== undefined) ss.monitorTabSwitch = settings.monitorTabSwitch;
  if (settings.maxTabSwitches !== undefined) ss.maxTabSwitches = settings.maxTabSwitches ?? null;
  if (settings.monitorWebcam !== undefined) ss.monitorWebcam = settings.monitorWebcam;
  if (settings.randomizeQuestions !== undefined) ss.randomizeQuestions = settings.randomizeQuestions;
  if (settings.randomizeOptions !== undefined) ss.randomizeOptions = settings.randomizeOptions;
  if (settings.fullscreenMode !== undefined) ss.fullscreenMode = settings.fullscreenMode;
  if (settings.blockRightClick !== undefined) ss.blockRightClick = settings.blockRightClick;
  if (settings.blockKeyboardShortcuts !== undefined) ss.blockKeyboardShortcuts = settings.blockKeyboardShortcuts;
  if (settings.showResultAfterSubmit !== undefined) ss.showResultAfterSubmit = settings.showResultAfterSubmit;
  return ss;
}

function mapDbToFrontendSettings(security: Record<string, unknown>): Record<string, unknown> {
  const fs: Record<string, unknown> = {};
  if (security.blockCopyPaste !== undefined) fs.blockCopyPaste = security.blockCopyPaste;
  if (security.monitorTabSwitch !== undefined) fs.monitorTabSwitch = security.monitorTabSwitch;
  if (security.maxTabSwitches !== undefined) fs.maxTabSwitches = security.maxTabSwitches;
  if (security.monitorWebcam !== undefined) fs.monitorWebcam = security.monitorWebcam;
  if (security.randomizeQuestions !== undefined) fs.randomizeQuestions = security.randomizeQuestions;
  if (security.randomizeOptions !== undefined) fs.randomizeOptions = security.randomizeOptions;
  if (security.fullscreenMode !== undefined) fs.fullscreenMode = security.fullscreenMode;
  if (security.blockRightClick !== undefined) fs.blockRightClick = security.blockRightClick;
  if (security.blockKeyboardShortcuts !== undefined) fs.blockKeyboardShortcuts = security.blockKeyboardShortcuts;
  if (security.showResultAfterSubmit !== undefined) fs.showResultAfterSubmit = security.showResultAfterSubmit;
  return fs;
}

function mergeSettings(securityModel: Record<string, unknown> | null, examJson: string | null): Record<string, unknown> {
  const defaults = {
    blockCopyPaste: false,
    monitorTabSwitch: false,
    maxTabSwitches: 3,
    monitorWebcam: false,
    randomizeQuestions: false,
    randomizeOptions: false,
    fullscreenMode: false,
    blockRightClick: false,
    blockKeyboardShortcuts: false,
    showResultAfterSubmit: false,
  };
  if (securityModel) {
    return { ...defaults, ...mapDbToFrontendSettings(securityModel) };
  }
  try {
    const parsed = examJson ? JSON.parse(examJson) : {};
    return {
      ...defaults,
      blockCopyPaste: parsed.blockCopyPaste ?? defaults.blockCopyPaste,
      monitorTabSwitch: parsed.tabSwitchWarning ?? defaults.monitorTabSwitch,
      maxTabSwitches: parsed.maxTabSwitches ?? defaults.maxTabSwitches,
      monitorWebcam: parsed.webcamMonitor ?? defaults.monitorWebcam,
      randomizeQuestions: parsed.randomizeQuestions ?? defaults.randomizeQuestions,
      randomizeOptions: parsed.randomizeOptions ?? defaults.randomizeOptions,
      fullscreenMode: parsed.fullscreen ?? defaults.fullscreenMode,
      blockRightClick: parsed.blockRightClick ?? defaults.blockRightClick,
      blockKeyboardShortcuts: parsed.blockKeyboardShortcuts ?? defaults.blockKeyboardShortcuts,
      showResultAfterSubmit: parsed.showResultAfterSubmit ?? defaults.showResultAfterSubmit,
    };
  } catch {
    return defaults;
  }
}

// GET /api/exams/[id]/security - Fetch security settings
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const exam = await db.exam.findUnique({
      where: auth.role === 'SUPER_ADMIN' ? { id } : { id, schoolId: auth.schoolId },
      include: { security: true },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    const securitySettings = mergeSettings(
      exam.security as unknown as Record<string, unknown> | null,
      exam.securitySettings
    );

    return NextResponse.json({
      data: {
        ...securitySettings,
        allowCalculator: exam.allowCalculator,
        calculatorMode: exam.calculatorMode,
        shuffleQuestions: exam.shuffleQuestions,
        shuffleOptions: exam.shuffleOptions,
        showResult: exam.showResult,
        negativeMarking: exam.negativeMarking,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/exams/[id]/security - Update/create security settings
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.exam.findUnique({ 
      where: auth.role === 'SUPER_ADMIN' ? { id } : { id, schoolId: auth.schoolId } 
    });
    if (!existing) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    if (auth.role === 'TEACHER') {
      const teacherId = await resolveTeacherId(auth.userId || '');
      if (!teacherId || existing.teacherId !== teacherId) {
        return NextResponse.json({ error: 'You can only update your own exams' }, { status: 403 });
      }
    }

    const securityFields = [
      'blockCopyPaste', 'monitorTabSwitch', 'maxTabSwitches', 'monitorWebcam',
      'randomizeQuestions', 'randomizeOptions', 'fullscreenMode', 'blockRightClick',
      'blockKeyboardShortcuts', 'showResultAfterSubmit',
    ];
    const examFields = [
      'allowCalculator', 'calculatorMode', 'shuffleQuestions', 'shuffleOptions',
      'showResult', 'negativeMarking',
    ];

    const securityData: Record<string, unknown> = {};
    for (const key of securityFields) {
      if (body[key] !== undefined) securityData[key] = body[key];
    }

    const examData: Record<string, unknown> = {};
    for (const key of examFields) {
      if (body[key] !== undefined) examData[key] = body[key];
    }

    // Build JSON-compatible security settings object for Exam.securitySettings
    const jsonSettings: Record<string, unknown> = {};
    if (securityData.blockCopyPaste !== undefined) jsonSettings.blockCopyPaste = securityData.blockCopyPaste;
    if (securityData.monitorTabSwitch !== undefined) jsonSettings.tabSwitchWarning = securityData.monitorTabSwitch;
    if (securityData.maxTabSwitches !== undefined) jsonSettings.maxTabSwitches = securityData.maxTabSwitches;
    if (securityData.monitorWebcam !== undefined) jsonSettings.webcamMonitor = securityData.monitorWebcam;
    if (securityData.randomizeQuestions !== undefined) jsonSettings.randomizeQuestions = securityData.randomizeQuestions;
    if (securityData.randomizeOptions !== undefined) jsonSettings.randomizeOptions = securityData.randomizeOptions;
    if (securityData.fullscreenMode !== undefined) jsonSettings.fullscreen = securityData.fullscreenMode;
    if (securityData.blockRightClick !== undefined) jsonSettings.blockRightClick = securityData.blockRightClick;
    if (securityData.blockKeyboardShortcuts !== undefined) jsonSettings.blockKeyboardShortcuts = securityData.blockKeyboardShortcuts;
    if (securityData.showResultAfterSubmit !== undefined) jsonSettings.showResultAfterSubmit = securityData.showResultAfterSubmit;

    await db.$transaction([
      db.exam.update({
        where: { id },
        data: {
          securitySettings: JSON.stringify(jsonSettings),
          ...examData,
        },
      }),
      db.examSecuritySettings.upsert({
        where: { examId: id },
        create: { examId: id, ...mapFrontendSettingsToDb(securityData) },
        update: mapFrontendSettingsToDb(securityData),
      }),
    ]);

    return NextResponse.json({
      data: { ...securityData, ...examData },
      message: 'Security settings updated successfully',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/exams/[id]/security - Reset security settings to defaults
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.exam.findUnique({ 
      where: auth.role === 'SUPER_ADMIN' ? { id } : { id, schoolId: auth.schoolId } 
    });
    if (!existing) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    if (auth.role === 'TEACHER') {
      const teacherId = await resolveTeacherId(auth.userId || '');
      if (!teacherId || existing.teacherId !== teacherId) {
        return NextResponse.json({ error: 'You can only update your own exams' }, { status: 403 });
      }
    }

    await db.examSecuritySettings.deleteMany({ where: { examId: id } });
    await db.exam.update({
      where: { id },
      data: { securitySettings: null },
    });

    return NextResponse.json({ message: 'Security settings reset to defaults' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
