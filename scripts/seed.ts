import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

// Create Prisma Client
function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not set');
  }
  
  const adapter = new PrismaNeon({ connectionString: databaseUrl });
  
  return new PrismaClient({
    adapter,
    log: ['warn', 'error'],
  });
}

const db = createPrismaClient();

async function seedSubscriptionPlans() {
  const plans = [
    { 
      name: 'Free', 
      displayName: 'Free Plan',
      price: 0, 
      maxStudents: 100,
      maxTeachers: 5,
      maxClasses: 10,
      maxParents: 100,
      maxLibraryBooks: 500,
      maxVideoLessons: 50,
      maxHomeworkPerMonth: 100,
      storageLimit: 1000,
      supportLevel: 'email',
      customDomain: false,
      apiAccess: false,
      whiteLabel: false,
      features: 'Basic features, Up to 100 students',
      isActive: true
    },
    { 
      name: 'Starter', 
      displayName: 'Starter Plan',
      price: 49, 
      maxStudents: 500,
      maxTeachers: 10,
      maxClasses: 20,
      maxParents: 500,
      maxLibraryBooks: 1000,
      maxVideoLessons: 100,
      maxHomeworkPerMonth: 200,
      storageLimit: 5000,
      supportLevel: 'email',
      customDomain: false,
      apiAccess: false,
      whiteLabel: false,
      features: 'All Free features, Up to 500 students, Email support',
      isActive: true
    },
    { 
      name: 'Professional', 
      displayName: 'Professional Plan',
      price: 99, 
      maxStudents: 2000,
      maxTeachers: 25,
      maxClasses: 50,
      maxParents: 2000,
      maxLibraryBooks: 5000,
      maxVideoLessons: 500,
      maxHomeworkPerMonth: 500,
      storageLimit: 20000,
      supportLevel: 'priority',
      customDomain: true,
      apiAccess: true,
      whiteLabel: false,
      features: 'All Starter features, Up to 2000 students, Priority support, Custom branding',
      isActive: true
    },
    { 
      name: 'Enterprise', 
      displayName: 'Enterprise Plan',
      price: 199, 
      maxStudents: 999999,
      maxTeachers: 999,
      maxClasses: 999,
      maxParents: 999999,
      maxLibraryBooks: 999999,
      maxVideoLessons: 999999,
      maxHomeworkPerMonth: 999999,
      storageLimit: 999999,
      supportLevel: '24/7',
      customDomain: true,
      apiAccess: true,
      whiteLabel: true,
      features: 'All Professional features, Unlimited students, 24/7 support, Custom domain',
      isActive: true
    },
  ];

  for (const plan of plans) {
    await db.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
  }
  console.log('Subscription plans seeded');
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