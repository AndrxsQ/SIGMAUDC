package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"

	"github.com/andrxsq/SIGMAUDC/internal/models"
)

// PensumHandler gestiona la vista del pensum para estudiantes
type PensumHandler struct {
	db *sql.DB
}

// NewPensumHandler crea un handler nuevo
func NewPensumHandler(db *sql.DB) *PensumHandler {
	return &PensumHandler{db: db}
}

func (h *PensumHandler) getClaims(r *http.Request) (*models.JWTClaims, error) {
	claims, ok := r.Context().Value("claims").(*models.JWTClaims)
	if !ok || claims == nil {
		return nil, errors.New("unauthorized")
	}
	return claims, nil
}

// GetPensumEstudiante devuelve la vista completa del pensum del estudiante
func (h *PensumHandler) GetPensumEstudiante(w http.ResponseWriter, r *http.Request) {
	claims, err := h.getClaims(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if claims.Rol != "estudiante" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	estudianteID, err := h.getEstudianteID(claims.Sub)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	pensumID, pensumNombre, programaNombre, err := h.getPensumInfo(estudianteID)
	if err != nil {
		if errors.Is(err, errPensumNoAsignado) {
			http.Error(w, "Pensum no asignado al estudiante", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	activePeriodo, err := h.getActivePeriodo()
	if err != nil {
		// no abortamos, seguimos sin período activo
		activePeriodo = nil
	}

	asignaturas, err := h.getAsignaturas(pensumID)
	if err != nil {
		http.Error(w, "Error obteniendo asignaturas del pensum", http.StatusInternalServerError)
		return
	}

	prereqMap, err := h.buildPrereqMap(pensumID)
	if err != nil {
		http.Error(w, "Error obteniendo prerrequisitos", http.StatusInternalServerError)
		return
	}

	historialMap, err := h.buildHistorialMap(estudianteID)
	if err != nil {
		http.Error(w, "Error obteniendo historial académico", http.StatusInternalServerError)
		return
	}

	activeOrdinal := (*int)(nil)
	if activePeriodo != nil {
		ord := periodOrdinal(activePeriodo.Year, activePeriodo.Semestre)
		activeOrdinal = &ord
	}

	semestresMap := make(map[int][]models.AsignaturaCompleta)
	for _, asig := range asignaturas {
		hist := historialMap[asig.ID]
		prereqs := make([]models.Prerequisito, 0, len(prereqMap[asig.ID]))
		for _, prereq := range prereqMap[asig.ID] {
			prereq.Completado = hasApprovedEntry(historialMap, prereq.PrerequisitoID)
			prereqs = append(prereqs, prereq)
		}

		var faltantes []models.Prerequisito
		for _, p := range prereqs {
			if !p.Completado {
				faltantes = append(faltantes, p)
			}
		}

		state, nota, grupoID, periodoCursada, repeticiones := determineEstado(hist, activePeriodo, activeOrdinal, len(faltantes) > 0)

		asig.Estado = &state
		asig.Nota = nota
		asig.Repeticiones = repeticiones
		asig.Prerequisitos = prereqs
		asig.PrerequisitosFaltantes = faltantes
		asig.GrupoID = grupoID
		asig.PeriodoCursada = periodoCursada

		semestresMap[asig.Semestre] = append(semestresMap[asig.Semestre], asig)
	}

	var semestres []models.SemestrePensum
	for semestre := range semestresMap {
		semestres = append(semestres, models.SemestrePensum{
			Numero:      semestre,
			Asignaturas: semestresMap[semestre],
		})
	}
	sort.Slice(semestres, func(i, j int) bool {
		return semestres[i].Numero < semestres[j].Numero
	})

	response := models.PensumEstudianteResponse{
		ProgramaNombre: programaNombre,
		PensumNombre:   pensumNombre,
		Semestres:      semestres,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, "Error encoding response", http.StatusInternalServerError)
		return
	}
}

func (h *PensumHandler) getEstudianteID(usuarioID int) (int, error) {
	var estudianteID int
	query := `SELECT id FROM estudiante WHERE usuario_id = $1`
	err := h.db.QueryRow(query, usuarioID).Scan(&estudianteID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, fmt.Errorf("estudiante no encontrado")
		}
		return 0, err
	}
	return estudianteID, nil
}

var errPensumNoAsignado = errors.New("pensum no asignado")

func (h *PensumHandler) getPensumInfo(estudianteID int) (int, string, string, error) {
	var pensumID int
	var pensumNombre, programaNombre string
	query := `
		SELECT p.id, p.nombre, pr.nombre
		FROM estudiante_pensum ep
		JOIN pensum p ON ep.pensum_id = p.id
		JOIN programa pr ON p.programa_id = pr.id
		WHERE ep.estudiante_id = $1
	`
	err := h.db.QueryRow(query, estudianteID).Scan(&pensumID, &pensumNombre, &programaNombre)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, "", "", errPensumNoAsignado
		}
		return 0, "", "", err
	}
	return pensumID, pensumNombre, programaNombre, nil
}

func (h *PensumHandler) getActivePeriodo() (*models.PeriodoAcademico, error) {
	var periodo models.PeriodoAcademico
	query := `SELECT id, year, semestre FROM periodo_academico WHERE activo = true AND archivado = false ORDER BY year DESC, semestre DESC LIMIT 1`
	err := h.db.QueryRow(query).Scan(&periodo.ID, &periodo.Year, &periodo.Semestre)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &periodo, nil
}

func (h *PensumHandler) getAsignaturas(pensumID int) ([]models.AsignaturaCompleta, error) {
	query := `
		SELECT 
			pa.semestre,
			a.id,
			a.codigo,
			a.nombre,
			a.creditos,
			COALESCE(at.nombre, '') as tipo_nombre,
			a.tiene_laboratorio,
			pa.categoria
		FROM pensum_asignatura pa
		JOIN asignatura a ON pa.asignatura_id = a.id
		LEFT JOIN asignatura_tipo at ON a.tipo_id = at.id
		WHERE pa.pensum_id = $1
		ORDER BY pa.semestre, a.codigo
	`
	rows, err := h.db.Query(query, pensumID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var asignaturas []models.AsignaturaCompleta
	for rows.Next() {
		var asig models.AsignaturaCompleta
		if err := rows.Scan(
			&asig.Semestre,
			&asig.ID,
			&asig.Codigo,
			&asig.Nombre,
			&asig.Creditos,
			&asig.TipoNombre,
			&asig.TieneLaboratorio,
			&asig.Categoria,
		); err != nil {
			return nil, err
		}
		asignaturas = append(asignaturas, asig)
	}
	return asignaturas, nil
}

type historyRecord struct {
	AsignaturaID int
	Estado       string
	Nota         sql.NullFloat64
	GrupoID      sql.NullInt64
	PeriodoID    int
	Year         int
	Semestre     int
	Ordinal      int
}

func (h *PensumHandler) buildHistorialMap(estudianteID int) (map[int][]historyRecord, error) {
	query := `
		SELECT 
			ha.id_asignatura,
			ha.estado,
			ha.nota,
			ha.grupo_id,
			ha.id_periodo,
			p.year,
			p.semestre
		FROM historial_academico ha
		JOIN periodo_academico p ON ha.id_periodo = p.id
		WHERE ha.id_estudiante = $1
		ORDER BY p.year, p.semestre, ha.id
	`
	rows, err := h.db.Query(query, estudianteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	hist := make(map[int][]historyRecord)
	for rows.Next() {
		var rec historyRecord
		if err := rows.Scan(
			&rec.AsignaturaID,
			&rec.Estado,
			&rec.Nota,
			&rec.GrupoID,
			&rec.PeriodoID,
			&rec.Year,
			&rec.Semestre,
		); err != nil {
			return nil, err
		}
		rec.Ordinal = periodOrdinal(rec.Year, rec.Semestre)
		hist[rec.AsignaturaID] = append(hist[rec.AsignaturaID], rec)
	}
	return hist, nil
}

func (h *PensumHandler) buildPrereqMap(pensumID int) (map[int][]models.Prerequisito, error) {
	query := `
		SELECT 
			pr.asignatura_id,
			pr.prerequisito_id,
			a.codigo,
			a.nombre,
			COALESCE(pa.semestre, 0) as semestre,
			pr.tipo
		FROM pensum_prerequisito pr
		JOIN asignatura a ON pr.prerequisito_id = a.id
		LEFT JOIN pensum_asignatura pa ON pa.asignatura_id = a.id AND pa.pensum_id = $1
		WHERE pr.pensum_id = $1
		ORDER BY a.codigo
	`
	rows, err := h.db.Query(query, pensumID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	prereqMap := make(map[int][]models.Prerequisito)
	for rows.Next() {
		var prereq models.Prerequisito
		if err := rows.Scan(
			&prereq.AsignaturaID,
			&prereq.PrerequisitoID,
			&prereq.Codigo,
			&prereq.Nombre,
			&prereq.Semestre,
			&prereq.Tipo,
		); err != nil {
			return nil, err
		}
		prereqMap[prereq.AsignaturaID] = append(prereqMap[prereq.AsignaturaID], prereq)
	}
	return prereqMap, nil
}

func determineEstado(history []historyRecord, activePeriodo *models.PeriodoAcademico, activeOrdinal *int, tienePrereqPendientes bool) (string, *float64, *int, *string, int) {
	repeticiones := 0
	var lastReprob *historyRecord
	for _, entry := range history {
		if entry.Estado == "reprobada" {
			repeticiones++
			lastReprob = &entry
		}
		if activePeriodo != nil && entry.PeriodoID == activePeriodo.ID && entry.Estado == "matriculada" {
			var grupo *int
			if entry.GrupoID.Valid {
				g := int(entry.GrupoID.Int64)
				grupo = &g
			}
			var nota *float64
			if entry.Nota.Valid {
				n := entry.Nota.Float64
				nota = &n
			}
			return "matriculada", nota, grupo, nil, repeticiones
		}
	}

	for i := len(history) - 1; i >= 0; i-- {
		entry := history[i]
		if entry.Estado == "aprobada" && entry.Nota.Valid && entry.Nota.Float64 >= 3.0 {
			nota := entry.Nota.Float64
			periodo := fmt.Sprintf("%d-%d", entry.Year, entry.Semestre)
			return "cursada", &nota, nil, &periodo, repeticiones
		}
		if entry.Estado == "convalidada" {
			periodo := fmt.Sprintf("%d-%d", entry.Year, entry.Semestre)
			return "cursada", nil, nil, &periodo, repeticiones
		}
	}

	var notaPendiente *float64
	if lastReprob != nil && lastReprob.Nota.Valid {
		n := lastReprob.Nota.Float64
		notaPendiente = &n
	}

	if repeticiones >= 2 {
		return "obligatoria_repeticion", notaPendiente, nil, nil, repeticiones
	}
	if lastReprob != nil && shouldObligatoria(history, *lastReprob, activeOrdinal) {
		return "obligatoria_repeticion", notaPendiente, nil, nil, repeticiones
	}
	if repeticiones == 1 {
		return "pendiente_repeticion", notaPendiente, nil, nil, repeticiones
	}

	if tienePrereqPendientes {
		return "en_espera", nil, nil, nil, repeticiones
	}

	return "activa", nil, nil, nil, repeticiones
}

func shouldObligatoria(history []historyRecord, lastReprob historyRecord, activeOrdinal *int) bool {
	if activeOrdinal == nil {
		return false
	}
	if *activeOrdinal < lastReprob.Ordinal+2 {
		return false
	}
	next := lastReprob.Ordinal + 1
	for _, entry := range history {
		if entry.Ordinal == next {
			return false
		}
	}
	return true
}

func hasApprovedEntry(historial map[int][]historyRecord, asignaturaID int) bool {
	for _, entry := range historial[asignaturaID] {
		if entry.Estado == "aprobada" && entry.Nota.Valid && entry.Nota.Float64 >= 3.0 {
			return true
		}
		if entry.Estado == "convalidada" {
			return true
		}
	}
	return false
}

func periodOrdinal(year, semestre int) int {
	return year*2 + (semestre - 1)
}
