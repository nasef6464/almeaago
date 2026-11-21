package domain

// GuidePlacementGroup is one policy class of visible published placements.
type GuidePlacementGroup struct {
	Slot            PlacementSlot
	PlacementAccess PlacementAccessType
	BaseAccess      AccessType
	Kind            Kind
}

type SubjectGuideCategory struct {
	Type          string `json:"type"`
	HasContent    bool   `json:"hasContent"`
	HasFree       bool   `json:"hasFree"`
	HasOpen       bool   `json:"hasOpen"`
	HasLocked     bool   `json:"hasLocked"`
	HasRestricted bool   `json:"hasRestricted"`
}

type SubjectAccessGuide struct {
	PathID      string                 `json:"pathId"`
	SubjectID   string                 `json:"subjectId"`
	Categories  []SubjectGuideCategory `json:"categories"`
	Unavailable []string               `json:"unavailable"`
	Complete    bool                   `json:"complete"`
}
