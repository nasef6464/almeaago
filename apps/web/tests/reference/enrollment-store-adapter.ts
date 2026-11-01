import { useStudentExperience } from '../../src/features/learning/navigation';

// Import boundary only: both variants use the same actual Go navigation state.
// The original component checks the current actor after its asynchronous save.
let current: ReturnType<typeof useStudentExperience> | undefined;
export function useStore() {
  current = useStudentExperience();
  return current;
}
useStore.getState = () => {
  if (!current) throw new Error('Source enrollment context is not mounted');
  return current;
};
