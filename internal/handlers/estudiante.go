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

	"github.com/andrxsq/SIGMAUDC/internal/models"
)

type EstudianteHandler struct {
	db *sql.DB
}

func NewEstudianteHandler(db *sql.DB) *EstudianteHandler {
	return &EstudianteHandler{db: db}
}

func (h *EstudianteHandler) getClaims(r *http.Request) (*models.JWTClaims, error) {
	claims, ok := r.Context().Value("claims").(*models.JWTClaims)
	if !ok || claims == nil {
		return nil, errors.New("unauthorized")
	}
	return claims, nil
}

func (h *EstudianteHandler) getEstudianteID(usuarioID int) (int, error) {
	var estudianteID int
	err := h.db.QueryRow(`SELECT id FROM estudiante WHERE usuario_id = $1`, usuarioID).Scan(&estudianteID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, errors.New("estudiante no encontrado")
		}
		return 0, err
	}
	return estudianteID, nil
}

type EstudianteDatosResponse struct {
	EstudianteID int      `json:"estudiante_id"`
	Codigo       string   `json:"codigo"`
	Nombre       string   `json:"nombre"`
	Apellido     string   `json:"apellido"`
	Email        string   `json:"email"`
	Programa     string   `json:"programa"`
	Semestre     int      `json:"semestre"`
	Promedio     *float64 `json:"promedio,omitempty"`
	Estado       string   `json:"estado"`
	Sexo         string   `json:"sexo"`
	FotoPerfil   string   `json:"foto_perfil"`
}

func (h *EstudianteHandler) GetDatosEstudiante(w http.ResponseWriter, r *http.Request) {
	claims, err := h.getClaims(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if claims.Rol != "estudiante" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	query := `
		SELECT
			e.id,
			u.codigo,
			u.nombre,
			u.apellido,
			u.email,
			COALESCE(p.nombre, '') AS programa,
			e.semestre,
			e.promedio,
			e.estado,
			COALESCE(e.sexo, 'otro'),
			COALESCE(e.foto_perfil, '')
		FROM usuario u
		JOIN estudiante e ON e.usuario_id = u.id
		LEFT JOIN programa p ON p.id = u.programa_id
		WHERE u.id = $1
	`
	var datos EstudianteDatosResponse
	var promedio sql.NullFloat64
	err = h.db.QueryRow(query, claims.Sub).Scan(
		&datos.EstudianteID,
		&datos.Codigo,
		&datos.Nombre,
		&datos.Apellido,
		&datos.Email,
		&datos.Programa,
		&datos.Semestre,
		&promedio,
		&datos.Estado,
		&datos.Sexo,
		&datos.FotoPerfil,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "Estudiante no encontrado", http.StatusNotFound)
			return
		}
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if promedio.Valid {
		datos.Promedio = &promedio.Float64
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(datos)
}

type UpdateDatosRequest struct {
	Nombre   string `json:"nombre"`
	Apellido string `json:"apellido"`
	Sexo     string `json:"sexo"`
}

var allowedSexos = map[string]struct{}{
	"masculino": {},
	"femenino":  {},
	"otro":      {},
}

func (h *EstudianteHandler) UpdateDatosEstudiante(w http.ResponseWriter, r *http.Request) {
	claims, err := h.getClaims(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if claims.Rol != "estudiante" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var payload UpdateDatosRequest
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

	updateUsuario := `UPDATE usuario SET nombre = $1, apellido = $2 WHERE id = $3`
	if _, err := tx.Exec(updateUsuario, payload.Nombre, payload.Apellido, claims.Sub); err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	estudianteID, err := h.getEstudianteID(claims.Sub)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	updateEstudiante := `UPDATE estudiante SET sexo = $1 WHERE id = $2`
	if _, err := tx.Exec(updateEstudiante, sexo, estudianteID); err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *EstudianteHandler) SubirFotoEstudiante(w http.ResponseWriter, r *http.Request) {
	claims, err := h.getClaims(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if claims.Rol != "estudiante" {
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

	estudianteID, err := h.getEstudianteID(claims.Sub)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	dir := filepath.Join("uploads", "profiles", fmt.Sprintf("%d", estudianteID))
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

	photoURL := fmt.Sprintf("/uploads/profiles/%d/%s", estudianteID, filename)
	update := `UPDATE estudiante SET foto_perfil = $1 WHERE id = $2`
	if _, err := h.db.Exec(update, photoURL, estudianteID); err != nil {
		http.Error(w, "No se pudo guardar la ruta en la base de datos", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"foto_perfil": photoURL})
}
