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
			archivado BOOLEAN NOT NULL DEFAULT FALSE,
			CONSTRAINT periodo_unico UNIQUE (year, semestre)
		)
		`,
		`
		CREATE TABLE IF NOT EXISTS plazos (
			id SERIAL PRIMARY KEY,
			periodo_id INT NOT NULL,
			programa_id INT NOT NULL,
			documentos BOOLEAN NOT NULL DEFAULT FALSE,
			inscripcion BOOLEAN NOT NULL DEFAULT FALSE,
			modificaciones BOOLEAN NOT NULL DEFAULT FALSE,
			CONSTRAINT fk_plazos_periodo
				FOREIGN KEY (periodo_id) REFERENCES periodo_academico(id)
				ON DELETE CASCADE,
			CONSTRAINT fk_plazos_programa
				FOREIGN KEY (programa_id) REFERENCES programa(id)
				ON DELETE CASCADE,
			CONSTRAINT plazos_periodo_programa_unique UNIQUE (periodo_id, programa_id)
		)
		`,
		`ALTER TABLE periodo_academico ADD COLUMN IF NOT EXISTS archivado BOOLEAN NOT NULL DEFAULT FALSE`,
		`UPDATE periodo_academico SET archivado = FALSE WHERE archivado IS NULL`,
		`UPDATE periodo_academico SET activo = FALSE WHERE archivado = TRUE`,
		`ALTER TABLE plazos ADD COLUMN IF NOT EXISTS programa_id INT`,
		`UPDATE plazos SET programa_id = 1 WHERE programa_id IS NULL`,
		`ALTER TABLE plazos ALTER COLUMN programa_id SET NOT NULL`,
		`
		DO $$
		BEGIN
			ALTER TABLE plazos
			ADD CONSTRAINT fk_plazos_programa FOREIGN KEY (programa_id) REFERENCES programa(id) ON DELETE CASCADE;
		EXCEPTION
			WHEN duplicate_object THEN NULL;
		END $$;
		`,
		`
		DO $$
		BEGIN
			ALTER TABLE plazos
			ADD CONSTRAINT plazos_periodo_programa_unique UNIQUE (periodo_id, programa_id);
		EXCEPTION
			WHEN duplicate_object THEN NULL;
		END $$;
		`,
	}

	for _, stmt := range statements {
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("error running migrations: %w", err)
		}
	}

	return nil
}
