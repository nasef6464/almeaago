import { checkpointHints } from './checkpointHints';

export type BoardAction =
  | { type: 'write'; id: string; kind: 'text' | 'formula'; content: string }
  | { type: 'transform'; target: string; content: string }
  | { type: 'highlight' | 'box' | 'erase'; target: string };

export type TeachingCheckpoint = {
  prompt: string;
  hints: [string, string];
};

export type TeachingScene = {
  id: string;
  narration: string;
  actions: BoardAction[];
  checkpoint?: TeachingCheckpoint;
};

export type TeachingStoryboard = {
  version: 1;
  language: 'ar-SA' | 'en-US';
  scenes: TeachingScene[];
};

const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const safeText = (value: unknown, max: number): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.length <= max &&
  !/(?:<[A-Za-z!/][^>]*>|[\u0000-\u0008])/.test(value);

const identifier = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(value);

const safeFormula = (value: string) =>
  !/\\(?:html\w*|href|url|includegraphics|def|gdef|newcommand|renewcommand|input)\b/i.test(value);

/** Reject the entire plan when references, bounds, or an action are invalid. */
export function validateTeachingStoryboard(value: unknown): TeachingStoryboard | null {
  if (
    !record(value) ||
    value.version !== 1 ||
    !['ar-SA', 'en-US'].includes(String(value.language)) ||
    !Array.isArray(value.scenes) ||
    value.scenes.length < 1 ||
    value.scenes.length > 8
  ) {
    return null;
  }

  const sceneIds = new Set<string>();
  const elements = new Map<string, 'text' | 'formula'>();
  const usedIds = new Set<string>();
  const scenes: TeachingScene[] = [];
  let actionCount = 0;
  let checkpointCount = 0;

  for (const scene of value.scenes) {
    if (
      !record(scene) ||
      !identifier(scene.id) ||
      sceneIds.has(scene.id) ||
      !safeText(scene.narration, 800) ||
      !Array.isArray(scene.actions) ||
      scene.actions.length > 8
    ) {
      return null;
    }

    sceneIds.add(scene.id);
    const actions: BoardAction[] = [];

    for (const action of scene.actions) {
      if (++actionCount > 32 || !record(action)) return null;

      if (action.type === 'write') {
        if (
          !identifier(action.id) ||
          usedIds.has(action.id) ||
          !['text', 'formula'].includes(String(action.kind)) ||
          !safeText(action.content, 600) ||
          (action.kind === 'formula' && !safeFormula(action.content))
        ) {
          return null;
        }
        usedIds.add(action.id);
        elements.set(action.id, action.kind as 'text' | 'formula');
        actions.push({
          type: 'write',
          id: action.id,
          kind: action.kind as 'text' | 'formula',
          content: action.content,
        });
      } else {
        if (!identifier(action.target) || !elements.has(action.target)) return null;
        if (action.type === 'transform') {
          if (
            !safeText(action.content, 600) ||
            (elements.get(action.target) === 'formula' && !safeFormula(action.content))
          ) {
            return null;
          }
          actions.push({ type: 'transform', target: action.target, content: action.content });
        } else if (action.type === 'highlight' || action.type === 'box' || action.type === 'erase') {
          actions.push({ type: action.type, target: action.target });
          if (action.type === 'erase') elements.delete(action.target);
        } else {
          return null;
        }
      }
    }

    let checkpoint: TeachingCheckpoint | undefined;
    if (scene.checkpoint !== undefined) {
      if (++checkpointCount > 1 || scene === value.scenes[value.scenes.length - 1]) return null;
      const check = scene.checkpoint;
      if (
        !record(check) ||
        !safeText(check.prompt, 300) ||
        !Array.isArray(check.hints) ||
        check.hints.length !== 2 ||
        !check.hints.every((hint) => safeText(hint, 300))
      ) {
        return null;
      }
      checkpoint = { prompt: check.prompt, hints: checkpointHints(check.prompt, String(value.language)) };
    }

    scenes.push({
      id: scene.id,
      narration: scene.narration,
      actions,
      ...(checkpoint ? { checkpoint } : {}),
    });
  }

  return {
    version: 1,
    language: value.language as TeachingStoryboard['language'],
    scenes,
  };
}
