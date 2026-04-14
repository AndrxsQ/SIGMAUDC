import React, { useState, useEffect } from "react";
import { matriculaService } from "../../services/matricula";
import "../../styles/ValidarSolicitudes.css";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaSpinner,
  FaClipboardList,
  FaUser,
  FaPlus,
  FaMinus,
} from "react-icons/fa";

const ValidarSolicitudes = () => {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("todos");

  useEffect(() => {
    loadSolicitudes();
  }, []);

  const loadSolicitudes = async () => {
    try {
      setLoading(true);
      const response = await matriculaService.getSolicitudesPorPrograma();
      setSolicitudes(response || []);
      setError(null);
    } catch (err) {
      console.error("Error loading solicitudes:", err);
      setError(err.response?.data?.error || "Error al cargar solicitudes");
    } finally {
      setLoading(false);
    }
  };

  const handleValidar = async (solicitudId, estado, observacion) => {
    try {
      setProcesando({ ...procesando, [solicitudId]: true });
      setError(null);
      setSuccess(null);

      await matriculaService.validarSolicitud(solicitudId, estado, observacion);
      setSuccess(
        `Solicitud ${estado === "aprobada" ? "aprobada" : "rechazada"} exitosamente`
      );

      // Recargar solicitudes (Igual a loadDocumentos() en VerificarDocumentos.jsx)
      await loadSolicitudes();

      // Limpiar mensaje de éxito después de 3 segundos
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error validando solicitud:", err);
      setError(err.response?.data?.error || "Error al validar solicitud");
    } finally {
      setProcesando({ ...procesando, [solicitudId]: false });
    }
  };

  const solicitudesFiltradas = solicitudes.filter((sol) => {
    if (filtroEstado === "todos") return true;
    return sol.estado === filtroEstado;
  });

  // Agrupar solicitudes por estudiante
  const solicitudesPorEstudiante = {};
  solicitudesFiltradas.forEach((sol) => {
    const key = `${sol.estudiante_codigo || sol.estudiante_id}`;
    if (!solicitudesPorEstudiante[key]) {
      solicitudesPorEstudiante[key] = {
        estudiante: {
          codigo: sol.estudiante_codigo || `ID: ${sol.estudiante_id}`,
          nombre: sol.estudiante_nombre || "Sin nombre",
          apellido: sol.estudiante_apellido || "",
        },
        solicitudes: [],
      };
    }
    solicitudesPorEstudiante[key].solicitudes.push(sol);
  });

  if (loading) {
    return (
      <div className="validar-solicitudes-container">
        <div className="loading-container">
          <FaSpinner className="spinner" />
          <p>Cargando solicitudes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="validar-solicitudes-container">
      <div className="validar-header">
        <div className="header-logo-title">
          <div className="udc-logo-container">
            <img 
              src="/logo-udc.png" 
              alt="Logo Universidad" 
              className="udc-logo"
            />
          </div>
          <div>
            <h1 className="page-title">Validar Solicitudes de Modificación</h1>
            <p className="page-subtitle">
              Revisa y aprueba o rechaza las solicitudes de modificación de matrícula
            </p>
          </div>
        </div>

        {/* Filtro de estado */}
        <div className="filtros">
          <label className="filtro-label">Filtrar por estado:</label>
          <select
            className="filtro-select"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="todos">Todos</option>
            <option value="pendiente">Pendientes</option>
            <option value="aprobada">Aprobadas</option>
            <option value="rechazada">Rechazadas</option>
          </select>
        </div>
      </div>

      {/* Mensajes de estado */}
      {error && (
        <div className="alert-error">
          <FaTimesCircle />
          <p>{error}</p>
        </div>
      )}
      {success && (
        <div className="alert-success">
          <FaCheckCircle />
          <p>{success}</p>
        </div>
      )}

      {/* Lista de solicitudes */}
      {solicitudesFiltradas.length === 0 ? (
        <div className="empty-state">
          <FaClipboardList size={48} />
          <p>No hay solicitudes para mostrar</p>
        </div>
      ) : (
        <div className="solicitudes-grid">
          {Object.values(solicitudesPorEstudiante).map((grupo, idx) => (
            <div key={idx} className="estudiante-card">
              <div className="estudiante-header">
                <div className="estudiante-info">
                  <FaUser />
                  <div>
                    <h3>
                      {grupo.estudiante.nombre} {grupo.estudiante.apellido}
                    </h3>
                    <p className="estudiante-codigo">
                      Código: {grupo.estudiante.codigo || `ID: ${grupo.solicitudes[0]?.estudiante_id || 'N/A'}`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="solicitudes-list">
                {grupo.solicitudes.map((sol) => (
                  <SolicitudCard
                    key={sol.id}
                    solicitud={sol}
                    onValidar={handleValidar}
                    procesando={procesando[sol.id] || false}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SolicitudCard = ({ solicitud, onValidar, procesando }) => {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [observacion, setObservacion] = useState("");

  const getEstadoBadge = () => {
    if (solicitud.estado === "aprobada") {
      return (
        <span className="badge badge-success">
          <FaCheckCircle /> Aprobada
        </span>
      );
    }
    if (solicitud.estado === "pendiente") {
      return (
        <span className="badge badge-warning">
          <FaSpinner className="spinner-small" /> Pendiente
        </span>
      );
    }
    if (solicitud.estado === "rechazada") {
      return (
        <span className="badge badge-error">
          <FaTimesCircle /> Rechazada
        </span>
      );
    }
    return null;
  };

  const handleAprobar = () => {
    onValidar(solicitud.id, "aprobada", "");
    setMostrarForm(false);
    setObservacion("");
  };

  const handleRechazar = () => {
    if (!observacion.trim()) {
      alert("La observación es obligatoria al rechazar una solicitud");
      return;
    }
    onValidar(solicitud.id, "rechazada", observacion.trim());
    setMostrarForm(false);
    setObservacion("");
  };

  // Parsear los detalles de la solicitud
  const gruposAAgregar = solicitud.grupos_agregar || [];
  const gruposARetirar = solicitud.grupos_retirar || [];

  return (
    <div className={`solicitud-card ${solicitud.estado}`}>
      <div className="solicitud-header">
        <div>
          <h4>Solicitud de Modificación</h4>
          <p className="solicitud-fecha">
            Enviada: {new Date(solicitud.fecha_solicitud).toLocaleDateString('es-ES', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
        {getEstadoBadge()}
      </div>

      {/* Detalles de la solicitud */}
      <div className="solicitud-detalles">
        {gruposAAgregar.length > 0 && (
          <div className="solicitud-seccion agregar">
            <h5><FaPlus /> Materias a Agregar ({gruposAAgregar.length})</h5>
            <div className="materias-grid">
              {gruposAAgregar.map((grupo, idx) => (
                <div key={idx} className="materia-item">
                  <div className="materia-header-detalle">
                    <div className="materia-info-principal">
                      <h6 className="materia-nombre-detalle">{grupo.asignatura_nombre || 'Asignatura'}</h6>
                      <div className="materia-meta-detalle">
                        <span className="materia-codigo-detalle">{grupo.asignatura_codigo || grupo.asignatura_id}</span>
                        <span className="materia-separador">•</span>
                        <span className="materia-creditos-detalle">{grupo.creditos || 0} créditos</span>
                      </div>
                    </div>
                  </div>
                  <div className="materia-grupo-info">
                    <span className="grupo-badge-detalle">{grupo.grupo_codigo || `Grupo ${grupo.grupo_id}`}</span>
                    {grupo.docente && (
                      <span className="docente-info">Docente: {grupo.docente}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {gruposARetirar.length > 0 && (
          <div className="solicitud-seccion retirar">
            <h5><FaMinus /> Materias a Retirar ({gruposARetirar.length})</h5>
            <div className="materias-grid">
              {gruposARetirar.map((grupo, idx) => (
                <div key={idx} className="materia-item">
                  <div className="materia-header-detalle">
                    <div className="materia-info-principal">
                      <h6 className="materia-nombre-detalle">{grupo.asignatura_nombre || 'Asignatura'}</h6>
                      <div className="materia-meta-detalle">
                        <span className="materia-codigo-detalle">{grupo.asignatura_codigo || grupo.asignatura_id}</span>
                        <span className="materia-separador">•</span>
                        <span className="materia-creditos-detalle">{grupo.creditos || 0} créditos</span>
                      </div>
                    </div>
                  </div>
                  <div className="materia-grupo-info">
                    <span className="grupo-badge-detalle">{grupo.grupo_codigo || `Grupo ${grupo.grupo_id}`}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {gruposAAgregar.length === 0 && gruposARetirar.length === 0 && (
          <div className="solicitud-vacia">
            <p>No hay cambios en esta solicitud</p>
          </div>
        )}
      </div>

      {solicitud.estado === "rechazada" && solicitud.observacion && (
        <div className="observacion-box">
          <strong>Observación:</strong>{" "}
          {typeof solicitud.observacion === 'string' ? solicitud.observacion : ''}
        </div>
      )}

      <div className="solicitud-actions">
        {solicitud.estado === "pendiente" && (
          <button
            className="btn-review"
            onClick={() => setMostrarForm(!mostrarForm)}
            disabled={procesando}
          >
            {mostrarForm ? "Cancelar" : "Revisar"}
          </button>
        )}
      </div>

      {mostrarForm && solicitud.estado === "pendiente" && (
        <div className="review-form">
          <div className="review-buttons">
            <button
              className="btn-approve"
              onClick={handleAprobar}
              disabled={procesando}
            >
              {procesando ? (
                <>
                  <FaSpinner className="spinner-small" /> Procesando...
                </>
              ) : (
                <>
                  <FaCheckCircle /> Aprobar
                </>
              )}
            </button>
            <button
              className="btn-reject"
              onClick={() => {
                if (!observacion.trim()) {
                  alert("La observación es obligatoria");
                  return;
                }
                handleRechazar();
              }}
              disabled={procesando || !observacion.trim()}
            >
              {procesando ? (
                <>
                  <FaSpinner className="spinner-small" /> Procesando...
                </>
              ) : (
                <>
                  <FaTimesCircle /> Rechazar
                </>
              )}
            </button>
          </div>
          <textarea
            className="observacion-input"
            placeholder="Observación (obligatoria si se rechaza)..."
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            rows="3"
          />
        </div>
      )}
    </div>
  );
};

export default ValidarSolicitudes;