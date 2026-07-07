import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function seedSubscriptionPlans() {
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
      name: 'premium',
      displayName: 'Premium',
      pricingType: 'per_student',
      maxStudents: 99999,
      maxTeachers: 99999,
      maxClasses: 99999,
      maxAdminAccounts: 1,
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
      supportLevel: 'priority',
      features: JSON.stringify([
        'All Pro Features',
        'Accountant Portal',
        'Librarian Portal',
        'All Portals Included',
        'Full Instant Support',
        'Priority Support',
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
      hasPartnership: true,
      features: JSON.stringify([
        'Custom Features',
        'Custom Pricing',
        'Dedicated Support',
        'Contact via WhatsApp',
      ]),
      isActive: true,
    },
  ];

  const results: Array<{ id: string; name: string; displayName: string }> = [];
  for (const planData of plans) {
    const plan = await db.subscriptionPlan.upsert({
      where: { name: planData.name },
      update: planData,
      create: planData,
    });
    results.push(plan);
  }
  return results;
}

export async function seedPlanPricing(plans: Array<{ id: string; name: string }>) {
  const proPlan = plans.find(p => p.name === 'pro');
  const premiumPlan = plans.find(p => p.name === 'premium');
  if (!proPlan) return;

  const pricingData = [
    // Pro Plan — monthly = term / 2
    { planId: proPlan.id, schoolType: 'primary', monthlyPrice: 10000, termPrice: 20000, sessionPrice: 50000 },
    { planId: proPlan.id, schoolType: 'secondary', monthlyPrice: 15000, termPrice: 30000, sessionPrice: 80000 },
    { planId: proPlan.id, schoolType: 'primary_secondary', monthlyPrice: 20000, termPrice: 40000, sessionPrice: 100000 },
    { planId: proPlan.id, schoolType: 'higher_institution', monthlyPrice: 20000, termPrice: 40000, sessionPrice: 100000 },
    // Premium Plan — monthly = term / 2
    { planId: premiumPlan.id, schoolType: 'primary', monthlyPrice: 15000, termPrice: 30000, sessionPrice: 70000 },
    { planId: premiumPlan.id, schoolType: 'secondary', monthlyPrice: 25000, termPrice: 50000, sessionPrice: 120000 },
    { planId: premiumPlan.id, schoolType: 'primary_secondary', monthlyPrice: 30000, termPrice: 60000, sessionPrice: 150000 },
    { planId: premiumPlan.id, schoolType: 'higher_institution', monthlyPrice: 30000, termPrice: 60000, sessionPrice: 150000 },
  ];

  for (const data of pricingData) {
    await db.planPricing.upsert({
      where: { planId_schoolType: { planId: data.planId, schoolType: data.schoolType } },
      update: data,
      create: data,
    });
  }
}

export async function seedDatabase() {
  // Check if Super Admin already exists
  const existingAdmin = await db.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
  });

  // Always seed/update subscription plans
  const seededPlans = await seedSubscriptionPlans();

  // Seed PlanPricing for pro and premium plans
  await seedPlanPricing(seededPlans);

  // Deactivate old plans that are no longer in the seed list
  const seededNames = seededPlans.map(p => p.name);
  await db.subscriptionPlan.updateMany({
    where: { name: { notIn: seededNames }, isActive: true },
    data: { isActive: false },
  });

  if (existingAdmin) {
    return { message: 'Database already seeded. Super Admin already exists.', superAdmin: existingAdmin.email };
  }

  // Use environment variable or generate a random password
  const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || 'CHANGE_ME_NOW_' + Math.random().toString(36).slice(-8);
  const adminHash = await hashPassword(initialPassword);

  // Create ONLY the Super Admin
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

  return {
    message: 'Database seeded successfully. Only the Super Admin account has been created.',
    superAdmin: {
      username: 'abduttawwab',
      email: 'admin@skoolar.com',
      name: 'Odebunmi Tawwāb',
      password: initialPassword, // Only returned in dev/seed, not in production API
    },
  };
}
