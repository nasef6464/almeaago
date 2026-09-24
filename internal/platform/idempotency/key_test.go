package idempotency
import("strings";"testing")
func TestNormalize(t *testing.T){got,err:=Normalize("  payment:abc-123  ");if err!=nil||got!="payment:abc-123"{t.Fatalf("got %q err %v",got,err)}}
func TestReject(t *testing.T){for _,v:=range[]string{"","   ",strings.Repeat("x",MaxKeyLength+1)}{if _,err:=Normalize(v);err==nil{t.Fatalf("expected error")}}}
