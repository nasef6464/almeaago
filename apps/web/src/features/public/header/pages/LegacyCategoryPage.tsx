import {useParams,useSearchParams} from 'react-router-dom';
import {useStudentExperience,StudentPathAccessPrompt} from '../../../learning/navigation';
import {LearningSpacePage} from '../../../learning/pages/LearningSpacePage';
import {PathPackagesPage} from '../commerce/PathPackagesPage';
import {PathMockExamsPage} from './PathMockExamsPage';
export function LegacyCategoryPage(){
 const {pathId:raw=''}=useParams();const [params]=useSearchParams();const experience=useStudentExperience();
 const path=experience.paths.find(row=>row.id===raw||row.code===raw);
 if(experience.loading)return <main role="status" className="p-10 text-center">جاري تحميل المسار...</main>;
 if(experience.error)return <main role="alert" className="p-10 text-center">{experience.error}</main>;
 if(!path)return <main role="alert" className="p-10 text-center">المسار غير موجود أو غير متاح.</main>;
 if(!experience.scope.pathVisible(path))return <StudentPathAccessPrompt path={path}/>;
 if(params.get('tab')==='packages')return <PathPackagesPage pathId={path.id}/>;
 if(params.get('tab')==='mock-exams')return <PathMockExamsPage pathId={path.id}/>;
 return <LearningSpacePage/>;
}
