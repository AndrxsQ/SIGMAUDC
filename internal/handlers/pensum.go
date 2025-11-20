package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"github.com/andrxsq/SIGMAUDC/internal/models"
)

type PensumHandler struct {
	db *sql.DB
}

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

// GetPensumEstudiante obtiene el pensum completo de un estudiante con toda la información
func (h *PensumHandler) GetPensumEstudiante(w http.ResponseWriter, r *http.Request) {
	log.Printf("🎯 GetPensumEstudiante - Handler llamado para %s", r.URL.Path)
	claims, err := h.getClaims(r)
	if err != nil {
		log.Printf("❌ GetPensumEstudiante - Error obteniendo claims: %v", err)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	log.Printf("✅ GetPensumEstudiante - Claims obtenidos: Rol=%s, Sub=%s", claims.Rol, claims.Sub)

	if claims.Rol != "estudiante" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Obtener estudiante_id
	var estudianteID int
	queryEstudiante := `SELECT id FROM estudiante WHERE usuario_id = $1`
	log.Printf("🔍 Buscando estudiante con usuario_id: %v", claims.Sub)
	err = h.db.QueryRow(queryEstudiante, claims.Sub).Scan(&estudianteID)
	if err == sql.ErrNoRows {
		log.Printf("❌ Estudiante no encontrado para usuario_id: %v", claims.Sub)
		http.Error(w, "Estudiante no encontrado", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("❌ Error getting estudiante: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	log.Printf("✅ Estudiante encontrado: estudiante_id=%d", estudianteID)

	// Obtener pensum asignado al estudiante
	var pensumID int
	var pensumNombre string
	var programaNombre string
	queryPensum := `
		SELECT p.id, p.nombre, pr.nombre as programa_nombre
		FROM estudiante_pensum ep
		JOIN pensum p ON ep.pensum_id = p.id
		JOIN programa pr ON p.programa_id = pr.id
		WHERE ep.estudiante_id = $1
	`
	log.Printf("🔍 Buscando pensum para estudiante_id: %d", estudianteID)
	err = h.db.QueryRow(queryPensum, estudianteID).Scan(&pensumID, &pensumNombre, &programaNombre)
	if err == sql.ErrNoRows {
		log.Printf("❌ Pensum no asignado al estudiante_id: %d", estudianteID)
		http.Error(w, "Pensum no asignado al estudiante", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("❌ Error getting pensum: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	log.Printf("✅ Pensum encontrado: pensum_id=%d, nombre=%s, programa=%s", pensumID, pensumNombre, programaNombre)

	// Obtener periodo activo para verificar matrícula actual
	var periodoActivoID sql.NullInt64
	queryPeriodoActivo := `SELECT id FROM periodo_academico WHERE activo = true AND archivado = false LIMIT 1`
	errPeriodo := h.db.QueryRow(queryPeriodoActivo).Scan(&periodoActivoID)
	if errPeriodo != nil && errPeriodo != sql.ErrNoRows {
		log.Printf("Error getting periodo activo: %v", errPeriodo)
		// Continuar sin periodo activo si hay error
		periodoActivoID = sql.NullInt64{Valid: false}
	}

	// Obtener todas las asignaturas del pensum organizadas por semestre
	// Incluye información de matrícula actual e historial académico
	// RN-14 a RN-17: Profundizaciones y electivas se tratan como obligatorias normales
	queryAsignaturas := `
		SELECT 
			pa.semestre,
			a.id,
			a.codigo,
			a.nombre,
			a.creditos,
			at.nombre as tipo_nombre,
			a.tiene_laboratorio,
			pa.categoria,
			-- Estado de estudiante_asignatura (puede ser null)
			ea.estado as estado_estudiante_asignatura,
			ea.nota as nota_estudiante_asignatura,
			COALESCE(ea.repeticiones, 0) as repeticiones,
			-- Nota del historial académico (última nota registrada)
			(SELECT ha.nota 
			 FROM historial_academico ha 
			 WHERE ha.estudiante_id = $1 AND ha.asignatura_id = a.id 
			 ORDER BY ha.id DESC 
			 LIMIT 1) as nota_historial,
			-- Verificar si está aprobada (nota >= 3.0 en historial)
			CASE 
				WHEN EXISTS (
					SELECT 1 FROM historial_academico ha
					WHERE ha.estudiante_id = $1 
					AND ha.asignatura_id = a.id 
					AND ha.aprobado = true
				) THEN true
				ELSE false
			END as esta_aprobada,
			-- Verificar si está reprobada (último intento fue reprobado)
			CASE 
				WHEN EXISTS (
					SELECT 1 FROM estudiante_asignatura_intentos eai
					WHERE eai.estudiante_id = $1 
					AND eai.asignatura_id = a.id 
					AND eai.estado = 'reprobado'
					AND eai.periodo_id = (
						SELECT MAX(periodo_id) 
						FROM estudiante_asignatura_intentos 
						WHERE estudiante_id = $1 AND asignatura_id = a.id
					)
				) THEN true
				ELSE false
			END as esta_reprobada,
			-- Verificar si está matriculada en el periodo actual
			CASE 
				WHEN (SELECT id FROM periodo_academico WHERE activo = true AND archivado = false LIMIT 1) IS NOT NULL 
					AND EXISTS (
						SELECT 1 FROM matricula m
						JOIN grupo g ON m.grupo_id = g.id
						JOIN periodo_academico p ON m.periodo_id = p.id
						WHERE m.estudiante_id = $1 
						AND g.asignatura_id = a.id 
						AND p.activo = true AND p.archivado = false
						AND m.estado = 'inscrita'
					) THEN true
				ELSE false
			END as esta_matriculada
		FROM pensum_asignatura pa
		JOIN asignatura a ON pa.asignatura_id = a.id
		JOIN asignatura_tipo at ON a.tipo_id = at.id
		LEFT JOIN estudiante_asignatura ea ON ea.estudiante_id = $1 AND ea.asignatura_id = a.id
		WHERE pa.pensum_id = $2
		ORDER BY pa.semestre, a.codigo
	`
	log.Printf("🔍 Consultando asignaturas para estudiante_id=%d, pensum_id=%d", estudianteID, pensumID)
	rows, err := h.db.Query(queryAsignaturas, estudianteID, pensumID)
	if err != nil {
		log.Printf("❌ Error querying asignaturas: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	log.Printf("✅ Query de asignaturas ejecutada exitosamente")

	// Mapa para organizar asignaturas por semestre
	semestresMap := make(map[int][]models.AsignaturaCompleta)

	for rows.Next() {
		var asignatura models.AsignaturaCompleta
		var estadoEstudianteAsignatura sql.NullString
		var notaEstudianteAsignatura sql.NullFloat64
		var notaHistorial sql.NullFloat64
		var repeticiones int
		var estaMatriculada bool
		var estaAprobada bool
		var estaReprobada bool

		err := rows.Scan(
			&asignatura.Semestre,
			&asignatura.ID,
			&asignatura.Codigo,
			&asignatura.Nombre,
			&asignatura.Creditos,
			&asignatura.TipoNombre,
			&asignatura.TieneLaboratorio,
			&asignatura.Categoria,
			&estadoEstudianteAsignatura,
			&notaEstudianteAsignatura,
			&repeticiones,
			&notaHistorial,
			&estaAprobada,
			&estaReprobada,
			&estaMatriculada,
		)
		if err != nil {
			log.Printf("Error scanning asignatura: %v", err)
			continue
		}

		// RN-03: Si está aprobada, el estado es "aprobada"
		if estaAprobada {
			estadoAprobada := "aprobada"
			asignatura.Estado = &estadoAprobada
		} else if estaMatriculada {
			// Si está matriculada en el periodo actual, el estado es "matriculada"
			estadoMatriculada := "matriculada"
			asignatura.Estado = &estadoMatriculada
		} else if estaReprobada {
			// Si está reprobada, el estado inicial es "reprobada" (luego se calculará si es pendiente u obligatoria)
			estadoReprobada := "reprobada"
			asignatura.Estado = &estadoReprobada
		} else if estadoEstudianteAsignatura.Valid {
			// Usar el estado de estudiante_asignatura si existe
			asignatura.Estado = &estadoEstudianteAsignatura.String
		} else {
			// Estado inicial por defecto (se calculará después)
			estadoDefault := "activa"
			asignatura.Estado = &estadoDefault
		}

		// Lógica para determinar qué nota mostrar:
		// 1. Si está matriculada (cursando actualmente), mostrar nota de estudiante_asignatura
		// 2. Si no está matriculada pero tiene historial, mostrar nota del historial
		// 3. Si tiene nota en estudiante_asignatura y está en estado "matriculada" o "cursada", usar esa
		if estaMatriculada && notaEstudianteAsignatura.Valid {
			// Está cursando actualmente, mostrar nota actual
			asignatura.Nota = &notaEstudianteAsignatura.Float64
		} else if estadoEstudianteAsignatura.Valid && (estadoEstudianteAsignatura.String == "matriculada" || estadoEstudianteAsignatura.String == "cursada") && notaEstudianteAsignatura.Valid {
			// Está matriculada o cursada según estudiante_asignatura
			asignatura.Nota = &notaEstudianteAsignatura.Float64
		} else if notaHistorial.Valid {
			// Si tiene historial académico, mostrar esa nota (fue cursada en algún momento)
			asignatura.Nota = &notaHistorial.Float64
		} else if notaEstudianteAsignatura.Valid {
			// Si tiene nota en estudiante_asignatura pero no en historial, usar esa
			asignatura.Nota = &notaEstudianteAsignatura.Float64
		}
		// Si no tiene ninguna nota, asignatura.Nota queda como nil

		asignatura.Repeticiones = repeticiones

		// Obtener prerrequisitos para esta asignatura con información de completitud
		// RN-25 a RN-32: Los prerrequisitos se validan según el pensum del estudiante (núcleo común)
		prerequisitos, err := h.getPrerequisitosConEstado(asignatura.ID, estudianteID, pensumID)
		if err != nil {
			log.Printf("Error getting prerequisitos for asignatura %d: %v", asignatura.ID, err)
		} else {
			asignatura.Prerequisitos = prerequisitos
			
			// Filtrar prerrequisitos faltantes (no completados)
			var faltantes []models.Prerequisito
			for _, prereq := range prerequisitos {
				if !prereq.Completado {
					faltantes = append(faltantes, prereq)
				}
			}
			asignatura.PrerequisitosFaltantes = faltantes
		}

		// Calcular estado correcto según las reglas de negocio (RN-01 a RN-32)
		estadoCalculado := h.calcularEstadoAsignatura(asignatura, estudianteID)
		asignatura.Estado = &estadoCalculado

		// Agregar al mapa de semestres
		semestresMap[asignatura.Semestre] = append(semestresMap[asignatura.Semestre], asignatura)
	}

	// Convertir mapa a slice de semestres ordenados
	var semestres []models.SemestrePensum
	for semestre := 1; semestre <= 20; semestre++ { // Asumimos máximo 20 semestres
		if asignaturas, exists := semestresMap[semestre]; exists {
			semestres = append(semestres, models.SemestrePensum{
				Numero:      semestre,
				Asignaturas: asignaturas,
			})
		}
	}

	// Construir respuesta
	log.Printf("📊 Construyendo respuesta: %d semestres encontrados", len(semestres))
	response := models.PensumEstudianteResponse{
		ProgramaNombre: programaNombre,
		PensumNombre:   pensumNombre,
		Semestres:      semestres,
	}

	w.Header().Set("Content-Type", "application/json")
	log.Printf("✅ Enviando respuesta JSON")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("❌ Error encoding response: %v", err)
		http.Error(w, "Error encoding response", http.StatusInternalServerError)
		return
	}
	log.Printf("✅ Respuesta enviada exitosamente")
}

// getPrerequisitos obtiene los prerrequisitos de una asignatura (versión simple)
// Nota: Esta función no se usa actualmente, pero se mantiene por compatibilidad
func (h *PensumHandler) getPrerequisitos(asignaturaID int) ([]models.Prerequisito, error) {
	query := `
		SELECT 
			pr.id,
			pr.asignatura_id,
			pr.prerequisito_id,
			a.codigo,
			a.nombre
		FROM pensum_prerequisito pr
		JOIN asignatura a ON pr.prerequisito_id = a.id
		WHERE pr.asignatura_id = $1
		ORDER BY a.codigo
	`
	rows, err := h.db.Query(query, asignaturaID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var prerequisitos []models.Prerequisito
	for rows.Next() {
		var prereq models.Prerequisito
		err := rows.Scan(
			&prereq.ID,
			&prereq.AsignaturaID,
			&prereq.PrerequisitoID,
			&prereq.Codigo,
			&prereq.Nombre,
		)
		if err != nil {
			return nil, err
		}
		prerequisitos = append(prerequisitos, prereq)
	}

	return prerequisitos, nil
}

// getPrerequisitosConEstado obtiene los prerrequisitos con información de si están completados
// RN-08: Un estudiante solo puede matricular una asignatura si ha aprobado todas las materias prerrequisito
// RN-10: Cadena de dependencia - los prerrequisitos se heredan
// RN-26: Para núcleo común, se validan los prerrequisitos del pensum del estudiante
func (h *PensumHandler) getPrerequisitosConEstado(asignaturaID int, estudianteID int, pensumID int) ([]models.Prerequisito, error) {
	query := `
		SELECT 
			pr.id,
			pr.asignatura_id,
			pr.prerequisito_id,
			a.codigo,
			a.nombre,
			COALESCE(pa.semestre, 0) as semestre,
			-- RN-08: Un prerrequisito está completado solo si está aprobado (nota >= 3.0 en historial)
			CASE 
				WHEN EXISTS (
					SELECT 1 FROM historial_academico ha
					WHERE ha.estudiante_id = $2 
					AND ha.asignatura_id = a.id 
					AND ha.aprobado = true
				) THEN true
				ELSE false
			END as completado
		FROM pensum_prerequisito pr
		JOIN asignatura a ON pr.prerequisito_id = a.id
		LEFT JOIN pensum_asignatura pa ON pa.asignatura_id = a.id AND pa.pensum_id = $3
		WHERE pr.asignatura_id = $1 AND pr.pensum_id = $3
		ORDER BY a.codigo
	`
	rows, err := h.db.Query(query, asignaturaID, estudianteID, pensumID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var prerequisitos []models.Prerequisito
	for rows.Next() {
		var prereq models.Prerequisito
		var semestre int
		err := rows.Scan(
			&prereq.ID,
			&prereq.AsignaturaID,
			&prereq.PrerequisitoID,
			&prereq.Codigo,
			&prereq.Nombre,
			&semestre,
			&prereq.Completado,
		)
		if err != nil {
			return nil, err
		}
		prereq.Semestre = semestre
		prerequisitos = append(prerequisitos, prereq)
	}

	return prerequisitos, nil
}

// calcularEstadoAsignatura calcula el estado correcto de una asignatura según las reglas de negocio
// Implementa RN-01 a RN-32
func (h *PensumHandler) calcularEstadoAsignatura(asignatura models.AsignaturaCompleta, estudianteID int) string {
	// RN-03: Una asignatura aprobada no puede volver a matricularse
	if asignatura.Estado != nil && *asignatura.Estado == "aprobada" {
		return "aprobada"
	}

	// RN-19, RN-20: Verificar si hay repetición obligatoria
	esRepeticionObligatoria, err := h.esRepeticionObligatoria(estudianteID, asignatura.ID)
	if err != nil {
		log.Printf("Error verificando repetición obligatoria: %v", err)
	} else if esRepeticionObligatoria {
		return "obligatoria_repeticion"
	}

	// RN-18: Verificar si está pendiente de repetición (primera vez reprobada)
	if asignatura.Estado != nil && *asignatura.Estado == "reprobada" {
		// Verificar si debe estar en pendiente_repeticion o ya pasó el periodo de gracia
		esPendienteRepeticion, err := h.esPendienteRepeticion(estudianteID, asignatura.ID)
		if err != nil {
			log.Printf("Error verificando pendiente repetición: %v", err)
		} else if esPendienteRepeticion {
			return "pendiente_repeticion"
		}
	}

	// RN-01, RN-02: Verificar prerrequisitos para determinar si está ACTIVA o EN ESPERA
	// RN-08: Un estudiante solo puede matricular una asignatura si ha aprobado todas las materias prerrequisito
	// RN-10: Cadena de dependencia - los prerrequisitos se heredan
	todosPrerequisitosCompletados := true
	for _, prereq := range asignatura.Prerequisitos {
		if !prereq.Completado {
			todosPrerequisitosCompletados = false
			break
		}
	}

	// RN-22: Verificar si está bloqueada por repetición obligatoria de otra materia
	estaBloqueada, err := h.estaBloqueadaPorRepeticionObligatoria(estudianteID, asignatura.ID)
	if err != nil {
		log.Printf("Error verificando bloqueo por repetición: %v", err)
	} else if estaBloqueada {
		// Si está bloqueada pero tiene prerrequisitos completados, sigue en espera
		// pero por bloqueo, no por prerrequisitos
		if !todosPrerequisitosCompletados {
			return "en_espera"
		}
		// Si tiene prerrequisitos completados pero está bloqueada, mantener estado actual
		// o retornar en_espera si no tiene estado específico
		if asignatura.Estado == nil {
			return "en_espera"
		}
	}

	// Si no tiene prerrequisitos y no está bloqueada, está activa (RN-01)
	if len(asignatura.Prerequisitos) == 0 {
		if asignatura.Estado != nil && (*asignatura.Estado == "matriculada" || *asignatura.Estado == "reprobada") {
			return *asignatura.Estado
		}
		return "activa"
	}

	// Si todos los prerrequisitos están completados, está activa (RN-01)
	if todosPrerequisitosCompletados {
		if asignatura.Estado != nil && (*asignatura.Estado == "matriculada" || *asignatura.Estado == "reprobada") {
			return *asignatura.Estado
		}
		return "activa"
	}

	// Si faltan prerrequisitos, está en espera (RN-02)
	return "en_espera"
}

// esRepeticionObligatoria verifica si una asignatura debe repetirse obligatoriamente
// RN-19: Si el estudiante NO repite la materia el periodo inmediatamente siguiente,
// entonces debe cursarla obligatoriamente en el segundo periodo después de haberla perdido
// RN-20: Si la reprueba dos veces, debe matricularla obligatoriamente en el siguiente periodo disponible
func (h *PensumHandler) esRepeticionObligatoria(estudianteID int, asignaturaID int) (bool, error) {
	// Obtener el último periodo donde se reprobó
	query := `
		SELECT periodo_id, estado, nota
		FROM estudiante_asignatura_intentos
		WHERE estudiante_id = $1 AND asignatura_id = $2
		ORDER BY periodo_id DESC
		LIMIT 2
	`
	rows, err := h.db.Query(query, estudianteID, asignaturaID)
	if err != nil {
		return false, err
	}
	defer rows.Close()

	var intentos []struct {
		periodoID int
		estado    string
		nota      sql.NullFloat64
	}

	for rows.Next() {
		var intento struct {
			periodoID int
			estado    string
			nota      sql.NullFloat64
		}
		if err := rows.Scan(&intento.periodoID, &intento.estado, &intento.nota); err != nil {
			continue
		}
		intentos = append(intentos, intento)
	}

	if len(intentos) == 0 {
		return false, nil
	}

	// RN-20: Si la reprueba dos veces, es obligatoria
	if len(intentos) >= 2 {
		// Verificar si los dos últimos intentos fueron reprobados
		ultimoReprobado := intentos[0].estado == "reprobado"
		penultimoReprobado := intentos[1].estado == "reprobado"
		if ultimoReprobado && penultimoReprobado {
			return true, nil
		}
	}

	// RN-19: Verificar si pasó el periodo de gracia
	if len(intentos) >= 1 && intentos[0].estado == "reprobado" {
		periodoReprobadoID := intentos[0].periodoID
		
		// Obtener el periodo activo actual
		var periodoActivoID sql.NullInt64
		queryPeriodo := `SELECT id FROM periodo_academico WHERE activo = true AND archivado = false ORDER BY year DESC, semestre DESC LIMIT 1`
		err := h.db.QueryRow(queryPeriodo).Scan(&periodoActivoID)
		if err != nil || !periodoActivoID.Valid {
			return false, nil
		}

		// Obtener información de los periodos
		var periodoReprobadoYear, periodoReprobadoSemestre int
		var periodoActivoYear, periodoActivoSemestre int
		
		queryPeriodoReprobado := `SELECT year, semestre FROM periodo_academico WHERE id = $1`
		err = h.db.QueryRow(queryPeriodoReprobado, periodoReprobadoID).Scan(&periodoReprobadoYear, &periodoReprobadoSemestre)
		if err != nil {
			return false, nil
		}

		queryPeriodoActivo := `SELECT year, semestre FROM periodo_academico WHERE id = $1`
		err = h.db.QueryRow(queryPeriodoActivo, periodoActivoID.Int64).Scan(&periodoActivoYear, &periodoActivoSemestre)
		if err != nil {
			return false, nil
		}

		// Calcular cuántos periodos han pasado
		periodosPasados := (periodoActivoYear-periodoReprobadoYear)*2 + (periodoActivoSemestre - periodoReprobadoSemestre)
		
		// Si han pasado 2 o más periodos desde que se reprobó, es obligatoria
		if periodosPasados >= 2 {
			// Verificar si ya se matriculó en algún periodo después de reprobar
			queryMatriculada := `
				SELECT COUNT(*) FROM matricula m
				JOIN grupo g ON m.grupo_id = g.id
				JOIN periodo_academico p ON m.periodo_id = p.id
				WHERE m.estudiante_id = $1 
				AND g.asignatura_id = $2
				AND (p.year > $3 OR (p.year = $3 AND p.semestre > $4))
				AND m.estado = 'inscrita'
			`
			var count int
			err = h.db.QueryRow(queryMatriculada, estudianteID, asignaturaID, periodoReprobadoYear, periodoReprobadoSemestre).Scan(&count)
			if err == nil && count == 0 {
				// No se ha matriculado después de reprobar, es obligatoria
				return true, nil
			}
		}
	}

	return false, nil
}

// esPendienteRepeticion verifica si una asignatura está pendiente de repetición (primera vez)
// RN-18: Si el estudiante reprueba una asignatura, puede repetirla en el periodo siguiente o no repetirla
func (h *PensumHandler) esPendienteRepeticion(estudianteID int, asignaturaID int) (bool, error) {
	// Obtener el último intento
	query := `
		SELECT periodo_id, estado
		FROM estudiante_asignatura_intentos
		WHERE estudiante_id = $1 AND asignatura_id = $2
		ORDER BY periodo_id DESC
		LIMIT 1
	`
	var periodoID int
	var estado string
	err := h.db.QueryRow(query, estudianteID, asignaturaID).Scan(&periodoID, &estado)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	if estado != "reprobado" {
		return false, nil
	}

	// Verificar si ya se matriculó en el periodo siguiente
	var periodoReprobadoYear, periodoReprobadoSemestre int
	queryPeriodo := `SELECT year, semestre FROM periodo_academico WHERE id = $1`
	err = h.db.QueryRow(queryPeriodo, periodoID).Scan(&periodoReprobadoYear, &periodoReprobadoSemestre)
	if err != nil {
		return false, nil
	}

	// Obtener el periodo activo actual
	var periodoActivoID sql.NullInt64
	queryPeriodoActivo := `SELECT id FROM periodo_academico WHERE activo = true AND archivado = false ORDER BY year DESC, semestre DESC LIMIT 1`
	err = h.db.QueryRow(queryPeriodoActivo).Scan(&periodoActivoID)
	if err != nil || !periodoActivoID.Valid {
		return false, nil
	}

	var periodoActivoYear, periodoActivoSemestre int
	queryPeriodoActivoInfo := `SELECT year, semestre FROM periodo_academico WHERE id = $1`
	err = h.db.QueryRow(queryPeriodoActivoInfo, periodoActivoID.Int64).Scan(&periodoActivoYear, &periodoActivoSemestre)
	if err != nil {
		return false, nil
	}

	// Calcular cuántos periodos han pasado
	periodosPasados := (periodoActivoYear-periodoReprobadoYear)*2 + (periodoActivoSemestre - periodoReprobadoSemestre)
	
	// Si pasó exactamente 1 periodo y no se ha matriculado, está pendiente
	if periodosPasados == 1 {
		queryMatriculada := `
			SELECT COUNT(*) FROM matricula m
			JOIN grupo g ON m.grupo_id = g.id
			WHERE m.estudiante_id = $1 
			AND g.asignatura_id = $2
			AND m.periodo_id = $3
			AND m.estado = 'inscrita'
		`
		var count int
		err = h.db.QueryRow(queryMatriculada, estudianteID, asignaturaID, periodoActivoID.Int64).Scan(&count)
		if err == nil && count == 0 {
			return true, nil
		}
	}

	return false, nil
}

// estaBloqueadaPorRepeticionObligatoria verifica si una asignatura está bloqueada
// porque el estudiante tiene materias obligatorias de repetición pendientes
// RN-22: No se puede matricular una asignatura avanzada si el estudiante tiene pendiente una materia obligatoria por repetición
func (h *PensumHandler) estaBloqueadaPorRepeticionObligatoria(estudianteID int, asignaturaID int) (bool, error) {
	// Obtener todas las asignaturas que están en estado obligatoria_repeticion
	query := `
		SELECT asignatura_id
		FROM estudiante_asignatura
		WHERE estudiante_id = $1
		AND estado = 'obligatoria_repeticion'
	`
	rows, err := h.db.Query(query, estudianteID)
	if err != nil {
		return false, err
	}
	defer rows.Close()

	var asignaturasObligatorias []int
	for rows.Next() {
		var asigID int
		if err := rows.Scan(&asigID); err != nil {
			continue
		}
		asignaturasObligatorias = append(asignaturasObligatorias, asigID)
	}

	if len(asignaturasObligatorias) == 0 {
		return false, nil
	}

	// Verificar si la asignatura actual tiene como prerrequisito alguna de las obligatorias
	// Si no tiene prerrequisitos directos, no está bloqueada
	// La lógica de bloqueo es: si hay una asignatura obligatoria de repetición,
	// todas las asignaturas avanzadas (que no sean esa misma) están bloqueadas
	
	// Obtener el semestre de la asignatura actual
	var semestreActual int
	querySemestre := `
		SELECT pa.semestre
		FROM pensum_asignatura pa
		JOIN estudiante_pensum ep ON pa.pensum_id = ep.pensum_id
		WHERE pa.asignatura_id = $1 AND ep.estudiante_id = $2
		LIMIT 1
	`
	err = h.db.QueryRow(querySemestre, asignaturaID, estudianteID).Scan(&semestreActual)
	if err != nil {
		return false, nil
	}

	// Obtener el semestre de las asignaturas obligatorias
	for _, asigObligID := range asignaturasObligatorias {
		if asigObligID == asignaturaID {
			// La misma asignatura no se bloquea a sí misma
			continue
		}

		var semestreOblig int
		querySemestreOblig := `
			SELECT pa.semestre
			FROM pensum_asignatura pa
			JOIN estudiante_pensum ep ON pa.pensum_id = ep.pensum_id
			WHERE pa.asignatura_id = $1 AND ep.estudiante_id = $2
			LIMIT 1
		`
		err = h.db.QueryRow(querySemestreOblig, asigObligID, estudianteID).Scan(&semestreOblig)
		if err != nil {
			continue
		}

		// Si la asignatura actual está en un semestre mayor que la obligatoria, está bloqueada
		if semestreActual > semestreOblig {
			return true, nil
		}
	}

	return false, nil
}

// ActualizarEstadosPorPrerequisitos actualiza automáticamente los estados de las asignaturas
// cuando se aprueba un prerrequisito. Se debe llamar cuando una asignatura cambia a "cursada"
func (h *PensumHandler) ActualizarEstadosPorPrerequisitos(estudianteID int, asignaturaAprobadaID int) error {
	// Obtener todas las asignaturas que tienen como prerrequisito la asignatura aprobada
	// Obtener pensum del estudiante primero
	var pensumID int
	queryPensum := `SELECT pensum_id FROM estudiante_pensum WHERE estudiante_id = $1`
	err := h.db.QueryRow(queryPensum, estudianteID).Scan(&pensumID)
	if err != nil {
		return err
	}
	
	query := `
		SELECT DISTINCT pr.asignatura_id
		FROM pensum_prerequisito pr
		WHERE pr.prerequisito_id = $1 AND pr.pensum_id = $2
	`
	rows, err := h.db.Query(query, asignaturaAprobadaID, pensumID)
	if err != nil {
		return err
	}
	defer rows.Close()

	var asignaturasAfectadas []int
	for rows.Next() {
		var asignaturaID int
		if err := rows.Scan(&asignaturaID); err != nil {
			continue
		}
		asignaturasAfectadas = append(asignaturasAfectadas, asignaturaID)
	}

	// pensumID ya se obtuvo arriba

	// Para cada asignatura afectada, verificar si ahora puede activarse
	for _, asignaturaID := range asignaturasAfectadas {
		// Obtener todos los prerrequisitos de esta asignatura
		prerequisitos, err := h.getPrerequisitosConEstado(asignaturaID, estudianteID, pensumID)
		if err != nil {
			log.Printf("Error getting prerequisitos for asignatura %d: %v", asignaturaID, err)
			continue
		}

		// Verificar si todos los prerrequisitos están completados
		todosCompletados := true
		for _, prereq := range prerequisitos {
			if !prereq.Completado {
				todosCompletados = false
				break
			}
		}

		// Si todos los prerrequisitos están completados, actualizar estado a "activa"
		if todosCompletados {
			// Verificar estado actual
			var estadoActual sql.NullString
			queryEstado := `SELECT estado FROM estudiante_asignatura WHERE estudiante_id = $1 AND asignatura_id = $2`
			err := h.db.QueryRow(queryEstado, estudianteID, asignaturaID).Scan(&estadoActual)
			
			// Solo actualizar si está en "en_espera" o no existe
			if err == sql.ErrNoRows {
				// Insertar como activa
				insert := `INSERT INTO estudiante_asignatura (estudiante_id, asignatura_id, estado) VALUES ($1, $2, 'activa')`
				_, err = h.db.Exec(insert, estudianteID, asignaturaID)
				if err != nil {
					log.Printf("Error inserting estudiante_asignatura: %v", err)
				}
			} else if err == nil && estadoActual.Valid && estadoActual.String == "en_espera" {
				// Actualizar de "en_espera" a "activa"
				update := `UPDATE estudiante_asignatura SET estado = 'activa' WHERE estudiante_id = $1 AND asignatura_id = $2`
				_, err = h.db.Exec(update, estudianteID, asignaturaID)
				if err != nil {
					log.Printf("Error updating estudiante_asignatura: %v", err)
				}
			}
		}
	}

	return nil
}

// calcularPosicionesJerarquicas calcula posiciones X, Y para cada asignatura
// organizándolas jerárquicamente por semestre y dependencias
func (h *PensumHandler) calcularPosicionesJerarquicas(semestres *[]models.SemestrePensum) {
	// Constantes para el layout
	const (
		spacingX     = 180.0 // Espaciado horizontal entre asignaturas
		spacingY     = 150.0 // Espaciado vertical entre semestres
		startX       = 100.0 // Posición inicial X
		startY       = 100.0 // Posición inicial Y
		minSpacingX  = 160.0 // Espaciado mínimo horizontal
	)

	// Crear mapa de todas las asignaturas por ID para acceso rápido
	asignaturasMap := make(map[int]*models.AsignaturaCompleta)
	for i := range *semestres {
		for j := range (*semestres)[i].Asignaturas {
			asignatura := &(*semestres)[i].Asignaturas[j]
			asignaturasMap[asignatura.ID] = asignatura
		}
	}

	// Calcular posiciones para cada semestre
	for semestreIdx := range *semestres {
		semestre := &(*semestres)[semestreIdx]
		
		// Posición Y basada en el semestre
		posY := startY + float64(semestre.Numero-1)*spacingY

		// Ordenar asignaturas dentro del semestre considerando dependencias
		asignaturasOrdenadas := h.ordenarAsignaturasPorDependencias(semestre.Asignaturas, asignaturasMap)

		// Calcular posiciones X para minimizar cruces
		posicionesX := h.calcularPosicionesX(asignaturasOrdenadas, asignaturasMap, startX, spacingX)

		// Asignar posiciones a cada asignatura
		for i, asignatura := range asignaturasOrdenadas {
			posX := posicionesX[i]
			asignatura.PosicionX = &posX
			asignatura.PosicionY = &posY
		}

		// Actualizar el slice original con las asignaturas ordenadas
		semestre.Asignaturas = asignaturasOrdenadas
	}
}

// ordenarAsignaturasPorDependencias ordena las asignaturas considerando sus dependencias
// para minimizar cruces de líneas
func (h *PensumHandler) ordenarAsignaturasPorDependencias(
	asignaturas []models.AsignaturaCompleta,
	asignaturasMap map[int]*models.AsignaturaCompleta,
) []models.AsignaturaCompleta {
	// Crear una copia para ordenar
	ordenadas := make([]models.AsignaturaCompleta, len(asignaturas))
	copy(ordenadas, asignaturas)

	// Ordenar por número de prerrequisitos (menos primero) y luego por código
	// Esto ayuda a agrupar asignaturas relacionadas
	for i := 0; i < len(ordenadas)-1; i++ {
		for j := i + 1; j < len(ordenadas); j++ {
			prereqsI := len(ordenadas[i].Prerequisitos)
			prereqsJ := len(ordenadas[j].Prerequisitos)

			// Si tienen diferente número de prerrequisitos, ordenar por cantidad
			if prereqsI != prereqsJ {
				if prereqsI > prereqsJ {
					ordenadas[i], ordenadas[j] = ordenadas[j], ordenadas[i]
				}
				continue
			}

			// Si tienen el mismo número, ordenar por código para consistencia
			if ordenadas[i].Codigo > ordenadas[j].Codigo {
				ordenadas[i], ordenadas[j] = ordenadas[j], ordenadas[i]
			}
		}
	}

	return ordenadas
}

// calcularPosicionesX calcula posiciones X para minimizar cruces de líneas
// Considera las posiciones de los prerrequisitos para posicionar las asignaturas cerca de ellos
func (h *PensumHandler) calcularPosicionesX(
	asignaturas []models.AsignaturaCompleta,
	asignaturasMap map[int]*models.AsignaturaCompleta,
	startX float64,
	spacingX float64,
) []float64 {
	if len(asignaturas) == 0 {
		return []float64{}
	}

	posiciones := make([]float64, len(asignaturas))
	
	// Si solo hay una asignatura, centrarla
	if len(asignaturas) == 1 {
		posiciones[0] = startX
		return posiciones
	}

	// Primera pasada: calcular posiciones ideales basadas en prerrequisitos
	posicionesIdeales := make([]float64, len(asignaturas))
	sinPrerequisitos := []int{}
	
	for i, asignatura := range asignaturas {
		if len(asignatura.Prerequisitos) == 0 {
			// Sin prerrequisitos, guardar índice para distribuir después
			sinPrerequisitos = append(sinPrerequisitos, i)
		} else {
			// Calcular posición promedio de los prerrequisitos
			sumaX := 0.0
			count := 0
			for _, prereq := range asignatura.Prerequisitos {
				if prereqAsig, exists := asignaturasMap[prereq.PrerequisitoID]; exists {
					if prereqAsig.PosicionX != nil {
						sumaX += *prereqAsig.PosicionX
						count++
					}
				}
			}
			if count > 0 {
				posicionesIdeales[i] = sumaX / float64(count)
			} else {
				// Si no se encontraron prerrequisitos, usar posición por defecto
				posicionesIdeales[i] = startX + float64(i)*spacingX
			}
		}
	}
	
	// Distribuir asignaturas sin prerrequisitos uniformemente
	if len(sinPrerequisitos) > 0 {
		anchoTotal := float64(len(sinPrerequisitos)-1) * spacingX
		posInicial := startX - anchoTotal/2
		for idx, i := range sinPrerequisitos {
			posicionesIdeales[i] = posInicial + float64(idx)*spacingX
		}
	}

	// Segunda pasada: ajustar posiciones para evitar solapamientos
	// Ordenar por posición ideal
	indices := make([]int, len(asignaturas))
	for i := range indices {
		indices[i] = i
	}
	
	// Ordenar índices por posición ideal
	for i := 0; i < len(indices)-1; i++ {
		for j := i + 1; j < len(indices); j++ {
			if posicionesIdeales[indices[i]] > posicionesIdeales[indices[j]] {
				indices[i], indices[j] = indices[j], indices[i]
			}
		}
	}

	// Asignar posiciones respetando el orden y evitando solapamientos
	posActual := startX
	for _, idx := range indices {
		posIdeal := posicionesIdeales[idx]
		
		// Si la posición ideal está muy cerca de la anterior, ajustarla
		if posIdeal < posActual {
			posiciones[idx] = posActual
		} else {
			posiciones[idx] = posIdeal
		}
		
		// Asegurar espaciado mínimo
		posActual = posiciones[idx] + spacingX
	}

	// Centrar el conjunto si es necesario
	minPos := posiciones[0]
	maxPos := posiciones[0]
	for _, pos := range posiciones {
		if pos < minPos {
			minPos = pos
		}
		if pos > maxPos {
			maxPos = pos
		}
	}
	
	// Ajustar para centrar alrededor de startX si hay mucho espacio
	centroActual := (minPos + maxPos) / 2
	offset := startX - centroActual
	if offset > -spacingX && offset < spacingX {
		for i := range posiciones {
			posiciones[i] += offset
		}
	}

	return posiciones
}

// agruparPorPrerequisitosCompartidos agrupa asignaturas que comparten prerrequisitos
func (h *PensumHandler) agruparPorPrerequisitosCompartidos(
	asignaturas []models.AsignaturaCompleta,
) [][]int {
	grupos := [][]int{}
	asignadas := make(map[int]bool)

	for i := range asignaturas {
		if asignadas[i] {
			continue
		}

		grupo := []int{i}
		asignadas[i] = true

		// Buscar asignaturas que compartan prerrequisitos
		prereqsI := h.obtenerIDsPrerequisitos(asignaturas[i].Prerequisitos)
		
		for j := i + 1; j < len(asignaturas); j++ {
			if asignadas[j] {
				continue
			}

			prereqsJ := h.obtenerIDsPrerequisitos(asignaturas[j].Prerequisitos)
			
			// Si comparten al menos un prerrequisito, agruparlas
			if h.tienenPrerequisitosCompartidos(prereqsI, prereqsJ) {
				grupo = append(grupo, j)
				asignadas[j] = true
			}
		}

		if len(grupo) > 0 {
			grupos = append(grupos, grupo)
		}
	}

	return grupos
}

// obtenerIDsPrerequisitos extrae los IDs de los prerrequisitos
func (h *PensumHandler) obtenerIDsPrerequisitos(prerequisitos []models.Prerequisito) []int {
	ids := make([]int, len(prerequisitos))
	for i, prereq := range prerequisitos {
		ids[i] = prereq.PrerequisitoID
	}
	return ids
}

// tienenPrerequisitosCompartidos verifica si dos listas de prerrequisitos tienen elementos en común
func (h *PensumHandler) tienenPrerequisitosCompartidos(prereqs1, prereqs2 []int) bool {
	for _, p1 := range prereqs1 {
		for _, p2 := range prereqs2 {
			if p1 == p2 {
				return true
			}
		}
	}
	return false
}

