export type PathStageSelection = {pathId:string;levelId:string};
export type CategoryPath={id:string;name:string;isActive?:boolean;showInHome?:boolean;showInNavbar?:boolean;parentPathId?:string;settings?:{stageSelection?:'auto'|'required'|'none';stageLabel?:string;studentTemplate?:string;[key:string]:unknown};[key:string]:unknown};
export type CategoryLevel={id:string;name:string;pathId:string};
export type CategorySubject={id:string;name:string;pathId:string;levelId?:string|null};
export type Preferences={enrolledPaths:string[];pathStageSelections:PathStageSelection[]};
