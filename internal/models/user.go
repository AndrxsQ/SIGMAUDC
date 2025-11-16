package models

import (
	"database/sql"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Usuario struct {
	ID          int            `json:"id"`
	Codigo      string         `json:"codigo"`
	Email       string         `json:"email"`
	PasswordHash sql.NullString `json:"-"`
	Rol         string         `json:"rol"`
	ProgramaID  int            `json:"programa_id"`
}

type LoginRequest struct {
	Codigo   string `json:"codigo"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token                string `json:"token,omitempty"`
	RequiresPasswordSetup bool   `json:"requiresPasswordSetup,omitempty"`
	UserID               int    `json:"userId,omitempty"`
	Message              string `json:"message,omitempty"`
	ErrorType            string `json:"errorType,omitempty"` // "user_not_found", "wrong_password", "connection_error"
}

type SetPasswordRequest struct {
	UserID      int    `json:"userId"`
	NewPassword string `json:"newPassword"`
}

type SetPasswordResponse struct {
	Success bool   `json:"success"`
	Token   string `json:"token,omitempty"`
	Message string `json:"message,omitempty"`
}

type Auditoria struct {
	ID          int       `json:"id"`
	UsuarioID   sql.NullInt64 `json:"usuario_id"`
	Accion      string    `json:"accion"`
	Descripcion string    `json:"descripcion"`
	Fecha       time.Time `json:"fecha"`
	IP          string    `json:"ip"`
	UserAgent   string    `json:"user_agent"`
}

type JWTClaims struct {
	jwt.RegisteredClaims
	Sub        int    `json:"sub"`
	Codigo     string `json:"codigo"`
	Rol        string `json:"rol"`
	ProgramaID int    `json:"programa_id"`
}

