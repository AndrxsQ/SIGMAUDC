import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../../services/auth";
import "../../styles/Home.css";

const HomeEstudiante = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const normalizeValue = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") {
      if (typeof value.String === "string" && value.String.trim().length > 0) {
        return value.String;
      }
    }
    return "";
  };

  const getNombreCompleto = (usuario) => {
    if (!usuario) return "";
    const nombre = normalizeValue(usuario.nombre);
    const apellido = normalizeValue(usuario.apellido);
    if (nombre && apellido) return `${nombre} ${apellido}`;
    return nombre || apellido || "";
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        let userData = authService.getUser();
        if (!userData) {
          userData = await authService.getCurrentUser();
          authService.saveUser(userData);
        } else {
          try {
            userData = await authService.getCurrentUser();
            authService.saveUser(userData);
          } catch (err) {
            console.error("Error refreshing user:", err);
          }
        }
        const normalizedUser = {
          ...userData,
          nombre: normalizeValue(userData?.nombre),
          apellido: normalizeValue(userData?.apellido),
        };
        authService.saveUser(normalizedUser);
        setUser(normalizedUser);
      } catch (error) {
        console.error("Error loading user:", error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const formatPrograma = (usuario) =>
    usuario?.programa_nombre || `Programa ID: ${usuario?.programa_id || "N/A"}`;

  const formatCodigo = (usuario) => usuario?.codigo || "N/A";

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="32">
              <animate attributeName="stroke-dasharray" dur="2s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite" />
              <animate attributeName="stroke-dashoffset" dur="2s" values="0;-16;-32;-32" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>
        <p>Cargando tu panel estudiantil...</p>
      </div>
    );
  }

  return (
    <div className="home-estudiante">
      {/* Hero Section con Logo y Bienvenida */}
      <div className="est-hero">
        <div className="est-hero-content">
          {/* Logo */}
          <div className="est-logo-container">
            <div className="est-logo-square">
              <img
                src="/logo-udc.png"
                alt="Escudo Universidad de Cartagena"
                className="est-logo-image"
                onError={(e) => {
                  e.target.style.display = "none";
                  const fallback = e.target.nextElementSibling;
                  if (fallback) fallback.style.display = "block";
                }}
              />
              <span className="est-logo-text-fallback">UDC</span>
            </div>
          </div>

          {/* Información del Estudiante */}
          <div className="est-welcome-section">
            <div className="est-welcome-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <span>Estudiante</span>
            </div>
            <h1 className="est-welcome-title">
              Hola,{" "}
              <span className="est-highlight">
                {getNombreCompleto(user) || formatCodigo(user) || "Estudiante UDC"}
              </span>
            </h1>
            <p className="est-welcome-subtitle">
              Este es tu panel central para gestionar matrícula, documentos y tu progreso académico.
            </p>
          </div>
        </div>

        {/* Información rápida */}
        <div className="est-info-card">
          <div className="info-card-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <h3>Resumen de tu perfil</h3>
          </div>
          <div className="info-card-grid">
            <div className="info-card-item">
              <div className="info-item-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <div className="info-item-content">
                <span className="info-label">Nombre Completo</span>
                <span className="info-value">{getNombreCompleto(user) || "No disponible"}</span>
              </div>
            </div>

            <div className="info-card-item">
              <div className="info-item-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z"></path>
                </svg>
              </div>
              <div className="info-item-content">
                <span className="info-label">Código Institucional</span>
                <span className="info-value">{formatCodigo(user)}</span>
              </div>
            </div>

            <div className="info-card-item">
              <div className="info-item-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </div>
              <div className="info-item-content">
                <span className="info-label">Correo Institucional</span>
                <span className="info-value">{user?.email || "N/A"}</span>
              </div>
            </div>

            <div className="info-card-item">
              <div className="info-item-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                  <line x1="9" y1="7" x2="15" y2="7"></line>
                  <line x1="9" y1="11" x2="15" y2="11"></line>
                  <line x1="9" y1="15" x2="13" y2="15"></line>
                </svg>
              </div>
              <div className="info-item-content">
                <span className="info-label">Programa Académico</span>
                <span className="info-value">{formatPrograma(user)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Panel de Acceso Rápido */}
      <div className="est-dashboard">
        <div className="dashboard-header">
          <h2 className="section-title">Tu vida académica</h2>
          <p className="section-subtitle">
            Accede a tus documentos, matrícula, pensum y hoja de vida de forma rápida y organizada.
          </p>
        </div>

        <div className="dashboard-grid">
          {/* Subir documentos */}
          <div className="dashboard-card" onClick={() => navigate("/subir")}>
            <div className="card-gradient-overlay"></div>
            <div className="card-content">
              <div className="card-icon-wrapper">
                <div className="card-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16v16H4z"></path>
                    <path d="M9 14l3-3 3 3"></path>
                    <path d="M12 11V21"></path>
                  </svg>
                </div>
              </div>
              <h3>Subir Documentos</h3>
              <p>
                Carga tu comprobante de matrícula financiera, EPS y demás documentos requeridos por la universidad.
              </p>
              <div className="card-footer">
                <span className="card-link">Ir a subida de documentos</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"></path>
                </svg>
              </div>
            </div>
          </div>

          {/* Inscribir/Matricular asignaturas */}
          <div className="dashboard-card" onClick={() => navigate("/inscribir")}>
            <div className="card-gradient-overlay"></div>
            <div className="card-content">
              <div className="card-icon-wrapper">
                <div className="card-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                    <path d="M7 8h10M7 12h6M7 16h4"></path>
                  </svg>
                </div>
              </div>
              <h3>Inscribir Asignaturas</h3>
              <p>
                Realiza tu inscripción y formaliza la matrícula según los plazos habilitados por tu programa.
              </p>
              <div className="card-footer">
                <span className="card-link">Inscripción y matrícula</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"></path>
                </svg>
              </div>
            </div>
          </div>

          {/* Modificaciones */}
          <div className="dashboard-card" onClick={() => navigate("/modificar")}>
            <div className="card-gradient-overlay"></div>
            <div className="card-content">
              <div className="card-icon-wrapper">
                <div className="card-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                    <path d="M16 3l5 5-11 11H5V14z"></path>
                  </svg>
                </div>
              </div>
              <h3>Modificaciones de Matrícula</h3>
              <p>
                Solicita ajustes sobre tu carga académica según los plazos y reglas definidos por jefatura.
              </p>
              <div className="card-footer">
                <span className="card-link">Gestionar modificaciones</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"></path>
                </svg>
              </div>
            </div>
          </div>

          {/* Hoja de vida académica */}
          <div className="dashboard-card" onClick={() => navigate("/hoja")}>
            <div className="card-gradient-overlay"></div>
            <div className="card-content">
              <div className="card-icon-wrapper">
                <div className="card-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16v16H4z"></path>
                    <path d="M8 8h8M8 12h5M8 16h6"></path>
                  </svg>
                </div>
              </div>
              <h3>Hoja de Vida Académica</h3>
              <p>
                Consulta tu historial de asignaturas, notas y avances dentro del plan de estudios.
              </p>
              <div className="card-footer">
                <span className="card-link">Ver hoja de vida</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"></path>
                </svg>
              </div>
            </div>
          </div>

          {/* Pensum visual */}
          <div className="dashboard-card" onClick={() => navigate("/pensul")}>
            <div className="card-gradient-overlay"></div>
            <div className="card-content">
              <div className="card-icon-wrapper">
                <div className="card-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M8 12h8M12 8v8"></path>
                  </svg>
                </div>
              </div>
              <h3>Pensum Visual</h3>
              <p>
                Visualiza gráficamente tu plan de estudios, identifica prerequisitos y planifica próximos semestres.
              </p>
              <div className="card-footer">
                <span className="card-link">Ver pensum</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"></path>
                </svg>
              </div>
            </div>
          </div>

          {/* Consultar matrícula / estados */}
          <div className="dashboard-card" onClick={() => navigate("/prueba")}>
            <div className="card-gradient-overlay"></div>
            <div className="card-content">
              <div className="card-icon-wrapper">
                <div className="card-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="6"></circle>
                    <line x1="16" y1="16" x2="21" y2="21"></line>
                  </svg>
                </div>
              </div>
              <h3>Consultar Matrícula</h3>
              <p>
                Revisa rápidamente el estado de tu matrícula, créditos inscritos y resumen del semestre actual.
              </p>
              <div className="card-footer">
                <span className="card-link">Consultar</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"></path>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeEstudiante;