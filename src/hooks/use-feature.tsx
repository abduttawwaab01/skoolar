'use client';

import { useAppStore } from '@/store/app-store';
import { useMemo } from 'react';

export function useFeature(featureId: string): boolean {
  const { disabledFeatures, selectedSchoolId, currentUser, currentRole } = useAppStore();

  // Super Admin always has all features enabled
  if (currentRole === 'SUPER_ADMIN') {
    return true;
  }

  // If no school selected, assume features enabled (dashboard loading state)
  if (!selectedSchoolId) {
    return true;
  }

  // Check if this feature is disabled for the school
  const isDisabled = disabledFeatures.includes(featureId);

  return !isDisabled;
}

export function useFeatures(featureIds: string[]): Record<string, boolean> {
  const { disabledFeatures, currentRole } = useAppStore();

  return useMemo(() => {
    // Super Admin always has all features enabled
    if (currentRole === 'SUPER_ADMIN') {
      return featureIds.reduce((acc, id) => {
        acc[id] = true;
        return acc;
      }, {} as Record<string, boolean>);
    }

    return featureIds.reduce((acc, id) => {
      acc[id] = !disabledFeatures.includes(id);
      return acc;
    }, {} as Record<string, boolean>);
  }, [featureIds, disabledFeatures, currentRole]);
}

export function FeatureGuard({
  featureId,
  children,
  fallback = null,
}: {
  featureId: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const isEnabled = useFeature(featureId);

  if (!isEnabled) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
