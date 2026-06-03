/**
 * DOCX Export Utilities for Skoolar
 * Generates Word documents for exam questions and results using the `docx` npm package.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  TableBorders,
  VerticalAlign,
  ShadingType,
} from 'docx';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExamInfo {
  id: string;
  name: string;
  type: string;
  totalMarks: number;
  passingMarks?: number;
  subject?: { name: string } | null;
  class?: { name: string } | null;
  duration?: number | null;
  instructions?: string | null;
}

interface ExamQuestionData {
  id: string;
  type: string;
  questionText: string;
  options: string | null;
  correctAnswer: string | null;
  marks: number;
  explanation: string | null;
  mediaUrl?: string | null;
  order: number;
}

interface ExamScoreData {
  id: string;
  score: number;
  grade: string | null;
  remarks: string | null;
  student: {
    id: string;
    admissionNo: string | null;
    user: { name: string | null; email: string | null } | null;
  } | null;
}

interface ExamStats {
  average: number;
  highest: number;
  lowest: number;
  passRate: number;
  totalStudents: number;
  passed: number;
  failed: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format a question type label */
function formatQuestionType(type: string): string {
  const labels: Record<string, string> = {
    MCQ: 'Multiple Choice',
    MULTI_SELECT: 'Multiple Select',
    TRUE_FALSE: 'True / False',
    FILL_BLANK: 'Fill in the Blank',
    SHORT_ANSWER: 'Short Answer',
    ESSAY: 'Essay',
    MATCHING: 'Matching',
  };
  return labels[type] || type;
}

/** Parse options from JSON string into a readable string array */
function parseOptions(options: string | null): string[] {
  if (!options) return [];
  try {
    const parsed = JSON.parse(options);
    if (Array.isArray(parsed)) {
      return parsed.map((opt: string, i: number) => `${String.fromCharCode(65 + i)}. ${opt}`);
    }
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.pairs)) {
      return parsed.pairs.map(
        (pair: { left: string; right: string }) => `${pair.left} \u2192 ${pair.right}`
      );
    }
    return [String(options)];
  } catch {
    return [options];
  }
}

/** Parse correct answer from JSON string */
function parseCorrectAnswer(correctAnswer: string | null): string {
  if (!correctAnswer) return 'N/A';
  try {
    const parsed = JSON.parse(correctAnswer);
    if (Array.isArray(parsed)) {
      return parsed.join(', ');
    }
    if (typeof parsed === 'object' && parsed !== null) {
      return JSON.stringify(parsed);
    }
    return String(parsed);
  } catch {
    return correctAnswer;
  }
}

/** Helper to determine grade from percentage */
function getGrade(score: number, total: number): string {
  const percentage = (score / total) * 100;
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
}

/** Calculate statistics from score entries */
function calculateStats(scores: ExamScoreData[], totalMarks: number, passingMarks: number): ExamStats {
  if (scores.length === 0) {
    return { average: 0, highest: 0, lowest: 0, passRate: 0, totalStudents: 0, passed: 0, failed: 0 };
  }
  const scoreValues = scores.map((s) => s.score);
  const sum = scoreValues.reduce((a, b) => a + b, 0);
  const passed = scoreValues.filter((s) => s >= passingMarks).length;
  return {
    average: Math.round((sum / scoreValues.length) * 100) / 100,
    highest: Math.max(...scoreValues),
    lowest: Math.min(...scoreValues),
    passRate: Math.round((passed / scoreValues.length) * 100),
    totalStudents: scoreValues.length,
    passed,
    failed: scoreValues.length - passed,
  };
}

/** Create a standard table border set */
function createTableBorders() {
  return {
    top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  };
}

/** Create a standard table cell */
function createCell(
  text: string,
  options?: { bold?: boolean; shading?: string; width?: number; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType] }
): TableCell {
  const cellOptions: any = {
    borders: createTableBorders(),
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: options?.alignment || AlignmentType.LEFT,
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({
            text: text || '',
            bold: options?.bold || false,
            size: 20, // 10pt
            font: 'Calibri',
          }),
        ],
      }),
    ],
  };

  if (options?.width) {
    cellOptions.width = { size: options.width, type: WidthType.PERCENTAGE };
  }

  if (options?.shading) {
    cellOptions.shading = {
      type: ShadingType.CLEAR,
      fill: options.shading,
    };
  }

  return new TableCell(cellOptions);
}

// ─── School Data Interface ───────────────────────────────────────────────────

export interface SchoolData {
  name: string;
  logoBase64?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  motto?: string | null;
  website?: string | null;
  primaryColor?: string;
}

// ─── Generate Questions DOCX ─────────────────────────────────────────────────

export async function generateQuestionsDocx(
  exam: ExamInfo,
  questions: ExamQuestionData[],
  school?: SchoolData
): Promise<Buffer> {
  const sectionChildren: (Paragraph | Table)[] = [];

  const primaryColor = school?.primaryColor?.replace('#', '') || '1B5E20';
  const lightBg = `${primaryColor}10`;

  // ════════════════════════════════════════════════════════════════════════════
  // SCHOOL LETTERHEAD
  // ════════════════════════════════════════════════════════════════════════════

  if (school) {
    // School logo row
    if (school.logoBase64) {
      // DOCX doesn't support inline images easily via the docx lib without ImageRun.
      // We insert a placeholder paragraph for the logo area.
      sectionChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [
            new TextRun({
              text: `[Logo]`,
              size: 16,
              font: 'Calibri',
              color: 'CCCCCC',
              italics: true,
            }),
          ],
        })
      );
    }

    // School name
    sectionChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: (school.name || 'SCHOOL NAME').toUpperCase(),
            bold: true,
            size: 40,
            font: 'Calibri',
            color: primaryColor,
          }),
        ],
      })
    );

    // School motto (if present)
    if (school.motto) {
      sectionChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [
            new TextRun({
              text: `"${school.motto}"`,
              italics: true,
              size: 20,
              font: 'Calibri',
              color: '666666',
            }),
          ],
        })
      );
    }

    // School address, phone, email line
    const contactParts: string[] = [];
    if (school.address) contactParts.push(school.address);
    if (school.phone) contactParts.push(`Tel: ${school.phone}`);
    if (school.email) contactParts.push(`Email: ${school.email}`);
    if (contactParts.length > 0) {
      sectionChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [
            new TextRun({
              text: contactParts.join('  |  '),
              size: 18,
              font: 'Calibri',
              color: '444444',
            }),
          ],
        })
      );
    }

    // Thick top border line under letterhead
    sectionChildren.push(
      new Paragraph({
        spacing: { after: 120 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: primaryColor, space: 4 },
        },
        children: [],
      })
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // EXAM TITLE BLOCK
  // ════════════════════════════════════════════════════════════════════════════

  sectionChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: exam.name || 'EXAMINATION',
          bold: true,
          size: 36,
          font: 'Calibri',
          color: primaryColor,
        }),
      ],
    })
  );

  // Exam metadata table
  const metaLeft: [string, string][] = [];
  const metaRight: [string, string][] = [];

  if (exam.subject?.name) metaLeft.push(['Subject:', exam.subject.name]);
  if (exam.class?.name) metaLeft.push(['Class:', exam.class.name]);
  if (exam.type) metaLeft.push(['Type:', exam.type]);
  if (exam.totalMarks) metaLeft.push(['Total Marks:', String(exam.totalMarks)]);
  if (exam.passingMarks) metaRight.push(['Passing Marks:', String(exam.passingMarks)]);
  if (exam.duration) metaRight.push(['Duration:', `${exam.duration} min`]);
  metaRight.push(['Questions:', String(questions.length)]);
  metaRight.push(['Date:', new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })]);

  const metaRows = [
    new TableRow({
      children: [
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          borders: { top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }, left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }, right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } },
          children: metaLeft.map(([lbl, val]) =>
            new Paragraph({
              spacing: { before: 30, after: 30 },
              children: [
                new TextRun({ text: `${lbl} `, bold: true, size: 20, font: 'Calibri', color: '333333' }),
                new TextRun({ text: val, size: 20, font: 'Calibri', color: '555555' }),
              ],
            })
          ),
        }),
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          borders: { top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }, left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }, right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } },
          children: metaRight.map(([lbl, val]) =>
            new Paragraph({
              spacing: { before: 30, after: 30 },
              children: [
                new TextRun({ text: `${lbl} `, bold: true, size: 20, font: 'Calibri', color: '333333' }),
                new TextRun({ text: val, size: 20, font: 'Calibri', color: '555555' }),
              ],
            })
          ),
        }),
      ],
    }),
  ];

  sectionChildren.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: metaRows,
    })
  );

  sectionChildren.push(new Paragraph({ spacing: { after: 200 }, children: [] }));

  // ════════════════════════════════════════════════════════════════════════════
  // INSTRUCTIONS BOX
  // ════════════════════════════════════════════════════════════════════════════

  const instructionsLines: Paragraph[] = [
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: 'GENERAL INSTRUCTIONS',
          bold: true,
          size: 22,
          font: 'Calibri',
          color: primaryColor,
        }),
      ],
    }),
  ];

  if (exam.instructions) {
    instructionsLines.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: exam.instructions,
            size: 20,
            font: 'Calibri',
            color: '333333',
          }),
        ],
      })
    );
  }

  instructionsLines.push(
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({ text: '1. ', bold: true, size: 20, font: 'Calibri', color: '555555' }),
        new TextRun({ text: 'Read all questions carefully before answering.', size: 20, font: 'Calibri', color: '555555' }),
      ],
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({ text: '2. ', bold: true, size: 20, font: 'Calibri', color: '555555' }),
        new TextRun({ text: 'Write your answers clearly in the spaces provided.', size: 20, font: 'Calibri', color: '555555' }),
      ],
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({ text: '3. ', bold: true, size: 20, font: 'Calibri', color: '555555' }),
        new TextRun({ text: 'Do not cheat or communicate with other students.', size: 20, font: 'Calibri', color: '555555' }),
      ],
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({ text: '4. ', bold: true, size: 20, font: 'Calibri', color: '555555' }),
        new TextRun({ text: `Answer ALL questions. Total marks: ${exam.totalMarks || '—'}.`, size: 20, font: 'Calibri', color: '555555' }),
      ],
    })
  );

  // Instructions in a bordered box
  sectionChildren.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: {
                top: { style: BorderStyle.SINGLE, size: 2, color: primaryColor },
                bottom: { style: BorderStyle.SINGLE, size: 2, color: primaryColor },
                left: { style: BorderStyle.SINGLE, size: 2, color: primaryColor },
                right: { style: BorderStyle.SINGLE, size: 2, color: primaryColor },
              },
              shading: { type: ShadingType.CLEAR, fill: lightBg },
              width: { size: 100, type: WidthType.PERCENTAGE },
              children: instructionsLines,
            }),
          ],
        }),
      ],
    })
  );

  sectionChildren.push(new Paragraph({ spacing: { after: 200 }, children: [] }));

  // ════════════════════════════════════════════════════════════════════════════
  // STUDENT INFORMATION SECTION
  // ════════════════════════════════════════════════════════════════════════════

  const studentInfoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '999999' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' }, left: { style: BorderStyle.SINGLE, size: 1, color: '999999' }, right: { style: BorderStyle.SINGLE, size: 1, color: '999999' } },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                spacing: { before: 40, after: 40 },
                children: [
                  new TextRun({ text: "Student's Name: ", bold: true, size: 20, font: 'Calibri', color: '333333' }),
                  new TextRun({ text: '___________________________________________', size: 16, font: 'Calibri', color: '999999' }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '999999' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' }, left: { style: BorderStyle.SINGLE, size: 1, color: '999999' }, right: { style: BorderStyle.SINGLE, size: 1, color: '999999' } },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                spacing: { before: 40, after: 40 },
                children: [
                  new TextRun({ text: 'Class: ', bold: true, size: 20, font: 'Calibri', color: '333333' }),
                  new TextRun({ text: exam.class?.name || '______________', size: 20, font: 'Calibri', color: '555555' }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.SINGLE, size: 1, color: '999999' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' }, left: { style: BorderStyle.SINGLE, size: 1, color: '999999' }, right: { style: BorderStyle.SINGLE, size: 1, color: '999999' } },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                spacing: { before: 40, after: 40 },
                children: [
                  new TextRun({ text: 'Date: ', bold: true, size: 20, font: 'Calibri', color: '333333' }),
                  new TextRun({ text: '___________________', size: 16, font: 'Calibri', color: '999999' }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  sectionChildren.push(studentInfoTable);
  sectionChildren.push(new Paragraph({ spacing: { after: 300 }, children: [] }));

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION HEADER
  // ════════════════════════════════════════════════════════════════════════════

  sectionChildren.push(
    new Paragraph({
      spacing: { before: 100, after: 200 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 2, color: primaryColor },
      },
      children: [
        new TextRun({
          text: 'SECTION A: OBJECTIVE / THEORY QUESTIONS',
          bold: true,
          size: 26,
          font: 'Calibri',
          color: primaryColor,
        }),
      ],
    })
  );

  // ════════════════════════════════════════════════════════════════════════════
  // QUESTIONS
  // ════════════════════════════════════════════════════════════════════════════

  questions.forEach((q, index) => {
    // Question header: number + type badge + marks
    sectionChildren.push(
      new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [
          new TextRun({
            text: `${index + 1}. `,
            bold: true,
            size: 24,
            font: 'Calibri',
            color: primaryColor,
          }),
          new TextRun({
            text: `[${formatQuestionType(q.type)}]`,
            size: 18,
            font: 'Calibri',
            color: 'FFFFFF',
          }),
          new TextRun({
            text: `  (${q.marks} mark${q.marks !== 1 ? 's' : ''})`,
            size: 18,
            font: 'Calibri',
            color: '888888',
            italics: true,
          }),
        ],
      })
    );

    // Question text
    sectionChildren.push(
      new Paragraph({
        spacing: { after: 80 },
        indent: { left: 360 },
        children: [
          new TextRun({
            text: q.questionText || '',
            size: 22,
            font: 'Calibri',
            color: '222222',
          }),
        ],
      })
    );

    // Options (for MCQ, MULTI_SELECT, TRUE_FALSE, MATCHING)
    if (['MCQ', 'MULTI_SELECT', 'TRUE_FALSE', 'MATCHING'].includes(q.type)) {
      const options = parseOptions(q.options);
      options.forEach((option) => {
        sectionChildren.push(
          new Paragraph({
            spacing: { before: 30, after: 30 },
            indent: { left: 720 },
            children: [
              new TextRun({
                text: option,
                size: 22,
                font: 'Calibri',
                color: '333333',
              }),
            ],
          })
        );
      });
    }

    // Answer space: 3 dashed lines for student's answer
    for (let i = 0; i < 3; i++) {
      sectionChildren.push(
        new Paragraph({
          spacing: { before: 20, after: 20 },
          indent: { left: 720 },
          children: [
            new TextRun({
              text: '_________________________________________________________________________________',
              size: 12,
              font: 'Calibri',
              color: 'CCCCCC',
            }),
          ],
        })
      );
    }

    // Separator between questions (except last)
    if (index < questions.length - 1) {
      sectionChildren.push(
        new Paragraph({
          spacing: { before: 100, after: 100 },
          children: [],
        })
      );
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // END OF EXAM PAPER
  // ════════════════════════════════════════════════════════════════════════════

  sectionChildren.push(
    new Paragraph({
      spacing: { before: 400 },
      border: {
        top: { style: BorderStyle.DOUBLE, size: 4, color: primaryColor },
      },
      children: [],
    })
  );

  sectionChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120 },
      children: [
        new TextRun({
          text: '— END OF EXAMINATION —',
          bold: true,
          size: 24,
          font: 'Calibri',
          color: primaryColor,
        }),
      ],
    })
  );

  sectionChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60 },
      children: [
        new TextRun({
          text: `Powered by Skoolar`,
          size: 16,
          font: 'Calibri',
          color: 'AAAAAA',
          italics: true,
        }),
      ],
    })
  );

  // ════════════════════════════════════════════════════════════════════════════
  // BUILD DOCUMENT
  // ════════════════════════════════════════════════════════════════════════════

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: school?.name || 'Examination Paper',
                    size: 16,
                    font: 'Calibri',
                    color: '999999',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Page ',
                    size: 16,
                    font: 'Calibri',
                    color: '999999',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    font: 'Calibri',
                    color: '999999',
                  }),
                  new TextRun({
                    text: ' of ',
                    size: 16,
                    font: 'Calibri',
                    color: '999999',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    font: 'Calibri',
                    color: '999999',
                  }),
                ],
              }),
            ],
          }),
        },
        children: sectionChildren,
      },
    ],
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 22,
          },
        },
      },
    },
  });

  return Packer.toBuffer(doc);
}

// ─── Generate Results DOCX ──────────────────────────────────────────────────

export async function generateExamResultsDocx(
  exam: ExamInfo,
  scores: ExamScoreData[]
): Promise<Buffer> {
  const children: Paragraph[] = [];
  const totalMarks = exam.totalMarks || 100;
  const passingMarks = exam.passingMarks || 50;
  const stats = calculateStats(scores, totalMarks, passingMarks);

  // Title
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: 'Exam Results Summary',
          bold: true,
          size: 36,
          font: 'Calibri',
          color: '1B5E20',
        }),
      ],
    })
  );

  // Exam name
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: exam.name || 'Exam',
          bold: true,
          size: 28,
          font: 'Calibri',
        }),
      ],
    })
  );

  // Date generated
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `Generated on ${new Date().toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}`,
          size: 20,
          font: 'Calibri',
          color: '888888',
        }),
      ],
    })
  );

  // Separator
  children.push(
    new Paragraph({
      spacing: { after: 200 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 2, color: '1B5E20' },
      },
      children: [],
    })
  );

  // Statistics Section
  children.push(
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: 'Statistics',
          bold: true,
          size: 26,
          font: 'Calibri',
          color: '1B5E20',
        }),
      ],
    })
  );

  // Stats table
  const statsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          createCell('Average Score', { bold: true, shading: 'E8F5E9', width: 50 }),
          createCell(`${stats.average} / ${totalMarks}`, { width: 50 }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Highest Score', { bold: true, shading: 'E8F5E9', width: 50 }),
          createCell(`${stats.highest} / ${totalMarks}`, { width: 50 }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Lowest Score', { bold: true, shading: 'E8F5E9', width: 50 }),
          createCell(`${stats.lowest} / ${totalMarks}`, { width: 50 }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Pass Rate', { bold: true, shading: 'E8F5E9', width: 50 }),
          createCell(`${stats.passRate}%`, { width: 50 }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Total Students', { bold: true, shading: 'E8F5E9', width: 50 }),
          createCell(String(stats.totalStudents), { width: 50 }),
        ],
      }),
      new TableRow({
        children: [
          createCell('Passed / Failed', { bold: true, shading: 'E8F5E9', width: 50 }),
          createCell(`${stats.passed} / ${stats.failed}`, { width: 50 }),
        ],
      }),
    ],
  });

  children.push(
    new Paragraph({
      spacing: { after: 100 },
      children: [],
    })
  );
  // The table needs to be added - but Table is not a Paragraph child.
  // We'll use a workaround: add the table as a direct child of the section.

  // ── Note: In docx library, children of a section can be Paragraph[] or (Paragraph | Table)[]
  // So we'll build children as a union array.

  const sectionChildren: (Paragraph | Table)[] = [...children, statsTable];

  // Individual Results Section Header
  sectionChildren.push(
    new Paragraph({
      spacing: { before: 300, after: 100 },
      children: [
        new TextRun({
          text: 'Individual Results',
          bold: true,
          size: 26,
          font: 'Calibri',
          color: '1B5E20',
        }),
      ],
    })
  );

  // Sort scores by score descending
  const sortedScores = [...scores].sort((a, b) => b.score - a.score);

  // Results table header
  const resultsHeaderRow = new TableRow({
    children: [
      createCell('#', { bold: true, shading: '1B5E20', width: 5 }),
      createCell('Student Name', { bold: true, shading: '1B5E20', width: 35 }),
      createCell('Admission No', { bold: true, shading: '1B5E20', width: 20 }),
      createCell('Score', { bold: true, shading: '1B5E20', width: 15 }),
      createCell('Grade', { bold: true, shading: '1B5E20', width: 10 }),
      createCell('Status', { bold: true, shading: '1B5E20', width: 15 }),
    ],
  });

  // Make header text white
  const resultsHeaderRowWithWhite = new TableRow({
    children: [
      new TableCell({
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: ShadingType.CLEAR, fill: '1B5E20' },
        width: { size: 5, type: WidthType.PERCENTAGE },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 40 },
            children: [new TextRun({ text: '#', bold: true, size: 20, font: 'Calibri', color: 'FFFFFF' })],
          }),
        ],
      }),
      new TableCell({
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: ShadingType.CLEAR, fill: '1B5E20' },
        width: { size: 35, type: WidthType.PERCENTAGE },
        children: [
          new Paragraph({
            spacing: { before: 40, after: 40 },
            children: [new TextRun({ text: 'Student Name', bold: true, size: 20, font: 'Calibri', color: 'FFFFFF' })],
          }),
        ],
      }),
      new TableCell({
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: ShadingType.CLEAR, fill: '1B5E20' },
        width: { size: 20, type: WidthType.PERCENTAGE },
        children: [
          new Paragraph({
            spacing: { before: 40, after: 40 },
            children: [new TextRun({ text: 'Admission No', bold: true, size: 20, font: 'Calibri', color: 'FFFFFF' })],
          }),
        ],
      }),
      new TableCell({
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: ShadingType.CLEAR, fill: '1B5E20' },
        width: { size: 15, type: WidthType.PERCENTAGE },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 40 },
            children: [new TextRun({ text: 'Score', bold: true, size: 20, font: 'Calibri', color: 'FFFFFF' })],
          }),
        ],
      }),
      new TableCell({
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: ShadingType.CLEAR, fill: '1B5E20' },
        width: { size: 10, type: WidthType.PERCENTAGE },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 40 },
            children: [new TextRun({ text: 'Grade', bold: true, size: 20, font: 'Calibri', color: 'FFFFFF' })],
          }),
        ],
      }),
      new TableCell({
        borders: createTableBorders(),
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: ShadingType.CLEAR, fill: '1B5E20' },
        width: { size: 15, type: WidthType.PERCENTAGE },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 40 },
            children: [new TextRun({ text: 'Status', bold: true, size: 20, font: 'Calibri', color: 'FFFFFF' })],
          }),
        ],
      }),
    ],
  });

  // Build result rows
  const resultRows = sortedScores.map((entry, index) => {
    const studentName = entry.student?.user?.name || 'Unknown';
    const admissionNo = entry.student?.admissionNo || 'N/A';
    const score = entry.score;
    const grade = entry.grade || getGrade(score, totalMarks);
    const passed = score >= passingMarks;
    const rowShading = index % 2 === 0 ? 'FFFFFF' : 'F5F5F5';

    return new TableRow({
      children: [
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          shading: { type: ShadingType.CLEAR, fill: rowShading },
          width: { size: 5, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 30, after: 30 },
              children: [new TextRun({ text: String(index + 1), size: 20, font: 'Calibri' })],
            }),
          ],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          shading: { type: ShadingType.CLEAR, fill: rowShading },
          width: { size: 35, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              spacing: { before: 30, after: 30 },
              children: [new TextRun({ text: studentName, size: 20, font: 'Calibri' })],
            }),
          ],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          shading: { type: ShadingType.CLEAR, fill: rowShading },
          width: { size: 20, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              spacing: { before: 30, after: 30 },
              children: [new TextRun({ text: admissionNo, size: 20, font: 'Calibri', color: '666666' })],
            }),
          ],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          shading: { type: ShadingType.CLEAR, fill: rowShading },
          width: { size: 15, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 30, after: 30 },
              children: [new TextRun({ text: `${score} / ${totalMarks}`, size: 20, font: 'Calibri' })],
            }),
          ],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          shading: { type: ShadingType.CLEAR, fill: rowShading },
          width: { size: 10, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 30, after: 30 },
              children: [
                new TextRun({
                  text: grade,
                  bold: true,
                  size: 20,
                  font: 'Calibri',
                  color: passed ? '2E7D32' : 'C62828',
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          borders: createTableBorders(),
          verticalAlign: VerticalAlign.CENTER,
          shading: { type: ShadingType.CLEAR, fill: rowShading },
          width: { size: 15, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 30, after: 30 },
              children: [
                new TextRun({
                  text: passed ? 'Passed' : 'Failed',
                  bold: true,
                  size: 20,
                  font: 'Calibri',
                  color: passed ? '2E7D32' : 'C62828',
                }),
              ],
            }),
          ],
        }),
      ],
    });
  });

  const resultsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [resultsHeaderRowWithWhite, ...resultRows],
  });

  sectionChildren.push(resultsTable);

  // Footer
  sectionChildren.push(
    new Paragraph({
      spacing: { before: 400 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 2, color: '1B5E20' },
      },
      children: [],
    })
  );
  sectionChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100 },
      children: [
        new TextRun({
          text: 'Skoolar - Odebunmi Tawwāb',
          size: 18,
          font: 'Calibri',
          color: '999999',
          italics: true,
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Skoolar',
                    size: 72,
                    font: 'Calibri',
                    color: 'E8F5E9',
                    bold: true,
                  }),
                ],
              }),
            ],
          }),
        },
        children: sectionChildren,
      },
    ],
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 22,
          },
        },
      },
    },
  });

  return Packer.toBuffer(doc);
}
