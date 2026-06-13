import fs from 'fs';
import path from 'path';
import { renderIDCard } from '../src/lib/id-card-utils/render-card';

async function test() {
  const person = {
    type: 'student',
    id: 'STU-2023-001',
    displayId: 'STU-2023-001',
    name: 'John Doe Smith',
    class: 'Grade 10 Science',
    gender: 'Male',
    schoolId: '1',
    photoUrl: 'https://i.pravatar.cc/300?u=johndoe'
  };

  const colors = { primary: '#059669', secondary: '#ffffff' };
  
  // Create portrait front
  const portraitFront = await renderIDCard(
    person, colors, '', true, false, 'portrait', person.photoUrl, 'STUDENT', false
  );
  fs.writeFileSync(path.join(process.cwd(), 'test-portrait-front.png'), portraitFront);
  
  // Test PDF generation
  const PDFDocument = require('pdfkit');
  const cardWidthPt = (53.98 / 25.4) * 72;
  const cardHeightPt = (85.6 / 25.4) * 72;
  const doc = new PDFDocument({ size: [cardWidthPt, cardHeightPt], compress: true, autoFirstPage: false, margin: 0 });
  doc.addPage({ size: [cardWidthPt, cardHeightPt], margin: 0 });
  doc.image(portraitFront, 0, 0, { width: cardWidthPt, height: cardHeightPt });
  
  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
  fs.writeFileSync(path.join(process.cwd(), 'test-id-card.pdf'), pdfBuffer);
  
  console.log("Done! Rendered test ID cards and PDF.");
}

test().catch(console.error);
