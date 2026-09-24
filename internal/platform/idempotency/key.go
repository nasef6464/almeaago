package idempotency
import("errors";"strings")
const MaxKeyLength=160
var ErrInvalidKey=errors.New("invalid idempotency key")
func Normalize(raw string)(string,error){k:=strings.TrimSpace(raw);if k==""||len(k)>MaxKeyLength{return "",ErrInvalidKey};return k,nil}
