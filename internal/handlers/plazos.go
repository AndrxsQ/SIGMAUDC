// Package handlers – PlazosHandler
// Gestiona la configuración de periodos académicos y sus plazos
// (documentos, inscripción, modificaciones) por programa.
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

	"github.com/andrxsq/SIGMAUDC/internal/constants"
	"github.com/andrxsq/SIGMAUDC/internal/models"
	"github.com/andrxsq/SIGMAUDC/internal/services"
	"github.com/andrxsq/SIGMAUDC/internal/utils"
	"github.com/gorilla/mux"
	"github.com/lib/pq"
)

// PlazosHandler gestiona las peticiones HTTP relacionadas con periodos académicos
// y la habilitación/deshabilitación de sus plazos por programa.
//
// Principios aplicados:
//   - SRP: solo gestiona lógica HTTP; auditoría delegada al AuditoriaService.
//   - DIP: depende de AuditoriaService por inyección.
type PlazosHandler struct {
	db        *sql.DB
	auditoria *services.AuditoriaService
}

// NewPlazosHandler crea una nueva instancia de PlazosHandler.
func NewPlazosHandler(db *sql.DB, auditoria *services.AuditoriaService) *PlazosHandler {
	return &PlazosHandler{db: db, auditoria: auditoria}
}

// ─── Métodos privados de soporte ─────────────────────────────────────────────

// getOrCreatePlazos obtiene los plazos del periodo/programa o los crea
// con todos los flags en false si no existen todavía.
// Maneja correctamente las condiciones de carrera al insertar.
func (h *PlazosHandler) getOrCreatePlazos(periodoID, programaID int) (*models.Plazos, error) {
	plazos, err := h.fetchPlazos(periodoID, programaID)
	if err == nil {
		return plazos, nil
	}
	if err != sql.ErrNoRows {
		return nil, err
	}

	insert := `INSERT INTO plazos (periodo_id, programa_id, documentos, inscripcion, modificaciones)
	           VALUES ($1, $2, false, false, false)
	           RETURNING id, periodo_id, programa_id, documentos, inscripcion, modificaciones`
	var created models.Plazos
	err = h.db.QueryRow(insert, periodoID, programaID).Scan(
		&created.ID,
		&created.PeriodoID,
		&created.ProgramaID,
		&created.Documentos,
		&created.Inscripcion,
		&created.Modificaciones,
	)
	if err != nil {
		// Reintentar en caso de condición de carrera (unique constraint violation o no rows)
		if errors.Is(err, sql.ErrNoRows) {
			return h.getOrCreatePlazos(periodoID, programaID)
		}
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return h.getOrCreatePlazos(periodoID, programaID)
		}
		return nil, err
	}
	return &created, nil
}

// fetchPlazos consulta los plazos de un periodo/programa específico.
func (h *PlazosHandler) fetchPlazos(periodoID, programaID int) (*models.Plazos, error) {
	var plazos models.Plazos
	query := `SELECT id, periodo_id, programa_id, documentos, inscripcion, modificaciones
	          FROM plazos WHERE periodo_id = $1 AND programa_id = $2`
	err := h.db.QueryRow(query, periodoID, programaID).Scan(
		&plazos.ID,
		&plazos.PeriodoID,
		&plazos.ProgramaID,
		&plazos.Documentos,
		&plazos.Inscripcion,
		&plazos.Modificaciones,
	)
	if err != nil {
		return nil, err
	}
	return &plazos, nil
}

// ─── Endpoints de periodos académicos ────────────────────────────────────────

// GetPeriodos retorna todos los periodos académicos ordenados por relevancia.
//
// GET /api/periodos
func (h *PlazosHandler) GetPeriodos(w http.ResponseWriter, r *http.Request) {
	query := `SELECT id, year, semestre, activo, archivado
	          FROM periodo_academico
	          ORDER BY archivado ASC, activo DESC, year DESC, semestre DESC`
	rows, err := h.db.Query(query)
	if err != nil {
		http.Error(w, "Error fetching periodos", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var periodos []models.PeriodoAcademico
	for rows.Next() {
		var p models.PeriodoAcademico
		if err := rows.Scan(&p.ID, &p.Year, &p.Semestre, &p.Activo, &p.Archivado); err != nil {
			log.Printf("Error scanning periodo: %v", err)
			continue
		}
		periodos = append(periodos, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(periodos)
}

// GetPeriodoActivo retorna el periodo académico actualmente activo.
//
// GET /api/periodos/activo
// Retorna null si no hay ningún periodo activo.
func (h *PlazosHandler) GetPeriodoActivo(w http.ResponseWriter, r *http.Request) {
	var periodo models.PeriodoAcademico
	query := `SELECT id, year, semestre, activo, archivado
	          FROM periodo_academico
	          WHERE activo = true AND archivado = false LIMIT 1`
	err := h.db.QueryRow(query).Scan(
		&periodo.ID, &periodo.Year, &periodo.Semestre, &periodo.Activo, &periodo.Archivado,
	)
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

// GetActivePeriodoPlazos retorna el periodo activo y los plazos del programa del usuario.
//
// GET /api/plazos/activo
// Requiere: token JWT válido.
func (h *PlazosHandler) GetActivePeriodoPlazos(w http.ResponseWriter, r *http.Request) {
	claims, err := getClaims(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var periodo models.PeriodoAcademico
	query := `SELECT id, year, semestre, activo, archivado
	          FROM periodo_academico
	          WHERE activo = true AND archivado = false LIMIT 1`
	err = h.db.QueryRow(query).Scan(
		&periodo.ID, &periodo.Year, &periodo.Semestre, &periodo.Activo, &periodo.Archivado,
	)
	if err == sql.ErrNoRows {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(models.ActivePlazosResponse{Periodo: nil, Plazos: nil})
		return
	}
	if err != nil {
		http.Error(w, "Error fetching periodo activo", http.StatusInternalServerError)
		return
	}

	plazos, err := h.getOrCreatePlazos(periodo.ID, claims.ProgramaID)
	if err != nil {
		http.Error(w, "Error fetching plazos", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.ActivePlazosResponse{
		Periodo: &periodo,
		Plazos:  plazos,
	})
}

// CreatePeriodo crea un nuevo periodo académico con todos sus plazos en false.
//
// POST /api/periodos
// Body: models.CreatePeriodoRequest (year, semestre).
// El semestre debe ser 1 o 2.
func (h *PlazosHandler) CreatePeriodo(w http.ResponseWriter, r *http.Request) {
	var req models.CreatePeriodoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Semestre != 1 && req.Semestre != 2 {
		http.Error(w, "Semestre debe ser 1 o 2", http.StatusBadRequest)
		return
	}

	var exists int
	if err := h.db.QueryRow(
		`SELECT COUNT(*) FROM periodo_academico WHERE year = $1 AND semestre = $2`,
		req.Year, req.Semestre,
	).Scan(&exists); err != nil {
		http.Error(w, "Error checking periodo", http.StatusInternalServerError)
		return
	}
	if exists > 0 {
		http.Error(w, "Ya existe un periodo con ese año y semestre", http.StatusConflict)
		return
	}

	var periodo models.PeriodoAcademico
	insertQuery := `INSERT INTO periodo_academico (year, semestre, activo, archivado)
	                VALUES ($1, $2, false, false)
	                RETURNING id, year, semestre, activo, archivado`
	if err := h.db.QueryRow(insertQuery, req.Year, req.Semestre).Scan(
		&periodo.ID, &periodo.Year, &periodo.Semestre, &periodo.Activo, &periodo.Archivado,
	); err != nil {
		http.Error(w, "Error creating periodo", http.StatusInternalServerError)
		return
	}

	// Crear los plazos asociados para cada programa (todos en false por defecto).
	programRows, err := h.db.Query(`SELECT id FROM programa`)
	if err != nil {
		log.Printf("Error fetching programas para crear plazos: %v", err)
	} else {
		defer programRows.Close()
		for programRows.Next() {
			var programaID int
			if err := programRows.Scan(&programaID); err != nil {
				log.Printf("Error scanning programa id: %v", err)
				continue
			}
			plazosQuery := `INSERT INTO plazos (periodo_id, programa_id, documentos, inscripcion, modificaciones)
			                VALUES ($1, $2, false, false, false)
			                ON CONFLICT (periodo_id, programa_id) DO NOTHING`
			if _, err := h.db.Exec(plazosQuery, periodo.ID, programaID); err != nil {
				log.Printf("Error creating plazos for periodo %d programa %d: %v", periodo.ID, programaID, err)
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(periodo)
}

// UpdatePeriodo actualiza el estado (activo/archivado) de un periodo académico.
//
// PUT /api/periodos/{id}
// Body: models.UpdatePeriodoRequest.
// Un periodo archivado no puede reactivarse.
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

	var current models.PeriodoAcademico
	getQuery := `SELECT id, year, semestre, activo, archivado FROM periodo_academico WHERE id = $1`
	if err := h.db.QueryRow(getQuery, periodoID).Scan(
		&current.ID, &current.Year, &current.Semestre, &current.Activo, &current.Archivado,
	); err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Periodo not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Error fetching periodo", http.StatusInternalServerError)
		return
	}

	newActivo := current.Activo
	newArchivado := current.Archivado

	if req.Archivado != nil {
		newArchivado = *req.Archivado
		if newArchivado {
			newActivo = false
		}
	}

	if req.Activo != nil {
		if newArchivado && *req.Activo {
			http.Error(w, "No se puede activar un periodo archivado", http.StatusBadRequest)
			return
		}
		newActivo = *req.Activo
	}

	// Solo puede haber un periodo activo a la vez.
	if newActivo {
		if _, err = h.db.Exec(
			`UPDATE periodo_academico SET activo = false WHERE id <> $1`, periodoID,
		); err != nil {
			http.Error(w, "Error desactivando otros periodos", http.StatusInternalServerError)
			return
		}
	}

	updateQuery := `UPDATE periodo_academico SET activo = $1, archivado = $2
	                WHERE id = $3
	                RETURNING id, year, semestre, activo, archivado`
	var updated models.PeriodoAcademico
	if err := h.db.QueryRow(updateQuery, newActivo, newArchivado, periodoID).Scan(
		&updated.ID, &updated.Year, &updated.Semestre, &updated.Activo, &updated.Archivado,
	); err != nil {
		http.Error(w, "Error updating periodo", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}

// DeletePeriodo no está implementado: los periodos no se eliminan, se archivan.
//
// DELETE /api/periodos/{id}
func (h *PlazosHandler) DeletePeriodo(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "Los periodos no se eliminan. Utiliza el archivado para mantener el historial.", http.StatusMethodNotAllowed)
}

// ─── Endpoints de plazos ─────────────────────────────────────────────────────

// GetPlazos retorna los plazos de un periodo específico para el programa del usuario.
//
// GET /api/periodos/{periodo_id}/plazos
// Requiere: token JWT válido.
func (h *PlazosHandler) GetPlazos(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	periodoID, err := strconv.Atoi(vars["periodo_id"])
	if err != nil {
		http.Error(w, "Invalid periodo ID", http.StatusBadRequest)
		return
	}

	claims, err := getClaims(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	plazos, err := h.getOrCreatePlazos(periodoID, claims.ProgramaID)
	if err == sql.ErrNoRows {
		http.Error(w, "Plazos not found for this periodo and programa", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "Error fetching plazos", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(plazos)
}

// UpdatePlazos actualiza los plazos de un periodo para el programa del jefe autenticado.
//
// PUT /api/periodos/{periodo_id}/plazos
// Requiere: rol "jefe_departamental".
// Body: models.UpdatePlazosRequest (campos opcionales: documentos, inscripcion, modificaciones).
//
// Solo se pueden modificar plazos de periodos activos y no archivados.
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

	claims, err := getClaims(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if claims.Rol != constants.RolJefe {
		http.Error(w, "Solo un jefe departamental puede modificar plazos", http.StatusForbidden)
		return
	}

	// Verificar que el periodo existe y está activo (no archivado).
	var activo, archivado bool
	if err = h.db.QueryRow(
		`SELECT activo, archivado FROM periodo_academico WHERE id = $1`, periodoID,
	).Scan(&activo, &archivado); err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Periodo not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Error checking periodo", http.StatusInternalServerError)
		return
	}
	if archivado {
		http.Error(w, "No se pueden modificar plazos de un periodo archivado", http.StatusBadRequest)
		return
	}
	if !activo {
		http.Error(w, "No se pueden modificar plazos de un periodo inactivo", http.StatusBadRequest)
		return
	}

	plazos, err := h.getOrCreatePlazos(periodoID, claims.ProgramaID)
	if err != nil {
		http.Error(w, "Error fetching plazos", http.StatusInternalServerError)
		return
	}

	// Actualizar solo los campos que vienen en el request (patch parcial).
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

	// Obtener info del periodo y programa para el mensaje de auditoría.
	var periodoYear, periodoSemestre int
	var programaNombre string
	queryInfo := `SELECT p.year, p.semestre, pr.nombre
	              FROM periodo_academico p
	              CROSS JOIN programa pr
	              WHERE pr.id = $1 AND p.id = $2`
	if err = h.db.QueryRow(queryInfo, claims.ProgramaID, periodoID).Scan(
		&periodoYear, &periodoSemestre, &programaNombre,
	); err != nil {
		log.Printf("Error getting periodo/programa info for audit: %v", err)
		programaNombre = fmt.Sprintf("Programa ID: %d", claims.ProgramaID)
		h.db.QueryRow(`SELECT year, semestre FROM periodo_academico WHERE id = $1`, periodoID).
			Scan(&periodoYear, &periodoSemestre)
	}

	// Construir lista de cambios aplicados para el log de auditoría.
	var cambios []string
	if req.Documentos != nil && *req.Documentos != plazos.Documentos {
		cambios = append(cambios, fmt.Sprintf("documentos: %s", estadoString(*req.Documentos)))
	}
	if req.Inscripcion != nil && *req.Inscripcion != plazos.Inscripcion {
		cambios = append(cambios, fmt.Sprintf("inscripcion: %s", estadoString(*req.Inscripcion)))
	}
	if req.Modificaciones != nil && *req.Modificaciones != plazos.Modificaciones {
		cambios = append(cambios, fmt.Sprintf("modificaciones: %s", estadoString(*req.Modificaciones)))
	}

	updateQuery := `UPDATE plazos SET documentos = $1, inscripcion = $2, modificaciones = $3
	                WHERE periodo_id = $4 AND programa_id = $5
	                RETURNING id, periodo_id, programa_id, documentos, inscripcion, modificaciones`
	if err = h.db.QueryRow(updateQuery, documentos, inscripcion, modificaciones, periodoID, claims.ProgramaID).Scan(
		&plazos.ID, &plazos.PeriodoID, &plazos.ProgramaID,
		&plazos.Documentos, &plazos.Inscripcion, &plazos.Modificaciones,
	); err != nil {
		http.Error(w, "Error updating plazos", http.StatusInternalServerError)
		return
	}

	if len(cambios) > 0 {
		ip := utils.GetIPAddress(r)
		userAgent := r.UserAgent()
		descripcion := fmt.Sprintf(
			"Actualización de plazos - Periodo: %d-%d, Programa: %s, Cambios: %s",
			periodoYear, periodoSemestre, programaNombre, strings.Join(cambios, ", "),
		)
		h.auditoria.Registrar(claims.Sub, "actualizacion_plazos", descripcion, ip, userAgent)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(plazos)
}

// GetPeriodosConPlazos retorna todos los periodos con sus plazos asociados
// para el programa del usuario autenticado.
//
// GET /api/periodos-con-plazos
// Requiere: token JWT válido.
func (h *PlazosHandler) GetPeriodosConPlazos(w http.ResponseWriter, r *http.Request) {
	claims, err := getClaims(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	query := `
		SELECT
			p.id, p.year, p.semestre, p.activo, p.archivado,
			pl.id, pl.periodo_id, pl.programa_id, pl.documentos, pl.inscripcion, pl.modificaciones
		FROM periodo_academico p
		LEFT JOIN plazos pl ON p.id = pl.periodo_id AND pl.programa_id = $1
		ORDER BY p.archivado ASC, p.activo DESC, p.year DESC, p.semestre DESC
	`
	rows, err := h.db.Query(query, claims.ProgramaID)
	if err != nil {
		http.Error(w, "Error fetching periodos", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var periodos []models.PeriodoConPlazos
	for rows.Next() {
		var p models.PeriodoConPlazos
		var plazosID, plazosPeriodoID, plazosProgramaID sql.NullInt64
		var documentos, inscripcion, modificaciones sql.NullBool

		if err := rows.Scan(
			&p.ID, &p.Year, &p.Semestre, &p.Activo, &p.Archivado,
			&plazosID, &plazosPeriodoID, &plazosProgramaID,
			&documentos, &inscripcion, &modificaciones,
		); err != nil {
			log.Printf("Error scanning periodo con plazos: %v", err)
			continue
		}

		if plazosID.Valid {
			p.Plazos = &models.Plazos{
				ID:             int(plazosID.Int64),
				PeriodoID:      int(plazosPeriodoID.Int64),
				ProgramaID:     int(plazosProgramaID.Int64),
				Documentos:     documentos.Valid && documentos.Bool,
				Inscripcion:    inscripcion.Valid && inscripcion.Bool,
				Modificaciones: modificaciones.Valid && modificaciones.Bool,
			}
		} else {
			// Crear automáticamente el registro de plazos si no existe para este programa.
			var nuevosPlazos models.Plazos
			createPlazosQuery := `INSERT INTO plazos (periodo_id, programa_id, documentos, inscripcion, modificaciones)
			                      VALUES ($1, $2, false, false, false)
			                      RETURNING id, periodo_id, programa_id, documentos, inscripcion, modificaciones`
			if err := h.db.QueryRow(createPlazosQuery, p.ID, claims.ProgramaID).Scan(
				&nuevosPlazos.ID,
				&nuevosPlazos.PeriodoID,
				&nuevosPlazos.ProgramaID,
				&nuevosPlazos.Documentos,
				&nuevosPlazos.Inscripcion,
				&nuevosPlazos.Modificaciones,
			); err != nil {
				log.Printf("Error creating default plazos for periodo %d: %v", p.ID, err)
			} else {
				nuevosPlazos.ProgramaID = claims.ProgramaID
				p.Plazos = &nuevosPlazos
			}
		}

		periodos = append(periodos, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(periodos)
}

// ─── Helpers internos ────────────────────────────────────────────────────────

// estadoString retorna "activado" o "desactivado" según el valor booleano,
// para usarse en los mensajes de auditoría de plazos.
func estadoString(v bool) string {
	if v {
		return "activado"
	}
	return "desactivado"
}
