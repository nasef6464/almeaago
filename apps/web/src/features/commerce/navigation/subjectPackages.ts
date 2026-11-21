export type SubjectPackageContent = 'foundation' | 'banks' | 'tests' | 'library';

// Preserve the student's exact place so returning from the catalogue is safe.
export function subjectPackagesURL(pathId: string, subjectId: string, contentType: SubjectPackageContent, returnTo: string): string {
  const query = new URLSearchParams({ tab: 'packages', subjectId, contentType, returnTo });
  return `/category/${encodeURIComponent(pathId)}?${query}`;
}
