package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/andrxsq/SIGMAUDC/internal/models"
	"github.com/andrxsq/SIGMAUDC/internal/utils"
	"github.com/gorilla/mux"
)

type DocumentosHandler struct {
	db              *sql.DB
	uploadDirectory string
}

func NewDocumentosHandler(db *sql.DB) *DocumentosHandler {
	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "./uploads"
	}
	// Crear directorio si no existe
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		log.Printf("Error creating upload directory %s: %v", uploadDir, err)
	} else {
		log.Printf("Upload directory configured: %s", uploadDir)
	}
	return &DocumentosHandler{
		db:              db,
		uploadDirectory: uploadDir,
	}
}

func (h *DocumentosHandler) getClaims(r *http.Request) (*models.JWTClaims, error) {
	claims, ok := r.Context().Value("claims").(*models.JWTClaims)
	if !ok || claims == nil {
		return nil, errors.New("unauthorized")
	}
	return claims, nil
}

// verificarPlazosDocumentos verifica si el periodo está activo y el plazo de documentos está habilitado
func (h *DocumentosHandler) verificarPlazosDocumentos(programaID int) (*models.Plazos, *models.PeriodoAcademico, error) {
	// Buscar periodo activo
	var periodo models.PeriodoAcademico
	queryPeriodo := `SELECT id, year, semestre, activo, archivado 
					 FROM periodo_academico 
					 WHERE activo = true AND archivado = false 
					 LIMIT 1`
	err := h.db.QueryRow(queryPeriodo).Scan(
		&periodo.ID,
		&periodo.Year,
		&periodo.Semestre,
		&periodo.Activo,
		&periodo.Archivado,
	)
	if err == sql.ErrNoRows {
		return nil, nil, errors.New("no hay periodo académico activo")
	}
	if err != nil {
		return nil, nil, err
	}

	// Buscar plazos para el programa y periodo
	var plazos models.Plazos
	queryPlazos := `SELECT id, periodo_id, programa_id, documentos, inscripcion, modificaciones 
					FROM plazos 
					WHERE periodo_id = $1 AND programa_id = $2`
	err = h.db.QueryRow(queryPlazos, periodo.ID, programaID).Scan(
		&plazos.ID,
		&plazos.PeriodoID,
		&plazos.ProgramaID,
		&plazos.Documentos,
		&plazos.Inscripcion,
		&plazos.Modificaciones,
	)
	if err == sql.ErrNoRows {
		return nil, nil, errors.New("no hay plazos configurados para este programa en el periodo activo")
	}
	if err != nil {
		return nil, nil, err
	}

	if !plazos.Documentos {
		return nil, nil, errors.New("el plazo de documentos no está activo para este programa")
	}

	return &plazos, &periodo, nil
}

// GetDocumentosEstudiante obtiene los documentos de un estudiante
func (h *DocumentosHandler) GetDocumentosEstudiante(w http.ResponseWriter, r *http.Request) {
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

	// Verificar plazos
	var plazoMensaje string
	plazos, periodo, err := h.verificarPlazosDocumentos(claims.ProgramaID)
	if err != nil {
		plazos = nil
		periodo = nil
		plazoMensaje = err.Error()
	}

	// Obtener documentos del estudiante para el periodo activo
	var documentos []models.DocumentoEstudiante
	if periodo != nil {
		query := `SELECT id, estudiante_id, programa_id, periodo_id, tipo_documento, archivo_url, 
				  estado, observacion, revisado_por, fecha_subida, fecha_revision
				  FROM documentos_estudiante 
				  WHERE estudiante_id = $1 AND periodo_id = $2
				  ORDER BY fecha_subida DESC`
		rows, err := h.db.Query(query, estudianteID, periodo.ID)
		if err != nil {
			log.Printf("Error querying documentos: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		for rows.Next() {
			var doc models.DocumentoEstudiante
			var observacion sql.NullString
			var revisadoPor sql.NullInt64
			var fechaRevision sql.NullTime

			err := rows.Scan(
				&doc.ID,
				&doc.EstudianteID,
				&doc.ProgramaID,
				&doc.PeriodoID,
				&doc.TipoDocumento,
				&doc.ArchivoURL,
				&doc.Estado,
				&observacion,
				&revisadoPor,
				&doc.FechaSubida,
				&fechaRevision,
			)
			if err != nil {
				log.Printf("Error scanning documento: %v", err)
				continue
			}

			if observacion.Valid {
				doc.Observacion = models.NullStringJSON{NullString: observacion}
			} else {
				doc.Observacion = models.NullStringJSON{NullString: sql.NullString{Valid: false}}
			}
			if revisadoPor.Valid {
				doc.RevisadoPor = revisadoPor
			}
			if fechaRevision.Valid {
				doc.FechaRevision = fechaRevision
			}

			documentos = append(documentos, doc)
		}
	}

	// Verificar si todos los documentos están aprobados
	documentosAprobados := true
	if len(documentos) < 2 { // Necesita certificado_eps y comprobante_matricula
		documentosAprobados = false
	} else {
		for _, doc := range documentos {
			if doc.Estado != "aprobado" {
				documentosAprobados = false
				break
			}
		}
	}

	puedeSubir := false
	if plazos != nil && plazos.Documentos && periodo != nil {
		puedeSubir = true
	}

	response := models.DocumentosEstudianteResponse{
		Documentos:          documentos,
		PeriodoActivo:       periodo,
		PlazoDocumentos:     plazos != nil && plazos.Documentos,
		PuedeSubir:          puedeSubir,
		DocumentosAprobados: documentosAprobados,
		PlazoMensaje:        plazoMensaje,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// SubirDocumento sube un documento para un estudiante
func (h *DocumentosHandler) SubirDocumento(w http.ResponseWriter, r *http.Request) {
	claims, err := h.getClaims(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if claims.Rol != "estudiante" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Verificar plazos
	_, periodo, err := h.verificarPlazosDocumentos(claims.ProgramaID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
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

	// Parsear multipart form (máximo 5MB)
	r.ParseMultipartForm(5 << 20)

	tipoDocumento := r.FormValue("tipo_documento")
	if tipoDocumento != "certificado_eps" && tipoDocumento != "comprobante_matricula" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "tipo_documento inválido. Debe ser 'certificado_eps' o 'comprobante_matricula'"})
		return
	}

	file, handler, err := r.FormFile("archivo")
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "archivo requerido"})
		return
	}
	defer file.Close()

	// Validar tamaño del archivo (máximo 5MB)
	if handler.Size > 5*1024*1024 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "El archivo excede el tamaño máximo de 5MB"})
		return
	}

	// Validar extensión
	ext := strings.ToLower(filepath.Ext(handler.Filename))
	allowedExts := []string{".pdf", ".png", ".jpg", ".jpeg"}
	allowed := false
	for _, e := range allowedExts {
		if ext == e {
			allowed = true
			break
		}
	}
	if !allowed {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "formato de archivo no permitido. Solo PDF, PNG, JPG, JPEG"})
		return
	}

	// Obtener nombre del archivo sin extensión
	filenameWithoutExt := strings.TrimSuffix(handler.Filename, ext)

	// Verificar si ya existe un documento de este tipo para este estudiante y periodo
	var docExistente models.DocumentoEstudiante
	queryExistente := `SELECT id, estado FROM documentos_estudiante 
					   WHERE estudiante_id = $1 AND periodo_id = $2 AND tipo_documento = $3
					   ORDER BY fecha_subida DESC LIMIT 1`
	err = h.db.QueryRow(queryExistente, estudianteID, periodo.ID, tipoDocumento).Scan(
		&docExistente.ID,
		&docExistente.Estado,
	)

	if err == nil {
		// Documento existe
		if docExistente.Estado == "pendiente" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "Documento ya subido, pendiente de revisión"})
			return
		}
		if docExistente.Estado == "aprobado" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "Documento ya aprobado"})
			return
		}
		// Si es rechazado, permitir resubida (actualizar registro existente)
	}

	// Obtener información del programa para crear la estructura de carpetas
	var programaNombre string
	queryPrograma := `SELECT nombre FROM programa WHERE id = $1`
	err = h.db.QueryRow(queryPrograma, claims.ProgramaID).Scan(&programaNombre)
	if err != nil {
		log.Printf("Error getting programa: %v", err)
		programaNombre = fmt.Sprintf("programa_%d", claims.ProgramaID)
	}

	// Obtener código del estudiante para la carpeta
	var estudianteCodigo string
	queryCodigo := `SELECT codigo FROM usuario WHERE id = $1`
	err = h.db.QueryRow(queryCodigo, claims.Sub).Scan(&estudianteCodigo)
	if err != nil {
		log.Printf("Error getting codigo: %v", err)
		estudianteCodigo = fmt.Sprintf("estudiante_%d", estudianteID)
	}

	// Crear estructura de carpetas: periodo/programa/estudiante/
	periodoFolder := fmt.Sprintf("%d-%d", periodo.Year, periodo.Semestre)
	programaFolder := strings.ReplaceAll(strings.ToLower(programaNombre), " ", "_")
	programaFolder = fmt.Sprintf("%d_%s", claims.ProgramaID, programaFolder)
	estudianteFolder := fmt.Sprintf("%d_%s", estudianteID, estudianteCodigo)

	uploadPath := filepath.Join(h.uploadDirectory, periodoFolder, programaFolder, estudianteFolder)

	// Crear directorios si no existen
	if err := os.MkdirAll(uploadPath, 0755); err != nil {
		log.Printf("Error creating directories: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Generar nombre único para el archivo (sin duplicar extensión)
	timestamp := time.Now().Unix()
	filename := fmt.Sprintf("%d_%d_%s_%s%s", estudianteID, timestamp, tipoDocumento, filenameWithoutExt, ext)
	filePath := filepath.Join(uploadPath, filename)

	// Crear archivo en el servidor
	dst, err := os.Create(filePath)
	if err != nil {
		log.Printf("Error creating file: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	// Copiar contenido del archivo
	_, err = io.Copy(dst, file)
	if err != nil {
		log.Printf("Error copying file: %v", err)
		os.Remove(filePath) // Limpiar si falla
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// URL relativa del archivo (mantener estructura de carpetas)
	archivoURL := fmt.Sprintf("/uploads/%s/%s/%s/%s", periodoFolder, programaFolder, estudianteFolder, filename)

	// Insertar o actualizar en la base de datos
	if err == sql.ErrNoRows || docExistente.ID == 0 {
		// Insertar nuevo
		insert := `INSERT INTO documentos_estudiante 
				   (estudiante_id, programa_id, periodo_id, tipo_documento, archivo_url, estado)
				   VALUES ($1, $2, $3, $4, $5, 'pendiente')
				   RETURNING id, fecha_subida`
		var docID int
		var fechaSubida time.Time
		err = h.db.QueryRow(insert, estudianteID, claims.ProgramaID, periodo.ID, tipoDocumento, archivoURL).Scan(
			&docID, &fechaSubida,
		)
		if err != nil {
			log.Printf("Error inserting documento: %v", err)
			os.Remove(filePath) // Limpiar si falla
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Registrar auditoría: estudiante sube documento
		ip := utils.GetIPAddress(r)
		userAgent := r.UserAgent()
		descripcion := fmt.Sprintf("Documento subido: %s, Periodo: %d-%d", tipoDocumento, periodo.Year, periodo.Semestre)
		h.registrarAuditoria(claims.Sub, "subida_documento", descripcion, ip, userAgent)

		response := map[string]interface{}{
			"id":             docID,
			"tipo_documento": tipoDocumento,
			"estado":         "pendiente",
			"fecha_subida":   fechaSubida,
			"message":        "Documento subido exitosamente",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	} else {
		// Actualizar existente (rechazado)
		// Eliminar archivo anterior si existe
		var archivoAnterior string
		queryAnterior := `SELECT archivo_url FROM documentos_estudiante WHERE id = $1`
		h.db.QueryRow(queryAnterior, docExistente.ID).Scan(&archivoAnterior)
		if archivoAnterior != "" && strings.HasPrefix(archivoAnterior, "/uploads/") {
			// Remover el prefijo /uploads/ y construir la ruta completa
			relativePath := strings.TrimPrefix(archivoAnterior, "/uploads/")
			oldPath := filepath.Join(h.uploadDirectory, relativePath)
			if err := os.Remove(oldPath); err != nil {
				log.Printf("Warning: could not remove old file %s: %v", oldPath, err)
			}
		}

		update := `UPDATE documentos_estudiante 
				   SET archivo_url = $1, estado = 'pendiente', observacion = NULL, 
				       revisado_por = NULL, fecha_revision = NULL, fecha_subida = CURRENT_TIMESTAMP
				   WHERE id = $2
				   RETURNING fecha_subida`
		var fechaSubida time.Time
		err = h.db.QueryRow(update, archivoURL, docExistente.ID).Scan(&fechaSubida)
		if err != nil {
			log.Printf("Error updating documento: %v", err)
			os.Remove(filePath) // Limpiar si falla
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Registrar auditoría: estudiante resube documento rechazado
		ip := utils.GetIPAddress(r)
		userAgent := r.UserAgent()
		descripcion := fmt.Sprintf("Documento resubido: %s, Periodo: %d-%d (anteriormente rechazado)", tipoDocumento, periodo.Year, periodo.Semestre)
		h.registrarAuditoria(claims.Sub, "resubida_documento", descripcion, ip, userAgent)

		response := map[string]interface{}{
			"id":             docExistente.ID,
			"tipo_documento": tipoDocumento,
			"estado":         "pendiente",
			"fecha_subida":   fechaSubida,
			"message":        "Documento resubido exitosamente",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}

// GetDocumentosPorPrograma obtiene todos los documentos pendientes/rechazados de un programa (para jefatura)
func (h *DocumentosHandler) GetDocumentosPorPrograma(w http.ResponseWriter, r *http.Request) {
	claims, err := h.getClaims(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if claims.Rol != "jefe_departamental" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Obtener periodo activo
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
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]models.DocumentoEstudiante{})
		return
	}
	if err != nil {
		log.Printf("Error getting periodo: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Obtener documentos del programa para el periodo activo
	query := `SELECT d.id, d.estudiante_id, d.programa_id, d.periodo_id, d.tipo_documento, 
			  d.archivo_url, d.estado, d.observacion, d.revisado_por, d.fecha_subida, d.fecha_revision,
			  e.nombre, e.apellido, u.codigo
			  FROM documentos_estudiante d
			  JOIN estudiante e ON d.estudiante_id = e.id
			  JOIN usuario u ON e.usuario_id = u.id
			  WHERE d.programa_id = $1 AND d.periodo_id = $2
			  ORDER BY d.fecha_subida DESC`
	rows, err := h.db.Query(query, claims.ProgramaID, periodo.ID)
	if err != nil {
		log.Printf("Error querying documentos: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var documentos []models.DocumentoEstudiante
	for rows.Next() {
		var doc models.DocumentoEstudiante
		var observacion sql.NullString
		var revisadoPor sql.NullInt64
		var fechaRevision sql.NullTime

		err := rows.Scan(
			&doc.ID,
			&doc.EstudianteID,
			&doc.ProgramaID,
			&doc.PeriodoID,
			&doc.TipoDocumento,
			&doc.ArchivoURL,
			&doc.Estado,
			&observacion,
			&revisadoPor,
			&doc.FechaSubida,
			&fechaRevision,
			&doc.EstudianteNombre,
			&doc.EstudianteApellido,
			&doc.EstudianteCodigo,
		)
		if err != nil {
			log.Printf("Error scanning documento: %v", err)
			continue
		}

		if observacion.Valid {
			doc.Observacion = models.NullStringJSON{NullString: observacion}
		} else {
			doc.Observacion = models.NullStringJSON{NullString: sql.NullString{Valid: false}}
		}
		if revisadoPor.Valid {
			doc.RevisadoPor = revisadoPor
		}
		if fechaRevision.Valid {
			doc.FechaRevision = fechaRevision
		}

		documentos = append(documentos, doc)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(documentos)
}

// RevisarDocumento permite a la jefatura aprobar o rechazar un documento
func (h *DocumentosHandler) RevisarDocumento(w http.ResponseWriter, r *http.Request) {
	claims, err := h.getClaims(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if claims.Rol != "jefe_departamental" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Obtener jefe_departamental_id
	var jefeID int
	queryJefe := `SELECT id FROM jefe_departamental WHERE usuario_id = $1`
	err = h.db.QueryRow(queryJefe, claims.Sub).Scan(&jefeID)
	if err == sql.ErrNoRows {
		http.Error(w, "Jefe departamental no encontrado", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("Error getting jefe: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	vars := mux.Vars(r)
	docID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid document ID", http.StatusBadRequest)
		return
	}

	var req models.RevisarDocumentoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Estado != "aprobado" && req.Estado != "rechazado" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "estado inválido. Debe ser 'aprobado' o 'rechazado'"})
		return
	}

	if req.Estado == "rechazado" && strings.TrimSpace(req.Observacion) == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "observación es obligatoria cuando se rechaza un documento"})
		return
	}

	// Verificar que el documento pertenece al programa del jefe
	var programaID int
	queryDoc := `SELECT programa_id FROM documentos_estudiante WHERE id = $1`
	err = h.db.QueryRow(queryDoc, docID).Scan(&programaID)
	if err == sql.ErrNoRows {
		http.Error(w, "Documento no encontrado", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("Error getting documento: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if programaID != claims.ProgramaID {
		http.Error(w, "Forbidden: documento no pertenece a tu programa", http.StatusForbidden)
		return
	}

	// Actualizar documento
	var observacionVal sql.NullString
	if req.Estado == "rechazado" && strings.TrimSpace(req.Observacion) != "" {
		observacionVal = sql.NullString{String: req.Observacion, Valid: true}
	} else {
		observacionVal = sql.NullString{Valid: false}
	}

	update := `UPDATE documentos_estudiante 
			   SET estado = $1, observacion = $2, revisado_por = $3, fecha_revision = CURRENT_TIMESTAMP
			   WHERE id = $4
			   RETURNING fecha_revision`
	var fechaRevision sql.NullTime
	err = h.db.QueryRow(update, req.Estado, observacionVal, jefeID, docID).Scan(&fechaRevision)
	if err != nil {
		log.Printf("Error updating documento: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Registrar auditoría: jefatura revisa documento
	ip := utils.GetIPAddress(r)
	userAgent := r.UserAgent()

	// Obtener información del documento y estudiante para la descripción
	var estudianteCodigo, tipoDocumento string
	var periodoYear, periodoSemestre int
	queryInfo := `SELECT u.codigo, d.tipo_documento, p.year, p.semestre
				  FROM documentos_estudiante d
				  JOIN estudiante e ON d.estudiante_id = e.id
				  JOIN usuario u ON e.usuario_id = u.id
				  JOIN periodo_academico p ON d.periodo_id = p.id
				  WHERE d.id = $1`
	err = h.db.QueryRow(queryInfo, docID).Scan(&estudianteCodigo, &tipoDocumento, &periodoYear, &periodoSemestre)
	if err != nil {
		log.Printf("Error getting documento info for audit: %v", err)
	} else {
		accion := "revision_documento_aprobado"
		if req.Estado == "rechazado" {
			accion = "revision_documento_rechazado"
		}
		descripcion := fmt.Sprintf("Documento %s: %s - Estudiante: %s, Periodo: %d-%d",
			req.Estado, tipoDocumento, estudianteCodigo, periodoYear, periodoSemestre)
		if req.Estado == "rechazado" && strings.TrimSpace(req.Observacion) != "" {
			descripcion += fmt.Sprintf(", Observación: %s", req.Observacion)
		}
		h.registrarAuditoria(claims.Sub, accion, descripcion, ip, userAgent)
	}

	response := map[string]interface{}{
		"id":             docID,
		"estado":         req.Estado,
		"observacion":    req.Observacion,
		"fecha_revision": fechaRevision,
		"message":        "Documento revisado exitosamente",
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// registrarAuditoria registra un evento en la tabla de auditoría
func (h *DocumentosHandler) registrarAuditoria(usuarioID int, accion, descripcion, ip, userAgent string) {
	var userID sql.NullInt64
	if usuarioID > 0 {
		userID = sql.NullInt64{Int64: int64(usuarioID), Valid: true}
	}

	query := `INSERT INTO auditoria (usuario_id, accion, descripcion, ip, user_agent) 
			  VALUES ($1, $2, $3, $4, $5)`
	_, err := h.db.Exec(query, userID, accion, descripcion, ip, userAgent)
	if err != nil {
		// Log error pero no fallar la operación principal
		log.Printf("Error registering audit: %v", err)
	}
}
