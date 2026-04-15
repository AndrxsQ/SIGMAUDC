// Package handlers – AuditHandler
// Expone el endpoint de consulta de logs de auditoría del sistema.
package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/andrxsq/SIGMAUDC/internal/constants"
	"github.com/andrxsq/SIGMAUDC/internal/models"
)

// AuditHandler gestiona las peticiones relacionadas con el log de auditoría.
type AuditHandler struct {
	db *sql.DB
}

// NewAuditHandler crea una nueva instancia de AuditHandler.
func NewAuditHandler(db *sql.DB) *AuditHandler {
	return &AuditHandler{db: db}
}

// GetAuditLogs retorna los registros de auditoría más recientes.
//
// Query param opcional:
//   - limit (string): número máximo de registros a retornar. Default: 50.
//
// Responde con un array JSON de models.AuditLog.
func (h *AuditHandler) GetAuditLogs(w http.ResponseWriter, r *http.Request) {
	limit := r.URL.Query().Get("limit")
	if limit == "" {
		limit = constants.DefaultAuditLimit
	}

	query := `SELECT id, usuario_id, accion, descripcion, fecha, ip, user_agent
	          FROM auditoria
	          ORDER BY fecha DESC
	          LIMIT $1`

	rows, err := h.db.Query(query, limit)
	if err != nil {
		http.Error(w, "Error fetching audit logs", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var logs []models.AuditLog
	for rows.Next() {
		var entry models.AuditLog
		var userID sql.NullInt64

		if err := rows.Scan(
			&entry.ID,
			&userID,
			&entry.Accion,
			&entry.Descripcion,
			&entry.Fecha,
			&entry.IP,
			&entry.UserAgent,
		); err != nil {
			continue
		}

		if userID.Valid {
			uid := int(userID.Int64)
			entry.UsuarioID = &uid
		}

		logs = append(logs, entry)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(logs)
}
