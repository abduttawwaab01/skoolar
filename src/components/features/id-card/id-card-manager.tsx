'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/store/app-store';
import { Skeleton } from '@/components/ui/skeleton';
import { IDCardDesigner } from '@/components/features/id-card/id-card-designer';
import { IDCardGenerate } from '@/components/features/id-card/id-card-generate';
import { IDCardBulk } from '@/components/features/id-card/id-card-bulk';
import { IdCard, Users, CreditCard, BarChart3, Palette, Plus, Upload, Download, Search, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface IDCardStats {
  totalCards: number;
  studentsCards: number;
  staffCards: number;
  activeCards: number;
}

interface CardRecord {
  id: string;
  fullName: string;
  displayId: string;
  personType: string;
  personId: string;
  className: string | null;
  section: string | null;
  status: string;
  uuid: string;
  createdAt: string;
  issueDate: string;
}

export function IDCardManager() {
  const { currentUser } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [stats, setStats] = useState<IDCardStats>({ totalCards: 0, studentsCards: 0, staffCards: 0, activeCards: 0 });
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [cardsTotal, setCardsTotal] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');
  const [cardFilter, setCardFilter] = useState<'all' | 'student' | 'teacher'>('all');
  const [cardSearch, setCardSearch] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [exportingAll, setExportingAll] = useState(false);

  useEffect(() => {
    loadStats();
    loadCards();
  }, [currentUser]);

  async function loadStats() {
    setLoading(true);
    try {
      const [studentsRes, teachersRes, cardsRes] = await Promise.all([
        fetch(`/api/students?schoolId=${currentUser.schoolId}&limit=1`),
        fetch(`/api/teachers?schoolId=${currentUser.schoolId}&limit=1`),
        fetch(`/api/id-cards?schoolId=${currentUser.schoolId}&limit=1`),
      ]);
      const [studentsData, teachersData, cardsData] = await Promise.all([
        studentsRes.json(), teachersRes.json(), cardsRes.json(),
      ]);
      const totalCards = cardsData.total || 0;
      setStats({
        totalCards,
        studentsCards: studentsData.total || 0,
        staffCards: teachersData.total || 0,
        activeCards: totalCards,
      });
    } catch {
      toast.error('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  }

  async function loadCards() {
    setCardsLoading(true);
    try {
      const res = await fetch(`/api/id-cards?schoolId=${currentUser.schoolId}&limit=100`);
      const data = await res.json();
      setCards(data.data || []);
      setCardsTotal(data.total || 0);
    } catch {
      setCards([]);
    } finally {
      setCardsLoading(false);
    }
  }

  const downloadCard = useCallback(async (cardId: string, personName: string) => {
    setDownloadingId(cardId);
    try {
      const res = await fetch(`/api/id-cards/${cardId}/pdf`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ID-Card-${personName.replace(/\s+/g, '-')}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const downloadAllCards = useCallback(async () => {
    setExportingAll(true);
    try {
      const res = await fetch('/api/id-cards/export/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: currentUser?.schoolId || '' }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'All-ID-Cards.html';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Downloaded all cards');
    } catch {
      toast.error('Export failed');
    } finally {
      setExportingAll(false);
    }
  }, [currentUser?.schoolId]);

  const filteredCards = cards.filter(c => {
    if (cardFilter !== 'all' && c.personType !== cardFilter) return false;
    if (cardSearch && !c.fullName.toLowerCase().includes(cardSearch.toLowerCase()) && !c.displayId?.toLowerCase().includes(cardSearch.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-6 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card><CardContent className="pt-6"><Skeleton className="h-96 w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <IdCard className="size-5 text-indigo-600" />
              <Badge variant="secondary" className="text-xs">Total</Badge>
            </div>
            <p className="text-3xl font-bold">{stats.totalCards}</p>
            <p className="text-sm text-muted-foreground">ID Cards Generated</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="size-5 text-emerald-600" />
              <Badge variant="secondary" className="text-xs">Students</Badge>
            </div>
            <p className="text-3xl font-bold">{stats.studentsCards}</p>
            <p className="text-sm text-muted-foreground">Total Students</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <CreditCard className="size-5 text-blue-600" />
              <Badge variant="secondary" className="text-xs">Staff</Badge>
            </div>
            <p className="text-3xl font-bold">{stats.staffCards}</p>
            <p className="text-sm text-muted-foreground">Total Staff</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <BarChart3 className="size-5 text-amber-600" />
              <Badge variant="secondary" className="text-xs">Active</Badge>
            </div>
            <p className="text-3xl font-bold">{stats.activeCards}</p>
            <p className="text-sm text-muted-foreground">Active Cards</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="text-sm"><BarChart3 className="size-4 mr-2" /> Overview</TabsTrigger>
          <TabsTrigger value="designer" className="text-sm"><Palette className="size-4 mr-2" /> Designer</TabsTrigger>
          <TabsTrigger value="generate" className="text-sm"><Plus className="size-4 mr-2" /> Generate</TabsTrigger>
          <TabsTrigger value="bulk" className="text-sm"><Upload className="size-4 mr-2" /> Bulk</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {(['all', 'student', 'teacher'] as const).map(f => (
                <Button
                  key={f}
                  variant={cardFilter === f ? 'default' : 'outline'}
                  size="sm" onClick={() => setCardFilter(f)}
                  className="h-7 text-[10px] capitalize"
                >
                  {f === 'all' ? 'All Cards' : f === 'student' ? 'Students' : 'Staff'}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
                <Input
                  placeholder="Search cards..."
                  value={cardSearch}
                  onChange={e => setCardSearch(e.target.value)}
                  className="h-7 pl-8 text-xs"
                />
              </div>
              <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={downloadAllCards} disabled={exportingAll || cards.length === 0}>
                {exportingAll ? <Loader2 className="size-3 animate-spin mr-1" /> : <Download className="size-3 mr-1" />}
                Export All
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-gray-50/80">
                      <th className="text-left p-3 font-semibold text-gray-600">Name</th>
                      <th className="text-left p-3 font-semibold text-gray-600">ID</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Type</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Class / Dept</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Status</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Issued</th>
                      <th className="text-right p-3 font-semibold text-gray-600">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cardsLoading ? (
                      <tr><td colSpan={7} className="p-8 text-center text-gray-400"><Loader2 className="size-5 animate-spin mx-auto mb-2" />Loading cards...</td></tr>
                    ) : filteredCards.length === 0 ? (
                      <tr><td colSpan={7} className="p-8 text-center text-gray-400">No cards found. Generate cards from the Generate tab.</td></tr>
                    ) : (
                      filteredCards.map(card => (
                        <tr key={card.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                          <td className="p-3 font-medium">{card.fullName}</td>
                          <td className="p-3 text-gray-500">{card.displayId || '-'}</td>
                          <td className="p-3">
                            <Badge variant="outline" className={`text-[10px] ${card.personType === 'teacher' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                              {card.personType === 'teacher' ? 'Staff' : 'Student'}
                            </Badge>
                          </td>
                          <td className="p-3 text-gray-500">{card.className || card.section || '-'}</td>
                          <td className="p-3">
                            {card.status === 'active' ? (
                              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                                <CheckCircle className="size-3 mr-0.5" /> Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                                <XCircle className="size-3 mr-0.5" /> {card.status}
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-gray-400 text-[10px]">{card.issueDate ? new Date(card.issueDate).toLocaleDateString() : '-'}</td>
                          <td className="p-3 text-right">
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 text-[10px] text-indigo-600"
                              onClick={() => downloadCard(card.id, card.fullName)}
                              disabled={downloadingId === card.id}
                            >
                              {downloadingId === card.id ? <Loader2 className="size-3 animate-spin mr-1" /> : <Download className="size-3 mr-1" />}
                              {downloadingId === card.id ? '...' : 'Download'}
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="text-xs text-gray-400 text-center">
            Showing {filteredCards.length} of {cardsTotal} card{cardsTotal !== 1 ? 's' : ''}
          </div>
        </TabsContent>

        <TabsContent value="designer" className="space-y-6">
          <IDCardDesigner />
        </TabsContent>

        <TabsContent value="generate" className="space-y-6">
          <IDCardGenerate />
        </TabsContent>

        <TabsContent value="bulk" className="space-y-6">
          <IDCardBulk />
        </TabsContent>
      </Tabs>
    </div>
  );
}
