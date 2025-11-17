package models

// PeriodoAcademico representa un periodo académico (semestre)
type PeriodoAcademico struct {
	ID       int  `json:"id"`
	Year     int  `json:"year"`
	Semestre int  `json:"semestre"`
	Activo   bool `json:"activo"`
}

// CreatePeriodoRequest representa la solicitud para crear un periodo
type CreatePeriodoRequest struct {
	Year     int `json:"year"`
	Semestre int `json:"semestre"`
}

// UpdatePeriodoRequest representa la solicitud para actualizar un periodo
type UpdatePeriodoRequest struct {
	Activo *bool `json:"activo,omitempty"` // Puntero para permitir nil (no actualizar)
}

// Plazos representa los plazos de un periodo académico
type Plazos struct {
	ID            int  `json:"id"`
	PeriodoID     int  `json:"periodo_id"`
	Documentos    bool `json:"documentos"`
	Inscripcion   bool `json:"inscripcion"`
	Modificaciones bool `json:"modificaciones"`
}

// UpdatePlazosRequest representa la solicitud para actualizar plazos
type UpdatePlazosRequest struct {
	Documentos     *bool `json:"documentos,omitempty"`
	Inscripcion    *bool `json:"inscripcion,omitempty"`
	Modificaciones *bool `json:"modificaciones,omitempty"`
}

// PeriodoConPlazos representa un periodo académico con sus plazos asociados
type PeriodoConPlazos struct {
	PeriodoAcademico
	Plazos *Plazos `json:"plazos,omitempty"`
}

