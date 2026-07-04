'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX, Save, Loader2,
  ClipboardX, MousePointer2, Keyboard, Maximize2, Monitor,
  Shuffle, Calculator, Eye, Minus, Siren,
} from 'lucide-react';
import { slideUp, staggerContainer } from '@/lib/motion-variants';

export interface ExamSecuritySettingsData {
  blockCopyPaste: boolean;
  monitorTabSwitch: boolean;
  maxTabSwitches: number | null;
  monitorWebcam: boolean;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  fullscreenMode: boolean;
  blockRightClick: boolean;
  blockKeyboardShortcuts: boolean;
  showResultAfterSubmit: boolean;
  allowCalculator: boolean;
  calculatorMode: 'basic' | 'scientific' | 'both';
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResult: boolean;
  negativeMarking: number;
}

interface ExamSecuritySettingsDialogProps {
  examId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSettings?: ExamSecuritySettingsData;
  onSave?: (settings: ExamSecuritySettingsData) => void;
}

const DEFAULT_SETTINGS: ExamSecuritySettingsData = {
  blockCopyPaste: false,
  monitorTabSwitch: false,
  maxTabSwitches: 3,
  monitorWebcam: false,
  randomizeQuestions: false,
  randomizeOptions: false,
  fullscreenMode: false,
  blockRightClick: false,
  blockKeyboardShortcuts: false,
  showResultAfterSubmit: false,
  allowCalculator: true,
  calculatorMode: 'basic',
  shuffleQuestions: false,
  shuffleOptions: false,
  showResult: false,
  negativeMarking: 0,
};

function computeSecurityScore(settings: ExamSecuritySettingsData): { score: number; level: 'low' | 'medium' | 'high' | 'extreme'; color: string } {
  let score = 0;
  if (settings.blockCopyPaste) score++;
  if (settings.monitorTabSwitch) score++;
  if (settings.maxTabSwitches && settings.maxTabSwitches > 0 && settings.monitorTabSwitch) score++;
  if (settings.monitorWebcam) score++;
  if (settings.randomizeQuestions) score++;
  if (settings.randomizeOptions) score++;
  if (settings.fullscreenMode) score++;
  if (settings.blockRightClick) score++;
  if (settings.blockKeyboardShortcuts) score++;
  if (settings.showResultAfterSubmit) score++;

  if (score <= 2) return { score, level: 'low', color: 'text-green-600 dark:text-green-400' };
  if (score <= 5) return { score, level: 'medium', color: 'text-yellow-600 dark:text-yellow-400' };
  if (score <= 8) return { score, level: 'high', color: 'text-orange-600 dark:text-orange-400' };
  return { score, level: 'extreme', color: 'text-red-600 dark:text-red-400' };
}

function getSecurityLevelBadge(level: string) {
  switch (level) {
    case 'low': return <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Low</Badge>;
    case 'medium': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Medium</Badge>;
    case 'high': return <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">High</Badge>;
    case 'extreme': return <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Extreme</Badge>;
    default: return <Badge variant="secondary">N/A</Badge>;
  }
}

function SettingRow({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <motion.div
      variants={slideUp}
      className="flex items-start justify-between gap-4 rounded-lg border p-4"
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 shrink-0 rounded-md bg-primary/10 p-2">
          <Icon className="size-4 text-primary" />
        </div>
        <div className="min-w-0">
          <Label className="text-sm font-medium">{label}</Label>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </motion.div>
  );
}

export function ExamSecuritySettingsDialog({
  examId,
  open,
  onOpenChange,
  initialSettings,
  onSave,
}: ExamSecuritySettingsDialogProps) {
  const [settings, setSettings] = useState<ExamSecuritySettingsData>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const fetchSettings = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch(`/api/exams/${examId}/security`);
      if (!res.ok) throw new Error('Failed to fetch settings');
      const json = await res.json();
      setSettings({ ...DEFAULT_SETTINGS, ...json.data });
    } catch {
      if (initialSettings) {
        setSettings({ ...DEFAULT_SETTINGS, ...initialSettings });
      }
    } finally {
      setFetching(false);
    }
  }, [examId, initialSettings]);

  useEffect(() => {
    if (open) {
      if (initialSettings) {
        setSettings({ ...DEFAULT_SETTINGS, ...initialSettings });
        setFetching(false);
      } else {
        fetchSettings();
      }
    }
  }, [open, initialSettings, fetchSettings]);

  const updateField = <K extends keyof ExamSecuritySettingsData>(
    key: K,
    value: ExamSecuritySettingsData[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (onSave) {
        onSave(settings);
        toast.success('Security settings saved');
        onOpenChange(false);
        return;
      }

      const res = await fetch(`/api/exams/${examId}/security`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save settings');
      }

      toast.success('Security settings updated successfully');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/exams/${examId}/security`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to reset settings');
      }

      setSettings(DEFAULT_SETTINGS);
      toast.success('Security settings reset to defaults');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset settings');
    } finally {
      setLoading(false);
    }
  };

  const security = useMemo(() => computeSecurityScore(settings), [settings]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Shield className="size-5 text-primary" />
            Exam Security Settings
          </DialogTitle>
          <DialogDescription>
            Configure security, calculator, and result display options for this exam.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        {fetching ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="flex-1 px-6 py-4 max-h-[60vh]">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="space-y-6"
            >
              {/* General Security */}
              <motion.div variants={slideUp}>
                <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
                  <Siren className="size-4 text-primary" />
                  General Security
                </h3>
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <SettingRow
                      icon={ClipboardX}
                      label="Block Copy-Paste"
                      description="Prevents students from copying and pasting during the exam"
                      checked={settings.blockCopyPaste}
                      onCheckedChange={(v) => updateField('blockCopyPaste', v)}
                    />
                    <SettingRow
                      icon={MousePointer2}
                      label="Block Right Click"
                      description="Disables right-click context menu in the exam window"
                      checked={settings.blockRightClick}
                      onCheckedChange={(v) => updateField('blockRightClick', v)}
                    />
                    <SettingRow
                      icon={Keyboard}
                      label="Block Keyboard Shortcuts"
                      description="Blocks common keyboard shortcuts (Ctrl+C, Ctrl+V, etc.)"
                      checked={settings.blockKeyboardShortcuts}
                      onCheckedChange={(v) => updateField('blockKeyboardShortcuts', v)}
                    />
                    <SettingRow
                      icon={Maximize2}
                      label="Fullscreen Mode"
                      description="Forces exam to fullscreen, exits if user tries to leave"
                      checked={settings.fullscreenMode}
                      onCheckedChange={(v) => updateField('fullscreenMode', v)}
                    />
                  </CardContent>
                </Card>
              </motion.div>

              {/* Tab Monitoring */}
              <motion.div variants={slideUp}>
                <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
                  <Monitor className="size-4 text-primary" />
                  Tab Monitoring
                </h3>
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <SettingRow
                      icon={Monitor}
                      label="Monitor Tab Switch"
                      description="Detects and warns when students switch to another tab or window"
                      checked={settings.monitorTabSwitch}
                      onCheckedChange={(v) => updateField('monitorTabSwitch', v)}
                    />
                    <AnimatePresence>
                      {settings.monitorTabSwitch && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-4 pl-11"
                        >
                          <Label className="text-xs text-muted-foreground shrink-0">
                            Max Allowed Switches
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            max={20}
                            value={settings.maxTabSwitches ?? 3}
                            onChange={(e) => updateField('maxTabSwitches', Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-20 h-8 text-sm"
                            disabled={!settings.monitorTabSwitch}
                          />
                          <span className="text-xs text-muted-foreground">
                            (0 = unlimited)
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Question Security */}
              <motion.div variants={slideUp}>
                <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
                  <Shuffle className="size-4 text-primary" />
                  Question Security
                </h3>
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <SettingRow
                      icon={Shuffle}
                      label="Randomize Questions"
                      description="Questions appear in a different order for each student"
                      checked={settings.randomizeQuestions}
                      onCheckedChange={(v) => updateField('randomizeQuestions', v)}
                    />
                    <SettingRow
                      icon={Shuffle}
                      label="Randomize Options"
                      description="Answer options appear in a different order for each student"
                      checked={settings.randomizeOptions}
                      onCheckedChange={(v) => updateField('randomizeOptions', v)}
                    />
                  </CardContent>
                </Card>
              </motion.div>

              {/* Calculator Settings */}
              <motion.div variants={slideUp}>
                <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
                  <Calculator className="size-4 text-primary" />
                  Calculator Settings
                </h3>
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <SettingRow
                      icon={Calculator}
                      label="Allow Calculator"
                      description="Students can use an on-screen calculator during the exam"
                      checked={settings.allowCalculator}
                      onCheckedChange={(v) => updateField('allowCalculator', v)}
                    />
                    <AnimatePresence>
                      {settings.allowCalculator && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-4 pl-11"
                        >
                          <Label className="text-xs text-muted-foreground shrink-0">
                            Calculator Mode
                          </Label>
                          <Select
                            value={settings.calculatorMode}
                            onValueChange={(v) => updateField('calculatorMode', v as 'basic' | 'scientific' | 'both')}
                            disabled={!settings.allowCalculator}
                          >
                            <SelectTrigger className="w-40 h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                             <SelectContent>
                              <SelectItem value="basic">Basic</SelectItem>
                              <SelectItem value="scientific">Scientific</SelectItem>
                              <SelectItem value="both">Basic & Scientific</SelectItem>
                            </SelectContent>
                          </Select>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Results */}
              <motion.div variants={slideUp}>
                <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
                  <Eye className="size-4 text-primary" />
                  Results
                </h3>
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <SettingRow
                      icon={Eye}
                      label="Show Result After Submit"
                      description="Display the result to the student immediately after submission"
                      checked={settings.showResultAfterSubmit}
                      onCheckedChange={(v) => updateField('showResultAfterSubmit', v)}
                    />
                    <SettingRow
                      icon={Eye}
                      label="Show Score"
                      description="Display the score to the student (requires Show Result to be enabled)"
                      checked={settings.showResult}
                      onCheckedChange={(v) => updateField('showResult', v)}
                      disabled={!settings.showResultAfterSubmit}
                    />
                    <motion.div
                      variants={slideUp}
                      className="flex items-center gap-4 pl-11"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-0.5 shrink-0 rounded-md bg-primary/10 p-2">
                          <Minus className="size-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <Label className="text-sm font-medium">Negative Marking</Label>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Penalty marks per wrong answer (0 = no negative marking)
                          </p>
                        </div>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        step={0.25}
                        value={settings.negativeMarking}
                        onChange={(e) => updateField('negativeMarking', Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-20 h-8 text-sm"
                      />
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Security Summary */}
              <motion.div variants={slideUp}>
                <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
                  <ShieldCheck className="size-4 text-primary" />
                  Security Summary
                </h3>
                <Card className="bg-muted/30">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {security.level === 'extreme' && <ShieldX className="size-5 text-red-500" />}
                        {security.level === 'high' && <ShieldAlert className="size-5 text-orange-500" />}
                        {security.level === 'medium' && <ShieldCheck className="size-5 text-yellow-500" />}
                        {security.level === 'low' && <Shield className="size-5 text-green-500" />}
                        <span className="text-sm font-medium">Security Level</span>
                      </div>
                      {getSecurityLevelBadge(security.level)}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Security Score</span>
                        <span>{security.score} / 10</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(security.score / 10) * 100}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                          className={`h-full rounded-full transition-colors ${
                            security.level === 'low' ? 'bg-green-500' :
                            security.level === 'medium' ? 'bg-yellow-500' :
                            security.level === 'high' ? 'bg-orange-500' :
                            'bg-red-500'
                          }`}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {security.level === 'low' && 'Basic security measures. Consider enabling more options for sensitive exams.'}
                      {security.level === 'medium' && 'Moderate security. Good for standard assessments.'}
                      {security.level === 'high' && 'Strong security measures active. Suitable for high-stakes exams.'}
                      {security.level === 'extreme' && 'Maximum security enforced. All available protections are active.'}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </ScrollArea>
        )}

        <Separator />

        <DialogFooter className="px-6 py-4 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={loading || fetching}
          >
            Reset to Defaults
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={loading || fetching}
            className="gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="size-4" />
                Save Settings
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
