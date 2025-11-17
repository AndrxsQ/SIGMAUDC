import React, { useState, useEffect } from "react";
import { plazosService } from "../../services/plazos";
import "../../styles/Plazos.css";

const PLAZO_ITEMS = [
  {
    key: "documentos",
    label: "Documentos",
    description: "Controla si los estudiantes pueden subir o actualizar documentación.",
    iconClass: "documentos",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    key: "inscripcion",
    label: "Inscripción",
    description: "Habilita las matrículas y la selección de asignaturas.",
    iconClass: "inscripcion",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <line x1="20" y1="8" x2="20" y2="14" />
        <line x1="23" y1="11" x2="17" y2="11" />
      </svg>
    ),
  },
  {
    key: "modificaciones",
    label: "Modificaciones",
    description: "Permite ajustes posteriores sobre matrícula o información registrada.",
    iconClass: "modificaciones",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
];

const Plazos = () => {
  const [activePeriodo, setActivePeriodo] = useState(null);
  const [plazos, setPlazos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updatingKey, setUpdatingKey] = useState(null);

  useEffect(() => {
    loadActivePlazos();
  }, []);

  const loadActivePlazos = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await plazosService.getPlazosPeriodoActivo();
      setActivePeriodo(data?.periodo || null);
      setPlazos(data?.plazos || null);
    } catch (err) {
      console.error("Error loading active plazos:", err);
      setError("No se pudieron cargar los plazos del periodo activo.");
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePlazo = async (tipoPlazo) => {
    if (!activePeriodo || !plazos) {
      setError("No hay un periodo activo para gestionar plazos.");
      setTimeout(() => setError(""), 3000);
      return;
    }
    try {
      setError("");
      setUpdatingKey(tipoPlazo);
      await plazosService.updatePlazos(activePeriodo.id, {
        [tipoPlazo]: !plazos[tipoPlazo],
      });
      setSuccess("Plazos actualizados exitosamente");
      await loadActivePlazos();
      setTimeout(() => setSuccess(""), 2500);
    } catch (err) {
      console.error("Error updating plazos:", err);
      const message = err.response?.data || "Error al actualizar los plazos";
      setError(typeof message === "string" ? message : "Error al actualizar los plazos");
    } finally {
      setUpdatingKey(null);
    }
  };

  const formatPeriodo = (periodo) => `${periodo.year}-${periodo.semestre}`;

  if (loading) {
    return (
      <div className="plazos-loading">
        <div className="loading-spinner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="32">
              <animate attributeName="stroke-dasharray" dur="2s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite" />
              <animate attributeName="stroke-dashoffset" dur="2s" values="0;-16;-32;-32" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>
        <p>Cargando plazos del periodo activo...</p>
      </div>
    );
  }

  return (
    <div className="plazos-container">
      <div className="plazos-header">
        <div className="header-content">
          <div>
            <h1 className="plazos-title">Panel de Plazos del Programa</h1>
            <p className="plazos-subtitle">
              {activePeriodo
                ? `Gestionas las acciones del periodo ${formatPeriodo(activePeriodo)}.`
                : "No hay un periodo activo configurado actualmente por la administración."}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="plazos-message error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
          <button onClick={() => setError("")} className="message-close">×</button>
        </div>
      )}

      {success && (
        <div className="plazos-message success">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>{success}</span>
          <button onClick={() => setSuccess("")} className="message-close">×</button>
        </div>
      )}

      {!activePeriodo ? (
        <div className="plazos-empty secondary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3>No hay un periodo activo</h3>
          <p>Cuando la administración active un nuevo periodo, podrás gestionar los plazos desde esta vista.</p>
        </div>
      ) : (
        <section className="panel-card plazos-panel single">
          <div className="panel-header">
            <div>
              <h2>Controles del Programa</h2>
              <p>Los cambios aplican únicamente a tu programa dentro del periodo vigente.</p>
            </div>
            <div className="active-periodo-chip">
              <span>Periodo activo</span>
              <strong>{formatPeriodo(activePeriodo)}</strong>
            </div>
          </div>

          <div className="periodo-info-banner">
            <div>
              <span className="info-label">Periodo</span>
              <span className="info-value">{formatPeriodo(activePeriodo)}</span>
            </div>
            <div>
              <span className="info-label">Estado</span>
              <span className={`meta-status ${activePeriodo.activo ? "active" : "archived"}`}>
                {activePeriodo.activo ? "En curso" : "Inactivo"}
              </span>
            </div>
            <div>
              <span className="info-label">Archivo</span>
              <span className={`meta-status ${activePeriodo.archivado ? "archived" : ""}`}>
                {activePeriodo.archivado ? "Archivado" : "Disponible"}
              </span>
            </div>
          </div>

          {!plazos ? (
            <div className="plazos-empty secondary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
              </svg>
              <h3>Cargando plazos</h3>
              <p>Estamos sincronizando los switches de este periodo.</p>
            </div>
          ) : (
            <div className="plazos-section standalone">
              <div className="plazos-list">
                {PLAZO_ITEMS.map((item) => {
                  const isActive = !!plazos[item.key];
                  return (
                    <div className="plazo-item" key={item.key}>
                      <div className="plazo-info">
                        <div className={`plazo-icon ${item.iconClass}`}>{item.icon}</div>
                        <div className="plazo-content">
                          <span className="plazo-label">{item.label}</span>
                          <span className="plazo-description">{item.description}</span>
                        </div>
                      </div>
                      <button
                        className={`plazo-toggle ${isActive ? "active" : ""}`}
                        onClick={() => handleTogglePlazo(item.key)}
                        disabled={updatingKey === item.key}
                      >
                        <span className="toggle-slider"></span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default Plazos;

