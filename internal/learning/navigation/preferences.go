// Package navigation owns learner presentation preferences. It never grants access.
package navigation

import (
	"context"
	"errors"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	"strings"
)

var ErrInvalid = errors.New("invalid navigation preferences")
var ErrForbidden = errors.New("authentication required")

type Stage struct {
	PathID  string `json:"pathId"`
	LevelID string `json:"levelId"`
}
type Preferences struct {
	EnrolledPaths       []string `json:"enrolledPaths"`
	PathStageSelections []Stage  `json:"pathStageSelections"`
}
type Patch struct {
	EnrolledPaths       *[]string `json:"enrolledPaths,omitempty"`
	PathStageSelections *[]Stage  `json:"pathStageSelections,omitempty"`
}
type Path struct {
	ID                           string
	Active, ShowHome, ShowNavbar bool
	StagePolicy                  string
}
type Level struct{ ID, PathID, Status string }

func (l Level) selectable() bool { return l.Status == "" || l.Status == "active" }

func Empty() Preferences {
	return Preferences{EnrolledPaths: []string{}, PathStageSelections: []Stage{}}
}
func Resolve(current Preferences, patch Patch, paths []Path, levels []Level, student bool) (Preferences, error) {
	out := Empty()
	out.EnrolledPaths = append(out.EnrolledPaths, current.EnrolledPaths...)
	out.PathStageSelections = append(out.PathStageSelections, current.PathStageSelections...)
	if patch.EnrolledPaths != nil {
		out.EnrolledPaths = []string{}
		for _, id := range *patch.EnrolledPaths {
			if id == "" || len(id) > 160 {
				return Empty(), ErrInvalid
			}
			if !contains(out.EnrolledPaths, id) {
				out.EnrolledPaths = append(out.EnrolledPaths, id)
			}
		}
	}
	if patch.EnrolledPaths != nil {
		rows := []Stage{}
		for _, s := range out.PathStageSelections {
			if contains(out.EnrolledPaths, s.PathID) {
				rows = append(rows, s)
			}
		}
		out.PathStageSelections = rows
	}
	validStage := func(s Stage) bool {
		for _, l := range levels {
			if l.selectable() && l.ID == s.LevelID && l.PathID == s.PathID {
				return true
			}
		}
		return false
	}
	if patch.PathStageSelections != nil {
		if len(*patch.PathStageSelections) > 100 {
			return Empty(), ErrInvalid
		}
		for _, row := range *patch.PathStageSelections {
			row.PathID = strings.TrimSpace(row.PathID)
			row.LevelID = strings.TrimSpace(row.LevelID)
			if row.PathID == "" || row.LevelID == "" || len(row.PathID) > 160 || len(row.LevelID) > 160 || !contains(out.EnrolledPaths, row.PathID) {
				return Empty(), ErrInvalid
			}
			unchanged := false
			for _, saved := range current.PathStageSelections {
				if contains(current.EnrolledPaths, row.PathID) && saved == row {
					unchanged = true
				}
			}
			if !unchanged && !validStage(row) {
				return Empty(), ErrInvalid
			}
			replaced := false
			for i, s := range out.PathStageSelections {
				if s.PathID == row.PathID {
					out.PathStageSelections[i] = row
					replaced = true
					break
				}
			}
			if !replaced {
				out.PathStageSelections = append(out.PathStageSelections, row)
			}
		}
	}
	for _, id := range out.EnrolledPaths {
		if contains(current.EnrolledPaths, id) {
			continue
		}
		var found *Path
		for i := range paths {
			if paths[i].ID == id {
				found = &paths[i]
				break
			}
		}
		if found == nil || !found.Active || (!found.ShowHome && !found.ShowNavbar) {
			return Empty(), ErrInvalid
		}
		hasLevels := false
		for _, l := range levels {
			if l.selectable() && l.PathID == id {
				hasLevels = true
			}
		}
		requires := found.StagePolicy == "required" || ((found.StagePolicy == "" || found.StagePolicy == "auto") && hasLevels)
		if student && requires {
			ok := false
			for _, s := range out.PathStageSelections {
				if s.PathID == id && validStage(s) {
					ok = true
				}
			}
			if !ok {
				return Empty(), ErrInvalid
			}
		}
	}
	if len(out.PathStageSelections) > 100 {
		return Empty(), ErrInvalid
	}
	return out, nil
}
func contains(ids []string, id string) bool {
	for _, v := range ids {
		if v == id {
			return true
		}
	}
	return false
}

type Repository interface {
	Get(context.Context, string) (Preferences, error)
	Patch(context.Context, string, bool, Patch) (Preferences, error)
}
type Service struct{ repo Repository }

func NewService(repo Repository) *Service { return &Service{repo: repo} }
func (s *Service) Get(ctx context.Context, actor identity.User) (Preferences, error) {
	if actor.ID == "" {
		return Empty(), ErrForbidden
	}
	return s.repo.Get(ctx, actor.ID)
}
func (s *Service) Patch(ctx context.Context, actor identity.User, p Patch) (Preferences, error) {
	if actor.ID == "" {
		return Empty(), ErrForbidden
	}
	return s.repo.Patch(ctx, actor.ID, actor.HasRole(identity.RoleStudent), p)
}
