export type MockSummary={id?:string;pathId:string;subjectId?:string;title?:string;questionCount:number;sectionCount:number;timeLimitSeconds:number};
export type MockPath={id:string;name:string;isActive?:boolean;showInNavbar?:boolean;settings?:{showMockExamCard?:unknown;[key:string]:unknown}};
export function visibleMockPaths<T extends MockPath>(paths:T[],role:string){
 const canSeeHiddenPaths=['admin','teacher','supervisor'].includes(role);
 const rank=(name:string)=>name.includes('قدرات')?1:name.includes('تحصيلي')?2:3;
 return paths.filter(path=>path.settings?.showMockExamCard!==false&&(canSeeHiddenPaths||path.isActive!==false)&&path.showInNavbar!==false).sort((a,b)=>rank(a.name)-rank(b.name)||a.name.localeCompare(b.name,'ar'));
}
export function mockPathSummary(mocks:MockSummary[],pathId:string){const rows=mocks.filter(mock=>mock.pathId===pathId);return {count:rows.length,totalQuestions:rows.reduce((sum,m)=>sum+m.questionCount,0),totalSections:rows.reduce((sum,m)=>sum+Math.max(m.sectionCount,1),0),nearestTime:rows[0]?rows[0].timeLimitSeconds/60:0};}
