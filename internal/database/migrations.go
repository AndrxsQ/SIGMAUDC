package database

import (
	"database/sql"
	"fmt"
)

// RunMigrations ensures that required tables for periodos y plazos exist
func RunMigrations(db *sql.DB) error {
	statements := []string{
		`
		CREATE TABLE IF NOT EXISTS periodo_academico (
			id SERIAL PRIMARY KEY,
			year INT NOT NULL,
			semestre INT NOT NULL,
			activo BOOLEAN NOT NULL DEFAULT FALSE,
			CONSTRAINT periodo_unico UNIQUE (year, semestre)
		)
		`,
		`
		CREATE TABLE IF NOT EXISTS plazos (
			id SERIAL PRIMARY KEY,
			periodo_id INT NOT NULL UNIQUE,
			documentos BOOLEAN NOT NULL DEFAULT FALSE,
			inscripcion BOOLEAN NOT NULL DEFAULT FALSE,
			modificaciones BOOLEAN NOT NULL DEFAULT FALSE,
			CONSTRAINT fk_plazos_periodo
				FOREIGN KEY (periodo_id) REFERENCES periodo_academico(id)
				ON DELETE CASCADE
		)
		`,
	}

	for _, stmt := range statements {
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("error running migrations: %w", err)
		}
	}

	return nil
}

