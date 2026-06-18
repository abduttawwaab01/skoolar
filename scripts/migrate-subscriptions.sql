-- Migration: Fix existing data inconsistencies in subscription & plans system
-- Run this after schema changes are applied

-- 1. Migrate PlatformPayment duration values from numeric to labels
UPDATE "PlatformPayment"
SET duration = 'monthly'
WHERE duration IN ('1', 'month');

UPDATE "PlatformPayment"
SET duration = 'term'
WHERE duration IN ('4', 'term');

UPDATE "PlatformPayment"
SET duration = 'session'
WHERE duration IN ('10', 'session', 'yearly', 'year');

-- 2. Ensure School.plan field matches the linked SubscriptionPlan name
UPDATE "School" s
SET plan = sp.name
FROM "SubscriptionPlan" sp
WHERE s."planId" = sp.id
  AND s.plan IS DISTINCT FROM sp.name;

-- 3. Fix any School records that reference a planId for a non-existent plan
UPDATE "School"
SET "planId" = NULL, plan = 'free'
WHERE "planId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "SubscriptionPlan" WHERE id = "School"."planId");

-- 4. Fix any SubscriptionPlan with missing/invalid pricingType
UPDATE "SubscriptionPlan"
SET "pricingType" = 'free'
WHERE name = 'free' AND ("pricingType" IS NULL OR "pricingType" = '');

UPDATE "SubscriptionPlan"
SET "pricingType" = 'per_student'
WHERE name = 'pro' AND ("pricingType" IS NULL OR "pricingType" = '');

UPDATE "SubscriptionPlan"
SET "pricingType" = 'custom'
WHERE name = 'custom' AND ("pricingType" IS NULL OR "pricingType" = '');

-- 5. Fix any PlatformPayment records with status 'active' -> 'success'
UPDATE "PlatformPayment"
SET status = 'success'
WHERE status = 'active';

-- 6. Deactivate any remaining plans not in our 3-plan set
UPDATE "SubscriptionPlan"
SET "isActive" = false
WHERE name NOT IN ('free', 'pro', 'custom') AND "isActive" = true;

-- 7. Ensure all School records with no successful payment have correct plan field
-- If a school has a non-free planId but no successful payment, revert to free
UPDATE "School" s
SET "planId" = NULL, plan = 'free'
WHERE s.plan != 'free'
  AND s."planId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "SubscriptionPlan" sp WHERE sp.id = s."planId" AND sp."pricingType" != 'free')
  AND NOT EXISTS (
    SELECT 1 FROM "PlatformPayment" pp
    WHERE pp."schoolId" = s.id
      AND pp.status = 'success'
      AND pp."planId" = s."planId"
  );

-- Verify cleanup
SELECT 'Plans' AS entity, name, "displayName", "pricingType", "isActive" FROM "SubscriptionPlan" ORDER BY name;
SELECT 'PlatformPayment durations' AS entity, duration, COUNT(*) FROM "PlatformPayment" GROUP BY duration;
SELECT 'PlatformPayment statuses' AS entity, status, COUNT(*) FROM "PlatformPayment" GROUP BY status;
