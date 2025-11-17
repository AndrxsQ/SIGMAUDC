import React, { useState, useEffect } from "react";
import { plazosService } from "../../services/plazos";
import "../../styles/Plazos.css";

const Plazos = () => {
  const [periodos, setPeriodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPeriodo, setNewPeriodo] = useState({ year: new Date().getFullYear(), semestre: 1 });

  useEffect(() => {
    loadPeriodos();
  }, []);

  const loadPeriodos = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await plazosService.getPeriodosConPlazos();
      setPeriodos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading periodos:", err);
      setError("Error al cargar los periodos académicos");
    } finally {
      setLoading(false);
    }
  };

  const safePeriodos = Array.isArray(periodos) ? periodos : [];
  const activePeriodo = safePeriodos.find((periodo) => periodo.activo) || null;
  const sortedPeriodos = [...safePeriodos].sort((a, b) => {
    if (a.activo === b.activo) {
      if (a.year === b.year) {
        return b.semestre - a.semestre;
      }
      return b.year - a.year;
    }
    return a.activo ? -1 : 1;
  });

  const handleCreatePeriodo = async (e) => {
    e.preventDefault();
    try {
      setError("");
      await plazosService.createPeriodo(newPeriodo.year, newPeriodo.semestre);
      setSuccess("Periodo académico creado exitosamente");
      setShowCreateModal(false);
      setNewPeriodo({ year: new Date().getFullYear(), semestre: 1 });
      await loadPeriodos();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error creating periodo:", err);
      const message = err.response?.data?.error || err.response?.data || "Error al crear el periodo académico";
      setError(typeof message === 'string' ? message : "Error al crear el periodo académico");
    }
  };

  const handleSetPeriodoActivo = async (periodo) => {
    try {
      setError("");
      if (periodo.activo) {
        setSuccess("Este periodo ya es el activo actual");
        setTimeout(() => setSuccess(""), 2000);
        return;
      }
      await plazosService.updatePeriodo(periodo.id, true);
      setSuccess(`Periodo ${formatPeriodo(periodo)} activado exitosamente`);
      await loadPeriodos();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error updating periodo:", err);
      const message = err.response?.data?.error || err.response?.data || "Error al actualizar el periodo académico";
      setError(typeof message === "string" ? message : "Error al actualizar el periodo académico");
    }
  };

  const handleDeletePeriodo = async (periodoId) => {
    if (!window.confirm("¿Estás seguro de eliminar este periodo académico? Esta acción no se puede deshacer.")) {
      return;
    }
    try {
      setError("");
      await plazosService.deletePeriodo(periodoId);
      setSuccess("Periodo académico eliminado exitosamente");
      await loadPeriodos();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error deleting periodo:", err);
      const message = err.response?.data?.error || err.response?.data || "Error al eliminar el periodo académico";
      setError(typeof message === 'string' ? message : "Error al eliminar el periodo académico");
    }
  };

  const handleTogglePlazo = async (periodoId, tipoPlazo, valorActual) => {
    try {
      if (!periodoId) {
        setError("Debes activar un periodo académico antes de gestionar los plazos.");
        setTimeout(() => setError(""), 3000);
        return;
      }
      setError("");
      const nuevosPlazos = {
        [tipoPlazo]: !valorActual,
      };
      await plazosService.updatePlazos(periodoId, nuevosPlazos);
      setSuccess("Plazos actualizados exitosamente");
      await loadPeriodos();
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) {
      console.error("Error updating plazos:", err);
      setError("Error al actualizar los plazos");
    }
  };

  const formatPeriodo = (periodo) => {
    return `${periodo.year}-${periodo.semestre}`;
  };

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
        <p>Cargando periodos académicos...</p>
      </div>
    );
  }

  const renderPlazoChip = (label, activo) => (
    <span className={`plazo-chip ${activo ? "active" : ""}`}>
      <span className="chip-dot" />
      {label}: <strong>{activo ? "Activo" : "Inactivo"}</strong>
    </span>
  );

  return (
    <div className="plazos-container">
      {/* Header */}
      <div className="plazos-header">
        <div className="header-content">
          <div>
            <h1 className="plazos-title">Administración de Plazos</h1>
            <p className="plazos-subtitle">Gestiona los periodos académicos y controla los plazos de documentos, inscripción y modificaciones</p>
          </div>
          <button
            className="create-periodo-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>Nuevo Periodo</span>
          </button>
        </div>
      </div>

      {/* Mensajes */}
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

      {/* Lista de Periodos */}
      <div className="plazos-panels">
        <section className="panel-card periodos-panel">
          <div className="panel-header">
            <div>
              <h2>Periodos Académicos</h2>
              <p>Gestiona creación, activación y eliminación</p>
            </div>
          </div>
          {periodos.length === 0 ? (
            <div className="plazos-empty compact">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <h3>No hay periodos académicos</h3>
              <p>Crea tu primer periodo académico para comenzar</p>
            </div>
          ) : (
            <div className="periodos-grid">
              {sortedPeriodos.map((periodo) => (
                <div
                  key={periodo.id}
                  className={`periodo-card ${periodo.activo ? "activo" : ""}`}
                >
                  <div className="periodo-card-header">
                    <div className="periodo-info">
                      <h3 className="periodo-nombre">{formatPeriodo(periodo)}</h3>
                      {periodo.activo && (
                        <span className="periodo-badge activo-badge">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="9 12 11 14 15 10" />
                          </svg>
                          Activo
                        </span>
                      )}
                    </div>
                    <div className="periodo-actions">
                      <button
                        className={`toggle-activo-btn ${periodo.activo ? "active" : ""}`}
                        onClick={() => handleSetPeriodoActivo(periodo)}
                        title={periodo.activo ? "Periodo activo" : "Activar periodo"}
                      >
                        <span className="toggle-slider"></span>
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => handleDeletePeriodo(periodo.id)}
                        title="Eliminar periodo"
                        disabled={periodo.activo}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="periodo-meta">
                    <div>
                      <span className="meta-label">Año</span>
                      <span className="meta-value">{periodo.year}</span>
                    </div>
                    <div>
                      <span className="meta-label">Semestre</span>
                      <span className="meta-value">{periodo.semestre}</span>
                    </div>
                    <div>
                      <span className="meta-label">Estado</span>
                      <span className={`meta-status ${periodo.activo ? "active" : ""}`}>
                        {periodo.activo ? "En curso" : "Inactivo"}
                      </span>
                    </div>
                  </div>

                  {periodo.plazos && (
                    <div className="plazo-chip-group">
                      {renderPlazoChip("Documentos", periodo.plazos.documentos)}
                      {renderPlazoChip("Inscripción", periodo.plazos.inscripcion)}
                      {renderPlazoChip("Modificaciones", periodo.plazos.modificaciones)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel-card plazos-panel">
          <div className="panel-header">
            <div>
              <h2>Plazos del Periodo Activo</h2>
              <p>Define qué procesos están habilitados en el semestre en curso</p>
            </div>
            {activePeriodo && (
              <div className="active-periodo-chip">
                <span>Periodo activo</span>
                <strong>{formatPeriodo(activePeriodo)}</strong>
              </div>
            )}
          </div>

          {!activePeriodo ? (
            <div className="plazos-empty secondary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <h3>Activa un periodo académico</h3>
              <p>Debes tener un periodo activo para habilitar o bloquear los plazos.</p>
            </div>
          ) : !activePeriodo.plazos ? (
            <div className="plazos-empty secondary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
              </svg>
              <h3>Cargando plazos</h3>
              <p>Estamos sincronizando los plazos asociados a este periodo.</p>
            </div>
          ) : (
            <div className="plazos-section standalone">
              <div className="plazos-list">
                <div className="plazo-item">
                  <div className="plazo-info">
                    <div className="plazo-icon documentos">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                    </div>
                    <div className="plazo-content">
                      <span className="plazo-label">Documentos</span>
                      <span className="plazo-description">
                        Controla si los estudiantes pueden subir documentación.
                      </span>
                    </div>
                  </div>
                  <button
                    className={`plazo-toggle ${activePeriodo.plazos.documentos ? "active" : ""}`}
                    onClick={() => handleTogglePlazo(activePeriodo.id, "documentos", activePeriodo.plazos.documentos)}
                  >
                    <span className="toggle-slider"></span>
                  </button>
                </div>

                <div className="plazo-item">
                  <div className="plazo-info">
                    <div className="plazo-icon inscripcion">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="8.5" cy="7" r="4" />
                        <line x1="20" y1="8" x2="20" y2="14" />
                        <line x1="23" y1="11" x2="17" y2="11" />
                      </svg>
                    </div>
                    <div className="plazo-content">
                      <span className="plazo-label">Inscripción</span>
                      <span className="plazo-description">
                        Habilita la inscripción/matrícula de asignaturas.
                      </span>
                    </div>
                  </div>
                  <button
                    className={`plazo-toggle ${activePeriodo.plazos.inscripcion ? "active" : ""}`}
                    onClick={() => handleTogglePlazo(activePeriodo.id, "inscripcion", activePeriodo.plazos.inscripcion)}
                  >
                    <span className="toggle-slider"></span>
                  </button>
                </div>

                <div className="plazo-item">
                  <div className="plazo-info">
                    <div className="plazo-icon modificaciones">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </div>
                    <div className="plazo-content">
                      <span className="plazo-label">Modificaciones</span>
                      <span className="plazo-description">
                        Permite realizar cambios sobre matrícula o información.
                      </span>
                    </div>
                  </div>
                  <button
                    className={`plazo-toggle ${activePeriodo.plazos.modificaciones ? "active" : ""}`}
                    onClick={() =>
                      handleTogglePlazo(activePeriodo.id, "modificaciones", activePeriodo.plazos.modificaciones)
                    }
                  >
                    <span className="toggle-slider"></span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Modal de Crear Periodo */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Crear Nuevo Periodo Académico</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreatePeriodo} className="modal-form">
              <div className="form-group">
                <label htmlFor="year">Año</label>
                <input
                  id="year"
                  type="number"
                  min="2020"
                  max="2100"
                  value={newPeriodo.year}
                  onChange={(e) => setNewPeriodo({ ...newPeriodo, year: parseInt(e.target.value) })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="semestre">Semestre</label>
                <select
                  id="semestre"
                  value={newPeriodo.semestre}
                  onChange={(e) => setNewPeriodo({ ...newPeriodo, semestre: parseInt(e.target.value) })}
                  required
                >
                  <option value={1}>Primer Semestre (1)</option>
                  <option value={2}>Segundo Semestre (2)</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Crear Periodo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Plazos;

