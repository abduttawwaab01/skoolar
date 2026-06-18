import { PrismaClient } from '@prisma/client';

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not set');
  }

  const provider = (process.env.DATABASE_PROVIDER || 'pg').toLowerCase();
  
  if (provider === 'neon') {
    try {
      const { PrismaNeon } = require('@prisma/adapter-neon');
      return new PrismaClient({
        adapter: new PrismaNeon({ connectionString: databaseUrl }),
        log: ['warn', 'error'],
      });
    } catch {
      console.warn('[Seed] Neon adapter not available, using standard PrismaClient');
    }
  }
  
  return new PrismaClient({ log: ['warn', 'error'] });
}

const db = createPrismaClient();

async function seedSubscriptionPlans() {
  const plans = [
    {
      name: 'free',
      displayName: 'Free',
      pricingType: 'free',
      price: 0,
      maxStudents: 30,
      maxTeachers: 5,
      maxClasses: 10,
      maxAdminAccounts: 1,
      hasPartnership: true,
      features: JSON.stringify([
        '30 Students',
        '5 Teachers',
        '1 Admin Account',
        'Partnership with Skoolar Company',
        'Basic Attendance',
        'Basic Report Cards',
        'Community Support',
      ]),
      isActive: true,
    },
    {
      name: 'pro',
      displayName: 'Pro',
      pricingType: 'per_student',
      maxStudents: 99999,
      maxTeachers: 99999,
      maxClasses: 99999,
      maxAdminAccounts: 1,
      hasDirectorPortal: true,
      hasParentPortal: true,
      hasAIFeatures: true,
      hasPartnership: true,
      maxLibraryBooks: 2000,
      maxVideoLessons: 500,
      maxHomeworkPerMonth: 1000,
      storageLimit: 5000,
      supportLevel: 'email',
      features: JSON.stringify([
        'All Free Features',
        'Students Portal',
        'Parents Portal',
        'Director Portal',
        'AI Grading Assistant',
        'AI Quiz Generator',
        'AI Chat',
        'Support Access',
        'Partnership with Skoolar Company',
      ]),
      isActive: true,
    },
    {
      name: 'custom',
      displayName: 'Custom',
      pricingType: 'custom',
      price: 0,
      maxStudents: 99999,
      maxTeachers: 99999,
      maxClasses: 99999,
      maxAdminAccounts: 5,
      hasDirectorPortal: true,
      hasParentPortal: true,
      hasAccountantPortal: true,
      hasLibrarianPortal: true,
      hasAIFeatures: true,
      hasPremiumSupport: true,
      hasPartnership: true,
      maxLibraryBooks: 99999,
      maxVideoLessons: 99999,
      maxHomeworkPerMonth: 99999,
      storageLimit: 99999,
      supportLevel: 'dedicated',
      customDomain: true,
      apiAccess: true,
      whiteLabel: true,
      features: JSON.stringify([
        'All Pro Features',
        'Tailored Solutions',
        'Dedicated Support',
        'Contact via WhatsApp',
      ]),
      isActive: true,
    },
  ];

  const seededNames: string[] = [];
  for (const plan of plans) {
    await db.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan as any,
    });
    seededNames.push(plan.name);
  }

  // Deactivate old plans
  await db.subscriptionPlan.updateMany({
    where: { name: { notIn: seededNames }, isActive: true },
    data: { isActive: false },
  });

  console.log('Subscription plans seeded');
}

async function seedPlanPricing() {
  const proPlan = await db.subscriptionPlan.findUnique({ where: { name: 'pro' } });
  if (!proPlan) {
    console.log('Skipping PlanPricing seed - pro plan not found');
    return;
  }

  const pricingData = [
    { planId: proPlan.id, schoolType: 'primary', monthlyPrice: 100, termPrice: 400, sessionPrice: 800 },
    { planId: proPlan.id, schoolType: 'secondary', monthlyPrice: 200, termPrice: 600, sessionPrice: 1000 },
    { planId: proPlan.id, schoolType: 'primary_secondary', monthlyPrice: 200, termPrice: 600, sessionPrice: 1000 },
    { planId: proPlan.id, schoolType: 'higher_institution', monthlyPrice: 300, termPrice: 900, sessionPrice: 1500 },
  ];

  for (const data of pricingData) {
    await db.planPricing.upsert({
      where: { planId_schoolType: { planId: data.planId, schoolType: data.schoolType } },
      update: data,
      create: data,
    });
  }
  console.log('PlanPricing seeded');
}

async function seedDatabase(forceReset = false) {
  // Check if Super Admin already exists
  let existingAdmin = await db.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
  });

  if (existingAdmin && !forceReset) {
    console.log('Super Admin already exists:', existingAdmin.email);
    return;
  }

  // Create or reset Super Admin
  // Use environment variable or generate a random password
  const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || 'CHANGE_ME_NOW_' + Math.random().toString(36).slice(-8);
  const adminHash = await import('bcryptjs').then(b => b.hash(initialPassword, 12));

  if (existingAdmin && forceReset) {
    // Reset existing admin password
    await db.user.update({
      where: { id: existingAdmin.id },
      data: { password: adminHash, isActive: true },
    });
    console.log('Super Admin password reset:', existingAdmin.email, '->', initialPassword);
    return;
  }

  const superAdmin = await db.user.create({
    data: {
      username: 'abduttawwab',
      name: 'Odebunmi Tawwāb',
      email: 'admin@skoolar.com',
      password: adminHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  console.log('Super Admin created:', superAdmin.email, '->', initialPassword);
  console.log('⚠️  IMPORTANT: Save this password! It will not be shown again.');
}

async function main() {
  console.log('Starting seeding...');
  
  const forceReset = process.argv.includes('--force-reset');
  if (forceReset) {
    console.log('Force reset mode enabled');
  }
  
  try {
    await seedSubscriptionPlans();
    await seedPlanPricing();
    await seedDatabase(forceReset);
    console.log('Seeding completed!');
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();