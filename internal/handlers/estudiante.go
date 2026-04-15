// Package handlers – EstudianteHandler
// Gestiona las peticiones relacionadas con datos y perfil del estudiante.
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

	"github.com/andrxsq/SIGMAUDC/internal/constants"
)

// EstudianteHandler gestiona las peticiones HTTP relacionadas con el perfil
// y datos personales del estudiante.
type EstudianteHandler struct {
	db *sql.DB
}

// NewEstudianteHandler crea una nueva instancia de EstudianteHandler.
func NewEstudianteHandler(db *sql.DB) *EstudianteHandler {
	return &EstudianteHandler{db: db}
}

// getEstudianteID obtiene el ID interno del estudiante a partir del ID de usuario.
// Retorna un error descriptivo si el estudiante no existe en la base de datos.
func (h *EstudianteHandler) getEstudianteID(usuarioID int) (int, error) {
	var estudianteID int
	err := h.db.QueryRow(
		`SELECT id FROM estudiante WHERE usuario_id = $1`, usuarioID,
	).Scan(&estudianteID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, errors.New("estudiante no encontrado")
		}
		return 0, err
	}
	return estudianteID, nil
}

// EstudianteDatosResponse es el DTO de respuesta para GET /api/estudiante/datos.
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

// GetDatosEstudiante retorna los datos personales y académicos del estudiante autenticado.
//
// Requiere: rol "estudiante".
// Responde con EstudianteDatosResponse en JSON.
func (h *EstudianteHandler) GetDatosEstudiante(w http.ResponseWriter, r *http.Request) {
	claims, err := getClaims(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if claims.Rol != constants.RolEstudiante {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	query := `
		SELECT
			e.id,
			u.codigo,
			COALESCE(e.nombre, ''),
			COALESCE(e.apellido, ''),
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

// UpdateDatosRequest es el body esperado en PUT /api/estudiante/datos.
type UpdateDatosRequest struct {
	Nombre   string `json:"nombre"`
	Apellido string `json:"apellido"`
	Sexo     string `json:"sexo"`
}

// UpdateDatosEstudiante actualiza el nombre, apellido y sexo del estudiante autenticado.
//
// Requiere: rol "estudiante".
// Responde con 204 No Content si la actualización es exitosa.
func (h *EstudianteHandler) UpdateDatosEstudiante(w http.ResponseWriter, r *http.Request) {
	claims, err := getClaims(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if claims.Rol != constants.RolEstudiante {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var payload UpdateDatosRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Payload inválido", http.StatusBadRequest)
		return
	}

	// Normalizar y validar sexo usando la lista de valores permitidos del paquete constants.
	sexo := strings.TrimSpace(strings.ToLower(payload.Sexo))
	if sexo == "" {
		sexo = "otro"
	}
	if _, ok := constants.SexosPermitidos[sexo]; !ok {
		http.Error(w, "Valor de sexo inválido", http.StatusBadRequest)
		return
	}

	tx, err := h.db.Begin()
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	estudianteID, err := h.getEstudianteID(claims.Sub)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	updateEstudiante := `UPDATE estudiante SET nombre = $1, apellido = $2, sexo = $3 WHERE id = $4`
	if _, err := tx.Exec(updateEstudiante, payload.Nombre, payload.Apellido, sexo, estudianteID); err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// SubirFotoEstudiante reemplaza la foto de perfil del estudiante autenticado.
//
// Requiere: rol "estudiante", form-data con campo "foto" (JPG, JPEG o PNG, máx. 8 MB).
// Responde con la URL pública de la foto en JSON.
func (h *EstudianteHandler) SubirFotoEstudiante(w http.ResponseWriter, r *http.Request) {
	claims, err := getClaims(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if claims.Rol != constants.RolEstudiante {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	if err := r.ParseMultipartForm(constants.MaxFotoBytes); err != nil {
		http.Error(w, "No se pudo procesar el archivo", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("foto")
	if err != nil {
		http.Error(w, "Debes subir una imagen", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Validar extensión contra la lista centralizada de extensiones permitidas.
	ext := strings.ToLower(filepath.Ext(header.Filename))
	extValida := false
	for _, e := range constants.ExtensionesFoto {
		if ext == e {
			extValida = true
			break
		}
	}
	if !extValida {
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
