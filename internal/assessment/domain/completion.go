package domain

type CompletionBucket struct {
	Total      int `json:"total"`
	Completed  int `json:"completed"`
	Percentage int `json:"percentage"`
}

type TopicCompletionDetail struct {
	Total     int  `json:"total"`
	Completed int  `json:"completed"`
	Percent   int  `json:"percent"`
	Complete  bool `json:"complete"`
}

type LearningCompletionResponse struct {
	Training         CompletionBucket                 `json:"training"`
	Tests            CompletionBucket                 `json:"tests"`
	Mock             CompletionBucket                 `json:"mock"`
	CompletedQuizIDs []string                         `json:"completedQuizIds"`
	Foundation       map[string]TopicCompletionDetail `json:"foundation"`
	FoundationLocked []string                         `json:"foundationLocked"`
}

func CalcPercentage(completed, total int) int {
	if total <= 0 {
		return 0
	}
	if completed >= total {
		return 100
	}
	pct := (completed * 100) / total
	if pct > 99 {
		return 99
	}
	return pct
}
