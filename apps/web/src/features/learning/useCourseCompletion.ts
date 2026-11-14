import { useCallback, useEffect, useRef, useState } from 'react';
import { lessonProgressClient } from './api/learning-client';

// Null means unavailable/loading, not zero progress. Never reuse another
// learner's or another course's result during a route/account transition.
export function useCourseCompletion(courseId: string, userId: string) {
  const scope = JSON.stringify([userId, courseId]);
  const [state, setState] = useState<{scope:string; ids:string[] | null}>({scope:'', ids:null});
  const confirmedDuringLoad = useRef<{scope:string; ids:Set<string>}>({scope:'', ids:new Set()});
  useEffect(() => {
    if (!courseId || !userId) return;
    const controller = new AbortController();
    confirmedDuringLoad.current = {scope, ids:new Set()};
    setState({scope, ids:null});
    lessonProgressClient.completedCourse(courseId, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      if (result.courseId !== courseId || !Array.isArray(result.completedLessonIds) || result.completedLessonIds.some(id => typeof id !== 'string')) throw new Error('Invalid course progress');
      const confirmed = confirmedDuringLoad.current.scope === scope ? confirmedDuringLoad.current.ids : new Set<string>();
      setState({scope, ids:Array.from(new Set([...result.completedLessonIds, ...confirmed]))});
    }).catch(() => { if (!controller.signal.aborted) setState({scope, ids:null}); });
    return () => controller.abort();
  }, [courseId, userId, scope]);
  const markCompleted = useCallback((lessonId:string) => {
    if (confirmedDuringLoad.current.scope === scope) confirmedDuringLoad.current.ids.add(lessonId);
    setState(current => current.scope === scope && current.ids !== null ? {scope, ids:Array.from(new Set([...current.ids, lessonId]))} : current);
  }, [scope]);
  return { completedLessonIds: state.scope === scope ? state.ids : null, markCompleted };
}
