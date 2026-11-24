export function resultFoundationPath(
  scope: { pathId: string; subjectId: string },
  topicId: string,
  content: 'lessons' | 'quizzes' | 'support',
) {
  const query = new URLSearchParams({ subject: scope.subjectId, tab: 'skills', topic: topicId, content });
  return `/category/${encodeURIComponent(scope.pathId)}?${query}`;
}
