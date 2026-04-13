'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Plus, Pencil, Trash2, Check, X, Crown, Zap, Building2, Users, GraduationCap, BookOpen, Video, HardDrive, Headphones, Globe, Code, Palette } from 'lucide-react';
import { handleSilentError } from '@/lib/error-handler';
import { useConfirm } from '@/components/confirm-dialog';

interface Plan {
  id: string; name: string; displayName: string; price: number; yearlyPrice: number | null;
  maxStudents: number; maxTeachers: number; maxClasses: number; maxParents: number;
  maxLibraryBooks: number; maxVideoLessons: number; maxHomeworkPerMonth: number;
  storageLimit: number; supportLevel: string; customDomain: boolean; apiAccess: boolean; whiteLabel: boolean;
  features: string; isActive: boolean; paystackPlanCode: string | null;
  _count?: { schools: number };
}

export function PlansManager() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState<{ open: boolean; plan: Plan | null }>({ open: false, plan: null });
  const [form, setForm] = useState({
    name: '', displayName: '', price: 0, yearlyPrice: 0,
    maxStudents: 50, maxTeachers: 5, maxClasses: 10, maxParents: 100,
    maxLibraryBooks: 500, maxVideoLessons: 50, maxHomeworkPerMonth: 100,
    storageLimit: 1000, supportLevel: 'email', customDomain: false, apiAccess: false, whiteLabel: false,
    features: '[]', isActive: true, paystackPlanCode: '',
  });
  const [saving, setSaving] = useState(false);
  const [featureInput, setFeatureInput] = useState('');
  const confirm = useConfirm();

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/plans-manager?action=usage-stats');
      const json = await res.json();
      if (json.success) setPlans(json.data);
    } catch (error: unknown) { handleSilentError(error); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const openCreate = () => {
    setForm({ name: '', displayName: '', price: 0, yearlyPrice: 0, maxStudents: 50, maxTeachers: 5, maxClasses: 10, maxParents: 100, maxLibraryBooks: 500, maxVideoLessons: 50, maxHomeworkPerMonth: 100, storageLimit: 1000, supportLevel: 'email', customDomain: false, apiAccess: false, whiteLabel: false, features: '[]', isActive: true, paystackPlanCode: '' });
    setEditDialog({ open: true, plan: null });
  };

  const openEdit = (plan: Plan) => {
    let safeFeatures = '[]';
    try {
      const parsed = JSON.parse(plan.features || '[]');
      safeFeatures = Array.isArray(parsed) ? plan.features : '[]';
    } catch (error: unknown) { handleSilentError(error);
      safeFeatures = '[]';
    }
    setForm({
      name: plan.name, displayName: plan.displayName, price: plan.price, yearlyPrice: plan.yearlyPrice || 0,
      maxStudents: plan.maxStudents, maxTeachers: plan.maxTeachers, maxClasses: plan.maxClasses, maxParents: plan.maxParents,
      maxLibraryBooks: plan.maxLibraryBooks, maxVideoLessons: plan.maxVideoLessons, maxHomeworkPerMonth: plan.maxHomeworkPerMonth,
      storageLimit: plan.storageLimit, supportLevel: plan.supportLevel, customDomain: plan.customDomain, apiAccess: plan.apiAccess, whiteLabel: plan.whiteLabel,
      features: safeFeatures, isActive: plan.isActive, paystackPlanCode: plan.paystackPlanCode || '',
    });
    setEditDialog({ open: true, plan });
  };

  const savePlan = async () => {
    if (!form.name || !form.displayName) { toast.error('Name and Display Name are required'); return; }
    setSaving(true);
    try {
      const url = editDialog.plan ? '/api/plans-manager' : '/api/plans';
      const method = editDialog.plan ? 'PUT' : 'POST';
      const body = editDialog.plan ? { id: editDialog.plan.id, ...form, features: typeof form.features === 'string' ? form.features : JSON.stringify(form.features) } : { ...form, features: typeof form.features === 'string' ? form.features : JSON.stringify(form.features) };
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success || json.data) { toast.success(editDialog.plan ? 'Plan updated' : 'Plan created'); setEditDialog({ open: false, plan: null }); fetchPlans(); }
      else toast.error(json.message || json.error || 'Failed');
    } catch (error: unknown) { handleSilentError(error); toast.error('Failed to save'); } finally { setSaving(false); }
  };

   const deletePlan = async (plan: Plan) => {
     const ok = await confirm(`Are you sure you want to delete the plan "${plan.displayName}"? This action cannot be undone.`);
     if (!ok) return;
     try {
       const res = await fetch(`/api/plans-manager?id=${plan.id}`, { method: 'DELETE' });
       const json = await res.json();
       if (json.success) { toast.success('Plan deleted'); fetchPlans(); }
       else toast.error(json.message || 'Failed to delete');
     } catch (error: unknown) { handleSilentError(error); toast.error('Failed'); }
   };

  const toggleActive = async (plan: Plan) => {
    try {
      const res = await fetch('/api/plans-manager', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: plan.id, isActive: !plan.isActive }),
      });
      const json = await res.json();
      if (json.success) fetchPlans();
    } catch (error: unknown) { handleSilentError(error); }
  };

  const addFeature = () => {
    if (!featureInput.trim()) return;
    let features: string[] = [];
    try {
      features = JSON.parse(form.features || '[]');
      if (!Array.isArray(features)) features = [];
    } catch (error: unknown) { handleSilentError(error);
      features = [];
    }
    if (!features.includes(featureInput.trim())) {
      features.push(featureInput.trim());
      setForm(prev => ({ ...prev, features: JSON.stringify(features) }));
      setFeatureInput('');
    }
  };

  const removeFeature = (index: number) => {
    let features: string[] = [];
    try {
      features = JSON.parse(form.features || '[]');
      if (!Array.isArray(features)) return;
    } catch (error: unknown) { handleSilentError(error);
      return;
    }
    features.splice(index, 1);
    setForm(prev => ({ ...prev, features: JSON.stringify(features) }));
  };

  const formatPrice = (price: number) => `₦${price.toLocaleString()}`;
  let featuresArr: string[] = [];
  try {
    const parsed = JSON.parse(form.features || '[]');
    featuresArr = Array.isArray(parsed) ? parsed : [];
  } catch (error: unknown) { handleSilentError(error);
    featuresArr = [];
  }
  const features = featuresArr;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><CreditCard className="h-7 w-7 text-emerald-600" /> Subscription Plans</h1>
          <p className="text-sm text-gray-500 mt-1">Manage subscription plans, pricing, and feature limits</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> New Plan</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-80 rounded-xl" />)}</div>
      ) : plans.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400"><CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" /><p>No plans yet. Create your first subscription plan.</p></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map(plan => {
            const planFeatures: string[] = JSON.parse(plan.features || '[]');
            return (
              <Card key={plan.id} className={`relative overflow-hidden ${plan._count && plan._count.schools > 0 ? 'border-emerald-200' : ''}`}>
                {!plan.isActive && <div className="absolute top-3 right-3"><Badge variant="secondary" className="bg-gray-100 text-gray-500">Inactive</Badge></div>}
                {plan._count && plan._count.schools > 0 && <div className="absolute top-3 right-3"><Badge className="bg-emerald-100 text-emerald-700">{plan._count.schools} school{plan._count.schools > 1 ? 's' : ''}</Badge></div>}
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold text-gray-900">{plan.displayName}</h3>
                  <p className="text-xs text-gray-400 mt-1">{plan.name}</p>
                  <div className="mt-4">
                    <span className="text-3xl font-bold text-emerald-600">{formatPrice(plan.price)}</span>
                    <span className="text-sm text-gray-400">/month</span>
                    {plan.yearlyPrice && plan.yearlyPrice > 0 && (
                      <p className="text-xs text-gray-500 mt-1">{formatPrice(plan.yearlyPrice)}/year <Badge className="text-[10px] ml-1 bg-emerald-50 text-emerald-700">Save</Badge></p>
                    )}
                  </div>
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm"><Users className="h-4 w-4 text-gray-400" /><span>{plan.maxStudents} students</span></div>
                    <div className="flex items-center gap-2 text-sm"><GraduationCap className="h-4 w-4 text-gray-400" /><span>{plan.maxTeachers} teachers</span></div>
                    <div className="flex items-center gap-2 text-sm"><Building2 className="h-4 w-4 text-gray-400" /><span>{plan.maxClasses} classes</span></div>
                    <div className="flex items-center gap-2 text-sm"><BookOpen className="h-4 w-4 text-gray-400" /><span>{plan.maxLibraryBooks} library books</span></div>
                    <div className="flex items-center gap-2 text-sm"><Video className="h-4 w-4 text-gray-400" /><span>{plan.maxVideoLessons} video lessons</span></div>
                    <div className="flex items-center gap-2 text-sm"><HardDrive className="h-4 w-4 text-gray-400" /><span>{plan.storageLimit}MB storage</span></div>
                    <div className="flex items-center gap-2 text-sm"><Headphones className="h-4 w-4 text-gray-400" /><span>{plan.supportLevel} support</span></div>
                    {plan.customDomain && <div className="flex items-center gap-2 text-sm"><Globe className="h-4 w-4 text-blue-500" /><span className="text-blue-600">Custom domain</span></div>}
                    {plan.apiAccess && <div className="flex items-center gap-2 text-sm"><Code className="h-4 w-4 text-purple-500" /><span className="text-purple-600">API access</span></div>}
                    {plan.whiteLabel && <div className="flex items-center gap-2 text-sm"><Palette className="h-4 w-4 text-pink-500" /><span className="text-pink-600">White label</span></div>}
                  </div>
                  {planFeatures.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-medium text-gray-500 mb-2">Features</p>
                      <div className="flex flex-wrap gap-1">{planFeatures.map((f, i) => <Badge key={i} variant="outline" className="text-[10px]">{f}</Badge>)}</div>
                    </div>
                  )}
                  <div className="mt-4 flex items-center gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(plan)}><Pencil className="h-3 w-3 mr-1" /> Edit</Button>
                    <Button variant="outline" size="sm" onClick={() => toggleActive(plan)}>
                      {plan.isActive ? <><X className="h-3 w-3 mr-1" /> Disable</> : <><Check className="h-3 w-3 mr-1" /> Enable</>}
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => deletePlan(plan)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={editDialog.open} onOpenChange={open => setEditDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editDialog.plan ? 'Edit Plan' : 'Create New Plan'}</DialogTitle>
            <DialogDescription>Configure pricing, limits, and features for this subscription plan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Plan Name (internal)</Label><Input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g., basic" className="mt-1" /></div>
              <div><Label>Display Name</Label><Input value={form.displayName} onChange={e => setForm(prev => ({ ...prev, displayName: e.target.value }))} placeholder="e.g., Basic Plan" className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Monthly Price (₦)</Label><Input type="number" value={form.price} onChange={e => setForm(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))} className="mt-1" /></div>
              <div><Label>Yearly Price (₦)</Label><Input type="number" value={form.yearlyPrice} onChange={e => setForm(prev => ({ ...prev, yearlyPrice: parseFloat(e.target.value) || 0 }))} className="mt-1" /></div>
            </div>
            <Separator />
            <p className="text-sm font-medium text-gray-700">Resource Limits</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { key: 'maxStudents', label: 'Max Students' },
                { key: 'maxTeachers', label: 'Max Teachers' },
                { key: 'maxClasses', label: 'Max Classes' },
                { key: 'maxParents', label: 'Max Parents' },
                { key: 'maxLibraryBooks', label: 'Max Library Books' },
                { key: 'maxVideoLessons', label: 'Max Video Lessons' },
                { key: 'maxHomeworkPerMonth', label: 'Homework/Month' },
                { key: 'storageLimit', label: 'Storage (MB)' },
              ].map(item => (
                <div key={item.key}>
                  <Label className="text-xs">{item.label}</Label>
                  <Input type="number" value={(form as Record<string, unknown>)[item.key] as number} onChange={e => setForm(prev => ({ ...prev, [item.key]: parseInt(e.target.value) || 0 }))} className="mt-1" />
                </div>
              ))}
            </div>
            <Separator />
            <p className="text-sm font-medium text-gray-700">Premium Features</p>
            <div className="space-y-3">
              {[
                { key: 'customDomain', label: 'Custom Domain', desc: 'Use your own domain name' },
                { key: 'apiAccess', label: 'API Access', desc: 'REST API access for integrations' },
                { key: 'whiteLabel', label: 'White Label', desc: 'Remove Skoolar branding' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between">
                  <div><p className="text-sm font-medium">{item.label}</p><p className="text-xs text-gray-400">{item.desc}</p></div>
                  <Switch checked={(form as Record<string, unknown>)[item.key] as boolean} onCheckedChange={checked => setForm(prev => ({ ...prev, [item.key]: checked }))} />
                </div>
              ))}
            </div>
            <div>
              <Label>Support Level</Label>
              <div className="flex gap-2 mt-1">
                {['email', 'chat', 'priority'].map(level => (
                  <Button key={level} variant={form.supportLevel === level ? 'default' : 'outline'} size="sm" onClick={() => setForm(prev => ({ ...prev, supportLevel: level }))} className="capitalize">{level}</Button>
                ))}
              </div>
            </div>
            <div>
              <Label>Paystack Plan Code</Label>
              <Input value={form.paystackPlanCode} onChange={e => setForm(prev => ({ ...prev, paystackPlanCode: e.target.value }))} placeholder="PLN_xxxxxxxx" className="mt-1" />
            </div>
            <Separator />
            <p className="text-sm font-medium text-gray-700">Features</p>
            <div className="flex gap-2">
              <Input value={featureInput} onChange={e => setFeatureInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addFeature(); }} placeholder="Add feature..." />
              <Button variant="outline" onClick={addFeature}><Plus className="h-4 w-4" /></Button>
            </div>
            {features.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {features.map((f, i) => <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => removeFeature(i)}>{f} <X className="h-3 w-3 ml-1" /></Badge>)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, plan: null })}>Cancel</Button>
            <Button onClick={savePlan} disabled={saving}>{saving ? 'Saving...' : editDialog.plan ? 'Update Plan' : 'Create Plan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
