package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"github.com/andrxsq/SIGMAUDC/internal/models"
)

type MatriculaHandler struct {
	db *sql.DB
}

func NewMatriculaHandler(db *sql.DB) *MatriculaHandler {
	return &MatriculaHandler{db: db}
}

func (h *MatriculaHandler) getClaims(r *http.Request) (*models.JWTClaims, error) {
	claims, ok := r.Context().Value("claims").(*models.JWTClaims)
	if !ok || claims == nil {
		return nil, errors.New("unauthorized")
	}
	return claims, nil
}

// ValidarInscripcion valida si el estudiante puede inscribir asignaturas
// Verifica:
// 1. Plazo activo (plazos.inscripcion = TRUE, programa_id del estudiante, periodo_id activo)
// 2. Documentos aprobados (todos los documentos del periodo activo deben estar aprobados)
func (h *MatriculaHandler) ValidarInscripcion(w http.ResponseWriter, r *http.Request) {
	claims, err := h.getClaims(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if claims.Rol != "estudiante" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Obtener estudiante_id
	var estudianteID int
	queryEstudiante := `SELECT id FROM estudiante WHERE usuario_id = $1`
	err = h.db.QueryRow(queryEstudiante, claims.Sub).Scan(&estudianteID)
	if err == sql.ErrNoRows {
		http.Error(w, "Estudiante no encontrado", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("Error getting estudiante: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Validación 1: Obtener periodo activo
	var periodo models.PeriodoAcademico
	queryPeriodo := `SELECT id, year, semestre, activo, archivado 
					 FROM periodo_academico 
					 WHERE activo = true AND archivado = false 
					 LIMIT 1`
	err = h.db.QueryRow(queryPeriodo).Scan(
		&periodo.ID,
		&periodo.Year,
		&periodo.Semestre,
		&periodo.Activo,
		&periodo.Archivado,
	)
	if err == sql.ErrNoRows {
		response := models.ValidarInscripcionResponse{
			PuedeInscribir: false,
			Razon:          "No hay un periodo académico activo.",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}
	if err != nil {
		log.Printf("Error getting periodo activo: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Validación 1: Verificar plazo de inscripción activo
	var plazos models.Plazos
	queryPlazos := `SELECT id, periodo_id, programa_id, documentos, inscripcion, modificaciones 
					FROM plazos 
					WHERE periodo_id = $1 AND programa_id = $2`
	err = h.db.QueryRow(queryPlazos, periodo.ID, claims.ProgramaID).Scan(
		&plazos.ID,
		&plazos.PeriodoID,
		&plazos.ProgramaID,
		&plazos.Documentos,
		&plazos.Inscripcion,
		&plazos.Modificaciones,
	)
	if err == sql.ErrNoRows {
		response := models.ValidarInscripcionResponse{
			PuedeInscribir: false,
			Razon:          "No hay plazos configurados para tu programa en el periodo activo.",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}
	if err != nil {
		log.Printf("Error getting plazos: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if !plazos.Inscripcion {
		response := models.ValidarInscripcionResponse{
			PuedeInscribir: false,
			Razon:          "El plazo de inscripción no está activo para tu programa en este periodo.",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	// Validación 2: Verificar documentos aprobados
	// Obtener todos los documentos del estudiante para el periodo activo
	queryDocumentos := `SELECT id, tipo_documento, estado 
						FROM documentos_estudiante 
						WHERE estudiante_id = $1 AND periodo_id = $2`
	rows, err := h.db.Query(queryDocumentos, estudianteID, periodo.ID)
	if err != nil {
		log.Printf("Error querying documentos: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var documentos []struct {
		ID            int
		TipoDocumento string
		Estado        string
	}
	for rows.Next() {
		var doc struct {
			ID            int
			TipoDocumento string
			Estado        string
		}
		if err := rows.Scan(&doc.ID, &doc.TipoDocumento, &doc.Estado); err != nil {
			log.Printf("Error scanning documento: %v", err)
			continue
		}
		documentos = append(documentos, doc)
	}

	// Verificar que todos los documentos estén aprobados
	documentosPendientes := []string{}
	documentosRechazados := []string{}
	for _, doc := range documentos {
		if doc.Estado == "pendiente" {
			documentosPendientes = append(documentosPendientes, doc.TipoDocumento)
		} else if doc.Estado == "rechazado" {
			documentosRechazados = append(documentosRechazados, doc.TipoDocumento)
		}
	}

	if len(documentosPendientes) > 0 || len(documentosRechazados) > 0 {
		var razon string
		if len(documentosPendientes) > 0 && len(documentosRechazados) > 0 {
			razon = "Tienes documentos pendientes y rechazados. Debes tener todos los documentos aprobados para inscribir asignaturas."
		} else if len(documentosPendientes) > 0 {
			razon = "Tienes documentos pendientes de revisión. Debes tener todos los documentos aprobados para inscribir asignaturas."
		} else {
			razon = "Tienes documentos rechazados. Debes tener todos los documentos aprobados para inscribir asignaturas."
		}
		
		// Agregar detalles de los documentos
		if len(documentosPendientes) > 0 {
			razon += " Documentos pendientes: " + joinDocumentos(documentosPendientes)
		}
		if len(documentosRechazados) > 0 {
			razon += " Documentos rechazados: " + joinDocumentos(documentosRechazados)
		}

		response := models.ValidarInscripcionResponse{
			PuedeInscribir: false,
			Razon:          razon,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	// Si no hay documentos, también es un problema
	if len(documentos) == 0 {
		response := models.ValidarInscripcionResponse{
			PuedeInscribir: false,
			Razon:          "No has subido los documentos requeridos para este periodo. Debes tener todos los documentos aprobados para inscribir asignaturas.",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	// Todas las validaciones pasaron
	response := models.ValidarInscripcionResponse{
		PuedeInscribir: true,
		Razon:          "",
		Periodo:       &periodo,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Función auxiliar para unir documentos
func joinDocumentos(docs []string) string {
	if len(docs) == 0 {
		return ""
	}
	result := docs[0]
	for i := 1; i < len(docs); i++ {
		result += ", " + docs[i]
	}
	return result
}

// GetAsignaturasDisponibles obtiene las asignaturas disponibles para inscripción
// Por ahora retorna un array vacío ya que la lógica completa aún no está implementada
func (h *MatriculaHandler) GetAsignaturasDisponibles(w http.ResponseWriter, r *http.Request) {
	claims, err := h.getClaims(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if claims.Rol != "estudiante" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Por ahora retornar array vacío - la lógica completa se implementará después
	// El frontend usará datos mock mientras tanto
	response := []interface{}{}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetHorarioActual obtiene el horario actual del estudiante para el periodo activo
func (h *MatriculaHandler) GetHorarioActual(w http.ResponseWriter, r *http.Request) {
	claims, err := h.getClaims(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if claims.Rol != "estudiante" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Obtener estudiante_id
	var estudianteID int
	queryEstudiante := `SELECT id FROM estudiante WHERE usuario_id = $1`
	err = h.db.QueryRow(queryEstudiante, claims.Sub).Scan(&estudianteID)
	if err == sql.ErrNoRows {
		http.Error(w, "Estudiante no encontrado", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("Error getting estudiante: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Obtener periodo activo
	var periodoID int
	var periodoYear int
	var periodoSemestre int
	queryPeriodo := `SELECT id, year, semestre FROM periodo_academico WHERE activo = true AND archivado = false LIMIT 1`
	err = h.db.QueryRow(queryPeriodo).Scan(&periodoID, &periodoYear, &periodoSemestre)
	if err == sql.ErrNoRows {
		// No hay periodo activo, retornar horario vacío
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"periodo": map[string]interface{}{
				"id":       nil,
				"year":     nil,
				"semestre": nil,
			},
			"asignaturas": []interface{}{},
		})
		return
	}
	if err != nil {
		log.Printf("Error getting periodo activo: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Primero verificar si hay matrículas para este estudiante y periodo
	var countMatriculas int
	queryCount := `SELECT COUNT(*) FROM matricula WHERE estudiante_id = $1 AND periodo_id = $2`
	err = h.db.QueryRow(queryCount, estudianteID, periodoID).Scan(&countMatriculas)
	if err != nil {
		log.Printf("Error counting matriculas: %v", err)
	} else {
		log.Printf("Matrículas encontradas para estudiante %d, periodo %d: %d", estudianteID, periodoID, countMatriculas)
	}

	// Verificar matrículas con estado 'inscrita'
	var countInscritas int
	queryCountInscritas := `SELECT COUNT(*) FROM matricula WHERE estudiante_id = $1 AND periodo_id = $2 AND estado = 'inscrita'`
	err = h.db.QueryRow(queryCountInscritas, estudianteID, periodoID).Scan(&countInscritas)
	if err != nil {
		log.Printf("Error counting matriculas inscritas: %v", err)
	} else {
		log.Printf("Matrículas inscritas: %d", countInscritas)
	}

	// Obtener todas las matrículas del estudiante para el periodo activo con estado 'inscrita'
	// Usar LEFT JOIN para horario_grupo porque puede que algunos grupos no tengan horarios aún
	query := `
		SELECT 
			m.id as matricula_id,
			a.id as asignatura_id,
			a.codigo as asignatura_codigo,
			a.nombre as asignatura_nombre,
			a.creditos,
			g.id as grupo_id,
			g.codigo as grupo_codigo,
			g.docente,
			hg.id as horario_id,
			COALESCE(hg.dia, '') as dia,
			COALESCE(hg.hora_inicio::text, '') as hora_inicio,
			COALESCE(hg.hora_fin::text, '') as hora_fin,
			COALESCE(hg.salon, '') as salon
		FROM matricula m
		JOIN grupo g ON m.grupo_id = g.id
		JOIN asignatura a ON g.asignatura_id = a.id
		LEFT JOIN horario_grupo hg ON hg.grupo_id = g.id
		WHERE m.estudiante_id = $1 
			AND m.periodo_id = $2 
			AND m.estado = 'inscrita'
		ORDER BY 
			CASE COALESCE(hg.dia, '')
				WHEN 'LUNES' THEN 1
				WHEN 'MARTES' THEN 2
				WHEN 'MIERCOLES' THEN 3
				WHEN 'JUEVES' THEN 4
				WHEN 'VIERNES' THEN 5
				WHEN 'SABADO' THEN 6
				ELSE 7
			END,
			COALESCE(hg.hora_inicio, '00:00:00')
	`
	rows, err := h.db.Query(query, estudianteID, periodoID)
	if err != nil {
		log.Printf("Error querying horario: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	// Estructura para agrupar por asignatura
	type HorarioItem struct {
		AsignaturaID   int     `json:"asignatura_id"`
		AsignaturaCodigo string `json:"asignatura_codigo"`
		AsignaturaNombre string `json:"asignatura_nombre"`
		Creditos       int     `json:"creditos"`
		GrupoID        int     `json:"grupo_id"`
		GrupoCodigo    string  `json:"grupo_codigo"`
		Docente        sql.NullString `json:"docente"`
		Horarios       []map[string]interface{} `json:"horarios"`
	}

	asignaturasMap := make(map[int]*HorarioItem)

	rowCount := 0
	for rows.Next() {
		rowCount++
		var matriculaID, asignaturaID, creditos, grupoID int
		var horarioID sql.NullInt64
		var asignaturaCodigo, asignaturaNombre, grupoCodigo, dia, horaInicio, horaFin string
		var salon sql.NullString
		var docente sql.NullString

		err := rows.Scan(
			&matriculaID, &asignaturaID, &asignaturaCodigo, &asignaturaNombre, &creditos,
			&grupoID, &grupoCodigo, &docente, &horarioID, &dia, &horaInicio, &horaFin, &salon,
		)
		if err != nil {
			log.Printf("Error scanning horario row: %v", err)
			continue
		}

		log.Printf("Row %d: asignatura_id=%d, codigo=%s, grupo_id=%d, horario_id=%v, dia=%s", 
			rowCount, asignaturaID, asignaturaCodigo, grupoID, horarioID, dia)

		// Si la asignatura no existe en el mapa, crearla
		if _, exists := asignaturasMap[asignaturaID]; !exists {
			asignaturasMap[asignaturaID] = &HorarioItem{
				AsignaturaID:     asignaturaID,
				AsignaturaCodigo: asignaturaCodigo,
				AsignaturaNombre: asignaturaNombre,
				Creditos:         creditos,
				GrupoID:          grupoID,
				GrupoCodigo:      grupoCodigo,
				Docente:          docente,
				Horarios:         []map[string]interface{}{},
			}
		}

		// Agregar horario solo si tiene datos válidos
		if horarioID.Valid && dia != "" && horaInicio != "" && horaFin != "" {
			horario := map[string]interface{}{
				"id":           horarioID.Int64,
				"dia":          dia,
				"hora_inicio":  horaInicio,
				"hora_fin":     horaFin,
				"salon":        salon.String,
			}
			asignaturasMap[asignaturaID].Horarios = append(asignaturasMap[asignaturaID].Horarios, horario)
		}
	}
	
	log.Printf("Total rows procesadas: %d, Asignaturas únicas: %d", rowCount, len(asignaturasMap))

	// Convertir mapa a slice
	asignaturas := make([]map[string]interface{}, 0, len(asignaturasMap))
	for _, item := range asignaturasMap {
		asignaturas = append(asignaturas, map[string]interface{}{
			"asignatura_id":     item.AsignaturaID,
			"asignatura_codigo": item.AsignaturaCodigo,
			"asignatura_nombre": item.AsignaturaNombre,
			"creditos":          item.Creditos,
			"grupo_id":          item.GrupoID,
			"grupo_codigo":      item.GrupoCodigo,
			"docente":           item.Docente.String,
			"horarios":          item.Horarios,
		})
	}

	response := map[string]interface{}{
		"periodo": map[string]interface{}{
			"id":       periodoID,
			"year":     periodoYear,
			"semestre": periodoSemestre,
		},
		"asignaturas": asignaturas,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

