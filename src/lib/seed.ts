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
      price: 0,
      yearlyPrice: null,
      maxStudents: 50,
      maxTeachers: 5,
      maxClasses: 10,
      features: 'Basic attendance,5 subjects,Report cards (print only),Single school admin',
      isActive: true,
    },
    {
      name: 'pro',
      displayName: 'Pro',
      price: 15000,
      yearlyPrice: 150000,
      maxStudents: 500,
      maxTeachers: 30,
      maxClasses: 30,
      features: 'All Free features,Unlimited subjects,Homework management,Video lessons (10),In-app messaging,Student diary,Notice board',
      isActive: true,
    },
    {
      name: 'premium',
      displayName: 'Premium',
      price: 35000,
      yearlyPrice: 350000,
      maxStudents: 2000,
      maxTeachers: 100,
      maxClasses: 100,
      features: 'All Pro features,Unlimited video lessons,AI grading assistant,AI quiz generator,AI chat,Advanced analytics,Multi-school comparison,Custom branding,API access',
      isActive: true,
    },
    {
      name: 'enterprise',
      displayName: 'Enterprise',
      price: 75000,
      yearlyPrice: 750000,
      maxStudents: 10000,
      maxTeachers: 500,
      maxClasses: 500,
      features: 'All Premium features,Unlimited everything,Priority support,Custom integrations,Dedicated account manager,White-label option,SLA guarantee',
      isActive: true,
    },
  ];

  const results: Array<{ id: string; name: string; displayName: string }> = [];
  for (const planData of plans) {
    const existing = await db.subscriptionPlan.findUnique({
      where: { name: planData.name },
    });
    if (!existing) {
      const plan = await db.subscriptionPlan.create({ data: planData });
      results.push(plan);
    } else {
      results.push(existing);
    }
  }
  return results;
}

export async function seedDatabase() {
  // Check if Super Admin already exists
  const existingAdmin = await db.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
  });

  if (existingAdmin) {
    return { message: 'Database already seeded. Super Admin already exists.', superAdmin: existingAdmin.email };
  }

  // Use environment variable or generate a random password
  const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || 'CHANGE_ME_NOW_' + Math.random().toString(36).slice(-8);
  const adminHash = await hashPassword(initialPassword);

  // Use environment variables or defaults (change defaults in production!)
  const adminUsername = process.env.SUPER_ADMIN_USERNAME || 'abduttawwab';
  const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@skoolar.com';
  const adminName = process.env.SUPER_ADMIN_NAME || 'Odebunmi Tawwāb';

  // Create ONLY the Super Admin
  const superAdmin = await db.user.create({
    data: {
      username: adminUsername,
      name: adminName,
      email: adminEmail,
      password: adminHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  return {
    message: 'Database seeded successfully. Only the Super Admin account has been created.',
    superAdmin: {
      username: adminUsername,
      email: adminEmail,
      name: adminName,
      password: initialPassword, // Only returned in dev/seed, not in production API
    },
  };
}
