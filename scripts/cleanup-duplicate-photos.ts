import { PrismaClient } from '@prisma/client';

async function main() {
  const db = new PrismaClient();
  try {
    const schoolId = process.argv[2];
    if (!schoolId) {
      console.error('Usage: node cleanup-duplicate-photos.js <schoolId> [--force]');
      process.exit(1);
    }
    const force = process.argv.includes('--force');

    const duplicates = await db.$queryRawUnsafe(`
      SELECT photo, COUNT(*) as cnt
      FROM "Student"
      WHERE "photo" IS NOT NULL AND "photo" <> '' AND "schoolId" = $1
      GROUP BY photo
      HAVING COUNT(*) > 1
      ORDER BY cnt DESC
    `, schoolId);

    for (const row of duplicates as any[]) {
      const photo = row.photo as string;
      const students = await db.student.findMany({ where: { photo, schoolId }, include: { user: true } });
      console.log(`Photo: ${photo} — ${students.length} students`);
      const keepCandidates = students.filter(s => s.user?.avatar === photo);
      if (keepCandidates.length === 1) {
        const keepId = keepCandidates[0].id;
        const toNull = students.filter(s => s.id !== keepId).map(s => s.id);
        console.log(' Keeping:', keepId, 'Nullify:', toNull.length);
        if (force && toNull.length > 0) {
          await db.student.updateMany({ where: { id: { in: toNull } }, data: { photo: null } });
          console.log(' Nullified', toNull.length, 'students');
        }
      } else {
        console.log(' Ambiguous — no action (use --force to attempt cleanup)');
      }
    }

    console.log('Done');
  } finally {
    await (new PrismaClient()).$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
