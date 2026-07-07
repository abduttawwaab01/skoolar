-- Update subscription plans: Standardize to Pro/Custom
-- Run this in your database CLI or Prisma Studio

-- Deactivate any old plans that don't match Pro/Custom
UPDATE "SubscriptionPlan" 
SET "isActive" = false
WHERE name NOT IN ('pro', 'custom');

-- Fix any plans that slipped through with missing pricingType
UPDATE "SubscriptionPlan"
SET "pricingType" = 'per_student' WHERE name = 'pro' AND ("pricingType" IS NULL OR "pricingType" = '');
UPDATE "SubscriptionPlan"
SET "pricingType" = 'custom' WHERE name = 'custom' AND ("pricingType" IS NULL OR "pricingType" = '');

-- Insert Pro plan if it doesn't exist
INSERT INTO "SubscriptionPlan" (id, name, "displayName", "pricingType", price, "yearlyPrice", "maxAdminAccounts", "maxStudents", "maxTeachers", "maxClasses", "maxParents", "maxLibraryBooks", "maxVideoLessons", "maxHomeworkPerMonth", "storageLimit", "supportLevel", "customDomain", "apiAccess", "whiteLabel", "hasDirectorPortal", "hasParentPortal", "hasAIFeatures", "hasPartnership", features, "isActive", "warningDays", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'pro', 'Pro', 'per_student', 0, NULL, 1, -1, -1, -1, -1, -1, -1, -1, -1, 'email', false, false, false, true, true, true, true, '["Unlimited students", "Unlimited teachers", "Unlimited classes", "Advanced report cards", "Video lessons", "AI grading assistant", "Homework management", "Email support", "Transport tracking"]', true, 7, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "SubscriptionPlan" WHERE name = 'pro');

-- Insert Custom plan if it doesn't exist
INSERT INTO "SubscriptionPlan" (id, name, "displayName", "pricingType", price, "yearlyPrice", "maxAdminAccounts", "maxStudents", "maxTeachers", "maxClasses", "maxParents", "maxLibraryBooks", "maxVideoLessons", "maxHomeworkPerMonth", "storageLimit", "supportLevel", "customDomain", "apiAccess", "whiteLabel", "hasDirectorPortal", "hasAccountantPortal", "hasLibrarianPortal", "hasParentPortal", "hasAIFeatures", "hasPremiumSupport", "hasPartnership", features, "isActive", "warningDays", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'custom', 'Custom', 'custom', 0, NULL, 5, -1, -1, -1, -1, -1, -1, -1, -1, 'dedicated', true, true, true, true, true, true, true, true, true, true, '["Unlimited students", "Unlimited teachers", "Unlimited classes", "Custom features", "Custom pricing", "Dedicated support"]', true, 7, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "SubscriptionPlan" WHERE name = 'custom');

-- Verify the changes
SELECT id, name, "displayName", "pricingType", price, "isActive" FROM "SubscriptionPlan" ORDER BY name ASC;
