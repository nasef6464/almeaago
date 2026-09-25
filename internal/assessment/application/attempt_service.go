package application

import(
"context"
"errors"
"strings"
identity "github.com/nasef6464/almeaago/internal/identity/domain"
assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)
var ErrAttemptExpired=errors.New("assessment attempt expired")
var ErrAttemptSubmitted=errors.New("assessment attempt submitted")
var ErrResultUnavailable=errors.New("assessment result unavailable")
type AttemptRepository interface{Start(context.Context,string,string,string)(assessment.Attempt,error);GetAttempt(context.Context,string)(assessment.Attempt,error);SaveAnswer(context.Context,string,string,string,assessment.AnswerWrite)(assessment.Attempt,error);Submit(context.Context,string,string,string)(assessment.Result,error);GetResult(context.Context,string)(assessment.Result,error)}
type AttemptService struct{repo AttemptRepository}
func NewAttemptService(r AttemptRepository)*AttemptService{return &AttemptService{repo:r}}
func requireStudent(a identity.User)error{if strings.TrimSpace(a.ID)==""||!a.HasRole(identity.RoleStudent){return ErrForbidden};return nil}
func key(v string)string{v=strings.TrimSpace(v);if len(v)>160{return ""};return v}
func(s *AttemptService)Start(ctx context.Context,a identity.User,assessmentID,startKey string)(assessment.Attempt,error){if requireStudent(a)!=nil{return assessment.Attempt{},ErrForbidden};assessmentID=strings.TrimSpace(assessmentID);startKey=key(startKey);if assessmentID==""||startKey==""{return assessment.Attempt{},ErrInvalidInput};return s.repo.Start(ctx,a.ID,assessmentID,startKey)}
func(s *AttemptService)Get(ctx context.Context,a identity.User,id string)(assessment.Attempt,error){if requireStudent(a)!=nil{return assessment.Attempt{},ErrForbidden};x,e:=s.repo.GetAttempt(ctx,strings.TrimSpace(id));if e!=nil{return x,e};if x.StudentID!=a.ID{return assessment.Attempt{},ErrForbidden};return x,nil}
func(s *AttemptService)Save(ctx context.Context,a identity.User,id,qid string,w assessment.AnswerWrite)(assessment.Attempt,error){if requireStudent(a)!=nil{return assessment.Attempt{},ErrForbidden};if strings.TrimSpace(id)==""||strings.TrimSpace(qid)==""||w.TimeSpentSeconds<0||w.TimeSpentSeconds>86400{return assessment.Attempt{},ErrInvalidInput};if w.SelectedOptionIndex==nil&&strings.TrimSpace(w.TextAnswer)==""{return assessment.Attempt{},ErrInvalidInput};if w.SelectedOptionIndex!=nil&&strings.TrimSpace(w.TextAnswer)!=""{return assessment.Attempt{},ErrInvalidInput};return s.repo.SaveAnswer(ctx,a.ID,id,qid,w)}
func(s *AttemptService)Submit(ctx context.Context,a identity.User,id,submissionKey string)(assessment.Result,error){if requireStudent(a)!=nil{return assessment.Result{},ErrForbidden};submissionKey=key(submissionKey);if strings.TrimSpace(id)==""||submissionKey==""{return assessment.Result{},ErrInvalidInput};return s.repo.Submit(ctx,a.ID,id,submissionKey)}
func(s *AttemptService)Result(ctx context.Context,a identity.User,id string)(assessment.Result,error){if requireStudent(a)!=nil{return assessment.Result{},ErrForbidden};x,e:=s.repo.GetAttempt(ctx,strings.TrimSpace(id));if e!=nil{return assessment.Result{},e};if x.StudentID!=a.ID{return assessment.Result{},ErrForbidden};return s.repo.GetResult(ctx,id)}
