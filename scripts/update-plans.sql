-- Update subscription plans: Standardize to Free/Pro/Custom
-- Run this in your database CLI or Prisma Studio

-- First, update existing plans
-- If you have a "Starter" plan, update it to "Free"
UPDATE "SubscriptionPlan" 
SET 
  name = 'free',
  "displayName" = 'Free',
  "pricingType" = 'free',
  price = 0,
  "maxStudents" = 50,
  "maxTeachers" = 5,
  "maxClasses" = 10,
  features = '["Up to 50 students", "Up to 5 teachers", "Up to 10 classes", "Basic report cards", "Attendance tracking", "Community support"]',
  "supportLevel" = 'community'
WHERE (name ILIKE '%starter%' OR "displayName" ILIKE '%starter%') AND name != 'free';

-- If you have a "Professional" or "Pro" plan, update it to "Pro"
UPDATE "SubscriptionPlan" 
SET 
  name = 'pro',
  "displayName" = 'Pro',
  "pricingType" = 'per_student',
  price = 0,
  "yearlyPrice" = NULL,
  "maxStudents" = -1,
  "maxTeachers" = -1,
  "maxClasses" = -1,
  features = '["Unlimited students", "Unlimited teachers", "Unlimited classes", "Advanced report cards", "Video lessons", "AI grading assistant", "Homework management", "Email support", "Transport tracking"]',
  "hasDirectorPortal" = true,
  "hasParentPortal" = true,
  "hasAIFeatures" = true,
  "hasPartnership" = true
WHERE (name ILIKE '%professional%' OR "displayName" ILIKE '%professional%' OR name = 'pro') AND name != 'pro';

-- If you have an "Enterprise" or "Premium" plan, update it to "Custom"
UPDATE "SubscriptionPlan" 
SET 
  name = 'custom',
  "displayName" = 'Custom',
  "pricingType" = 'custom',
  price = 0,
  "maxStudents" = -1,
  "maxTeachers" = -1,
  "maxClasses" = -1,
  features = '["Unlimited students", "Unlimited teachers", "Unlimited classes", "Custom features", "Custom pricing", "Dedicated support"]',
  "supportLevel" = 'dedicated',
  "customDomain" = true,
  "apiAccess" = true,
  "whiteLabel" = true
WHERE (name ILIKE '%enterprise%' OR "displayName" ILIKE '%enterprise%' OR name ILIKE '%premium%' OR "displayName" ILIKE '%premium%') AND name != 'custom';

-- Deactivate any remaining old plans that don't match Free/Pro/Custom
UPDATE "SubscriptionPlan" 
SET "isActive" = false
WHERE name NOT IN ('free', 'pro', 'custom');

-- Fix any plans that slipped through with missing pricingType
UPDATE "SubscriptionPlan"
SET "pricingType" = 'free' WHERE name = 'free' AND ("pricingType" IS NULL OR "pricingType" = '');
UPDATE "SubscriptionPlan"
SET "pricingType" = 'per_student' WHERE name = 'pro' AND ("pricingType" IS NULL OR "pricingType" = '');
UPDATE "SubscriptionPlan"
SET "pricingType" = 'custom' WHERE name = 'custom' AND ("pricingType" IS NULL OR "pricingType" = '');

-- Insert Free plan if it doesn't exist
INSERT INTO "SubscriptionPlan" (id, name, "displayName", "pricingType", price, "yearlyPrice", "maxAdminAccounts", "maxStudents", "maxTeachers", "maxClasses", "maxParents", "maxLibraryBooks", "maxVideoLessons", "maxHomeworkPerMonth", "storageLimit", "supportLevel", "customDomain", "apiAccess", "whiteLabel", "hasPartnership", features, "isActive", "paystackPlanCode", "warningDays", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'free', 'Free', 'free', 0, NULL, 1, 50, 5, 10, 100, 500, 50, 100, 1000, 'community', false, false, false, true, '["Up to 50 students", "Up to 5 teachers", "Up to 10 classes", "Basic report cards", "Attendance tracking", "Community support"]', true, NULL, 7, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "SubscriptionPlan" WHERE name = 'free');

-- Insert Pro plan if it doesn't exist
INSERT INTO "SubscriptionPlan" (id, name, "displayName", "pricingType", price, "yearlyPrice", "maxAdminAccounts", "maxStudents", "maxTeachers", "maxClasses", "maxParents", "maxLibraryBooks", "maxVideoLessons", "maxHomeworkPerMonth", "storageLimit", "supportLevel", "customDomain", "apiAccess", "whiteLabel", "hasDirectorPortal", "hasParentPortal", "hasAIFeatures", "hasPartnership", features, "isActive", "paystackPlanCode", "warningDays", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'pro', 'Pro', 'per_student', 0, NULL, 1, -1, -1, -1, -1, -1, -1, -1, -1, 'email', false, false, false, true, true, true, true, '["Unlimited students", "Unlimited teachers", "Unlimited classes", "Advanced report cards", "Video lessons", "AI grading assistant", "Homework management", "Email support", "Transport tracking"]', true, NULL, 7, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "SubscriptionPlan" WHERE name = 'pro');

-- Insert Custom plan if it doesn't exist
INSERT INTO "SubscriptionPlan" (id, name, "displayName", "pricingType", price, "yearlyPrice", "maxAdminAccounts", "maxStudents", "maxTeachers", "maxClasses", "maxParents", "maxLibraryBooks", "maxVideoLessons", "maxHomeworkPerMonth", "storageLimit", "supportLevel", "customDomain", "apiAccess", "whiteLabel", "hasDirectorPortal", "hasAccountantPortal", "hasLibrarianPortal", "hasParentPortal", "hasAIFeatures", "hasPremiumSupport", "hasPartnership", features, "isActive", "paystackPlanCode", "warningDays", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'custom', 'Custom', 'custom', 0, NULL, 5, -1, -1, -1, -1, -1, -1, -1, -1, 'dedicated', true, true, true, true, true, true, true, true, true, true, '["Unlimited students", "Unlimited teachers", "Unlimited classes", "Custom features", "Custom pricing", "Dedicated support"]', true, NULL, 7, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "SubscriptionPlan" WHERE name = 'custom');

-- Verify the changes
SELECT id, name, "displayName", "pricingType", price, "yearlyPrice", "isActive" FROM "SubscriptionPlan" ORDER BY price ASC;
