'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import {
  Loader2, Users, IdCard, QrCode, Activity, AlertTriangle,
  GraduationCap, Briefcase, Chalkboard, TrendingUp,
} from 'lucide-react';

interface StatsData {
  total: number;
  active: number;
  expired: number;
  suspended: number;
  byType: Record<string, number>;
  recentScans: number;
  todayScans: number;
  verifiedToday: number;
}

export function IDCardStats() {
  const { currentUser } = useAppStore();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/id-cards?stats=true&timeframe=${timeframe}`);
        if (res.ok) {
          const json = await res.json();
          setStats(json.data || json.stats || json);
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
    load();
  }, [timeframe]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Activity className="size-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No analytics data available</p>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Cards',
      value: stats.total ?? 0,
      icon: IdCard,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Active',
      value: stats.active ?? 0,
      icon: Activity,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Expired',
      value: stats.expired ?? 0,
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Recent Scans',
      value: stats.recentScans ?? 0,
      icon: QrCode,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: "Today's Scans",
      value: stats.todayScans ?? 0,
      icon: TrendingUp,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      label: 'Verified Today',
      value: stats.verifiedToday ?? 0,
      icon: QrCode,
      color: 'text-teal-600',
      bg: 'bg-teal-50',
    },
  ];

  const typeBreakdown = [
    { key: 'student', label: 'Students', icon: GraduationCap },
    { key: 'teacher', label: 'Teachers', icon: Chalkboard },
    { key: 'staff', label: 'Staff', icon: Briefcase },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {(['7d', '30d', '90d'] as const).map((t) => (
            <Badge
              key={t}
              variant={timeframe === t ? 'default' : 'outline'}
              className="cursor-pointer text-[10px]"
              onClick={() => setTimeframe(t)}
            >
              {t}
            </Badge>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          <Users className="size-3 inline mr-1" />
          {currentUser.schoolName}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground">{card.label}</p>
                <div className={cn('p-1 rounded-md', card.bg)}>
                  <card.icon className={cn('size-3', card.color)} />
                </div>
              </div>
              <p className="text-lg font-bold mt-1">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-3">
          <h4 className="text-xs font-medium mb-2">Cards by Type</h4>
          <div className="space-y-2">
            {typeBreakdown.map((t) => {
              const count = stats.byType?.[t.key] ?? 0;
              const total = stats.total || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={t.key}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1">
                      <t.icon className="size-3 text-muted-foreground" />
                      {t.label}
                    </span>
                    <span className="text-muted-foreground">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full mt-0.5 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {stats.suspended !== undefined && stats.suspended > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="p-3 flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600 shrink-0" />
            <p className="text-[10px] text-amber-700">
              {stats.suspended} card(s) currently suspended
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
