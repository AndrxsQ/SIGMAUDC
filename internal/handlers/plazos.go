package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/andrxsq/SIGMAUDC/internal/models"
	"github.com/gorilla/mux"
)

type PlazosHandler struct {
	db *sql.DB
}

func NewPlazosHandler(db *sql.DB) *PlazosHandler {
	return &PlazosHandler{db: db}
}

// GetPeriodos obtiene todos los periodos académicos
func (h *PlazosHandler) GetPeriodos(w http.ResponseWriter, r *http.Request) {
	query := `SELECT id, year, semestre, activo FROM periodo_academico ORDER BY year DESC, semestre DESC`
	rows, err := h.db.Query(query)
	if err != nil {
		http.Error(w, "Error fetching periodos", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var periodos []models.PeriodoAcademico
	for rows.Next() {
		var p models.PeriodoAcademico
		if err := rows.Scan(&p.ID, &p.Year, &p.Semestre, &p.Activo); err != nil {
			log.Printf("Error scanning periodo: %v", err)
			continue
		}
		periodos = append(periodos, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(periodos)
}

// GetPeriodoActivo obtiene el periodo académico activo
func (h *PlazosHandler) GetPeriodoActivo(w http.ResponseWriter, r *http.Request) {
	var periodo models.PeriodoAcademico
	query := `SELECT id, year, semestre, activo FROM periodo_academico WHERE activo = true LIMIT 1`
	err := h.db.QueryRow(query).Scan(&periodo.ID, &periodo.Year, &periodo.Semestre, &periodo.Activo)
	
	if err == sql.ErrNoRows {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(nil)
		return
	}
	
	if err != nil {
		http.Error(w, "Error fetching periodo activo", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(periodo)
}

// CreatePeriodo crea un nuevo periodo académico
func (h *PlazosHandler) CreatePeriodo(w http.ResponseWriter, r *http.Request) {
	var req models.CreatePeriodoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validar semestre (1 o 2)
	if req.Semestre != 1 && req.Semestre != 2 {
		http.Error(w, "Semestre debe ser 1 o 2", http.StatusBadRequest)
		return
	}

	// Verificar si ya existe un periodo con el mismo año y semestre
	var exists int
	checkQuery := `SELECT COUNT(*) FROM periodo_academico WHERE year = $1 AND semestre = $2`
	err := h.db.QueryRow(checkQuery, req.Year, req.Semestre).Scan(&exists)
	if err != nil {
		http.Error(w, "Error checking periodo", http.StatusInternalServerError)
		return
	}
	if exists > 0 {
		http.Error(w, "Ya existe un periodo con ese año y semestre", http.StatusConflict)
		return
	}

	// Crear el periodo (inactivo por defecto)
	var periodo models.PeriodoAcademico
	insertQuery := `INSERT INTO periodo_academico (year, semestre, activo) VALUES ($1, $2, false) RETURNING id, year, semestre, activo`
	err = h.db.QueryRow(insertQuery, req.Year, req.Semestre).Scan(
		&periodo.ID, &periodo.Year, &periodo.Semestre, &periodo.Activo,
	)
	if err != nil {
		http.Error(w, "Error creating periodo", http.StatusInternalServerError)
		return
	}

	// Crear los plazos asociados (todos en false por defecto)
	plazosQuery := `INSERT INTO plazos (periodo_id, documentos, inscripcion, modificaciones) VALUES ($1, false, false, false)`
	_, err = h.db.Exec(plazosQuery, periodo.ID)
	if err != nil {
		log.Printf("Error creating plazos for periodo %d: %v", periodo.ID, err)
		// No fallar si no se pueden crear los plazos, pero loguear
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(periodo)
}

// UpdatePeriodo actualiza un periodo académico
func (h *PlazosHandler) UpdatePeriodo(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	periodoID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid periodo ID", http.StatusBadRequest)
		return
	}

	var req models.UpdatePeriodoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Si se está activando este periodo, desactivar todos los demás
	if req.Activo != nil && *req.Activo {
		// Desactivar todos los periodos
		_, err = h.db.Exec(`UPDATE periodo_academico SET activo = false`)
		if err != nil {
			http.Error(w, "Error updating periodos", http.StatusInternalServerError)
			return
		}
	}

	// Actualizar el periodo
	updateQuery := `UPDATE periodo_academico SET activo = $1 WHERE id = $2 RETURNING id, year, semestre, activo`
	var periodo models.PeriodoAcademico
	activoValue := false
	if req.Activo != nil {
		activoValue = *req.Activo
	}
	
	err = h.db.QueryRow(updateQuery, activoValue, periodoID).Scan(
		&periodo.ID, &periodo.Year, &periodo.Semestre, &periodo.Activo,
	)
	if err == sql.ErrNoRows {
		http.Error(w, "Periodo not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "Error updating periodo", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(periodo)
}

// DeletePeriodo elimina un periodo académico (y sus plazos por CASCADE)
func (h *PlazosHandler) DeletePeriodo(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	periodoID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid periodo ID", http.StatusBadRequest)
		return
	}

	// Verificar que no sea el periodo activo
	var activo bool
	checkQuery := `SELECT activo FROM periodo_academico WHERE id = $1`
	err = h.db.QueryRow(checkQuery, periodoID).Scan(&activo)
	if err == sql.ErrNoRows {
		http.Error(w, "Periodo not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "Error checking periodo", http.StatusInternalServerError)
		return
	}
	if activo {
		http.Error(w, "No se puede eliminar el periodo activo", http.StatusBadRequest)
		return
	}

	// Eliminar el periodo (los plazos se eliminan automáticamente por CASCADE)
	_, err = h.db.Exec(`DELETE FROM periodo_academico WHERE id = $1`, periodoID)
	if err != nil {
		http.Error(w, "Error deleting periodo", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetPlazos obtiene los plazos de un periodo específico
func (h *PlazosHandler) GetPlazos(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	periodoID, err := strconv.Atoi(vars["periodo_id"])
	if err != nil {
		http.Error(w, "Invalid periodo ID", http.StatusBadRequest)
		return
	}

	var plazos models.Plazos
	query := `SELECT id, periodo_id, documentos, inscripcion, modificaciones FROM plazos WHERE periodo_id = $1`
	err = h.db.QueryRow(query, periodoID).Scan(
		&plazos.ID, &plazos.PeriodoID, &plazos.Documentos, &plazos.Inscripcion, &plazos.Modificaciones,
	)
	if err == sql.ErrNoRows {
		http.Error(w, "Plazos not found for this periodo", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "Error fetching plazos", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(plazos)
}

// UpdatePlazos actualiza los plazos de un periodo
func (h *PlazosHandler) UpdatePlazos(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	periodoID, err := strconv.Atoi(vars["periodo_id"])
	if err != nil {
		http.Error(w, "Invalid periodo ID", http.StatusBadRequest)
		return
	}

	var req models.UpdatePlazosRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Obtener los valores actuales
	var plazos models.Plazos
	getQuery := `SELECT id, periodo_id, documentos, inscripcion, modificaciones FROM plazos WHERE periodo_id = $1`
	err = h.db.QueryRow(getQuery, periodoID).Scan(
		&plazos.ID, &plazos.PeriodoID, &plazos.Documentos, &plazos.Inscripcion, &plazos.Modificaciones,
	)
	if err == sql.ErrNoRows {
		http.Error(w, "Plazos not found for this periodo", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "Error fetching plazos", http.StatusInternalServerError)
		return
	}

	// Actualizar solo los campos que vienen en el request
	documentos := plazos.Documentos
	inscripcion := plazos.Inscripcion
	modificaciones := plazos.Modificaciones

	if req.Documentos != nil {
		documentos = *req.Documentos
	}
	if req.Inscripcion != nil {
		inscripcion = *req.Inscripcion
	}
	if req.Modificaciones != nil {
		modificaciones = *req.Modificaciones
	}

	// Actualizar
	updateQuery := `UPDATE plazos SET documentos = $1, inscripcion = $2, modificaciones = $3 WHERE periodo_id = $4 RETURNING id, periodo_id, documentos, inscripcion, modificaciones`
	err = h.db.QueryRow(updateQuery, documentos, inscripcion, modificaciones, periodoID).Scan(
		&plazos.ID, &plazos.PeriodoID, &plazos.Documentos, &plazos.Inscripcion, &plazos.Modificaciones,
	)
	if err != nil {
		http.Error(w, "Error updating plazos", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(plazos)
}

// GetPeriodosConPlazos obtiene todos los periodos con sus plazos asociados
func (h *PlazosHandler) GetPeriodosConPlazos(w http.ResponseWriter, r *http.Request) {
	query := `
		SELECT 
			p.id, p.year, p.semestre, p.activo,
			pl.id, pl.periodo_id, pl.documentos, pl.inscripcion, pl.modificaciones
		FROM periodo_academico p
		LEFT JOIN plazos pl ON p.id = pl.periodo_id
		ORDER BY p.year DESC, p.semestre DESC
	`
	rows, err := h.db.Query(query)
	if err != nil {
		http.Error(w, "Error fetching periodos", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var periodos []models.PeriodoConPlazos
	for rows.Next() {
		var p models.PeriodoConPlazos
		var plazosID sql.NullInt64
		var plazosPeriodoID sql.NullInt64
		var documentos, inscripcion, modificaciones sql.NullBool

		err := rows.Scan(
			&p.ID, &p.Year, &p.Semestre, &p.Activo,
			&plazosID, &plazosPeriodoID, &documentos, &inscripcion, &modificaciones,
		)
		if err != nil {
			log.Printf("Error scanning periodo con plazos: %v", err)
			continue
		}

		if plazosID.Valid {
			p.Plazos = &models.Plazos{
				ID:             int(plazosID.Int64),
				PeriodoID:      int(plazosPeriodoID.Int64),
				Documentos:     documentos.Valid && documentos.Bool,
				Inscripcion:    inscripcion.Valid && inscripcion.Bool,
				Modificaciones: modificaciones.Valid && modificaciones.Bool,
			}
		} else {
			// Crear automáticamente el registro de plazos si no existe
			var nuevosPlazos models.Plazos
			createPlazosQuery := `INSERT INTO plazos (periodo_id, documentos, inscripcion, modificaciones) 
								   VALUES ($1, false, false, false)
								   RETURNING id, periodo_id, documentos, inscripcion, modificaciones`
			err := h.db.QueryRow(createPlazosQuery, p.ID).Scan(
				&nuevosPlazos.ID,
				&nuevosPlazos.PeriodoID,
				&nuevosPlazos.Documentos,
				&nuevosPlazos.Inscripcion,
				&nuevosPlazos.Modificaciones,
			)
			if err != nil {
				log.Printf("Error creating default plazos for periodo %d: %v", p.ID, err)
			} else {
				p.Plazos = &nuevosPlazos
			}
		}

		periodos = append(periodos, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(periodos)
}

