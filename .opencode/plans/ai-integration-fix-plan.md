# AI Integration Fix Plan

## Phase 1: Update Model Lists (4 files)

### 1a. `src/lib/ai/server.ts` - Replace FREE_MODELS + increase timeout

**Replace FREE_MODELS array** (lines 24-51) with:

```typescript
const FREE_MODELS = [
  // Tier 1 - Top quality, fast (July 2026)
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'openai/gpt-oss-120b:free',
  // Tier 2 - Good quality, fast
  'openai/gpt-oss-20b:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'qwen/qwen3-coder:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  // Tier 3 - Lightweight fallbacks
  'nvidia/nemotron-nano-9b-v2:free',
  'google/gemma-4-26b-a4b-it:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  // Tier 4 - Last resort
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  // Auto-router
  'openrouter/free',
];
```

**Change line 61: `FETCH_TIMEOUT_MS` from 10000 to 20000:**
```typescript
const FETCH_TIMEOUT_MS = AI_PROVIDER === 'local' ? 60000 : 20000;
```

### 1b. `src/lib/ai-assessment.ts` - Replace model lists

**Replace FREE_OPENROUTER_MODELS** (lines 55-88) with:

```typescript
const FREE_OPENROUTER_MODELS = [
  // Tier 1 - Top quality, fast (July 2026)
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'openai/gpt-oss-120b:free',
  // Tier 2 - Good quality, fast
  'openai/gpt-oss-20b:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'qwen/qwen3-coder:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  // Tier 3 - Lightweight fallbacks
  'nvidia/nemotron-nano-9b-v2:free',
  'google/gemma-4-26b-a4b-it:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  // Tier 4 - Last resort
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  // Auto-router
  'openrouter/free',
];
```

**Replace FREE_MODEL_LIST** (lines 301-332) with:

```typescript
const FREE_MODEL_LIST = [
  // Tier 1
  { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B', provider: 'Google', free: true, speed: 'fast' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron 3 Super 120B', provider: 'NVIDIA', free: true, speed: 'fast' },
  { id: 'openai/gpt-oss-120b:free', name: 'GPT-OSS 120B', provider: 'OpenAI', free: true, speed: 'medium' },
  // Tier 2
  { id: 'openai/gpt-oss-20b:free', name: 'GPT-OSS 20B', provider: 'OpenAI', free: true, speed: 'very fast' },
  { id: 'nvidia/nemotron-3-nano-30b-a3b:free', name: 'Nemotron 3 Nano 30B', provider: 'NVIDIA', free: true, speed: 'fast' },
  { id: 'qwen/qwen3-coder:free', name: 'Qwen3 Coder', provider: 'Qwen', free: true, speed: 'fast' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', provider: 'Meta', free: true, speed: 'medium' },
  // Tier 3
  { id: 'nvidia/nemotron-nano-9b-v2:free', name: 'Nemotron Nano 9B v2', provider: 'NVIDIA', free: true, speed: 'very fast' },
  { id: 'google/gemma-4-26b-a4b-it:free', name: 'Gemma 4 26B A4B', provider: 'Google', free: true, speed: 'medium' },
  { id: 'qwen/qwen3-next-80b-a3b-instruct:free', name: 'Qwen3 Next 80B', provider: 'Qwen', free: true, speed: 'medium' },
  // Tier 4
  { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: 'Nemotron 3 Ultra 550B', provider: 'NVIDIA', free: true, speed: 'slow' },
  // Auto-router
  { id: 'openrouter/free', name: 'OpenRouter Free', provider: 'OpenRouter', free: true, speed: 'auto' },
];
```

Also update default primaryModel and fallbackModel defaults in `getAIProvider()`:
- Line 353: `primaryModel: config.primaryModel || 'google/gemma-4-31b-it:free'`
- Line 369: `primaryModel: 'google/gemma-4-31b-it:free'`

### 1c. `src/components/dashboards/assessment-ai-config-view.tsx` - Replace FREE_MODELS

**Replace FREE_MODELS array** (lines 16-47) with the same model list (matching FREE_MODEL_LIST structure). Update the default state values:
- Line 58: `setPrimaryModel('google/gemma-4-31b-it:free')`
- Line 59: `setFallbackModel1('nvidia/nemotron-3-super-120b-a12b:free')`
- Line 60: `setFallbackModel2('openai/gpt-oss-120b:free')`
- Line 61: `setFallbackModel3('openai/gpt-oss-20b:free')`

### 1d. `src/app/api/public/entrance/[id]/submit/route.ts` - Replace AI_MODELS

**Replace AI_MODELS array** (lines 16-30) with:

```typescript
const AI_MODELS = AI_PROVIDER === 'local'
  ? [process.env.LOCAL_LLM_MODEL || 'default']
  : [
      'google/gemma-4-31b-it:free',
      'nvidia/nemotron-3-super-120b-a12b:free',
      'openai/gpt-oss-120b:free',
      'openai/gpt-oss-20b:free',
      'nvidia/nemotron-3-nano-30b-a3b:free',
      'qwen/qwen3-coder:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'openrouter/free',
    ];
```

---

## Phase 2: Add AbortController timeout to all frontend components

### Pattern to Add (repeat in each component):

For every `fetch()` call in AI components, wrap with an AbortController that times out at 25 seconds:

```typescript
// Before the fetch
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 25000);

try {
  const response = await fetch(url, {
    ...existingOptions,
    signal: controller.signal,
  });
  // ... existing handling
} catch (error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    // Specific "Request timed out" message
    toast.error('Request timed out. Please try again.');
  } else {
    // existing error handling
  }
} finally {
  clearTimeout(timeoutId);
}
```

### Files to modify:

1. **`src/components/features/ai-homework-generator.tsx`** — Add controller+timeout to the `fetch()` in `handleGenerate()` (~line 67-109)
2. **`src/components/features/ai-scheme-of-work-generator.tsx`** — Add to `handleGenerate()` fetch
3. **`src/components/features/ai-timetable-generator.tsx`** — Add to `handleGenerate()` fetch
4. **`src/components/features/ai-report-card-writer.tsx`** — Add to `handleGenerate()` fetch
5. **`src/components/features/ai-lesson-note-generator.tsx`** — Add to `handleGenerate()` fetch
6. **`src/components/features/ai-pd-planner.tsx`** — Add to `handleGenerate()` fetch
7. **`src/components/features/ai-grading-assistant.tsx`** — Add to `gradeWithAI()` fetch (~line 73)
8. **`src/components/features/ai-homework-helper.tsx`** — Add to `handleSend()` fetch and `handleActionClick()` fetch
9. **`src/components/features/ai-admin-dashboard.tsx`** — Add to shared `callAI()` function (line 57-88)
10. **`src/components/dashboards/teacher-ai-assistant.tsx`** — Add to chat fetch
11. **`src/components/dashboards/student-ai-chat.tsx`** — Add to chat fetch

---

## Phase 3: Add Cancel/Stop button

In every generator component that has a progress bar, add a "Cancel" button next to the progress bar that calls `controller.abort()`:

```tsx
{isGenerating && (
  <div className="space-y-2">
    <Progress value={progress} />
    <div className="flex justify-between items-center">
      <p className="text-sm text-muted-foreground">AI creating assignment...</p>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => { controller.abort(); clearInterval(interval); setIsGenerating(false); setProgress(0); }}
      >
        Cancel
      </Button>
    </div>
  </div>
)}
```

Store both `controller` and `interval` as refs or state variables accessible from the JSX.

---

## Phase 4: Fix Bulk Grading

In `src/components/features/ai-grading-assistant.tsx`:

Replace the sequential `for` loop with a controlled loop that uses individual AbortControllers with timeouts:

```typescript
const gradeAll = async () => {
  setIsGrading(true);
  let completed = 0;
  const results = [...ungradedResults];
  for (let i = 0; i < ungradedResults.length; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    try {
      const grade = await gradeWithAI(ungradedResults[i].answer, controller.signal);
      results[i] = { ...results[i], grade: grade.grade, score: grade.score, feedback: grade.feedback };
    } catch (err) {
      results[i] = { ...results[i], grade: 'E', score: 0, feedback: 'Grading failed - timed out' };
    } finally {
      clearTimeout(timeoutId);
      completed++;
      setProgress(Math.round((completed / ungradedResults.length) * 100));
    }
  }
  setUngradedResults(results);
  setIsGrading(false);
};
```

---

## Phase 5: Increase Server Timeout

Already covered in Phase 1a — change `FETCH_TIMEOUT_MS` from 10000 to 20000 in `src/lib/ai/server.ts`.

---

## Phase 6: Add retry in frontend for transient failures

In the catch block of each generator, after showing the timeout/error toast, add a "Retry" action button in the toast:

```typescript
toast.error('Request timed out', {
  action: { label: 'Retry', onClick: () => handleGenerate() },
});
```

---

## Verification Steps

1. Run `npm run build` or `npx tsc --noEmit` to check TypeScript compilation
2. Run any linting: `npm run lint` or `npx eslint src/`
3. Verify by testing flow against OpenRouter API
