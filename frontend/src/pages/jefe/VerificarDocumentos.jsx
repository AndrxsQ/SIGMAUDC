import React, { useState, useEffect } from "react";
import documentosService from "../../services/documentos";
import "../../styles/VerificarDocumentos.css";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaSpinner,
  FaFileAlt,
  FaDownload,
  FaUser,
} from "react-icons/fa";

const VerificarDocumentos = () => {
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revisando, setRevisando] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("todos"); // "todos", "pendiente", "aprobado", "rechazado"

  useEffect(() => {
    loadDocumentos();
  }, []);

  const loadDocumentos = async () => {
    try {
      setLoading(true);
      const response = await documentosService.getDocumentosPorPrograma();
      setDocumentos(response || []);
      setError(null);
    } catch (err) {
      console.error("Error loading documentos:", err);
      setError(err.response?.data?.error || "Error al cargar documentos");
    } finally {
      setLoading(false);
    }
  };

  const handleRevisar = async (documentoId, estado, observacion) => {
    try {
      setRevisando({ ...revisando, [documentoId]: true });
      setError(null);
      setSuccess(null);

      await documentosService.revisarDocumento(documentoId, estado, observacion);
      setSuccess(
        `Documento ${estado === "aprobado" ? "aprobado" : "rechazado"} exitosamente`
      );

      // Recargar documentos
      await loadDocumentos();

      // Limpiar mensaje de éxito después de 3 segundos
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error revisando documento:", err);
      setError(err.response?.data?.error || "Error al revisar documento");
    } finally {
      setRevisando({ ...revisando, [documentoId]: false });
    }
  };

  const documentosFiltrados = documentos.filter((doc) => {
    if (filtroEstado === "todos") return true;
    return doc.estado === filtroEstado;
  });

  // Agrupar documentos por estudiante
  const documentosPorEstudiante = {};
  documentosFiltrados.forEach((doc) => {
    const key = `${doc.estudiante_codigo || doc.estudiante_id}`;
    if (!documentosPorEstudiante[key]) {
      documentosPorEstudiante[key] = {
        estudiante: {
          codigo: doc.estudiante_codigo,
          nombre: doc.estudiante_nombre,
          apellido: doc.estudiante_apellido,
        },
        documentos: [],
      };
    }
    documentosPorEstudiante[key].documentos.push(doc);
  });

  if (loading) {
    return (
      <div className="verificar-documentos-container">
        <div className="loading-container">
          <FaSpinner className="spinner" />
          <p>Cargando documentos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="verificar-documentos-container">
      <div className="verificar-header">
        <div className="header-logo-title">
          <div className="udc-logo-container">
            <img 
              src="/logo-udc.png" 
              alt="Logo Universidad" 
              className="udc-logo"
            />
          </div>
          <div>
            <h1 className="page-title">Verificar Documentos</h1>
            <p className="page-subtitle">
              Revisa y aprueba o rechaza los documentos subidos por los estudiantes
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
            <option value="aprobado">Aprobados</option>
            <option value="rechazado">Rechazados</option>
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

      {/* Lista de documentos */}
      {documentosFiltrados.length === 0 ? (
        <div className="empty-state">
          <FaFileAlt size={48} />
          <p>No hay documentos para mostrar</p>
        </div>
      ) : (
        <div className="documentos-grid">
          {Object.values(documentosPorEstudiante).map((grupo, idx) => (
            <div key={idx} className="estudiante-card">
              <div className="estudiante-header">
                <div className="estudiante-info">
                  <FaUser />
                  <div>
                    <h3>
                      {grupo.estudiante.nombre} {grupo.estudiante.apellido}
                    </h3>
                    <p className="estudiante-codigo">
                      Código: {grupo.estudiante.codigo}
                    </p>
                  </div>
                </div>
              </div>

              <div className="documentos-list">
                {grupo.documentos.map((doc) => (
                  <DocumentoCard
                    key={doc.id}
                    documento={doc}
                    onRevisar={handleRevisar}
                    revisando={revisando[doc.id] || false}
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

const DocumentoCard = ({ documento, onRevisar, revisando }) => {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [observacion, setObservacion] = useState("");

  const tipoNombre =
    documento.tipo_documento === "certificado_eps"
      ? "Certificado EPS"
      : "Comprobante de Matrícula";

  const getEstadoBadge = () => {
    if (documento.estado === "aprobado") {
      return (
        <span className="badge badge-success">
          <FaCheckCircle /> Aprobado
        </span>
      );
    }
    if (documento.estado === "pendiente") {
      return (
        <span className="badge badge-warning">
          <FaSpinner className="spinner-small" /> Pendiente
        </span>
      );
    }
    if (documento.estado === "rechazado") {
      return (
        <span className="badge badge-error">
          <FaTimesCircle /> Rechazado
        </span>
      );
    }
    return null;
  };

  const handleAprobar = () => {
    onRevisar(documento.id, "aprobado", "");
    setMostrarForm(false);
    setObservacion("");
  };

  const handleRechazar = () => {
    if (!observacion.trim()) {
      alert("La observación es obligatoria al rechazar un documento");
      return;
    }
    onRevisar(documento.id, "rechazado", observacion.trim());
    setMostrarForm(false);
    setObservacion("");
  };

  return (
    <div className={`documento-card ${documento.estado}`}>
      <div className="documento-header">
        <div>
          <h4>{tipoNombre}</h4>
          <p className="documento-fecha">
            Subido: {new Date(documento.fecha_subida).toLocaleDateString('es-ES', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
        {getEstadoBadge()}
      </div>

      {documento.estado === "rechazado" && documento.observacion && (
        <div className="observacion-box">
          <strong>Observación:</strong>{" "}
          {typeof documento.observacion === 'string' ? documento.observacion : ''}
        </div>
      )}

      <div className="documento-actions">
        <a
          href={documentosService.getArchivoURL(documento.archivo_url)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-view"
        >
          <FaDownload /> Ver documento
        </a>

        {documento.estado === "pendiente" && (
          <button
            className="btn-review"
            onClick={() => setMostrarForm(!mostrarForm)}
            disabled={revisando}
          >
            {mostrarForm ? "Cancelar" : "Revisar"}
          </button>
        )}
      </div>

      {mostrarForm && documento.estado === "pendiente" && (
        <div className="review-form">
          <div className="review-buttons">
            <button
              className="btn-approve"
              onClick={handleAprobar}
              disabled={revisando}
            >
              {revisando ? (
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
              disabled={revisando || !observacion.trim()}
            >
              {revisando ? (
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

export default VerificarDocumentos;

