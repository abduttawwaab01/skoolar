'use client';

import React, { useState } from 'react';
import { IDCardManager } from '@/components/features/id-card/id-card-manager';

export function TeacherIDCards() {
  return (
    <div className="p-6">
      <IDCardManager />
    </div>
  );
}
