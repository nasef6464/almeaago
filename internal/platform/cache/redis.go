package cache
import("context";"fmt";"time";"github.com/redis/go-redis/v9")
func Open(ctx context.Context,url string)(*redis.Client,error){
	opts,err:=redis.ParseURL(url);if err!=nil{return nil,fmt.Errorf("parse redis url: %w",err)}
	c:=redis.NewClient(opts);pingCtx,cancel:=context.WithTimeout(ctx,3*time.Second);defer cancel()
	if err:=c.Ping(pingCtx).Err();err!=nil{_ = c.Close();return nil,fmt.Errorf("ping redis: %w",err)}
	return c,nil
}
