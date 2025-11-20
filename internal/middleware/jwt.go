package middleware

import (
	"context"
	"log"
	"net/http"
	"strings"

	"github.com/andrxsq/SIGMAUDC/internal/models"
	"github.com/golang-jwt/jwt/v5"
)

func JWTAuthMiddleware(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			log.Printf("🔍 Middleware JWT - Ruta: %s %s", r.Method, r.URL.Path)
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				log.Printf("❌ Middleware JWT - No Authorization header en %s", r.URL.Path)
				http.Error(w, "Authorization header required", http.StatusUnauthorized)
				return
			}

			// Extraer el token del header "Bearer <token>"
			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				http.Error(w, "Invalid authorization header format", http.StatusUnauthorized)
				return
			}

			tokenString := parts[1]

			// Parsear y validar el token
			claims := &models.JWTClaims{}
			token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
				// Verificar el método de firma
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, jwt.ErrSignatureInvalid
				}
				return []byte(jwtSecret), nil
			})

			if err != nil || !token.Valid {
				log.Printf("❌ Middleware JWT - Token inválido o expirado en %s: %v", r.URL.Path, err)
				http.Error(w, "Invalid or expired token", http.StatusUnauthorized)
				return
			}

			log.Printf("✅ Middleware JWT - Token válido, pasando a handler para %s", r.URL.Path)
			// Agregar los claims al contexto
			ctx := context.WithValue(r.Context(), "claims", claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

