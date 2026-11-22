export interface SavedAttempt {
  id: string;
  title: string;
  questionId: string;
  returnTo: string;
}

const storageKey = (userId: string) => `almeaa:saved-assessment-attempts:${userId}`;

export function readSavedAttempts(userId: string): SavedAttempt[] {
  try {
    const items: unknown = JSON.parse(localStorage.getItem(storageKey(userId)) ?? '[]');
    if (!Array.isArray(items)) return [];
    return items.filter((item): item is SavedAttempt =>
      item && typeof item.id === 'string' && typeof item.title === 'string'
      && typeof item.questionId === 'string' && typeof item.returnTo === 'string',
    );
  } catch {
    return [];
  }
}

export function saveAttemptBookmark(userId: string, attempt: SavedAttempt) {
  const others = readSavedAttempts(userId).filter(item => item.id !== attempt.id);
  localStorage.setItem(storageKey(userId), JSON.stringify([attempt, ...others]));
}

export function removeAttemptBookmark(userId: string, attemptId: string) {
  const items = readSavedAttempts(userId);
  const remaining = items.filter(item => item.id !== attemptId);
  if (remaining.length === items.length) return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(remaining));
  } catch {
    // A browser storage failure must not affect a server submission.
  }
}
