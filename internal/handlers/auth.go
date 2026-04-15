// Package handlers – AuthHandler
// Gestiona la autenticación de usuarios: login y configuración inicial de contraseña.
package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/andrxsq/SIGMAUDC/internal/middleware"
	"github.com/andrxsq/SIGMAUDC/internal/models"
	"github.com/andrxsq/SIGMAUDC/internal/services"
	"github.com/andrxsq/SIGMAUDC/internal/utils"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// AuthHandler gestiona las peticiones de autenticación del sistema.
//
// Principios aplicados:
//   - SRP: solo se ocupa de autenticación; la auditoría es delegada al AuditoriaService.
//   - DIP: depende de AuditoriaService (abstracción), no implementa la lógica de auditoría.
type AuthHandler struct {
	db        *sql.DB
	jwtSecret string
	auditoria *services.AuditoriaService
}

// NewAuthHandler crea una nueva instancia de AuthHandler con sus dependencias inyectadas.
func NewAuthHandler(db *sql.DB, jwtSecret string, auditoria *services.AuditoriaService) *AuthHandler {
	return &AuthHandler{
		db:        db,
		jwtSecret: jwtSecret,
		auditoria: auditoria,
	}
}

// Login autentica a un usuario por código y contraseña.
//
// POST /auth/login
// Body: models.LoginRequest
//
// Flujos posibles:
//   - Usuario no existe → 401 con errorType "user_not_found".
//   - Usuario sin contraseña → 200 con requiresPasswordSetup: true.
//   - Contraseña incorrecta → 401 con errorType "wrong_password".
//   - Éxito → 200 con token JWT.
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	ip := utils.GetIPAddress(r)
	userAgent := r.UserAgent()

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
		h.auditoria.Registrar(0, "login_fallido", "Usuario no encontrado: "+req.Codigo, ip, userAgent)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(models.LoginResponse{
			Message:   "El código de usuario no existe en el sistema",
			ErrorType: "user_not_found",
		})
		return
	}

	if err != nil {
		h.auditoria.Registrar(0, "login_fallido", "Error de base de datos: "+err.Error(), ip, userAgent)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(models.LoginResponse{
			Message:   "Error de conexión con el servidor. Por favor intenta más tarde",
			ErrorType: "connection_error",
		})
		return
	}

	// Primer inicio de sesión: el usuario aún no tiene contraseña configurada.
	if !usuario.PasswordHash.Valid || usuario.PasswordHash.String == "" {
		h.auditoria.Registrar(usuario.ID, "login_fallido", "Intento de login sin contraseña configurada", ip, userAgent)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(models.LoginResponse{
			RequiresPasswordSetup: true,
			UserID:                usuario.ID,
		})
		return
	}

	// Verificar contraseña con bcrypt.
	if err := bcrypt.CompareHashAndPassword(
		[]byte(usuario.PasswordHash.String),
		[]byte(req.Password),
	); err != nil {
		h.auditoria.Registrar(usuario.ID, "login_fallido", "Contraseña incorrecta", ip, userAgent)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(models.LoginResponse{
			Message:   "La contraseña ingresada es incorrecta",
			ErrorType: "wrong_password",
		})
		return
	}

	token, err := h.generateJWT(usuario)
	if err != nil {
		http.Error(w, "Error generating token", http.StatusInternalServerError)
		return
	}

	h.auditoria.Registrar(usuario.ID, "login_exitoso", "Inicio de sesión exitoso", ip, userAgent)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.LoginResponse{Token: token})
}

// SetPassword establece la contraseña inicial de un usuario en su primer acceso.
//
// POST /auth/set-password
// Body: models.SetPasswordRequest
//
// Valida que el userId, código y email coincidan con los datos en BD,
// y que el usuario aún no tenga contraseña configurada.
func (h *AuthHandler) SetPassword(w http.ResponseWriter, r *http.Request) {
	var req models.SetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	var usuario models.Usuario
	var passwordHash sql.NullString
	query := `SELECT id, codigo, email, password_hash, rol, programa_id FROM usuario WHERE id = $1`
	err := h.db.QueryRow(query, req.UserID).Scan(
		&usuario.ID,
		&usuario.Codigo,
		&usuario.Email,
		&passwordHash,
		&usuario.Rol,
		&usuario.ProgramaID,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(models.SetPasswordResponse{
				Success: false,
				Message: "Usuario no encontrado",
			})
			return
		}
		http.Error(w, "Error fetching user", http.StatusInternalServerError)
		return
	}

	ip := utils.GetIPAddress(r)
	userAgent := r.UserAgent()

	// Validar que el código coincida.
	if strings.TrimSpace(req.Codigo) != strings.TrimSpace(usuario.Codigo) {
		h.auditoria.Registrar(req.UserID, "verificacion_codigo_fallida", "Código no coincide al crear contraseña", ip, userAgent)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(models.SetPasswordResponse{
			Success: false,
			Message: "El código ingresado no coincide con el código del usuario",
		})
		return
	}

	// Solo usuarios sin contraseña previa pueden usar este endpoint.
	if passwordHash.Valid && passwordHash.String != "" {
		h.auditoria.Registrar(req.UserID, "intento_crear_contraseña_existente", "Intento de crear contraseña cuando ya existe", ip, userAgent)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(models.SetPasswordResponse{
			Success: false,
			Message: "Este usuario ya tiene una contraseña configurada",
		})
		return
	}

	if strings.TrimSpace(req.Email) == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(models.SetPasswordResponse{
			Success: false,
			Message: "El correo electrónico es requerido",
		})
		return
	}

	// Normalizar correctamente antes de comparar (minúsculas + trim).
	emailIngresado := strings.ToLower(strings.TrimSpace(req.Email))
	emailBD := strings.ToLower(strings.TrimSpace(usuario.Email))

	if emailBD == "" {
		log.Printf("[SetPassword] ERROR CRÍTICO: Email en BD está vacío para UserID: %d", req.UserID)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(models.SetPasswordResponse{
			Success: false,
			Message: "Error interno: correo del usuario no encontrado en la base de datos",
		})
		return
	}

	log.Printf("[SetPassword] Validando correo - UserID: %d, Codigo: %s", req.UserID, req.Codigo)
	log.Printf("[SetPassword] Email ingresado (normalizado): '%s' (longitud: %d)", emailIngresado, len(emailIngresado))
	log.Printf("[SetPassword] Email BD (normalizado): '%s' (longitud: %d)", emailBD, len(emailBD))

	if emailIngresado != emailBD {
		descripcion := fmt.Sprintf(
			"Correo no coincide: ingresado='%s' (len=%d), esperado='%s' (len=%d), usuario_id=%d, codigo=%s",
			emailIngresado, len(emailIngresado), emailBD, len(emailBD), req.UserID, req.Codigo,
		)
		h.auditoria.Registrar(req.UserID, "verificacion_correo_fallida", descripcion, ip, userAgent)

		log.Printf("[SetPassword] ERROR: Correo no coincide")
		log.Printf("[SetPassword]   - Email ingresado: '%s' (longitud: %d)", emailIngresado, len(emailIngresado))
		log.Printf("[SetPassword]   - Email BD: '%s' (longitud: %d)", emailBD, len(emailBD))
		log.Printf("[SetPassword]   - Son iguales?: %v", emailIngresado == emailBD)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(models.SetPasswordResponse{
			Success: false,
			Message: "El correo electrónico no coincide con el registrado para este código",
		})
		return
	}

	log.Printf("[SetPassword] ✓ Correo validado correctamente para UserID: %d", req.UserID)

	// Validar requisitos de la contraseña (mínimo 8 caracteres, alfanumérica).
	valid, message := utils.ValidatePassword(req.NewPassword)
	if !valid {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(models.SetPasswordResponse{
			Success: false,
			Message: message,
		})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Error hashing password", http.StatusInternalServerError)
		return
	}

	updateQuery := `UPDATE usuario SET password_hash = $1 WHERE id = $2`
	if _, err = h.db.Exec(updateQuery, string(hashedPassword), req.UserID); err != nil {
		http.Error(w, "Error updating password", http.StatusInternalServerError)
		return
	}

	token, err := h.generateJWT(usuario)
	if err != nil {
		http.Error(w, "Error generating token", http.StatusInternalServerError)
		return
	}

	h.auditoria.Registrar(usuario.ID, "cambio_contraseña", "Creación de contraseña inicial", ip, userAgent)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.SetPasswordResponse{
		Success: true,
		Token:   token,
	})
}

// GetCurrentUser retorna los datos del usuario autenticado extraídos del JWT + BD.
//
// GET /api/me
// Requiere: cabecera Authorization con token JWT válido.
func (h *AuthHandler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.GetClaimsFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var usuario models.Usuario
	var nombre, apellido sql.NullString

	query := `
		SELECT
			u.id,
			u.codigo,
			u.email,
			u.rol,
			u.programa_id,
			p.nombre as programa_nombre,
			COALESCE(jd.nombre, e.nombre) as nombre,
			COALESCE(jd.apellido, e.apellido) as apellido
		FROM usuario u
		INNER JOIN programa p ON u.programa_id = p.id
		LEFT JOIN jefe_departamental jd ON u.id = jd.usuario_id
		LEFT JOIN estudiante e ON u.id = e.usuario_id
		WHERE u.id = $1
	`
	err := h.db.QueryRow(query, claims.Sub).Scan(
		&usuario.ID,
		&usuario.Codigo,
		&usuario.Email,
		&usuario.Rol,
		&usuario.ProgramaID,
		&usuario.ProgramaNombre,
		&nombre,
		&apellido,
	)
	if err != nil {
		http.Error(w, "Error fetching user", http.StatusInternalServerError)
		return
	}

	if nombre.Valid {
		usuario.Nombre = nombre.String
	}
	if apellido.Valid {
		usuario.Apellido = apellido.String
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(usuario)
}

// generateJWT genera un token JWT firmado para el usuario dado.
// El token tiene una validez de 24 horas.
func (h *AuthHandler) generateJWT(usuario models.Usuario) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour)
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
