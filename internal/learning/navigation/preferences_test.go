package navigation

import "testing"

func TestResolvePartialStageWritesAndExplicitRemoval(t *testing.T) {
	current := Preferences{EnrolledPaths: []string{"p", "q"}, PathStageSelections: []Stage{{"p", "l"}, {"q", "m"}}}
	empty := []Stage{}
	got, err := Resolve(current, Patch{PathStageSelections: &empty}, nil, nil, true)
	if err != nil || len(got.PathStageSelections) != 2 {
		t.Fatalf("empty stage patch must merge: %+v %v", got, err)
	}
	none := []string{}
	got, err = Resolve(current, Patch{EnrolledPaths: &none}, nil, nil, true)
	if err != nil || len(got.PathStageSelections) != 0 || len(got.EnrolledPaths) != 0 {
		t.Fatalf("explicit enrollment removal: %+v %v", got, err)
	}
}
func TestResolveNewEnrollmentScopeAndStagePolicy(t *testing.T) {
	ids := []string{"p"}
	stages := []Stage{{"p", "foreign"}}
	paths := []Path{{ID: "p", Active: true, ShowHome: true, StagePolicy: "auto"}}
	levels := []Level{{ID: "l", PathID: "p"}}
	if _, err := Resolve(Preferences{}, Patch{EnrolledPaths: &ids}, paths, levels, true); err == nil {
		t.Fatal("stage required")
	}
	if _, err := Resolve(Preferences{}, Patch{EnrolledPaths: &ids, PathStageSelections: &stages}, paths, levels, true); err == nil {
		t.Fatal("foreign stage accepted")
	}
	stages[0].LevelID = "l"
	if _, err := Resolve(Preferences{}, Patch{EnrolledPaths: &ids, PathStageSelections: &stages}, paths, levels, true); err != nil {
		t.Fatal(err)
	}
	paths[0].Active = false
	if _, err := Resolve(Preferences{}, Patch{EnrolledPaths: &ids, PathStageSelections: &stages}, paths, levels, true); err == nil {
		t.Fatal("inactive accepted")
	}
}

func TestResolvePreservesExistingWithoutForcedBackfillAndHiddenFalse(t *testing.T) {
	ids := []string{"existing", "hidden"}
	current := Preferences{EnrolledPaths: []string{"existing"}}
	paths := []Path{{ID: "existing", StagePolicy: "required"}, {ID: "hidden", Active: true, StagePolicy: "none"}}
	if _, err := Resolve(current, Patch{EnrolledPaths: &ids}, paths, nil, true); err == nil {
		t.Fatal("both false visibility accepted")
	}
	paths[1].ShowNavbar = true
	if got, err := Resolve(current, Patch{EnrolledPaths: &ids}, paths, nil, true); err != nil || len(got.EnrolledPaths) != 2 {
		t.Fatalf("existing backfill/none policy: %+v %v", got, err)
	}
}
func TestResolveStageUpdateMergesOtherPathsAndRejectsUnenrolled(t *testing.T) {
	current := Preferences{EnrolledPaths: []string{"p", "q"}, PathStageSelections: []Stage{{"q", "m"}, {"p", "l"}}}
	rows := []Stage{{"p", "l2"}}
	levels := []Level{{ID: "l2", PathID: "p"}}
	got, err := Resolve(current, Patch{PathStageSelections: &rows}, nil, levels, true)
	if err != nil || len(got.PathStageSelections) != 2 || got.PathStageSelections[0] != (Stage{"q", "m"}) || got.PathStageSelections[1] != (Stage{"p", "l2"}) {
		t.Fatalf("partial stage update: %+v %v", got, err)
	}
	rows[0].PathID = "other"
	if _, err = Resolve(current, Patch{PathStageSelections: &rows}, nil, levels, true); err == nil {
		t.Fatal("unenrolled path accepted")
	}
}

func TestResolveInactiveLevelsAreNotNewStageCandidates(t *testing.T) {
	ids := []string{"p"}
	paths := []Path{{ID: "p", Active: true, ShowHome: true, StagePolicy: "auto"}}
	levels := []Level{{ID: "inactive", PathID: "p", Status: "inactive"}, {ID: "archived", PathID: "p", Status: "archived"}}
	if _, err := Resolve(Empty(), Patch{EnrolledPaths: &ids}, paths, levels, true); err != nil {
		t.Fatalf("auto path without selectable levels must enroll without stage: %v", err)
	}
	rows := []Stage{{"p", "inactive"}}
	if _, err := Resolve(Empty(), Patch{EnrolledPaths: &ids, PathStageSelections: &rows}, paths, levels, true); err == nil {
		t.Fatal("new inactive stage accepted")
	}
	current := Preferences{EnrolledPaths: ids, PathStageSelections: rows}
	if got, err := Resolve(current, Patch{PathStageSelections: &rows}, paths, levels, true); err != nil || len(got.PathStageSelections) != 1 {
		t.Fatalf("unchanged existing inactive choice was lost: %+v %v", got, err)
	}
}
