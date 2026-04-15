// Package handlers – DocumentosHandler
// Gestiona la subida, consulta y revisión de documentos académicos requeridos
// para que el estudiante pueda inscribir asignaturas.
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

	"github.com/andrxsq/SIGMAUDC/internal/constants"
	"github.com/andrxsq/SIGMAUDC/internal/models"
	"github.com/andrxsq/SIGMAUDC/internal/services"
	"github.com/andrxsq/SIGMAUDC/internal/utils"
	"github.com/gorilla/mux"
)

// DocumentosHandler gestiona las peticiones HTTP relacionadas con los documentos
// académicos de los estudiantes (subida, consulta y revisión por parte de jefatura).
//
// Principios aplicados:
//   - SRP: solo gestiona la lógica HTTP de documentos; auditoría delegada al servicio.
//   - DIP: depende de AuditoriaService por inyección de dependencias.
type DocumentosHandler struct {
	db              *sql.DB
	uploadDirectory string
	auditoria       *services.AuditoriaService
}

// NewDocumentosHandler crea una nueva instancia de DocumentosHandler.
// El directorio de uploads se toma de la variable de entorno UPLOAD_DIR;
// si no está definida, usa "./uploads" como valor por defecto.
func NewDocumentosHandler(db *sql.DB, auditoria *services.AuditoriaService) *DocumentosHandler {
	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "./uploads"
	}
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		log.Printf("Error creating upload directory %s: %v", uploadDir, err)
	} else {
		log.Printf("Upload directory configured: %s", uploadDir)
	}
	return &DocumentosHandler{
		db:              db,
		uploadDirectory: uploadDir,
		auditoria:       auditoria,
	}
}

// verificarPlazosDocumentos comprueba que exista un periodo académico activo
// y que el plazo de documentos esté habilitado para el programa indicado.
//
// Retorna los plazos y el periodo si todo está en orden,
// o un error descriptivo si alguna condición no se cumple.
func (h *DocumentosHandler) verificarPlazosDocumentos(programaID int) (*models.Plazos, *models.PeriodoAcademico, error) {
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

// GetDocumentosEstudiante retorna los documentos del estudiante autenticado
// para el periodo académico activo, junto con el estado del plazo.
//
// GET /api/documentos
// Requiere: rol "estudiante".
func (h *DocumentosHandler) GetDocumentosEstudiante(w http.ResponseWriter, r *http.Request) {
	claims, err := getClaims(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if claims.Rol != constants.RolEstudiante {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var estudianteID int
	if err := h.db.QueryRow(
		`SELECT id FROM estudiante WHERE usuario_id = $1`, claims.Sub,
	).Scan(&estudianteID); err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Estudiante no encontrado", http.StatusNotFound)
			return
		}
		log.Printf("Error getting estudiante: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// La verificación de plazos puede fallar sin bloquear la vista de documentos.
	var plazoMensaje string
	plazos, periodo, err := h.verificarPlazosDocumentos(claims.ProgramaID)
	if err != nil {
		plazos = nil
		periodo = nil
		plazoMensaje = err.Error()
	}

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

			if err := rows.Scan(
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
			); err != nil {
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

	// Determinar si los documentos están aprobados:
	// Se necesitan exactamente los 2 tipos de documento, ambos en estado "aprobado".
	documentosAprobados := true
	if len(documentos) < constants.DocsRequeridosInscripcion {
		documentosAprobados = false
	} else {
		for _, doc := range documentos {
			if doc.Estado != constants.EstadoDocAprobado {
				documentosAprobados = false
				break
			}
		}
	}

	puedeSubir := plazos != nil && plazos.Documentos && periodo != nil

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

// SubirDocumento sube un documento académico para el estudiante autenticado.
//
// POST /api/documentos
// Requiere: rol "estudiante", multipart form con campos:
//   - tipo_documento: "certificado_eps" o "comprobante_matricula"
//   - archivo: PDF, PNG, JPG o JPEG, máx. 5 MB.
//
// Si ya existe un documento rechazado del mismo tipo, lo reemplaza.
func (h *DocumentosHandler) SubirDocumento(w http.ResponseWriter, r *http.Request) {
	claims, err := getClaims(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if claims.Rol != constants.RolEstudiante {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	_, periodo, err := h.verificarPlazosDocumentos(claims.ProgramaID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	var estudianteID int
	if err := h.db.QueryRow(
		`SELECT id FROM estudiante WHERE usuario_id = $1`, claims.Sub,
	).Scan(&estudianteID); err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Estudiante no encontrado", http.StatusNotFound)
			return
		}
		log.Printf("Error getting estudiante: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Parsear el form limitando a MaxDocumentoBytes en memoria.
	r.ParseMultipartForm(constants.MaxDocumentoBytes)

	tipoDocumento := r.FormValue("tipo_documento")
	if tipoDocumento != constants.TipoCertificadoEPS && tipoDocumento != constants.TipoComprobanteMatricula {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": fmt.Sprintf(
				"tipo_documento inválido. Debe ser '%s' o '%s'",
				constants.TipoCertificadoEPS, constants.TipoComprobanteMatricula,
			),
		})
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

	// Validar tamaño del archivo.
	if handler.Size > constants.MaxDocumentoBytes {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": fmt.Sprintf("El archivo excede el tamaño máximo de %dMB", constants.MaxDocumentoBytes/1024/1024),
		})
		return
	}

	// Validar extensión contra la lista centralizada.
	ext := strings.ToLower(filepath.Ext(handler.Filename))
	extValida := false
	for _, e := range constants.ExtensionesDocumento {
		if ext == e {
			extValida = true
			break
		}
	}
	if !extValida {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "formato de archivo no permitido. Solo PDF, PNG, JPG, JPEG",
		})
		return
	}

	filenameWithoutExt := strings.TrimSuffix(handler.Filename, ext)

	// Verificar si ya existe un documento de este tipo para este estudiante y periodo.
	var docExistente models.DocumentoEstudiante
	queryExistente := `SELECT id, estado FROM documentos_estudiante
	                   WHERE estudiante_id = $1 AND periodo_id = $2 AND tipo_documento = $3
	                   ORDER BY fecha_subida DESC LIMIT 1`
	err = h.db.QueryRow(queryExistente, estudianteID, periodo.ID, tipoDocumento).Scan(
		&docExistente.ID,
		&docExistente.Estado,
	)

	if err == nil {
		if docExistente.Estado == constants.EstadoDocPendiente {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Documento ya subido, pendiente de revisión",
			})
			return
		}
		if docExistente.Estado == constants.EstadoDocAprobado {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "Documento ya aprobado"})
			return
		}
		// Si está rechazado, se permite resubir (actualiza el registro existente).
	}

	// Construir estructura de carpetas: periodo/programa/estudiante/
	var programaNombre string
	if err := h.db.QueryRow(
		`SELECT nombre FROM programa WHERE id = $1`, claims.ProgramaID,
	).Scan(&programaNombre); err != nil {
		log.Printf("Error getting programa: %v", err)
		programaNombre = fmt.Sprintf("programa_%d", claims.ProgramaID)
	}

	var estudianteCodigo string
	if err := h.db.QueryRow(
		`SELECT codigo FROM usuario WHERE id = $1`, claims.Sub,
	).Scan(&estudianteCodigo); err != nil {
		log.Printf("Error getting codigo: %v", err)
		estudianteCodigo = fmt.Sprintf("estudiante_%d", estudianteID)
	}

	periodoFolder := fmt.Sprintf("%d-%d", periodo.Year, periodo.Semestre)
	programaFolder := fmt.Sprintf("%d_%s", claims.ProgramaID,
		strings.ReplaceAll(strings.ToLower(programaNombre), " ", "_"))
	estudianteFolder := fmt.Sprintf("%d_%s", estudianteID, estudianteCodigo)

	uploadPath := filepath.Join(h.uploadDirectory, periodoFolder, programaFolder, estudianteFolder)
	if err := os.MkdirAll(uploadPath, 0755); err != nil {
		log.Printf("Error creating directories: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	timestamp := time.Now().Unix()
	filename := fmt.Sprintf("%d_%d_%s_%s%s", estudianteID, timestamp, tipoDocumento, filenameWithoutExt, ext)
	filePath := filepath.Join(uploadPath, filename)

	dst, err := os.Create(filePath)
	if err != nil {
		log.Printf("Error creating file: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err = io.Copy(dst, file); err != nil {
		log.Printf("Error copying file: %v", err)
		os.Remove(filePath)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	archivoURL := fmt.Sprintf("/uploads/%s/%s/%s/%s", periodoFolder, programaFolder, estudianteFolder, filename)
	ip := utils.GetIPAddress(r)
	userAgent := r.UserAgent()

	// Insertar o actualizar en BD según si ya existía un documento rechazado.
	if err == sql.ErrNoRows || docExistente.ID == 0 {
		insert := `INSERT INTO documentos_estudiante
		           (estudiante_id, programa_id, periodo_id, tipo_documento, archivo_url, estado)
		           VALUES ($1, $2, $3, $4, $5, 'pendiente')
		           RETURNING id, fecha_subida`
		var docID int
		var fechaSubida time.Time
		if err = h.db.QueryRow(insert, estudianteID, claims.ProgramaID, periodo.ID, tipoDocumento, archivoURL).
			Scan(&docID, &fechaSubida); err != nil {
			log.Printf("Error inserting documento: %v", err)
			os.Remove(filePath)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		h.auditoria.Registrar(
			claims.Sub, "subida_documento",
			fmt.Sprintf("Documento subido: %s, Periodo: %d-%d", tipoDocumento, periodo.Year, periodo.Semestre),
			ip, userAgent,
		)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"id":             docID,
			"tipo_documento": tipoDocumento,
			"estado":         constants.EstadoDocPendiente,
			"fecha_subida":   fechaSubida,
			"message":        "Documento subido exitosamente",
		})
	} else {
		// Actualizar documento rechazado: eliminar archivo anterior y actualizar registro.
		var archivoAnterior string
		h.db.QueryRow(`SELECT archivo_url FROM documentos_estudiante WHERE id = $1`, docExistente.ID).
			Scan(&archivoAnterior)
		if archivoAnterior != "" && strings.HasPrefix(archivoAnterior, "/uploads/") {
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
		if err = h.db.QueryRow(update, archivoURL, docExistente.ID).Scan(&fechaSubida); err != nil {
			log.Printf("Error updating documento: %v", err)
			os.Remove(filePath)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		h.auditoria.Registrar(
			claims.Sub, "resubida_documento",
			fmt.Sprintf("Documento resubido: %s, Periodo: %d-%d (anteriormente rechazado)", tipoDocumento, periodo.Year, periodo.Semestre),
			ip, userAgent,
		)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"id":             docExistente.ID,
			"tipo_documento": tipoDocumento,
			"estado":         constants.EstadoDocPendiente,
			"fecha_subida":   fechaSubida,
			"message":        "Documento resubido exitosamente",
		})
	}
}

// GetDocumentosPorPrograma retorna todos los documentos del programa del jefe autenticado
// para el periodo activo (incluidos pendientes, aprobados y rechazados).
//
// GET /api/documentos/programa
// Requiere: rol "jefe_departamental".
func (h *DocumentosHandler) GetDocumentosPorPrograma(w http.ResponseWriter, r *http.Request) {
	claims, err := getClaims(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if claims.Rol != constants.RolJefe {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var periodo models.PeriodoAcademico
	queryPeriodo := `SELECT id, year, semestre, activo, archivado
	                 FROM periodo_academico
	                 WHERE activo = true AND archivado = false
	                 LIMIT 1`
	err = h.db.QueryRow(queryPeriodo).Scan(
		&periodo.ID, &periodo.Year, &periodo.Semestre, &periodo.Activo, &periodo.Archivado,
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

		if err := rows.Scan(
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
		); err != nil {
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

// RevisarDocumento permite al jefe departamental aprobar o rechazar un documento.
//
// PUT /api/documentos/{id}/revisar
// Requiere: rol "jefe_departamental".
// Body: models.RevisarDocumentoRequest (estado + observacion).
//
// Si se rechaza, la observación es obligatoria.
// Solo puede revisar documentos de su propio programa.
func (h *DocumentosHandler) RevisarDocumento(w http.ResponseWriter, r *http.Request) {
	claims, err := getClaims(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if claims.Rol != constants.RolJefe {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var jefeID int
	if err := h.db.QueryRow(
		`SELECT id FROM jefe_departamental WHERE usuario_id = $1`, claims.Sub,
	).Scan(&jefeID); err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Jefe departamental no encontrado", http.StatusNotFound)
			return
		}
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

	// Validar que el estado sea uno de los valores permitidos.
	if req.Estado != constants.EstadoDocAprobado && req.Estado != constants.EstadoDocRechazado {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": fmt.Sprintf(
				"estado inválido. Debe ser '%s' o '%s'",
				constants.EstadoDocAprobado, constants.EstadoDocRechazado,
			),
		})
		return
	}

	if req.Estado == constants.EstadoDocRechazado && strings.TrimSpace(req.Observacion) == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "observación es obligatoria cuando se rechaza un documento",
		})
		return
	}

	// Verificar que el documento pertenece al programa del jefe autenticado.
	var programaID int
	if err := h.db.QueryRow(
		`SELECT programa_id FROM documentos_estudiante WHERE id = $1`, docID,
	).Scan(&programaID); err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Documento no encontrado", http.StatusNotFound)
			return
		}
		log.Printf("Error getting documento: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if programaID != claims.ProgramaID {
		http.Error(w, "Forbidden: documento no pertenece a tu programa", http.StatusForbidden)
		return
	}

	var observacionVal sql.NullString
	if req.Estado == constants.EstadoDocRechazado && strings.TrimSpace(req.Observacion) != "" {
		observacionVal = sql.NullString{String: req.Observacion, Valid: true}
	} else {
		observacionVal = sql.NullString{Valid: false}
	}

	update := `UPDATE documentos_estudiante
	           SET estado = $1, observacion = $2, revisado_por = $3, fecha_revision = CURRENT_TIMESTAMP
	           WHERE id = $4
	           RETURNING fecha_revision`
	var fechaRevision sql.NullTime
	if err := h.db.QueryRow(update, req.Estado, observacionVal, jefeID, docID).Scan(&fechaRevision); err != nil {
		log.Printf("Error updating documento: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Registrar evento de auditoría con detalle del documento revisado.
	ip := utils.GetIPAddress(r)
	userAgent := r.UserAgent()
	var estudianteCodigo, tipoDocumento string
	var periodoYear, periodoSemestre int
	queryInfo := `SELECT u.codigo, d.tipo_documento, p.year, p.semestre
	              FROM documentos_estudiante d
	              JOIN estudiante e ON d.estudiante_id = e.id
	              JOIN usuario u ON e.usuario_id = u.id
	              JOIN periodo_academico p ON d.periodo_id = p.id
	              WHERE d.id = $1`
	if err := h.db.QueryRow(queryInfo, docID).Scan(
		&estudianteCodigo, &tipoDocumento, &periodoYear, &periodoSemestre,
	); err != nil {
		log.Printf("Error getting documento info for audit: %v", err)
	} else {
		accion := "revision_documento_aprobado"
		if req.Estado == constants.EstadoDocRechazado {
			accion = "revision_documento_rechazado"
		}
		descripcion := fmt.Sprintf(
			"Documento %s: %s - Estudiante: %s, Periodo: %d-%d",
			req.Estado, tipoDocumento, estudianteCodigo, periodoYear, periodoSemestre,
		)
		if req.Estado == constants.EstadoDocRechazado && strings.TrimSpace(req.Observacion) != "" {
			descripcion += fmt.Sprintf(", Observación: %s", req.Observacion)
		}
		h.auditoria.Registrar(claims.Sub, accion, descripcion, ip, userAgent)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":             docID,
		"estado":         req.Estado,
		"observacion":    req.Observacion,
		"fecha_revision": fechaRevision,
		"message":        "Documento revisado exitosamente",
	})
}
