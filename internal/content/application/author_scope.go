package application

import "context"

type AuthorScope interface {
	CanAuthor(ctx context.Context, userID, pathID, subjectID string) (bool, error)
}

type SchoolAuthorScope interface {
	CanTeachSubject(ctx context.Context, userID, pathID, subjectID string) (bool, error)
}

type CombinedAuthorScope struct {
	platform AuthorScope
	school   SchoolAuthorScope
}

func NewCombinedAuthorScope(platform AuthorScope, school SchoolAuthorScope) *CombinedAuthorScope {
	return &CombinedAuthorScope{platform: platform, school: school}
}

func (s *CombinedAuthorScope) CanAuthor(
	ctx context.Context,
	userID string,
	pathID string,
	subjectID string,
) (bool, error) {
	if s.platform != nil {
		ok, err := s.platform.CanAuthor(ctx, userID, pathID, subjectID)
		if err != nil {
			return false, err
		}
		if ok {
			return true, nil
		}
	}
	if s.school == nil {
		return false, nil
	}
	return s.school.CanTeachSubject(ctx, userID, pathID, subjectID)
}
