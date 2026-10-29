package contenthttp

import (
 "context"
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "testing"
 contentapp "github.com/nasef6464/almeaago/internal/content/application"
 content "github.com/nasef6464/almeaago/internal/content/domain"
)

type publicReaderStub struct{contentapp.Repository}
func (publicReaderStub) ListPublicCourses(_ context.Context,limit int)([]content.PublicCourse,error){
 return []content.PublicCourse{{ID:"published-1",Title:"دورة منشورة",InstructorName:"معلم"}},nil
}
func TestAnonymousPublicCoursesRead(t *testing.T){
 handler:=NewCourses(contentapp.NewService(publicReaderStub{}),nil)
 response:=httptest.NewRecorder()
 handler.ServeHTTP(response,httptest.NewRequest(http.MethodGet,"/public?limit=3",nil))
 if response.Code!=200{t.Fatalf("guest status=%d body=%s",response.Code,response.Body.String())}
 var body struct{Items []content.PublicCourse `json:"items"`}
 if err:=json.Unmarshal(response.Body.Bytes(),&body);err!=nil{t.Fatal(err)}
 if len(body.Items)!=1 || body.Items[0].ID!="published-1"{t.Fatalf("unexpected public courses %+v",body.Items)}
}
func TestPublicCoursesRejectUnboundedLimit(t *testing.T){
 handler:=NewCourses(contentapp.NewService(publicReaderStub{}),nil)
 for _,url:=range []string{"/public?limit=101","/public?limit=-1","/public?limit=abc"}{
  response:=httptest.NewRecorder()
  handler.ServeHTTP(response,httptest.NewRequest(http.MethodGet,url,nil))
  if response.Code!=400{t.Errorf("%s: expected 400 got %d",url,response.Code)}
 }
}
