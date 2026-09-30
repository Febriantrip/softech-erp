package config

import (
	"errors"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	AppName           string
	Environment       string
	HTTPAddr          string
	AllowedOrigins    []string
	PostgresHost      string
	PostgresPort      string
	PostgresDB        string
	PostgresUser      string
	PostgresPassword  string
	RedisHost         string
	RedisPort         string
	JWTSecret         string
	JWTIssuer         string
	TokenTTL          time.Duration
	BootstrapUser     string
	BootstrapPassword string
	BootstrapName     string
	BootstrapRoles    []string
	BootstrapEntities []string
	BootstrapSites    []string
	FacePython        string
	FaceModelsDir     string
	FaceTemplateKey   string
	WebAuthnRPID      string
	WebAuthnRPOrigin  string
	ReadyCheckTimeout time.Duration
}

func Load() Config {
	return Config{
		AppName:           env("APP_NAME", "NEXA ERP API"),
		Environment:       env("APP_ENV", "development"),
		HTTPAddr:          env("HTTP_ADDR", ":8080"),
		AllowedOrigins:    csv(env("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")),
		PostgresHost:      env("POSTGRES_HOST", "postgres"),
		PostgresPort:      env("POSTGRES_PORT", "5432"),
		PostgresDB:        env("POSTGRES_DB", "nexa_erp"),
		PostgresUser:      env("POSTGRES_USER", "nexa"),
		PostgresPassword:  env("POSTGRES_PASSWORD", ""),
		RedisHost:         env("REDIS_HOST", "redis"),
		RedisPort:         env("REDIS_PORT", "6379"),
		JWTSecret: env("JWT_SECRET", ""),
		JWTIssuer:         env("JWT_ISSUER", "nexa-erp"),
		TokenTTL:          duration("JWT_TTL", 8*time.Hour),
		BootstrapUser:     env("BOOTSTRAP_USERNAME", "admin"),
		BootstrapPassword: env("BOOTSTRAP_PASSWORD", "admin-change-me"),
		BootstrapName:     env("BOOTSTRAP_NAME", "ERP Administrator"),
		BootstrapRoles:    csv(env("BOOTSTRAP_ROLES", "GROUP_ADMIN")),
		BootstrapEntities: csv(env("BOOTSTRAP_ENTITIES", "NDU,NDT")),
		BootstrapSites:    csv(env("BOOTSTRAP_SITES", "JKT-HO,CKR-DC,TGR-WH,SBY-BR,GRK-WH")),
		FacePython:        env("FACE_PYTHON", ""),
		FaceModelsDir:     env("FACE_MODELS_DIR", ""),
		FaceTemplateKey:   env("FACE_TEMPLATE_KEY", ""),
		WebAuthnRPID:      env("WEBAUTHN_RP_ID", "localhost"),
		WebAuthnRPOrigin:  env("WEBAUTHN_RP_ORIGIN", "http://localhost:5173"),
		ReadyCheckTimeout: duration("READY_CHECK_TIMEOUT", 1500*time.Millisecond),
	}
}

func (c Config) Validate() error {
	if len(c.JWTSecret) < 32 {
		return errors.New("JWT_SECRET must be at least 32 characters")
	}
	if strings.EqualFold(c.Environment, "production") {
		if strings.Contains(strings.ToLower(c.JWTSecret), "change-this") || strings.Contains(strings.ToLower(c.JWTSecret), "dev-only") {
			return errors.New("unsafe JWT_SECRET is not allowed in production")
		}

	}
	if c.HTTPAddr == "" {
		return errors.New("HTTP_ADDR is required")
	}
	return nil
}

func (c Config) PostgresURL() string {
	return "postgres://" + url.QueryEscape(c.PostgresUser) + ":" + url.QueryEscape(c.PostgresPassword) + "@" + c.PostgresHost + ":" + c.PostgresPort + "/" + c.PostgresDB + "?sslmode=disable"
}

func env(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func csv(value string) []string {
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}

func duration(key string, fallback time.Duration) time.Duration {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	if parsed, err := time.ParseDuration(value); err == nil {
		return parsed
	}
	if seconds, err := strconv.Atoi(value); err == nil {
		return time.Duration(seconds) * time.Second
	}
	return fallback
}
