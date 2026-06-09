import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, WidthType, BorderStyle } from 'docx';

type ExportFormat = 'pdf' | 'doc' | 'csv' | 'print';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

export interface ExportOptions {
  title: string;
  subtitle?: string;
  fileName: string;
  columns?: ExportColumn[];
  data?: Record<string, unknown>[];
  summaryRows?: { label: string; value: string }[];
  chartDescriptions?: string[];
  sections?: { heading: string; content: string[] }[];
  orientation?: 'portrait' | 'landscape';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function exportToCSV(data: Record<string, unknown>[], fileName: string): void {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];
  for (const row of data) {
    const values = headers.map((h) => {
      const val = row[h];
      const str = val === null || val === undefined ? '' : String(val);
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    });
    csvRows.push(values.join(','));
  }
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName.replace(/\s+/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToPrint(): void {
  window.print();
}

export async function exportToPDF(options: ExportOptions): Promise<void> {
  const doc = new jsPDF(options.orientation || 'portrait', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  const addPage = () => {
    doc.addPage();
    y = margin;
  };

  const checkPage = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) addPage();
  };

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(options.title, pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Subtitle + Date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  const sub = options.subtitle || `Generated: ${formatDate()}`;
  doc.text(sub, pageWidth / 2, y, { align: 'center' });
  y += 12;

  doc.setTextColor(0);

  // Summary rows
  if (options.summaryRows && options.summaryRows.length > 0) {
    checkPage(10 + options.summaryRows.length * 6);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    for (const row of options.summaryRows) {
      checkPage(5);
      doc.text(`${row.label}: ${row.value}`, margin + 3, y);
      y += 5;
    }
    y += 4;
  }

  // Data table
  if (options.columns && options.data && options.data.length > 0) {
    checkPage(20);
    const tableData = options.data.map((row) =>
      options.columns!.map((col) => String(row[col.key] ?? ''))
    );
    (doc as any).autoTable({
      head: [options.columns.map((c) => c.header)],
      body: tableData,
      startY: y,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Chart descriptions
  if (options.chartDescriptions && options.chartDescriptions.length > 0) {
    checkPage(10 + options.chartDescriptions.length * 5);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Visual Analysis', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    for (const desc of options.chartDescriptions) {
      checkPage(5);
      doc.text(desc, margin + 3, y);
      y += 5;
    }
    y += 4;
  }

  // Sections
  if (options.sections) {
    for (const section of options.sections) {
      checkPage(15);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(section.heading, margin, y);
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      for (const line of section.content) {
        checkPage(5);
        const lines = doc.splitTextToSize(line, pageWidth - margin * 2);
        for (const l of lines) {
          checkPage(5);
          doc.text(l, margin + 2, y);
          y += 5;
        }
      }
      y += 3;
    }
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Skoolar Assessment Hub - ${formatDate()}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

  doc.save(`${options.fileName.replace(/\s+/g, '_')}.pdf`);
}

export async function exportToDOC(options: ExportOptions): Promise<void> {
  const children: (Paragraph | Table)[] = [];

  // Title
  children.push(
    new Paragraph({ text: options.title, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
    new Paragraph({ text: options.subtitle || `Generated: ${formatDate()}`, alignment: AlignmentType.CENTER, spacing: { after: 400 } }),
  );

  // Summary
  if (options.summaryRows && options.summaryRows.length > 0) {
    children.push(new Paragraph({ text: 'Summary', heading: HeadingLevel.HEADING_2, spacing: { after: 200 } }));
    for (const row of options.summaryRows) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${row.label}: `, bold: true, size: 20 }),
          new TextRun({ text: row.value, size: 20 }),
        ],
        spacing: { after: 100 },
      }));
    }
  }

  // Table
  if (options.columns && options.data && options.data.length > 0) {
    children.push(new Paragraph({ text: 'Detailed Data', heading: HeadingLevel.HEADING_2, spacing: { before: 400, after: 200 } }));
    const tableRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: options.columns.map((col) => new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: col.header, bold: true })], alignment: AlignmentType.CENTER })],
          width: { size: col.width || 2000, type: WidthType.DXA },
        })),
      }),
    ];
    for (const row of options.data) {
      tableRows.push(new TableRow({
        children: options.columns.map((col) => new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: String(row[col.key] ?? ''), size: 18 })] })],
        })),
      }));
    }
    children.push(new Table({ rows: tableRows }));
  }

  // Chart descriptions
  if (options.chartDescriptions && options.chartDescriptions.length > 0) {
    children.push(new Paragraph({ text: 'Visual Analysis', heading: HeadingLevel.HEADING_2, spacing: { before: 400, after: 200 } }));
    for (const desc of options.chartDescriptions) {
      children.push(new Paragraph({ text: desc, spacing: { after: 100 }, bullet: { level: 0 } }));
    }
  }

  // Sections
  if (options.sections) {
    for (const section of options.sections) {
      children.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_2, spacing: { before: 400, after: 200 } }));
      for (const line of section.content) {
        children.push(new Paragraph({ text: line, spacing: { after: 80 }, indent: { left: 400 } }));
      }
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${options.fileName.replace(/\s+/g, '_')}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportReport(options: ExportOptions, format: ExportFormat): Promise<void> {
  switch (format) {
    case 'pdf':
      await exportToPDF(options);
      break;
    case 'doc':
      await exportToDOC(options);
      break;
    case 'csv':
      if (options.data) exportToCSV(options.data, options.fileName);
      break;
    case 'print':
      exportToPrint();
      break;
  }
}

export function buildAnalysisSections(data: Record<string, unknown>, labelMap: Record<string, string>): { heading: string; content: string[] }[] {
  return Object.entries(data).map(([key, value]) => ({
    heading: labelMap[key] || key.replace(/_/g, ' '),
    content: typeof value === 'object' ? [JSON.stringify(value, null, 2)] : [String(value)],
  }));
}
