/**
 * Source-backed homepage path selection from Legacy pages/Landing.tsx.
 *
 * Contract (almeaacodax/main@bf7281fc):
 *  - showInHome=false hides a path for every role;
 *  - inactive paths are hidden for visitors, but may be visible to the
 *    original admin/teacher/supervisor roles;
 *  - paths with blank IDs/names are not displayed;
 *  - featuredPathIds narrow the eligible paths only if a match remains;
 *  - preserve the source paths' order, not the order of featured IDs.
 *
 * IMPORTANT: Presentation-only selection. The taxonomy Go/PostgreSQL read
 * must still enforce its own visibility/access contract; this function
 * does not grant access to any hidden content.
 */
export interface HomepagePathCandidate {
  id: string;
  name: string;
  showInHome?: boolean;
  isActive?: boolean;
}

export function selectHomepagePaths<T extends HomepagePathCandidate>(
  paths: readonly T[],
  featuredPathIds: readonly string[] | null | undefined,
  canSeeHiddenPaths = false,
): T[] {
  const eligible = paths.filter(
    path =>
      path.showInHome !== false &&
      (canSeeHiddenPaths || path.isActive !== false) &&
      typeof path.id === 'string' &&
      path.id.trim().length > 0 &&
      typeof path.name === 'string' &&
      path.name.trim().length > 0,
  );

  if (featuredPathIds?.length) {
    const featured = new Set(featuredPathIds);
    const selected = eligible.filter(path => featured.has(path.id));
    if (selected.length > 0) return selected;
  }

  return eligible;
}
