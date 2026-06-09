'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useAppStore } from '@/store/app-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useFeature } from '@/hooks/use-feature';
import { useLiveClasses } from '@/hooks/use-live-class-api';
import {
  Video, Plus, Copy, ExternalLink, Play, Calendar,
  Clock, Users, MoreHorizontal, Loader2, ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function LiveClassesView() {
  const router = useRouter();
  const { data: session } = useSession();
  const { selectedSchoolId } = useAppStore();
  const liveClassesEnabled = useFeature('live_classes');
  const [tab, setTab] = useState('active');

  const schoolId = selectedSchoolId || session?.user?.schoolId || '';
  const statusFilter = tab === 'active' ? 'active' : tab === 'scheduled' ? 'scheduled' : 'ended';
  const enabled = !!(selectedSchoolId || session?.user?.role === 'SUPER_ADMIN');
  const { data, isLoading } = useLiveClasses(schoolId, statusFilter, enabled);
  const classes = data?.data || [];

  const copyClassLink = (c: any) => {
    const url = `${window.location.origin}/live/class/${c.id}/lobby`;
    navigator.clipboard.writeText(`Join: ${c.title}\nCode: ${c.joinCode}\nLink: ${url}`);
    toast.success('Link copied!');
  };

  const canCreate = session?.user && ['SCHOOL_ADMIN', 'TEACHER', 'DIRECTOR', 'SUPER_ADMIN'].includes(session.user.role as string);

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      ended: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
      cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return (
      <Badge variant="outline" className={cn('text-[10px]', styles[status] || styles.ended)}>
        {status}
      </Badge>
    );
  };

  const typeIcon = (type: string) => {
    if (type === 'class') return '📚';
    if (type === 'meeting') return '🤝';
    if (type === 'interview') return '💼';
    return '📹';
  };

  if (!liveClassesEnabled) {
    return (
      <Card className="border-dashed border-amber-200 bg-amber-50/50">
        <CardContent className="p-12 text-center">
          <ShieldAlert className="size-12 text-amber-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-amber-700 mb-1">Feature Disabled</h2>
          <p className="text-sm text-amber-600">
            Live Classes have been disabled for this school. Contact the platform administrator.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Classes</h1>
          <p className="text-muted-foreground text-sm">
            Create and manage virtual classrooms, meetings, and interviews
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => router.push('/live/create')} className="bg-emerald-600 hover:bg-emerald-700">
            <Video className="size-4 mr-2" /> New Class
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="active">
            <Play className="size-3.5 mr-1.5" /> Active
          </TabsTrigger>
          <TabsTrigger value="scheduled">
            <Calendar className="size-3.5 mr-1.5" /> Scheduled
          </TabsTrigger>
          <TabsTrigger value="ended">
            <Clock className="size-3.5 mr-1.5" /> Past
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-xl" />
              ))}
            </div>
          ) : classes.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center">
                <Video className="size-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No {tab} classes found
                </p>
                {canCreate && (
                  <Button onClick={() => router.push('/live/create')} variant="outline" className="mt-3">
                    <Plus className="size-4 mr-2" /> Create your first class
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {classes.map((c: any) => (
                <Card key={c.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg">{typeIcon(c.type)}</span>
                        <div className="min-w-0">
                          <p className="font-medium truncate text-sm">{c.title}</p>
                          <p className="text-xs text-muted-foreground capitalize">{c.type}</p>
                        </div>
                      </div>
                      {statusBadge(c.status)}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <Users className="size-3" /> {c._count?.participants || 0}
                      </span>
                      {c.scheduledAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {new Date(c.scheduledAt).toLocaleDateString()}
                        </span>
                      )}
                      <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">
                        {c.joinCode}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {c.status === 'active' && (
                        <Button
                          size="sm"
                          className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => router.push(`/live/class/${c.id}/lobby`)}
                        >
                          <Play className="size-3 mr-1" /> Join
                        </Button>
                      )}
                      {c.status === 'scheduled' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8 text-xs"
                          disabled
                        >
                          <Calendar className="size-3 mr-1" /> Scheduled
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => copyClassLink(c)}
                      >
                        <Copy className="size-3" />
                      </Button>
                      {c.recordingUrl && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          asChild
                        >
                          <a href={c.recordingUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="size-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
