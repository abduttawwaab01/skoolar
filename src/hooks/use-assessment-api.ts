import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/app-store';
import { offlineGateway } from '@/lib/offline/gateway';

const API_BASE = '/api/assessment-hub';

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const result = await offlineGateway<T>(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if ('fromCache' in result) {
    return result.data as T;
  }
  if ('queued' in result && result.queued) {
    return { _queued: true, _mutationId: result.mutationId } as T;
  }
  return result as T;
}

function useSchoolId(): string {
  const { currentUser, selectedSchoolId } = useAppStore();
  return currentUser.schoolId || selectedSchoolId || '';
}

// ===== STUDENT ASSESSMENTS =====
export function useStudentAssessments(params?: {
  page?: number; limit?: number; type?: string; status?: string; classId?: string; search?: string;
}) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['student-assessments', params, schoolId],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (params?.page) sp.set('page', String(params.page));
      if (params?.limit) sp.set('limit', String(params.limit));
      if (params?.type) sp.set('type', params.type);
      if (params?.status) sp.set('status', params.status);
      if (params?.classId) sp.set('classId', params.classId);
      if (params?.search) sp.set('search', params.search);
      if (schoolId) sp.set('schoolId', schoolId);
      return fetchApi<{ data: unknown[]; total: number; page: number; totalPages: number }>(`${API_BASE}/student?${sp}`);
    },
    staleTime: 30_000,
  });
}

export function useStudentAssessment(id: string) {
  return useQuery({
    queryKey: ['student-assessment', id],
    queryFn: () => fetchApi(`${API_BASE}/student/${id}`),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCreateStudentAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => fetchApi(`${API_BASE}/student`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student-assessments'] }),
  });
}

export function useUpdateStudentAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; [key: string]: unknown }) =>
      fetchApi(`${API_BASE}/student`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student-assessments'] }),
  });
}

export function useDeleteStudentAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`${API_BASE}/student?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student-assessments'] }),
  });
}

export function useUpdateStudentAssessmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetchApi(`${API_BASE}/student/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student-assessments'] }),
  });
}

// ===== STUDENT SECTIONS =====
export function useCreateStudentSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => fetchApi(`${API_BASE}/student/sections`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student-assessment'] }),
  });
}

export function useUpdateStudentSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: unknown }) =>
      fetchApi(`${API_BASE}/student/sections/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student-assessment'] }),
  });
}

export function useDeleteStudentSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`${API_BASE}/student/sections/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student-assessment'] }),
  });
}

// ===== STUDENT QUESTIONS =====
export function useCreateStudentQuestions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => fetchApi(`${API_BASE}/student/questions`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student-assessment'] }),
  });
}

export function useUpdateStudentQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: unknown }) =>
      fetchApi(`${API_BASE}/student/questions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student-assessment'] }),
  });
}

export function useDeleteStudentQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`${API_BASE}/student/questions/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student-assessment'] }),
  });
}

// ===== STUDENT ATTEMPTS =====
export function useStartStudentAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { assessmentId: string; studentId: string }) =>
      fetchApi(`${API_BASE}/student/attempts`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student-attempts'] }),
  });
}

export function useSubmitStudentAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ attemptId, answers, timeTakenSeconds }: { attemptId: string; answers: Record<string, unknown>; timeTakenSeconds?: number }) =>
      fetchApi(`${API_BASE}/student/attempts/${attemptId}/submit`, { method: 'POST', body: JSON.stringify({ answers, timeTakenSeconds }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-attempts'] });
      qc.invalidateQueries({ queryKey: ['student-results'] });
      qc.invalidateQueries({ queryKey: ['student-profile'] });
    },
  });
}

export function useStudentAttempts(params?: { assessmentId?: string; studentId?: string; status?: string }) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['student-attempts', params, schoolId],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (params?.assessmentId) sp.set('assessmentId', params.assessmentId);
      if (params?.studentId) sp.set('studentId', params.studentId);
      if (params?.status) sp.set('status', params.status);
      if (schoolId) sp.set('schoolId', schoolId);
      return fetchApi<{ data: unknown[]; total: number }>(`${API_BASE}/student/attempts?${sp}`);
    },
    staleTime: 15_000,
  });
}

export function useStudentAttempt(id: string) {
  return useQuery({
    queryKey: ['student-attempt', id],
    queryFn: () => fetchApi(`${API_BASE}/student/attempts/${id}`),
    enabled: !!id,
    staleTime: 15_000,
  });
}

// ===== STUDENT RESULTS =====
export function useStudentResults(params?: { assessmentId?: string; studentId?: string; domain?: string }) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['student-results', params, schoolId],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (params?.assessmentId) sp.set('assessmentId', params.assessmentId);
      if (params?.studentId) sp.set('studentId', params.studentId);
      if (params?.domain) sp.set('domain', params.domain);
      return fetchApi<{ data: unknown[]; total: number }>(`${API_BASE}/student/results?${sp}`);
    },
    staleTime: 30_000,
  });
}

export function useStudentProfile(studentId: string) {
  return useQuery({
    queryKey: ['student-profile', studentId],
    queryFn: () => fetchApi(`${API_BASE}/student/profile/${studentId}`),
    enabled: !!studentId,
    staleTime: 60_000,
  });
}

export function useStudentLearningStyle(studentId: string) {
  return useQuery({
    queryKey: ['student-learning-style', studentId],
    queryFn: () => fetchApi(`${API_BASE}/student/learning-style/${studentId}`),
    enabled: !!studentId,
    staleTime: 120_000,
  });
}

export function useStudentGrowth(studentId: string) {
  return useQuery({
    queryKey: ['student-growth', studentId],
    queryFn: () => fetchApi(`${API_BASE}/student/growth/${studentId}`),
    enabled: !!studentId,
    staleTime: 60_000,
  });
}

export function useStudentRecommendations(params?: { studentId?: string; isCompleted?: boolean; priority?: string }) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['student-recommendations', params, schoolId],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (params?.studentId) sp.set('studentId', params.studentId);
      if (params?.isCompleted !== undefined) sp.set('isCompleted', String(params.isCompleted));
      if (params?.priority) sp.set('priority', params.priority);
      if (schoolId) sp.set('schoolId', schoolId);
      return fetchApi<{ data: unknown[]; total: number }>(`${API_BASE}/student/recommendations?${sp}`);
    },
    staleTime: 30_000,
  });
}

export function useCompleteStudentRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`${API_BASE}/student/recommendations/${id}/complete`, { method: 'PUT' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student-recommendations'] }),
  });
}

// ===== TEACHER ASSESSMENTS =====
export function useTeacherAssessments(params?: { page?: number; limit?: number; type?: string; status?: string }) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['teacher-assessments', params, schoolId],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (params?.page) sp.set('page', String(params.page));
      if (params?.limit) sp.set('limit', String(params.limit));
      if (params?.type) sp.set('type', params.type);
      if (params?.status) sp.set('status', params.status);
      if (schoolId) sp.set('schoolId', schoolId);
      return fetchApi<{ data: unknown[]; total: number; page: number; totalPages: number }>(`${API_BASE}/teacher?${sp}`);
    },
    staleTime: 30_000,
  });
}

export function useTeacherAssessment(id: string) {
  return useQuery({
    queryKey: ['teacher-assessment', id],
    queryFn: () => fetchApi(`${API_BASE}/teacher/${id}`),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCreateTeacherAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => fetchApi(`${API_BASE}/teacher`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teacher-assessments'] }),
  });
}

export function useDeleteTeacherAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`${API_BASE}/teacher?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teacher-assessments'] }),
  });
}

// ===== TEACHER ATTEMPTS =====
export function useStartTeacherAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { assessmentId: string; teacherId: string }) =>
      fetchApi(`${API_BASE}/teacher/attempts`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teacher-attempts'] }),
  });
}

export function useSubmitTeacherAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ attemptId, answers, timeTakenSeconds }: { attemptId: string; answers: Record<string, unknown>; timeTakenSeconds?: number }) =>
      fetchApi(`${API_BASE}/teacher/attempts/${attemptId}/submit`, { method: 'POST', body: JSON.stringify({ answers, timeTakenSeconds }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher-attempts'] });
      qc.invalidateQueries({ queryKey: ['teacher-competency'] });
    },
  });
}

export function useTeacherAttempts(params?: { assessmentId?: string; teacherId?: string }) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['teacher-attempts', params, schoolId],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (params?.assessmentId) sp.set('assessmentId', params.assessmentId);
      if (params?.teacherId) sp.set('teacherId', params.teacherId);
      if (schoolId) sp.set('schoolId', schoolId);
      return fetchApi<{ data: unknown[]; total: number }>(`${API_BASE}/teacher/attempts?${sp}`);
    },
    staleTime: 15_000,
  });
}

// ===== 360 FEEDBACK =====
export function useSubmitFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => fetchApi(`${API_BASE}/teacher/feedback`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teacher-feedback'] }),
  });
}

export function useFeedbackList(params?: { teacherId?: string; respondentRole?: string; approvalStatus?: string }) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['teacher-feedback', params, schoolId],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (params?.teacherId) sp.set('teacherId', params.teacherId);
      if (params?.respondentRole) sp.set('respondentRole', params.respondentRole);
      if (params?.approvalStatus) sp.set('approvalStatus', params.approvalStatus);
      if (schoolId) sp.set('schoolId', schoolId);
      return fetchApi<{ data: unknown[]; total: number }>(`${API_BASE}/teacher/feedback?${sp}`);
    },
    staleTime: 15_000,
  });
}

export function useApproveFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approvalStatus }: { id: string; approvalStatus: string }) =>
      fetchApi(`${API_BASE}/teacher/feedback/${id}/approve`, { method: 'PUT', body: JSON.stringify({ approvalStatus }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teacher-feedback'] }),
  });
}

// ===== OBSERVATIONS =====
export function useCreateObservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => fetchApi(`${API_BASE}/teacher/observations`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['observations'] }),
  });
}

export function useObservations(params?: { teacherId?: string; status?: string }) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['observations', params, schoolId],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (params?.teacherId) sp.set('teacherId', params.teacherId);
      if (params?.status) sp.set('status', params.status);
      if (schoolId) sp.set('schoolId', schoolId);
      return fetchApi<{ data: unknown[]; total: number }>(`${API_BASE}/teacher/observations?${sp}`);
    },
    staleTime: 15_000,
  });
}

export function useUpdateObservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: unknown }) =>
      fetchApi(`${API_BASE}/teacher/observations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['observations'] }),
  });
}

// ===== COMPETENCY & DEVELOPMENT =====
export function useTeacherCompetency(teacherId: string) {
  return useQuery({
    queryKey: ['teacher-competency', teacherId],
    queryFn: () => fetchApi(`${API_BASE}/teacher/competency/${teacherId}`),
    enabled: !!teacherId,
    staleTime: 60_000,
  });
}

export function useTeacherDevelopment(params?: { teacherId?: string; priority?: string }) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['teacher-development', params, schoolId],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (params?.teacherId) sp.set('teacherId', params.teacherId);
      if (params?.priority) sp.set('priority', params.priority);
      if (schoolId) sp.set('schoolId', schoolId);
      return fetchApi<{ data: unknown[]; total: number }>(`${API_BASE}/teacher/development?${sp}`);
    },
    staleTime: 30_000,
  });
}

export function useCompleteDevelopmentActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`${API_BASE}/teacher/development/${id}/complete`, { method: 'PUT' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teacher-development'] }),
  });
}

// ===== ANALYTICS =====
export function useAssessmentAnalyticsOverview() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['assessment-analytics-overview', schoolId],
    queryFn: () => fetchApi(`${API_BASE}/analytics/overview?schoolId=${schoolId}`),
    staleTime: 60_000,
  });
}

export function useStudentAnalytics(studentId: string) {
  return useQuery({
    queryKey: ['student-analytics', studentId],
    queryFn: () => fetchApi(`${API_BASE}/analytics/student/${studentId}`),
    enabled: !!studentId,
    staleTime: 60_000,
  });
}

export function useTeacherAnalytics(teacherId: string) {
  return useQuery({
    queryKey: ['teacher-analytics', teacherId],
    queryFn: () => fetchApi(`${API_BASE}/analytics/teacher/${teacherId}`),
    enabled: !!teacherId,
    staleTime: 60_000,
  });
}

export function useClassAnalytics(classId: string) {
  return useQuery({
    queryKey: ['class-analytics', classId],
    queryFn: () => fetchApi(`${API_BASE}/analytics/class/${classId}`),
    enabled: !!classId,
    staleTime: 60_000,
  });
}

// ===== AI =====
export function useAIGenerateQuestions() {
  return useMutation({
    mutationFn: (data: { topics: string[]; domain: string; difficulty?: string; count?: number; targetType?: string; questionTypes?: string[] }) =>
      fetchApi(`${API_BASE}/ai/generate-questions`, { method: 'POST', body: JSON.stringify(data) }),
  });
}

export function useAIGrade() {
  return useMutation({
    mutationFn: (data: { questionText: string; studentAnswer: string; maxMarks: number; rubric?: string }) =>
      fetchApi(`${API_BASE}/ai/grade`, { method: 'POST', body: JSON.stringify(data) }),
  });
}

export function useAIRecommend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { profileId: string; targetType: string; domains?: string[] }) =>
      fetchApi(`${API_BASE}/ai/recommend`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-recommendations'] });
      qc.invalidateQueries({ queryKey: ['teacher-development'] });
    },
  });
}

export function useAIAnalyzeProfile() {
  return useMutation({
    mutationFn: (data: { profileId: string; targetType: string }) =>
      fetchApi(`${API_BASE}/ai/analyze`, { method: 'POST', body: JSON.stringify(data) }),
  });
}

export function useAIGenerateReport() {
  return useMutation({
    mutationFn: (data: { assessmentId?: string; studentId?: string; teacherId?: string; type?: string }) =>
      fetchApi(`${API_BASE}/ai/generate-report`, { method: 'POST', body: JSON.stringify(data) }),
  });
}

// ===== TEMPLATES =====
export function useTemplates(targetType?: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['assessment-templates', targetType, schoolId],
    queryFn: () => fetchApi(`${API_BASE}/templates?schoolId=${schoolId}${targetType ? `&targetType=${targetType}` : ''}`),
    staleTime: 60_000,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => fetchApi(`${API_BASE}/templates`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assessment-templates'] }),
  });
}

export function useInstantiateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, ...data }: { templateId: string; [key: string]: unknown }) =>
      fetchApi(`${API_BASE}/templates/${templateId}/instantiate`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student-assessments'] }),
  });
}

// ===== AI CONFIG =====
export function useAIConfig() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['ai-config', schoolId],
    queryFn: () => fetchApi(`${API_BASE}/config?schoolId=${schoolId}`),
    staleTime: 120_000,
  });
}

export function useUpdateAIConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => fetchApi(`${API_BASE}/config`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-config'] }),
  });
}
