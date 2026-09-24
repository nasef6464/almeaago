package config
import("fmt";"os")
type Config struct{Environment,HTTPAddr,DatabaseURL,RedisURL,WebOrigin,LogLevel string}
func Load()(Config,error){
	c:=Config{Environment:value("APP_ENV","development"),HTTPAddr:value("HTTP_ADDR",":8080"),DatabaseURL:os.Getenv("DATABASE_URL"),RedisURL:os.Getenv("REDIS_URL"),WebOrigin:value("WEB_ORIGIN","http://localhost:5173"),LogLevel:value("LOG_LEVEL","info")}
	if c.DatabaseURL==""{return Config{},fmt.Errorf("DATABASE_URL is required")}
	if c.RedisURL==""{return Config{},fmt.Errorf("REDIS_URL is required")}
	return c,nil
}
func value(k,f string)string{if v:=os.Getenv(k);v!=""{return v};return f}
