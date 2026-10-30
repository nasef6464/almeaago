export type PathStageSelection = {pathId:string;levelId:string};
export type CategoryPath={id:string;name:string;sortOrder?:number;isActive?:boolean;showInHome?:boolean;showInNavbar?:boolean;parentPathId?:string;settings?:{stageSelection?:'auto'|'required'|'none';stageLabel?:string;studentTemplate?:string;[key:string]:unknown};[key:string]:unknown};
export type CategoryLevel={id:string;name:string;pathId:string;sortOrder?:number};
export type CategorySubject={id:string;name:string;pathId:string;levelId?:string|null;sortOrder?:number};
export type Preferences={enrolledPaths:string[];pathStageSelections:PathStageSelection[]};
