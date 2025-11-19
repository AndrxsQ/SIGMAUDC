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
	log.Printf("GetPensumEstudiante: Iniciando request")
	
	claims, err := h.getClaims(r)
	if err != nil {
		log.Printf("GetPensumEstudiante: Error getting claims: %v", err)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if claims.Rol != "estudiante" {
		log.Printf("GetPensumEstudiante: Rol no es estudiante: %s", claims.Rol)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	
	log.Printf("GetPensumEstudiante: Claims obtenidos correctamente, estudiante_id: %d", claims.Sub)

	// Obtener estudiante_id
	var estudianteID int
	queryEstudiante := `SELECT id FROM estudiante WHERE usuario_id = $1`
	err = h.db.QueryRow(queryEstudiante, claims.Sub).Scan(&estudianteID)
	if err == sql.ErrNoRows {
		log.Printf("GetPensumEstudiante: Estudiante no encontrado para usuario_id: %d", claims.Sub)
		http.Error(w, "Estudiante no encontrado", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("GetPensumEstudiante: Error getting estudiante: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	log.Printf("GetPensumEstudiante: Estudiante encontrado, estudiante_id: %d", estudianteID)

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
	err = h.db.QueryRow(queryPensum, estudianteID).Scan(&pensumID, &pensumNombre, &programaNombre)
	if err == sql.ErrNoRows {
		log.Printf("GetPensumEstudiante: Pensum no asignado al estudiante_id: %d", estudianteID)
		http.Error(w, "Pensum no asignado al estudiante", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("GetPensumEstudiante: Error getting pensum: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	log.Printf("GetPensumEstudiante: Pensum encontrado, pensum_id: %d, nombre: %s", pensumID, pensumNombre)

	// Obtener periodo activo para verificar matrícula actual
	var periodoActivoID sql.NullInt64
	queryPeriodoActivo := `SELECT id FROM periodo_academico WHERE activo = true AND archivado = false LIMIT 1`
	errPeriodo := h.db.QueryRow(queryPeriodoActivo).Scan(&periodoActivoID)
	if errPeriodo != nil && errPeriodo != sql.ErrNoRows {
		log.Printf("GetPensumEstudiante: Error getting periodo activo: %v", errPeriodo)
		// Continuar sin periodo activo si hay error
		periodoActivoID = sql.NullInt64{Valid: false}
	}
	
	if periodoActivoID.Valid {
		log.Printf("GetPensumEstudiante: Periodo activo encontrado, periodo_id: %d", periodoActivoID.Int64)
	} else {
		log.Printf("GetPensumEstudiante: No hay periodo activo")
	}

	// Obtener todas las asignaturas del pensum organizadas por semestre
	// Incluye información de matrícula actual e historial académico
	// Usamos una subquery para el periodo activo para evitar problemas con NULL
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
			COALESCE(ea.estado, 'activa') as estado,
			ea.nota as nota_estudiante_asignatura,
			COALESCE(ea.repeticiones, 0) as repeticiones,
			-- Nota del historial académico (última nota registrada)
			(SELECT ha.nota 
			 FROM historial_academico ha 
			 WHERE ha.estudiante_id = $1 AND ha.asignatura_id = a.id 
			 ORDER BY ha.id DESC 
			 LIMIT 1) as nota_historial,
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
	rows, err := h.db.Query(queryAsignaturas, estudianteID, pensumID)
	if err != nil {
		log.Printf("Error querying asignaturas: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	// Mapa para organizar asignaturas por semestre
	semestresMap := make(map[int][]models.AsignaturaCompleta)

	for rows.Next() {
		var asignatura models.AsignaturaCompleta
		var estado sql.NullString
		var notaEstudianteAsignatura sql.NullFloat64
		var notaHistorial sql.NullFloat64
		var repeticiones int
		var estaMatriculada bool

		err := rows.Scan(
			&asignatura.Semestre,
			&asignatura.ID,
			&asignatura.Codigo,
			&asignatura.Nombre,
			&asignatura.Creditos,
			&asignatura.TipoNombre,
			&asignatura.TieneLaboratorio,
			&asignatura.Categoria,
			&estado,
			&notaEstudianteAsignatura,
			&repeticiones,
			&notaHistorial,
			&estaMatriculada,
		)
		if err != nil {
			log.Printf("Error scanning asignatura: %v", err)
			continue
		}

		// Determinar estado: si está matriculada en el periodo actual, el estado es "matriculada"
		if estaMatriculada {
			estadoMatriculada := "matriculada"
			asignatura.Estado = &estadoMatriculada
		} else if estado.Valid {
			asignatura.Estado = &estado.String
		} else {
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
		} else if estado.Valid && (estado.String == "matriculada" || estado.String == "cursada") && notaEstudianteAsignatura.Valid {
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

		// Calcular estado correcto según prerrequisitos
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
	response := models.PensumEstudianteResponse{
		ProgramaNombre: programaNombre,
		PensumNombre:   pensumNombre,
		Semestres:      semestres,
	}

	log.Printf("GetPensumEstudiante: Respuesta construida, %d semestres encontrados", len(semestres))
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("GetPensumEstudiante: Error encoding response: %v", err)
		http.Error(w, "Error encoding response", http.StatusInternalServerError)
		return
	}
	log.Printf("GetPensumEstudiante: Respuesta enviada exitosamente")
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
func (h *PensumHandler) getPrerequisitosConEstado(asignaturaID int, estudianteID int, pensumID int) ([]models.Prerequisito, error) {
	query := `
		SELECT 
			pr.id,
			pr.asignatura_id,
			pr.prerequisito_id,
			a.codigo,
			a.nombre,
			COALESCE(pa.semestre, 0) as semestre,
			CASE 
				WHEN ea.estado = 'aprobada' OR (ea.estado = 'cursada' AND (ea.nota IS NULL OR ea.nota >= 3.0)) THEN true
				ELSE false
			END as completado
		FROM pensum_prerequisito pr
		JOIN asignatura a ON pr.prerequisito_id = a.id
		LEFT JOIN pensum_asignatura pa ON pa.asignatura_id = a.id AND pa.pensum_id = $3
		LEFT JOIN estudiante_asignatura ea ON ea.estudiante_id = $2 AND ea.asignatura_id = a.id
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

// calcularEstadoAsignatura calcula el estado correcto de una asignatura según sus prerrequisitos
func (h *PensumHandler) calcularEstadoAsignatura(asignatura models.AsignaturaCompleta, estudianteID int) string {
	// Si ya tiene un estado específico que no sea "activa" o "en_espera", mantenerlo
	if asignatura.Estado != nil {
		estadoActual := *asignatura.Estado
		if estadoActual == "cursada" || estadoActual == "matriculada" || 
		   estadoActual == "pendiente_repeticion" || estadoActual == "obligatoria_repeticion" {
			return estadoActual
		}
	}

	// Si no tiene prerrequisitos, está activa
	if len(asignatura.Prerequisitos) == 0 {
		return "activa"
	}

	// Verificar si todos los prerrequisitos están completados
	todosCompletados := true
	for _, prereq := range asignatura.Prerequisitos {
		if !prereq.Completado {
			todosCompletados = false
			break
		}
	}

	if todosCompletados {
		// Si todos los prerrequisitos están completados y no tiene estado específico, está activa
		if asignatura.Estado == nil || *asignatura.Estado == "activa" || *asignatura.Estado == "en_espera" {
			return "activa"
		}
		return *asignatura.Estado
	}

	// Si faltan prerrequisitos, está en espera
	return "en_espera"
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

