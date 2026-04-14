import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../../services/auth";
import "../../styles/Home.css";

const HomeJefe = () => {
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
          // Si no hay usuario en localStorage, obtenerlo del servidor
          userData = await authService.getCurrentUser();
          authService.saveUser(userData);
        } else {
          // Siempre refrescar del servidor para obtener datos actualizados
          try {
            userData = await authService.getCurrentUser();
            authService.saveUser(userData);
          } catch (err) {
            console.error("Error refreshing user:", err);
            // Usar el de localStorage si falla
          }
        }
        // Normalizar nombre/apellido por si vienen como objetos (sql.NullString)
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
        <p>Cargando información...</p>
      </div>
    );
  }

  return (
    <div className="home-jefe">
      {/* Hero Section con Logo y Bienvenida */}
      <div className="jefe-hero">
        <div className="hero-content">
          {/* Logo de la Universidad */}
          <div className="jefe-logo-container">
            <div className="jefe-logo-square">
              <img 
                src="/logo-udc.png" 
                alt="Escudo Universidad de Cartagena"
                className="jefe-logo-image"
                onError={(e) => {
                  e.target.style.display = 'none';
                  const fallback = e.target.nextElementSibling;
                  if (fallback) fallback.style.display = 'block';
                }}
              />
              <span className="jefe-logo-text-fallback">UDC</span>
            </div>
          </div>

          {/* Información del Jefe */}
          <div className="jefe-welcome-section">
            <div className="welcome-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <span>Jefe Departamental</span>
            </div>
            <h1 className="jefe-welcome-title">
              Bienvenido, <span className="highlight">
                {getNombreCompleto(user) || user?.codigo || "Jefe Departamental"}
              </span>
            </h1>
            <p className="jefe-welcome-subtitle">
              Panel de administración del programa académico
            </p>
          </div>
        </div>

        {/* Información del Usuario - Card Elegante */}
        <div className="jefe-info-card">
          <div className="info-card-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <h3>Información Personal</h3>
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
                <span className="info-value">
                  {getNombreCompleto(user) || "No disponible"}
                </span>
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
                <span className="info-value">{user?.codigo || "N/A"}</span>
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
                <span className="info-value">{user?.programa_nombre || `Programa ID: ${user?.programa_id || "N/A"}`}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Panel de Administración */}
      <div className="jefe-dashboard">
        <div className="dashboard-header">
          <h2 className="section-title">Panel de Administración</h2>
          <p className="section-subtitle">Gestiona los procesos académicos y administrativos de tu programa</p>
        </div>
        
        <div className="dashboard-grid">
          {/* Card: Administración de Plazos */}
          <div className="dashboard-card" onClick={() => navigate("/plazos")}>
            <div className="card-gradient-overlay"></div>
            <div className="card-content">
              <div className="card-icon-wrapper">
                <div className="card-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                </div>
              </div>
              <h3>Administración de Plazos</h3>
              <p>Gestiona los plazos de matrícula, fechas importantes y períodos académicos del programa</p>
              <div className="card-footer">
                <span className="card-link">Acceder</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"></path>
                </svg>
              </div>
            </div>
          </div>

          {/* Card: Verificar Documentos */}
          <div className="dashboard-card" onClick={() => navigate("/verificar-documentos")}>
            <div className="card-gradient-overlay"></div>
            <div className="card-content">
              <div className="card-icon-wrapper">
                <div className="card-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                </div>
              </div>
              <h3>Validar Documentos</h3>
              <p>Revisa, valida y aprueba los documentos subidos por los estudiantes durante el proceso de matrícula</p>
              <div className="card-footer">
                <span className="card-link">Acceder</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"></path>
                </svg>
              </div>
            </div>
          </div>

          {/* Card: Consultar Estudiante */}
          <div className="dashboard-card" onClick={() => navigate("/modificaciones")}>
            <div className="card-gradient-overlay"></div>
            <div className="card-content">
              <div className="card-icon-wrapper">
                <div className="card-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="M21 21l-4.35-4.35"></path>
                  </svg>
                </div>
              </div>
              <h3>Consultar Estudiante</h3>
              <p>Busca estudiantes por código, consulta su matrícula y realiza ajustes de inscripción o retiro de asignaturas</p>
              <div className="card-footer">
                <span className="card-link">Acceder</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"></path>
                </svg>
              </div>
            </div>
          </div>

          {/* Card: Modificar Plan de Estudio */}
          <div className="dashboard-card" onClick={() => navigate("/plan-estudio")}>
            <div className="card-gradient-overlay"></div>
            <div className="card-content">
              <div className="card-icon-wrapper">
                <div className="card-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                    <line x1="9" y1="7" x2="15" y2="7"></line>
                    <line x1="9" y1="11" x2="15" y2="11"></line>
                    <line x1="9" y1="15" x2="13" y2="15"></line>
                  </svg>
                </div>
              </div>
              <h3>Modificar Plan de Estudio</h3>
              <p>Administra y modifica los planes de estudio, asignaturas y estructura curricular del programa académico</p>
              <div className="card-footer">
                <span className="card-link">Acceder</span>
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

export default HomeJefe;
