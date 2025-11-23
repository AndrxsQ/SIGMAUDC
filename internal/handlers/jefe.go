package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/andrxsq/SIGMAUDC/internal/middleware"
	"github.com/andrxsq/SIGMAUDC/internal/models"
)

type JefeHandler struct {
	db *sql.DB
}

func NewJefeHandler(db *sql.DB) *JefeHandler {
	return &JefeHandler{db: db}
}

func (h *JefeHandler) getClaims(r *http.Request) (*models.JWTClaims, error) {
	claims, ok := middleware.GetClaimsFromContext(r.Context())
	if !ok {
		return nil, errors.New("unauthorized")
	}
	return claims, nil
}

func (h *JefeHandler) getJefeID(usuarioID int) (int, error) {
	var jefeID int
	err := h.db.QueryRow(`SELECT id FROM jefe_departamental WHERE usuario_id = $1`, usuarioID).Scan(&jefeID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, errors.New("jefe departamental no encontrado")
		}
		return 0, err
	}
	return jefeID, nil
}

type JefeDatosResponse struct {
	JefeID      int    `json:"jefe_id"`
	Codigo      string `json:"codigo"`
	Nombre      string `json:"nombre"`
	Apellido    string `json:"apellido"`
	Email       string `json:"email"`
	Programa    string `json:"programa"`
	Sexo        string `json:"sexo"`
	FotoPerfil  string `json:"foto_perfil"`
}

func (h *JefeHandler) GetDatosJefe(w http.ResponseWriter, r *http.Request) {
	claims, err := h.getClaims(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if claims.Rol != "jefe_departamental" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	query := `
		SELECT
			jd.id,
			u.codigo,
			COALESCE(jd.nombre, ''),
			COALESCE(jd.apellido, ''),
			u.email,
			COALESCE(p.nombre, '') AS programa,
			COALESCE(jd.sexo, 'otro'),
			COALESCE(jd.foto_perfil, '')
		FROM usuario u
		JOIN jefe_departamental jd ON jd.usuario_id = u.id
		LEFT JOIN programa p ON p.id = u.programa_id
		WHERE u.id = $1
	`
	var datos JefeDatosResponse
	err = h.db.QueryRow(query, claims.Sub).Scan(
		&datos.JefeID,
		&datos.Codigo,
		&datos.Nombre,
		&datos.Apellido,
		&datos.Email,
		&datos.Programa,
		&datos.Sexo,
		&datos.FotoPerfil,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "Jefe departamental no encontrado", http.StatusNotFound)
			return
		}
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(datos)
}

type UpdateDatosJefeRequest struct {
	Nombre   string `json:"nombre"`
	Apellido string `json:"apellido"`
	Sexo     string `json:"sexo"`
}

var allowedSexos = map[string]struct{}{
	"masculino": {},
	"femenino":  {},
	"otro":      {},
}

func (h *JefeHandler) UpdateDatosJefe(w http.ResponseWriter, r *http.Request) {
	claims, err := h.getClaims(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if claims.Rol != "jefe_departamental" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var payload UpdateDatosJefeRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Payload inválido", http.StatusBadRequest)
		return
	}

	sexo := strings.TrimSpace(strings.ToLower(payload.Sexo))
	if sexo == "" {
		sexo = "otro"
	}
	if _, ok := allowedSexos[sexo]; !ok {
		http.Error(w, "Valor de sexo inválido", http.StatusBadRequest)
		return
	}

	tx, err := h.db.Begin()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	jefeID, err := h.getJefeID(claims.Sub)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	updateJefe := `UPDATE jefe_departamental SET nombre = $1, apellido = $2, sexo = $3 WHERE id = $4`
	if _, err := tx.Exec(updateJefe, payload.Nombre, payload.Apellido, sexo, jefeID); err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *JefeHandler) SubirFotoJefe(w http.ResponseWriter, r *http.Request) {
	claims, err := h.getClaims(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if claims.Rol != "jefe_departamental" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	if err := r.ParseMultipartForm(8 << 20); err != nil {
		http.Error(w, "No se pudo procesar el archivo", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("foto")
	if err != nil {
		http.Error(w, "Debes subir una imagen", http.StatusBadRequest)
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" {
		http.Error(w, "Formato de imagen no permitido", http.StatusBadRequest)
		return
	}

	jefeID, err := h.getJefeID(claims.Sub)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	dir := filepath.Join("uploads", "profiles", "jefes", fmt.Sprintf("%d", jefeID))
	if err := os.MkdirAll(dir, 0755); err != nil {
		http.Error(w, "No se pudo crear carpeta de usuario", http.StatusInternalServerError)
		return
	}

	filename := fmt.Sprintf("profile%s", ext)
	destPath := filepath.Join(dir, filename)

	dst, err := os.Create(destPath)
	if err != nil {
		http.Error(w, "No se pudo guardar la imagen", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, "No se pudo guardar la imagen", http.StatusInternalServerError)
		return
	}

	photoURL := fmt.Sprintf("/uploads/profiles/jefes/%d/%s", jefeID, filename)
	update := `UPDATE jefe_departamental SET foto_perfil = $1 WHERE id = $2`
	if _, err := h.db.Exec(update, photoURL, jefeID); err != nil {
		http.Error(w, "No se pudo guardar la ruta en la base de datos", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"foto_perfil": photoURL})
}

