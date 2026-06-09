'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { Brain, Save, RefreshCw, Zap, Shield, Gauge, Sparkles } from 'lucide-react';

const FREE_MODELS = [
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', speed: 'Fast', free: true },
  { id: 'google/gemini-2.5-flash-001', name: 'Gemini 2.5 Flash', speed: 'Fast', free: true },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', speed: 'Fast', free: true },
  { id: 'meta-llama/llama-3.2-3b-instruct', name: 'Llama 3.2 3B', speed: 'Very Fast', free: true },
  { id: 'mistralai/mistral-7b-instruct', name: 'Mistral 7B', speed: 'Fast', free: true },
  { id: 'microsoft/phi-3-mini-128k-instruct', name: 'Phi-3 Mini', speed: 'Very Fast', free: true },
  { id: 'cognitivecomputations/dolphin-mixtral-8x7b', name: 'Dolphin Mixtral', speed: 'Medium', free: true },
  { id: 'cohere/command-r-08-2024', name: 'Command R', speed: 'Medium', free: true },
  { id: 'openai/gpt-4o', name: 'GPT-4o', speed: 'Medium', free: false },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', speed: 'Fast', free: false },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', speed: 'Medium', free: false },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', speed: 'Fast', free: false },
];

export function AssessmentAIConfigView() {
  const { currentUser } = useAppStore();
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [provider, setProvider] = useState('auto');
  const [openaiKey, setOpenaiKey] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [aiModel, setAiModel] = useState('auto');
  const [primaryModel, setPrimaryModel] = useState('google/gemini-2.0-flash-001');
  const [fallbackModel1, setFallbackModel1] = useState('google/gemini-2.5-flash-001');
  const [fallbackModel2, setFallbackModel2] = useState('deepseek/deepseek-chat');
  const [fallbackModel3, setFallbackModel3] = useState('meta-llama/llama-3.2-3b-instruct');
  const [maxRetries, setMaxRetries] = useState(2);
  const [timeoutMs, setTimeoutMs] = useState(15000);
  const [enabled, setEnabled] = useState(true);
  const [features, setFeatures] = useState({
    aiQuestionGen: true,
    aiGrading: true,
    aiRecommendations: true,
    aiProfileAnalysis: true,
    aiReportGen: true,
  });

  const schoolId = currentUser.schoolId || '';

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/assessment-hub/config?schoolId=${schoolId}`);
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setProvider(data.provider || 'auto');
        setOpenaiKey(data.apiKeyEncrypted || '');
        setOpenrouterKey(data.openrouterKey || '');
        setAiModel(data.aiModel || 'auto');
        setPrimaryModel(data.primaryModel || 'google/gemini-2.0-flash-001');
        setFallbackModel1(data.fallbackModel1 || 'google/gemini-2.5-flash-001');
        setFallbackModel2(data.fallbackModel2 || 'deepseek/deepseek-chat');
        setFallbackModel3(data.fallbackModel3 || 'meta-llama/llama-3.2-3b-instruct');
        setMaxRetries(data.maxRetries ?? 2);
        setTimeoutMs(data.requestTimeoutMs ?? 15000);
        setEnabled(data.aiEnabled !== false);
        setFeatures({
          aiQuestionGen: data.aiQuestionGen !== false,
          aiGrading: data.aiGrading !== false,
          aiRecommendations: data.aiRecommendations !== false,
          aiProfileAnalysis: data.aiProfileAnalysis !== false,
          aiReportGen: data.aiReportGen !== false,
        });
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const body: Record<string, unknown> = { schoolId, provider, aiEnabled: enabled };
      if (provider === 'openai' || provider === 'auto') {
        if (openaiKey && !openaiKey.startsWith('sk-')) {
          body.apiKeyEncrypted = openaiKey;
        } else if (openaiKey) {
          body.apiKeyEncrypted = openaiKey;
        }
        body.aiModel = aiModel;
      }
      if (provider === 'openrouter' || provider === 'auto') {
        if (openrouterKey && openrouterKey.length > 10) body.openrouterKey = openrouterKey;
        body.primaryModel = primaryModel;
        body.fallbackModel1 = fallbackModel1;
        body.fallbackModel2 = fallbackModel2;
        body.fallbackModel3 = fallbackModel3;
        body.maxRetries = maxRetries;
        body.requestTimeoutMs = timeoutMs;
      }
      Object.assign(body, features);

      const res = await fetch('/api/assessment-hub/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (res.ok) { toast.success('AI configuration saved'); fetchConfig(); }
      else { const err = await res.json(); toast.error(err.error || 'Failed'); }
    } catch { toast.error('Failed to save'); } finally { setSaving(false); }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      const res = await fetch('/api/assessment-hub/ai/generate-questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics: ['mathematics'], domain: 'SUBJECT_KNOWLEDGE', difficulty: 'easy', count: 1, schoolId }),
      });
      if (res.ok) {
        const data = await res.json();
        const latency = data.latencyMs ? ` (${data.latencyMs}ms)` : '';
        toast.success(`AI test successful! Model: ${data.modelUsed || 'unknown'}${latency}`);
      } else {
        const err = await res.json();
        toast.error(`Test failed: ${err.error || 'Unknown error'}`);
      }
    } catch {
      toast.error('AI test request failed');
    } finally { setTesting(false); }
  };

  const maskKey = (key: string) => {
    if (!key || key.length < 8) return key || '';
    return key.substring(0, 6) + '...' + key.substring(key.length - 4);
  };

  if (loading) return <div className="space-y-4">{[1,2,3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}</div>;

  const isOpenRouter = provider === 'openrouter' || provider === 'auto';
  const isOpenAI = provider === 'openai' || provider === 'auto';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Configuration</h1>
          <p className="text-muted-foreground">Configure AI-powered features with OpenRouter multi-model support</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            <Zap className="h-4 w-4 mr-2" /> {testing ? 'Testing...' : 'Test AI'}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-blue-200">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">OpenRouter</CardTitle>
            <Zap className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">8+ free models with auto-fallback. Fastest responses.</p>
            <p className="text-xs text-blue-600 mt-1">Recommended for speed & reliability</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Multiple Models</CardTitle>
            <Gauge className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Auto-fallback between Gemini, DeepSeek, Llama, Mistral.</p>
            <p className="text-xs text-emerald-600 mt-1">Sub-2s response times on flash models</p>
          </CardContent>
        </Card>
        <Card className="border-purple-200">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Fallback Protection</CardTitle>
            <Shield className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">If primary model fails or times out, next model takes over.</p>
            <p className="text-xs text-purple-600 mt-1">Zero downtime AI</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="openrouter">OpenRouter</TabsTrigger>
          <TabsTrigger value="openai">OpenAI (Legacy)</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">General Settings</CardTitle>
              <CardDescription>Provider selection and master toggle</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Enable AI Features</Label>
                  <p className="text-sm text-muted-foreground">Master toggle for all AI-powered features</p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>

              <div className="space-y-2">
                <Label>AI Provider</Label>
                <Select value={provider} onValueChange={setProvider} disabled={!enabled}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">
                      <span className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" /> Auto (OpenRouter Preferred)</span>
                    </SelectItem>
                    <SelectItem value="openrouter">
                      <span className="flex items-center gap-2"><Zap className="h-3.5 w-3.5" /> OpenRouter (Multi-Model)</span>
                    </SelectItem>
                    <SelectItem value="openai">
                      <span className="flex items-center gap-2"><Brain className="h-3.5 w-3.5" /> OpenAI Direct</span>
                    </SelectItem>
                    <SelectItem value="fallback">
                      <span className="flex items-center gap-2"><Shield className="h-3.5 w-3.5" /> Fallback (Simulated)</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {provider === 'auto' && 'Auto mode: tries OpenRouter first, falls back to OpenAI, then simulated fallback'}
                  {provider === 'openrouter' && 'OpenRouter: access to Gemini Flash, DeepSeek, Llama, and more free models with auto-fallback'}
                  {provider === 'openai' && 'OpenAI Direct: uses your OpenAI API key directly'}
                  {provider === 'fallback' && 'Fallback: simulated responses (no real AI, no API key needed)'}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Request Timeout (ms)</Label>
                <Input type="number" value={timeoutMs} onChange={(e) => setTimeoutMs(parseInt(e.target.value) || 15000)} min={1000} max={120000} disabled={!enabled || provider === 'fallback'} />
                <p className="text-xs text-muted-foreground">How long to wait before trying next model (recommended: 5000-15000ms)</p>
              </div>

              <div className="space-y-2">
                <Label>Max Retries</Label>
                <Input type="number" value={maxRetries} onChange={(e) => setMaxRetries(parseInt(e.target.value) || 2)} min={0} max={10} disabled={!enabled || provider === 'fallback'} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="openrouter" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-500" />
                <CardTitle className="text-lg">OpenRouter Configuration</CardTitle>
              </div>
              <CardDescription>
                Configure multiple free AI models with automatic fallback. Get an API key at{' '}
                <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">openrouter.ai/keys</a>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>OpenRouter API Key</Label>
                <Input
                  type="password"
                  value={openrouterKey}
                  onChange={(e) => setOpenrouterKey(e.target.value)}
                  placeholder={config?.openrouterKey ? maskKey(config.openrouterKey) : 'sk-or-v1-...'}
                  disabled={!enabled || !isOpenRouter}
                />
                {config?.openrouterKey && !openrouterKey && (
                  <p className="text-xs text-muted-foreground">Leave empty to keep existing key</p>
                )}
                <p className="text-xs text-muted-foreground">Free models available. Get key at openrouter.ai/keys</p>
              </div>

              <div className="space-y-2">
                <Label>Primary Model (fastest)</Label>
                <Select value={primaryModel} onValueChange={setPrimaryModel} disabled={!enabled || !isOpenRouter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREE_MODELS.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} {m.free ? '(Free)' : '(Paid)'} - {m.speed}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Primary model for all AI requests. Gemini 2.0 Flash is fastest.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Fallback Model 1</Label>
                  <Select value={fallbackModel1} onValueChange={setFallbackModel1} disabled={!enabled || !isOpenRouter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FREE_MODELS.filter(m => m.id !== primaryModel).map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.name} {m.free ? '(Free)' : '(Paid)'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fallback Model 2</Label>
                  <Select value={fallbackModel2} onValueChange={setFallbackModel2} disabled={!enabled || !isOpenRouter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FREE_MODELS.filter(m => m.id !== primaryModel && m.id !== fallbackModel1).map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.name} {m.free ? '(Free)' : '(Paid)'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fallback Model 3</Label>
                  <Select value={fallbackModel3} onValueChange={setFallbackModel3} disabled={!enabled || !isOpenRouter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FREE_MODELS.filter(m => m.id !== primaryModel && m.id !== fallbackModel1 && m.id !== fallbackModel2).map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.name} {m.free ? '(Free)' : '(Paid)'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="openai" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">OpenAI Direct (Legacy)</CardTitle>
              </div>
              <CardDescription>Direct OpenAI API connection. Only needed if OpenRouter is unavailable.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>OpenAI API Key</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder={config?.apiKeyEncrypted ? maskKey(config.apiKeyEncrypted) : 'sk-...'}
                    disabled={!enabled || !isOpenAI}
                    className="flex-1"
                  />
                  {config?.apiKeyEncrypted && (
                    <Button variant="outline" size="icon" onClick={() => setOpenaiKey('')} title="Clear key">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {config?.apiKeyEncrypted && !openaiKey && (
                  <p className="text-xs text-muted-foreground">Leave empty to keep existing key</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={aiModel} onValueChange={setAiModel} disabled={!enabled || !isOpenAI}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (Fastest Available)</SelectItem>
                    <SelectItem value="gpt4">GPT-4 (Best Quality)</SelectItem>
                    <SelectItem value="gpt4-turbo">GPT-4 Turbo (Faster)</SelectItem>
                    <SelectItem value="gpt35-turbo">GPT-3.5 Turbo (Fastest)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Feature Toggles</CardTitle>
              <CardDescription>Enable or disable specific AI-powered features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'aiQuestionGen', label: 'Question Generation', desc: 'AI generates questions based on topics and domains' },
                { key: 'aiGrading', label: 'Auto-Grading', desc: 'AI grades subjective answers (essays, short answers)' },
                { key: 'aiRecommendations', label: 'Recommendations', desc: 'AI generates personalized learning recommendations' },
                { key: 'aiProfileAnalysis', label: 'Profile Analysis', desc: 'AI analyzes student/teacher profiles for insights' },
                { key: 'aiReportGen', label: 'Report Generation', desc: 'AI generates comprehensive assessment reports' },
              ].map((feat) => (
                <div key={feat.key} className="flex items-center justify-between py-2">
                  <div>
                    <Label className="text-sm">{feat.label}</Label>
                    <p className="text-xs text-muted-foreground">{feat.desc}</p>
                  </div>
                  <Switch
                    checked={(features as any)[feat.key]}
                    onCheckedChange={(checked) => setFeatures({ ...features, [feat.key]: checked })}
                    disabled={!enabled}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
