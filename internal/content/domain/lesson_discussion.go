package domain

import "time"

type LessonDiscussionMessage struct {
	ID         string    `json:"id"`
	ParentID   string    `json:"parentId"`
	AuthorID   string    `json:"authorId"`
	AuthorName string    `json:"authorName"`
	Body       string    `json:"body"`
	CreatedAt  time.Time `json:"createdAt"`
}

type LessonDiscussionPage struct {
	Items   []LessonDiscussionMessage `json:"items"`
	Page    int                       `json:"page"`
	HasMore bool                      `json:"hasMore"`
}
