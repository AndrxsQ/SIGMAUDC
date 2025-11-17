package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
)

type AuditHandler struct {
	db *sql.DB
}

func NewAuditHandler(db *sql.DB) *AuditHandler {
	return &AuditHandler{db: db}
}

func (h *AuditHandler) GetAuditLogs(w http.ResponseWriter, r *http.Request) {
	// Obtener parámetros de paginación
	limit := r.URL.Query().Get("limit")
	if limit == "" {
		limit = "50"
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

	type AuditLog struct {
		ID          int     `json:"id"`
		UsuarioID   *int    `json:"usuario_id"`
		Accion      string  `json:"accion"`
		Descripcion string  `json:"descripcion"`
		Fecha       string  `json:"fecha"`
		IP          string  `json:"ip"`
		UserAgent   string  `json:"user_agent"`
	}

	var logs []AuditLog
	for rows.Next() {
		var log AuditLog
		var userID sql.NullInt64
		err := rows.Scan(
			&log.ID,
			&userID,
			&log.Accion,
			&log.Descripcion,
			&log.Fecha,
			&log.IP,
			&log.UserAgent,
		)
		if err != nil {
			continue
		}

		if userID.Valid {
			uid := int(userID.Int64)
			log.UsuarioID = &uid
		}

		logs = append(logs, log)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(logs)
}

