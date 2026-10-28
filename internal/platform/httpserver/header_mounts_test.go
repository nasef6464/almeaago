package httpserver

import (
 "io"
 "log/slog"
 "net/http"
 "net/http/httptest"
 "reflect"
 "testing"
)

func TestHeaderCapabilitiesMountAtOriginalAndNativeContracts(t *testing.T){
 for _,tc:=range []struct{field,path,method string}{
  {"Search","/api/v1/search?q=test","GET"},
  {"PublicArticles","/api/v1/public/articles","GET"},
  {"PublicMockExams","/api/v1/public/mock-exams","GET"},
  {"NavigationPreferences","/api/v1/learning/navigation-preferences","PATCH"},
 }{t.Run(tc.field,func(t *testing.T){
  deps:=Dependencies{Logger:slog.New(slog.NewTextHandler(io.Discard,nil))}
  field:=reflect.ValueOf(&deps).Elem().FieldByName(tc.field)
  if !field.IsValid(){t.Fatalf("missing header capability dependency %s",tc.field)}
  probe:=http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){w.Header().Set("X-Capability",tc.field);w.WriteHeader(204)})
  field.Set(reflect.ValueOf(http.Handler(probe)))
  server:=New(":0",deps);response:=httptest.NewRecorder();server.Handler.ServeHTTP(response,httptest.NewRequest(tc.method,tc.path,nil))
  if response.Code!=204||response.Header().Get("X-Capability")!=tc.field{t.Fatalf("mount unavailable: %d %s",response.Code,response.Body.String())}
 })}
}
