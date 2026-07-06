import { queueSocketEvent, getQueuedSocketEvents, removeQueuedSocketEvent } from './db';

let currentSchoolId = '';

export function setSocketQueueContext(schoolId: string): void {
  currentSchoolId = schoolId;
}

export async function enqueueSocketEvent(event: string, data: unknown): Promise<string> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await queueSocketEvent({
    id,
    event,
    data,
    schoolId: currentSchoolId,
    createdAt: Date.now(),
  });
  return id;
}

export async function flushSocketQueue(socket: { emit: (event: string, data: unknown) => void }): Promise<number> {
  const events = await getQueuedSocketEvents(currentSchoolId);
  let flushed = 0;

  for (const queued of events) {
    try {
      socket.emit(queued.event, queued.data);
      await removeQueuedSocketEvent(queued.id);
      flushed++;
    } catch {
      // Will retry on next flush
    }
  }

  return flushed;
}

export async function getQueuedSocketCount(): Promise<number> {
  const events = await getQueuedSocketEvents(currentSchoolId);
  return events.length;
}
