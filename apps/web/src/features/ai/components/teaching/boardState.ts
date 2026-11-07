import type { BoardAction, TeachingStoryboard } from './teachingStoryboard';

export type BoardElement = {
  id: string;
  kind: 'text' | 'formula';
  content: string;
  emphasis?: 'highlight' | 'box';
  progress: number;
};

export const actionDuration = (action: BoardAction): number => {
  if (action.type === 'write' || action.type === 'transform') {
    // Dynamic pace: shorter formulas write faster, longer explanations pace gracefully
    return Math.min(2200, Math.max(500, action.content.length * 24));
  }
  return 300;
};

export const sceneDuration = (plan: TeachingStoryboard, index: number): number => {
  const scene = plan.scenes[index];
  if (!scene) return 0;
  return scene.actions.reduce((sum, action) => sum + actionDuration(action), 0);
};

/** Replaying from beginning ensures seeking, rewinding and step resumption are strictly deterministic. */
export function boardAt(plan: TeachingStoryboard, sceneIndex: number, elapsedMs: number): BoardElement[] {
  const elements = new Map<string, BoardElement>();

  for (let i = 0; i <= sceneIndex && i < plan.scenes.length; i++) {
    const scene = plan.scenes[i];
    let actionStart = 0;

    for (const action of scene.actions) {
      const duration = actionDuration(action);
      if (i === sceneIndex && elapsedMs < actionStart) break;

      const progress = i < sceneIndex ? 1 : Math.min(1, Math.max(0, (elapsedMs - actionStart) / duration));

      if (action.type === 'write') {
        elements.set(action.id, {
          id: action.id,
          kind: action.kind,
          content: action.content,
          progress,
        });
      } else if (action.type === 'erase') {
        elements.delete(action.target);
      } else {
        const element = elements.get(action.target);
        if (element) {
          elements.set(
            action.target,
            action.type === 'transform'
              ? { ...element, content: action.content, progress, emphasis: undefined }
              : { ...element, emphasis: action.type }
          );
        }
      }
      actionStart += duration;
    }
  }

  return [...elements.values()];
}

/** Paced for natural Arabic speech: approximately 3.2 syllables or 140 words per minute */
export const estimateNarrationMs = (text: string): number => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(60000, Math.max(1400, Math.round(words * 410)));
};
