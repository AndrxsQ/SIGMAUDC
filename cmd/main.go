package main

import (
	"log"
	"net/http"
	"os"

	"github.com/andrxsq/SIGMAUDC/internal/config"
	"github.com/andrxsq/SIGMAUDC/internal/database"
	"github.com/andrxsq/SIGMAUDC/internal/handlers"
	"github.com/andrxsq/SIGMAUDC/internal/middleware"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
)

func main() {
	// Cargar variables de entorno
	// Intenta cargar desde el directorio actual (raíz del proyecto)
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
		log.Printf("Error: %v", err)
	} else {
		log.Println("Loaded .env file successfully")
	}

	// Cargar configuración
	cfg := config.Load()

	// Conectar a la base de datos
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatal("Error connecting to database:", err)
	}
	defer db.Close()

	// Ejecutar migraciones mínimas para periodo/plazos
	if err := database.RunMigrations(db); err != nil {
		log.Fatal("Error running migrations:", err)
	}

	// Inicializar handlers
	authHandler := handlers.NewAuthHandler(db, cfg.JWTSecret)
	auditHandler := handlers.NewAuditHandler(db)
	plazosHandler := handlers.NewPlazosHandler(db)
	documentosHandler := handlers.NewDocumentosHandler(db)
	pensumHandler := handlers.NewPensumHandler(db)
	matriculaHandler := handlers.NewMatriculaHandler(db)
	estudianteHandler := handlers.NewEstudianteHandler(db)
	jefeHandler := handlers.NewJefeHandler(db)

	// Configurar router
	r := mux.NewRouter()

	// Rutas públicas
	r.HandleFunc("/auth/login", authHandler.Login).Methods("POST")
	r.HandleFunc("/auth/set-password", authHandler.SetPassword).Methods("POST")

	// Rutas protegidas (requieren JWT)
	protected := r.PathPrefix("/api").Subrouter()
	protected.Use(middleware.JWTAuthMiddleware(cfg.JWTSecret))

	// Ejemplo de ruta protegida
	protected.HandleFunc("/me", authHandler.GetCurrentUser).Methods("GET")

	// Ruta de auditoría (protegida)
	protected.HandleFunc("/audit", auditHandler.GetAuditLogs).Methods("GET")

	// Rutas de periodos académicos y plazos (protegidas)
	protected.HandleFunc("/periodos", plazosHandler.GetPeriodos).Methods("GET")
	protected.HandleFunc("/periodos/activo", plazosHandler.GetPeriodoActivo).Methods("GET")
	protected.HandleFunc("/periodos", plazosHandler.CreatePeriodo).Methods("POST")
	protected.HandleFunc("/periodos/{id}", plazosHandler.UpdatePeriodo).Methods("PUT")
	protected.HandleFunc("/periodos/{id}", plazosHandler.DeletePeriodo).Methods("DELETE")
	protected.HandleFunc("/periodos-con-plazos", plazosHandler.GetPeriodosConPlazos).Methods("GET")
	protected.HandleFunc("/plazos/activo", plazosHandler.GetActivePeriodoPlazos).Methods("GET")

	// Rutas de plazos
	protected.HandleFunc("/periodos/{periodo_id}/plazos", plazosHandler.GetPlazos).Methods("GET")
	protected.HandleFunc("/periodos/{periodo_id}/plazos", plazosHandler.UpdatePlazos).Methods("PUT")

	// Rutas de documentos (protegidas)
	protected.HandleFunc("/documentos", documentosHandler.GetDocumentosEstudiante).Methods("GET")           // Para estudiantes
	protected.HandleFunc("/documentos", documentosHandler.SubirDocumento).Methods("POST")                   // Para estudiantes
	protected.HandleFunc("/documentos/programa", documentosHandler.GetDocumentosPorPrograma).Methods("GET") // Para jefatura
	protected.HandleFunc("/documentos/{id}/revisar", documentosHandler.RevisarDocumento).Methods("PUT")     // Para jefatura

	// Rutas de pensum (protegidas)
	protected.HandleFunc("/pensum", pensumHandler.GetPensumEstudiante).Methods("GET") // Para estudiantes
	protected.HandleFunc("/estudiante/datos", estudianteHandler.GetDatosEstudiante).Methods("GET")
	protected.HandleFunc("/estudiante/datos", estudianteHandler.UpdateDatosEstudiante).Methods("PUT")
	protected.HandleFunc("/estudiante/foto", estudianteHandler.SubirFotoEstudiante).Methods("POST")

	// Rutas de jefe departamental (protegidas)
	protected.HandleFunc("/jefe/datos", jefeHandler.GetDatosJefe).Methods("GET")
	protected.HandleFunc("/jefe/datos", jefeHandler.UpdateDatosJefe).Methods("PUT")
	protected.HandleFunc("/jefe/foto", jefeHandler.SubirFotoJefe).Methods("POST")
	log.Println("✅ Ruta /api/pensum registrada correctamente")

	// Rutas de matrícula (protegidas)
	protected.HandleFunc("/matricula/validar-inscripcion", matriculaHandler.ValidarInscripcion).Methods("GET")            // Para estudiantes
	protected.HandleFunc("/matricula/asignaturas-disponibles", matriculaHandler.GetAsignaturasDisponibles).Methods("GET") // Para estudiantes (temporal - retorna vacío)
	protected.HandleFunc("/matricula/horario-actual", matriculaHandler.GetHorarioActual).Methods("GET")                   // Para estudiantes
	protected.HandleFunc("/matricula/asignaturas/{id}/grupos", matriculaHandler.GetGruposAsignatura).Methods("GET")
	protected.HandleFunc("/matricula/inscribir", matriculaHandler.InscribirAsignaturas).Methods("POST")

	// Rutas de modificaciones (para jefatura)
	protected.HandleFunc("/modificaciones/estudiante", matriculaHandler.GetStudentMatricula).Methods("GET")
	protected.HandleFunc("/modificaciones/estudiante/{id}/inscribir", matriculaHandler.JefeInscribirAsignaturas).Methods("POST")
	protected.HandleFunc("/modificaciones/estudiante/{id}/desmatricular", matriculaHandler.JefeDesmatricularGrupo).Methods("POST")
	// Rutas de modificaciones estudiantiles (protegidas)
	protected.HandleFunc("/matricula/validar-modificaciones", matriculaHandler.ValidarModificaciones).Methods("GET")
	protected.HandleFunc("/matricula/modificaciones", matriculaHandler.GetModificacionesData).Methods("GET")
	protected.HandleFunc("/matricula/retirar-materia", matriculaHandler.RetirarMateria).Methods("POST")
	protected.HandleFunc("/matricula/agregar-materia", matriculaHandler.AgregarMateriaModificaciones).Methods("POST")

	// Servir archivos estáticos (uploads) - soporta estructura de carpetas periodo/programa/
	r.PathPrefix("/uploads/").Handler(http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads/"))))

	// CORS middleware
	corsHandler := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}

			next.ServeHTTP(w, r)
		})
	}

	// Aplicar CORS
	handler := corsHandler(r)

	// Agregar logging para todas las peticiones (para depuración)
	loggedHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("📥 Request: %s %s", r.Method, r.URL.Path)
		handler.ServeHTTP(w, r)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 Server starting on port %s", port)
	log.Println("📋 Rutas registradas:")
	log.Println("   GET  /api/pensum")
	log.Println("   GET  /api/me")
	log.Println("   GET  /api/periodos")
	log.Println("   GET  /api/documentos")
	log.Println("   POST /auth/login")
	log.Println("   POST /auth/set-password")
	log.Fatal(http.ListenAndServe(":"+port, loggedHandler))
}
