// Script to update subscription plans to Pro and Custom
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Updating subscription plans...');

  const targetNames = ['pro', 'custom'];

  // Deactivate plans not in our target set (free plan is being replaced by trial)
  await prisma.subscriptionPlan.updateMany({
    where: { name: { notIn: targetNames }, isActive: true },
    data: { isActive: false },
  });
  console.log('Deactivated plans not in target set (pro, custom)');

  // Upsert Pro plan
  const proPlan = await prisma.subscriptionPlan.upsert({
    where: { name: 'pro' },
    update: {
      displayName: 'Pro',
      pricingType: 'per_student',
      price: 0,
      yearlyPrice: null,
      maxAdminAccounts: 1,
      hasDirectorPortal: true,
      hasParentPortal: true,
      hasAIFeatures: true,
      hasPartnership: true,
      maxStudents: -1,
      maxTeachers: -1,
      maxClasses: -1,
      maxParents: -1,
      maxLibraryBooks: -1,
      maxVideoLessons: -1,
      maxHomeworkPerMonth: -1,
      storageLimit: -1,
      supportLevel: 'email',
      customDomain: false,
      apiAccess: false,
      whiteLabel: false,
      features: JSON.stringify(['Unlimited students', 'Unlimited teachers', 'Unlimited classes', 'Advanced report cards', 'Video lessons', 'AI grading assistant', 'Homework management', 'Email support', 'Attendance tracking', 'Custom branding', 'Transport tracking']),
      isActive: true,
      warningDays: 7,
    },
    create: {
      name: 'pro',
      displayName: 'Pro',
      pricingType: 'per_student',
      price: 0,
      yearlyPrice: null,
      maxAdminAccounts: 1,
      hasDirectorPortal: true,
      hasParentPortal: true,
      hasAIFeatures: true,
      hasPartnership: true,
      maxStudents: -1,
      maxTeachers: -1,
      maxClasses: -1,
      maxParents: -1,
      maxLibraryBooks: -1,
      maxVideoLessons: -1,
      maxHomeworkPerMonth: -1,
      storageLimit: -1,
      supportLevel: 'email',
      customDomain: false,
      apiAccess: false,
      whiteLabel: false,
      features: JSON.stringify(['Unlimited students', 'Unlimited teachers', 'Unlimited classes', 'Advanced report cards', 'Video lessons', 'AI grading assistant', 'Homework management', 'Email support']),
      isActive: true,
      warningDays: 7,
    },
  });
  console.log('Pro plan updated/created:', proPlan.id);

  // Upsert Custom plan
  const customPlan = await prisma.subscriptionPlan.upsert({
    where: { name: 'custom' },
    update: {
      displayName: 'Custom',
      pricingType: 'custom',
      price: 0,
      yearlyPrice: null,
      maxAdminAccounts: 5,
      hasDirectorPortal: true,
      hasAccountantPortal: true,
      hasLibrarianPortal: true,
      hasParentPortal: true,
      hasAIFeatures: true,
      hasPremiumSupport: true,
      hasPartnership: true,
      maxStudents: -1,
      maxTeachers: -1,
      maxClasses: -1,
      maxParents: -1,
      maxLibraryBooks: -1,
      maxVideoLessons: -1,
      maxHomeworkPerMonth: -1,
      storageLimit: -1,
      supportLevel: 'dedicated',
      customDomain: true,
      apiAccess: true,
      whiteLabel: true,
      features: JSON.stringify(['Unlimited students', 'Unlimited teachers', 'Unlimited classes', 'Custom features', 'Custom pricing', 'Dedicated support', '_whatsapp:+2349152929772']),
      isActive: true,
      warningDays: 7,
    },
    create: {
      name: 'custom',
      displayName: 'Custom',
      pricingType: 'custom',
      price: 0,
      yearlyPrice: null,
      maxAdminAccounts: 5,
      hasDirectorPortal: true,
      hasAccountantPortal: true,
      hasLibrarianPortal: true,
      hasParentPortal: true,
      hasAIFeatures: true,
      hasPremiumSupport: true,
      hasPartnership: true,
      maxStudents: -1,
      maxTeachers: -1,
      maxClasses: -1,
      maxParents: -1,
      maxLibraryBooks: -1,
      maxVideoLessons: -1,
      maxHomeworkPerMonth: -1,
      storageLimit: -1,
      supportLevel: 'dedicated',
      customDomain: true,
      apiAccess: true,
      whiteLabel: true,
      features: JSON.stringify(['Unlimited students', 'Unlimited teachers', 'Unlimited classes', 'Custom features', 'Custom pricing', 'Dedicated support', '_whatsapp:+2349152929772']),
      isActive: true,
      warningDays: 7,
    },
  });
  console.log('Custom plan updated/created:', customPlan.id);

  // Upsert PlanPricing for Pro plan — monthly = term / 2
  const pricingData = [
    { schoolType: 'primary', monthlyPrice: 10000, termPrice: 20000, sessionPrice: 50000 },
    { schoolType: 'secondary', monthlyPrice: 15000, termPrice: 30000, sessionPrice: 80000 },
    { schoolType: 'primary_secondary', monthlyPrice: 20000, termPrice: 40000, sessionPrice: 100000 },
    { schoolType: 'higher_institution', monthlyPrice: 20000, termPrice: 40000, sessionPrice: 100000 },
  ];
  for (const pd of pricingData) {
    await prisma.planPricing.upsert({
      where: { planId_schoolType: { planId: proPlan.id, schoolType: pd.schoolType } },
      update: pd,
      create: { planId: proPlan.id, ...pd },
    });
  }
  console.log('PlanPricing updated for Pro plan');

  // Show all active plans
  const allPlans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { price: 'asc' },
  });

  console.log('\nActive plans:');
  allPlans.forEach(p => {
    console.log(`- ${p.displayName} (${p.name}): ${p.pricingType}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
