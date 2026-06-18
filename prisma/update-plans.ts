// Script to update subscription plans to Free, Pro, Custom
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Updating subscription plans to Free, Pro, Custom...');

  const targetNames = ['free', 'pro', 'custom'];

  // Deactivate plans not in our target set
  await prisma.subscriptionPlan.updateMany({
    where: { name: { notIn: targetNames }, isActive: true },
    data: { isActive: false },
  });
  console.log('Deactivated plans not in target set (free, pro, custom)');

  // Upsert Free plan
  const freePlan = await prisma.subscriptionPlan.upsert({
    where: { name: 'free' },
    update: {
      displayName: 'Free',
      pricingType: 'free',
      price: 0,
      yearlyPrice: null,
      maxAdminAccounts: 1,
      hasPartnership: true,
      maxStudents: 50,
      maxTeachers: 5,
      maxClasses: 10,
      maxParents: 100,
      maxLibraryBooks: 500,
      maxVideoLessons: 50,
      maxHomeworkPerMonth: 100,
      storageLimit: 1000,
      supportLevel: 'community',
      customDomain: false,
      apiAccess: false,
      whiteLabel: false,
      features: JSON.stringify(['Up to 50 students', 'Up to 5 teachers', 'Up to 10 classes', 'Basic report cards', 'Attendance tracking', 'Community support']),
      isActive: true,
      paystackPlanCode: null,
      warningDays: 7,
    },
    create: {
      name: 'free',
      displayName: 'Free',
      pricingType: 'free',
      price: 0,
      yearlyPrice: null,
      maxAdminAccounts: 1,
      hasPartnership: true,
      maxStudents: 50,
      maxTeachers: 5,
      maxClasses: 10,
      maxParents: 100,
      maxLibraryBooks: 500,
      maxVideoLessons: 50,
      maxHomeworkPerMonth: 100,
      storageLimit: 1000,
      supportLevel: 'community',
      customDomain: false,
      apiAccess: false,
      whiteLabel: false,
      features: JSON.stringify(['Up to 50 students', 'Up to 5 teachers', 'Up to 10 classes', 'Basic report cards', 'Attendance tracking', 'Community support']),
      isActive: true,
      paystackPlanCode: null,
      warningDays: 7,
    },
  });
  console.log('Free plan updated/created:', freePlan.id);

  // Upsert Pro plan (per-student pricing)
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
      paystackPlanCode: null,
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
      paystackPlanCode: null,
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
      paystackPlanCode: null,
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
      paystackPlanCode: null,
      warningDays: 7,
    },
  });
  console.log('Custom plan updated/created:', customPlan.id);

  // Show all active plans
  const allPlans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { price: 'asc' },
  });

  console.log('\nActive plans:');
  allPlans.forEach(p => {
    console.log(`- ${p.displayName} (${p.name}): ₦${p.price}/month`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
