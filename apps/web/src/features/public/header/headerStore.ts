import {useStudentExperience} from '../../learning/navigation';
import {useHeaderCart} from './commerce/useHeaderCart';
export function useStore(){const {paths,levels,subjects}=useStudentExperience();const {cartItems}=useHeaderCart();return {paths,levels,subjects,cartItems};}
