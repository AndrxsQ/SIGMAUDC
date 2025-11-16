package config

import (
	"os"
)

type Config struct {
	DatabaseURL string
	JWTSecret   string
	Port        string
}

func Load() *Config {
	// Obtener variables de entorno - NO usar valores por defecto con información sensible
	databaseURL := getEnv("DATABASE_URL", "")
	jwtSecret := getEnv("JWT_SECRET", "")
	port := getEnv("PORT", "8080")

	// Validar que las variables críticas estén configuradas
	if databaseURL == "" {
		panic("DATABASE_URL no está configurada en el archivo .env")
	}
	if jwtSecret == "" {
		panic("JWT_SECRET no está configurada en el archivo .env")
	}

	return &Config{
		DatabaseURL: databaseURL,
		JWTSecret:   jwtSecret,
		Port:        port,
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
