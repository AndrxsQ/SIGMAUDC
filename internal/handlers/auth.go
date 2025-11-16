package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/andrxsq/SIGMAUDC/internal/models"
	"github.com/andrxsq/SIGMAUDC/internal/utils"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	db        *sql.DB
	jwtSecret string
}

func NewAuthHandler(db *sql.DB, jwtSecret string) *AuthHandler {
	return &AuthHandler{
		db:        db,
		jwtSecret: jwtSecret,
	}
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Obtener IP y User-Agent para auditoría
	ip := utils.GetIPAddress(r)
	userAgent := r.UserAgent()

	// Buscar usuario por código
	var usuario models.Usuario
	query := `SELECT id, codigo, email, password_hash, rol, programa_id 
			  FROM usuario WHERE codigo = $1`

	err := h.db.QueryRow(query, req.Codigo).Scan(
		&usuario.ID,
		&usuario.Codigo,
		&usuario.Email,
		&usuario.PasswordHash,
		&usuario.Rol,
		&usuario.ProgramaID,
	)

	if errors.Is(err, sql.ErrNoRows) {
		// Usuario no existe - registrar auditoría
		h.registrarAuditoria(0, "login_fallido", "Usuario no encontrado: "+req.Codigo, ip, userAgent)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(models.LoginResponse{
			Message:   "El código de usuario no existe en el sistema",
			ErrorType: "user_not_found",
		})
		return
	}

	if err != nil {
		// Error de base de datos
		h.registrarAuditoria(0, "login_fallido", "Error de base de datos: "+err.Error(), ip, userAgent)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(models.LoginResponse{
			Message:   "Error de conexión con el servidor. Por favor intenta más tarde",
			ErrorType: "connection_error",
		})
		return
	}

	// Verificar si password_hash es NULL (primer inicio de sesión)
	if !usuario.PasswordHash.Valid || usuario.PasswordHash.String == "" {
		// Primer inicio de sesión - requiere crear contraseña
		h.registrarAuditoria(usuario.ID, "login_fallido", "Intento de login sin contraseña configurada", ip, userAgent)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(models.LoginResponse{
			RequiresPasswordSetup: true,
			UserID:                usuario.ID,
		})
		return
	}

	// Verificar contraseña
	if err := bcrypt.CompareHashAndPassword(
		[]byte(usuario.PasswordHash.String),
		[]byte(req.Password),
	); err != nil {
		// Contraseña incorrecta
		h.registrarAuditoria(usuario.ID, "login_fallido", "Contraseña incorrecta", ip, userAgent)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(models.LoginResponse{
			Message:   "La contraseña ingresada es incorrecta",
			ErrorType: "wrong_password",
		})
		return
	}

	// Login exitoso - generar JWT
	token, err := h.generateJWT(usuario)
	if err != nil {
		http.Error(w, "Error generating token", http.StatusInternalServerError)
		return
	}

	// Registrar auditoría de login exitoso
	h.registrarAuditoria(usuario.ID, "login_exitoso", "Inicio de sesión exitoso", ip, userAgent)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.LoginResponse{
		Token: token,
	})
}

func (h *AuthHandler) SetPassword(w http.ResponseWriter, r *http.Request) {
	var req models.SetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validar que la contraseña tenga al menos 6 caracteres
	if len(req.NewPassword) < 6 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(models.SetPasswordResponse{
			Success: false,
			Message: "La contraseña debe tener al menos 6 caracteres",
		})
		return
	}

	// Hashear la contraseña
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Error hashing password", http.StatusInternalServerError)
		return
	}

	// Actualizar password_hash en la BD
	updateQuery := `UPDATE usuario SET password_hash = $1 WHERE id = $2`
	_, err = h.db.Exec(updateQuery, string(hashedPassword), req.UserID)
	if err != nil {
		http.Error(w, "Error updating password", http.StatusInternalServerError)
		return
	}

	// Obtener información del usuario para generar JWT
	var usuario models.Usuario
	query := `SELECT id, codigo, email, rol, programa_id FROM usuario WHERE id = $1`
	err = h.db.QueryRow(query, req.UserID).Scan(
		&usuario.ID,
		&usuario.Codigo,
		&usuario.Email,
		&usuario.Rol,
		&usuario.ProgramaID,
	)
	if err != nil {
		http.Error(w, "Error fetching user", http.StatusInternalServerError)
		return
	}

	// Generar JWT
	token, err := h.generateJWT(usuario)
	if err != nil {
		http.Error(w, "Error generating token", http.StatusInternalServerError)
		return
	}

	// Registrar auditoría
	ip := utils.GetIPAddress(r)
	userAgent := r.UserAgent()
	h.registrarAuditoria(usuario.ID, "cambio_contraseña", "Creación de contraseña inicial", ip, userAgent)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.SetPasswordResponse{
		Success: true,
		Token:   token,
	})
}

func (h *AuthHandler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	// El usuario viene del contexto del middleware JWT
	claims, ok := r.Context().Value("claims").(*models.JWTClaims)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Obtener información completa del usuario
	var usuario models.Usuario
	query := `SELECT id, codigo, email, rol, programa_id FROM usuario WHERE id = $1`
	err := h.db.QueryRow(query, claims.Sub).Scan(
		&usuario.ID,
		&usuario.Codigo,
		&usuario.Email,
		&usuario.Rol,
		&usuario.ProgramaID,
	)
	if err != nil {
		http.Error(w, "Error fetching user", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(usuario)
}

func (h *AuthHandler) generateJWT(usuario models.Usuario) (string, error) {
	expirationTime := time.Now().Add(1 * time.Hour)
	claims := &models.JWTClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.Itoa(usuario.ID),
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
		Sub:        usuario.ID,
		Codigo:     usuario.Codigo,
		Rol:        usuario.Rol,
		ProgramaID: usuario.ProgramaID,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.jwtSecret))
}

func (h *AuthHandler) registrarAuditoria(usuarioID int, accion, descripcion, ip, userAgent string) {
	var userID sql.NullInt64
	if usuarioID > 0 {
		userID = sql.NullInt64{Int64: int64(usuarioID), Valid: true}
	}

	query := `INSERT INTO auditoria (usuario_id, accion, descripcion, ip, user_agent) 
			  VALUES ($1, $2, $3, $4, $5)`
	_, err := h.db.Exec(query, userID, accion, descripcion, ip, userAgent)
	if err != nil {
		// Log error pero no fallar la operación principal
		// En producción, usar un logger apropiado
	}
}
