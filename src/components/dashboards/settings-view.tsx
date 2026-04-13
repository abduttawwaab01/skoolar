'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Download,
  Upload,
  ShieldCheck,
  Database,
  Settings,
  Bell,
  Lock,
  Globe,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';
import { soundEffects, areSoundsEnabled, toggleSounds } from '@/lib/ui-sounds';

export function SettingsView() {
  const { data: session } = useSession();
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);
  const [emailNotifs, setEmailNotifs] = React.useState({
    announcements: true,
    grades: true,
    attendance: true,
    payments: false,
    system: true,
  });
  const [pushNotifs, setPushNotifs] = React.useState({
    announcements: true,
    grades: true,
    attendance: false,
    payments: true,
    system: true,
  });
  const [smsNotifs, setSmsNotifs] = React.useState({
    announcements: false,
    grades: false,
    attendance: true,
    payments: true,
    system: false,
  });
  const [twoFA, setTwoFA] = React.useState(false);

  const notifTypes = [
    { key: 'announcements', label: 'Announcements', desc: 'New school announcements', emoji: '📢' },
    { key: 'grades', label: 'Grades & Results', desc: 'Exam results published', emoji: '📊' },
    { key: 'attendance', label: 'Attendance Alerts', desc: 'Absent/late notifications', emoji: '📅' },
    { key: 'payments', label: 'Payment Updates', desc: 'Fee payment confirmations', emoji: '💳' },
    { key: 'system', label: 'System Updates', desc: 'Maintenance and updates', emoji: '🔧' },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          ⚙️ Settings
        </h2>
        <p className="text-sm text-muted-foreground">Configure your platform preferences</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="general" className="gap-2">
            🌐 <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            🔔 <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            🔒 <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-2">
            💾 <span className="hidden sm:inline">Data</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">🌍 General Settings</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {/* Sound Toggle */}
              <div className="sm:col-span-2 flex items-center justify-between p-3 rounded-lg border bg-gradient-to-r from-emerald-50/50 to-transparent">
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    {areSoundsEnabled() ? '🔊' : '🔇'} UI Sounds
                  </p>
                  <p className="text-xs text-muted-foreground">Soft sounds for navigation, notifications, and actions</p>
                </div>
                <button
                  onClick={() => {
                    const enabled = toggleSounds();
                    if (enabled) {
                      soundEffects.toggleOn();
                      toast.success('UI sounds enabled 🔊');
                    } else {
                      toast.info('UI sounds muted 🔇');
                    }
                  }}
                  className={`p-2 rounded-lg transition-all ${areSoundsEnabled() ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  {areSoundsEnabled() ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
                </button>
              </div>
              <div className="grid gap-2">
                <Label>Language</Label>
                <Select defaultValue="en">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="ar">Arabic</SelectItem>
                    <SelectItem value="ha">Hausa</SelectItem>
                    <SelectItem value="yo">Yoruba</SelectItem>
                    <SelectItem value="ig">Igbo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Timezone</Label>
                <Select defaultValue="lagos">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lagos">West Africa Time (WAT)</SelectItem>
                    <SelectItem value="london">Greenwich Mean Time (GMT)</SelectItem>
                    <SelectItem value="dubai">Gulf Standard Time (GST)</SelectItem>
                    <SelectItem value="nairobi">East Africa Time (EAT)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Currency</Label>
                <Select defaultValue="ngn">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ngn">Nigerian Naira (₦)</SelectItem>
                    <SelectItem value="usd">US Dollar ($)</SelectItem>
                    <SelectItem value="gbp">British Pound (£)</SelectItem>
                    <SelectItem value="eur">Euro (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Date Format</Label>
                <Select defaultValue="dd-mm-yyyy">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dd-mm-yyyy">DD/MM/YYYY</SelectItem>
                    <SelectItem value="mm-dd-yyyy">MM/DD/YYYY</SelectItem>
                    <SelectItem value="yyyy-mm-dd">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  📧 Email Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {notifTypes.map((type) => (
                  <div key={type.key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{type.label}</p>
                      <p className="text-xs text-muted-foreground">{type.desc}</p>
                    </div>
                    <Switch
                      checked={emailNotifs[type.key]}
                      onCheckedChange={(checked) =>
                        setEmailNotifs({ ...emailNotifs, [type.key]: checked })
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  📲 Push Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {notifTypes.map((type) => (
                  <div key={type.key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{type.label}</p>
                      <p className="text-xs text-muted-foreground">{type.desc}</p>
                    </div>
                    <Switch
                      checked={pushNotifs[type.key]}
                      onCheckedChange={(checked) =>
                        setPushNotifs({ ...pushNotifs, [type.key]: checked })
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  💬 SMS Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {notifTypes.map((type) => (
                  <div key={type.key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{type.label}</p>
                      <p className="text-xs text-muted-foreground">{type.desc}</p>
                    </div>
                    <Switch
                      checked={smsNotifs[type.key]}
                      onCheckedChange={(checked) =>
                        setSmsNotifs({ ...smsNotifs, [type.key]: checked })
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="security">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">🔑 Change Password</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 max-w-md">
                <div className="grid gap-2">
                  <Label>Current Password</Label>
                  <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>New Password</Label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Confirm New Password</Label>
                  <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
                <Button className="w-fit" disabled={isChangingPassword} onClick={async () => {
                  if (!currentPassword || !newPassword || !confirmPassword) {
                    toast.error('All password fields are required. ❌');
                    return;
                  }
                  if (newPassword.length < 8) {
                    toast.error('New password must be at least 8 characters.');
                    return;
                  }
                  if (newPassword !== confirmPassword) {
                    toast.error('New passwords do not match. ❌');
                    return;
                  }
                  if (!session?.user?.id) {
                    toast.error('You must be logged in to change your password.');
                    return;
                  }
                  setIsChangingPassword(true);
                  try {
                    const res = await fetch('/api/auth/change-password', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        userId: session.user.id,
                        currentPassword,
                        newPassword,
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      toast.error(data.error || 'Failed to change password.');
                      return;
                    }
                    toast.success(data.message || 'Password changed successfully.');
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  } catch {
                    toast.error('Failed to change password. Please try again.');
                  } finally {
                    setIsChangingPassword(false);
                  }
                }}>{isChangingPassword ? 'Updating...' : 'Update Password'}</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="size-4" />
                  🛡️ Two-Factor Authentication
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">Enable 2FA</p>
                    <p className="text-xs text-muted-foreground">Add an extra layer of security to your account</p>
                  </div>
                  <Switch checked={twoFA} onCheckedChange={setTwoFA} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">📱 Active Sessions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">Chrome on Windows</p>
                    <p className="text-xs text-muted-foreground">192.168.1.1 &middot; Active now</p>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 text-xs">Current</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">Safari on iPhone</p>
                    <p className="text-xs text-muted-foreground">192.168.1.45 &middot; 2 hours ago</p>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => toast.success('Session revoked')}>Revoke</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="data">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">📤 Import / Export</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button variant="outline" className="gap-2" onClick={() => toast.success('Import started')}>
                    <Upload className="size-4" />
                    Import Data
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => toast.success('Export started')}>
                    <Download className="size-4" />
                    Export All Data
                  </Button>
                </div>
                <Separator />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.success('Exporting students...')}>
                    <Download className="size-3.5" />
                    Export Students
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.success('Exporting teachers...')}>
                    <Download className="size-3.5" />
                    Export Teachers
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.success('Exporting results...')}>
                    <Download className="size-3.5" />
                    Export Results
                  </Button>
                </div>
                <Separator />
                <Button variant="outline" className="gap-2" onClick={() => {
                  window.open('/api/download-codebase', '_blank');
                  toast.success('Codebase download started');
                }}>
                  <Download className="size-3.5" />
                  Download Source Code (.zip)
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">💾 Backup Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">Last Backup</p>
                    <p className="text-xs text-muted-foreground">March 28, 2025 at 2:00 AM</p>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 text-xs">Completed</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">Auto Backup</p>
                    <p className="text-xs text-muted-foreground">Daily at 2:00 AM (WAT)</p>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 text-xs">Enabled</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">Backup Size</p>
                    <p className="text-xs text-muted-foreground">1.2 GB compressed</p>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => toast.success('Restore started')}>Restore</Button>
                </div>
                <Button className="gap-2 mt-2" onClick={() => toast.success('Manual backup created')}>
                  <Database className="size-4" />
                  Create Manual Backup
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
