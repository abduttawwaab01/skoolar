'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, DollarSign, HandCoins, BarChart3, User, FileText, CreditCard } from 'lucide-react';
import { SalaryConfigList } from './salary-config-list';
import { SalaryPayrollList } from './salary-payroll-list';
import { SalaryAdvances } from './salary-advances';
import { SalaryReports } from './salary-reports';
import { SalaryMyInfo } from './salary-my-info';
import { SalaryMyPayslips } from './salary-my-payslips';
import { SalaryPromotionRequests } from './salary-promotion-requests';

export default function SalaryManager() {
  const [userRole, setUserRole] = useState<string>('');
  useEffect(() => {
    const stored = localStorage.getItem('auth-storage');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUserRole(parsed?.state?.user?.role || '');
      } catch {}
    }
  }, []);

  const isAdmin = userRole === 'SCHOOL_ADMIN' || userRole === 'SUPER_ADMIN';
  const isAccountant = userRole === 'ACCOUNTANT';
  const isStaff = userRole === 'TEACHER' || userRole === 'DIRECTOR';

  let tabs: { id: string; label: string; icon: any }[] = [];

  if (isAdmin) {
    tabs = [
      { id: 'config', label: 'Config', icon: Settings },
      { id: 'payroll', label: 'Payroll', icon: DollarSign },
      { id: 'advances', label: 'Advances', icon: HandCoins },
      { id: 'reports', label: 'Reports', icon: BarChart3 },
    ];
  } else if (isAccountant) {
    tabs = [
      { id: 'payroll', label: 'Payroll', icon: DollarSign },
      { id: 'advances', label: 'Advances', icon: HandCoins },
      { id: 'reports', label: 'Reports', icon: BarChart3 },
    ];
  } else if (isStaff) {
    tabs = [
      { id: 'my-info', label: 'My Salary', icon: User },
      { id: 'my-payslips', label: 'My Payslips', icon: FileText },
      { id: 'my-advances', label: 'My Advances', icon: CreditCard },
      { id: 'my-promotions', label: 'Promotions', icon: HandCoins },
    ];
  }

  const [activeTab, setActiveTab] = useState(tabs[0]?.id || '');

  useEffect(() => {
    if (tabs.length > 0 && !tabs.find(t => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [userRole]);

  if (tabs.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No salary access available for your role.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Salary & Payroll Management</h2>
          <p className="text-sm text-muted-foreground">Manage staff salaries, payroll, and advances</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-4 h-9">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="text-xs">
              <tab.icon className="size-3.5 mr-1.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="config" className="mt-3">
          <SalaryConfigList />
        </TabsContent>

        <TabsContent value="payroll" className="mt-3">
          <SalaryPayrollList />
        </TabsContent>

        <TabsContent value="advances" className="mt-3">
          <SalaryAdvances />
        </TabsContent>

        <TabsContent value="reports" className="mt-3">
          <SalaryReports />
        </TabsContent>

        <TabsContent value="my-info" className="mt-3">
          <SalaryMyInfo />
        </TabsContent>

        <TabsContent value="my-payslips" className="mt-3">
          <SalaryMyPayslips />
        </TabsContent>

        <TabsContent value="my-advances" className="mt-3">
          <SalaryAdvances />
        </TabsContent>
        <TabsContent value="my-promotions" className="mt-3">
          <SalaryPromotionRequests />
        </TabsContent>
      </Tabs>
    </div>
  );
}
