import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import documentosService from "../../services/documentos";
import "../../styles/Subir.css";
import { FaUpload, FaFileAlt, FaCheckCircle, FaTimesCircle, FaSpinner } from "react-icons/fa";
import { FaFileUpload } from "react-icons/fa";

const SubirDocumentos = () => {
  const navigate = useNavigate();
  const [documentos, setDocumentos] = useState([]);
  const [periodoActivo, setPeriodoActivo] = useState(null);
  const [puedeSubir, setPuedeSubir] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Estados locales para archivos seleccionados
  const [pagoFile, setPagoFile] = useState(null);
  const [epsFile, setEpsFile] = useState(null);

  useEffect(() => {
    loadDocumentos();
  }, []);

  const loadDocumentos = async () => {
    try {
      setLoading(true);
      const response = await documentosService.getDocumentosEstudiante();
      setDocumentos(response.documentos || []);
      setPeriodoActivo(response.periodoActivo || response.periodo_activo);
      setPuedeSubir(response.puedeSubir !== undefined ? response.puedeSubir : (response.puede_subir || false));
      setError(null);
    } catch (err) {
      console.error("Error loading documentos:", err);
      setError(err.response?.data?.error || "Error al cargar documentos");
    } finally {
      setLoading(false);
    }
  };

  const getDocumentoPorTipo = (tipo) => {
    return documentos.find((d) => d.tipo_documento === tipo);
  };

  const getEstadoDocumento = (tipo) => {
    const doc = getDocumentoPorTipo(tipo);
    if (!doc) return "sin_subir";
    return doc.estado; // "pendiente", "aprobado", "rechazado"
  };

  const getPuedeResubir = (tipo) => {
    const estado = getEstadoDocumento(tipo);
    return estado === "rechazado";
  };

  const handlePagoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPagoFile(file);
      setError(null);
    }
  };

  const handleEpsChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEpsFile(file);
      setError(null);
    }
  };

  const handleSubir = async (tipoDocumento, archivo) => {
    if (!archivo || !puedeSubir) return;

    const estado = getEstadoDocumento(tipoDocumento);
    if (estado === "pendiente") {
      setError("Documento ya subido, pendiente de revisión");
      return;
    }
    if (estado === "aprobado") {
      setError("Documento ya aprobado");
      return;
    }

    try {
      setUploading({ ...uploading, [tipoDocumento]: true });
      setError(null);
      setSuccess(null);

      const response = await documentosService.subirDocumento(tipoDocumento, archivo);
      setSuccess(`Documento ${tipoDocumento === "certificado_eps" ? "EPS" : "Matrícula"} subido exitosamente`);

      // Limpiar archivo seleccionado
      if (tipoDocumento === "certificado_eps") {
        setEpsFile(null);
      } else {
        setPagoFile(null);
      }

      // Recargar documentos
      await loadDocumentos();

      // Limpiar mensaje de éxito después de 3 segundos
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error uploading documento:", err);
      setError(err.response?.data?.error || `Error al subir ${tipoDocumento}`);
    } finally {
      setUploading({ ...uploading, [tipoDocumento]: false });
    }
  };

  const handleCancelar = () => {
    setPagoFile(null);
    setEpsFile(null);
    setError(null);
    setSuccess(null);
  };

  if (loading) {
    return (
      <div className="subir-container">
        <div className="loading-container">
          <FaSpinner className="spinner" />
          <p>Cargando documentos...</p>
        </div>
      </div>
    );
  }

  const estadoPago = getEstadoDocumento("comprobante_matricula");
  const estadoEPS = getEstadoDocumento("certificado_eps");
  const docPago = getDocumentoPorTipo("comprobante_matricula");
  const docEPS = getDocumentoPorTipo("certificado_eps");

  return (
    <div className="subir-container">
      <div className="upload-card">
        {/* Encabezado del modal */}
        <div className="modal-header">
          <div className="modal-logo">
            <span className="logo-circle">
              <FaFileUpload size={20} />
            </span>
          </div>
          <div>
            <h3>Subir Documentos Requeridos</h3>
            {periodoActivo && (
              <p className="periodo-info">
                Periodo: {periodoActivo.year}-{periodoActivo.semestre}
              </p>
            )}
          </div>
        </div>

        {/* Mensajes de estado */}
        {!puedeSubir && (
          <div className="alert-info">
            <p>El plazo para subir documentos no está activo en este momento.</p>
          </div>
        )}
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

        {/* Cuerpo principal */}
        <div className="modal-body">
          {/* Comprobante de Matrícula */}
          <div className="section">
            <div className="section-header">
              <p className="section-title">Comprobante de Matrícula</p>
              {estadoPago === "aprobado" && (
                <span className="badge badge-success">
                  <FaCheckCircle /> Aprobado
                </span>
              )}
              {estadoPago === "pendiente" && (
                <span className="badge badge-warning">
                  <FaSpinner className="spinner-small" /> Pendiente
                </span>
              )}
              {estadoPago === "rechazado" && (
                <span className="badge badge-error">
                  <FaTimesCircle /> Rechazado
                </span>
              )}
            </div>
            <p className="modal-description">
              Sube tu comprobante de matrícula en formato PDF o imagen.
            </p>

            {docPago && docPago.estado === "rechazado" && docPago.observacion && (
              <div className="observacion-box">
                <strong>Observación:</strong>{" "}
                {typeof docPago.observacion === "string" ? docPago.observacion : ""}
              </div>
            )}

            {/* Zona interactiva de subida */}
            <label
              className={`upload-area ${estadoPago === "aprobado" ? "disabled" : ""}`}
              style={{ pointerEvents: estadoPago === "aprobado" ? "none" : "auto" }}
            >
              <span className="upload-area-icon">
                {estadoPago === "aprobado" ? (
                  <FaCheckCircle size={30} />
                ) : (
                  <FaUpload size={30} />
                )}
              </span>
              <span className="upload-area-title">
                {pagoFile
                  ? pagoFile.name
                  : estadoPago === "aprobado"
                  ? "Documento aprobado"
                  : estadoPago === "pendiente"
                  ? "Documento pendiente de revisión"
                  : estadoPago === "rechazado"
                  ? "Arrastra o haz clic para resubir"
                  : "Arrastra o haz clic para subir"}
              </span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handlePagoChange}
                disabled={!puedeSubir || estadoPago === "aprobado" || estadoPago === "pendiente"}
                hidden
              />
            </label>

            {pagoFile && (estadoPago === "sin_subir" || estadoPago === "rechazado") && (
              <button
                className="btn-upload-individual"
                onClick={() => handleSubir("comprobante_matricula", pagoFile)}
                disabled={uploading["comprobante_matricula"] || !puedeSubir}
              >
                {uploading["comprobante_matricula"] ? (
                  <>
                    <FaSpinner className="spinner-small" /> Subiendo...
                  </>
                ) : (
                  "Subir Comprobante"
                )}
              </button>
            )}
          </div>

          {/* Certificado de EPS */}
          <div className="section">
            <div className="section-header">
              <p className="section-title">Certificado de EPS</p>
              {estadoEPS === "aprobado" && (
                <span className="badge badge-success">
                  <FaCheckCircle /> Aprobado
                </span>
              )}
              {estadoEPS === "pendiente" && (
                <span className="badge badge-warning">
                  <FaSpinner className="spinner-small" /> Pendiente
                </span>
              )}
              {estadoEPS === "rechazado" && (
                <span className="badge badge-error">
                  <FaTimesCircle /> Rechazado
                </span>
              )}
            </div>
            <p className="modal-description">
              Sube tu certificado de EPS en formato PDF o imagen.
            </p>

            {docEPS && docEPS.estado === "rechazado" && docEPS.observacion && (
              <div className="observacion-box">
                <strong>Observación:</strong>{" "}
                {typeof docEPS.observacion === "string" ? docEPS.observacion : ""}
              </div>
            )}

            <label
              className={`upload-area ${estadoEPS === "aprobado" ? "disabled" : ""}`}
              style={{ pointerEvents: estadoEPS === "aprobado" ? "none" : "auto" }}
            >
              <span className="upload-area-icon">
                {estadoEPS === "aprobado" ? (
                  <FaCheckCircle size={30} />
                ) : (
                  <FaUpload size={30} />
                )}
              </span>
              <span className="upload-area-title">
                {epsFile
                  ? epsFile.name
                  : estadoEPS === "aprobado"
                  ? "Documento aprobado"
                  : estadoEPS === "pendiente"
                  ? "Documento pendiente de revisión"
                  : estadoEPS === "rechazado"
                  ? "Arrastra o haz clic para resubir"
                  : "Arrastra o haz clic para subir"}
              </span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleEpsChange}
                disabled={!puedeSubir || estadoEPS === "aprobado" || estadoEPS === "pendiente"}
                hidden
              />
            </label>

            {epsFile && (estadoEPS === "sin_subir" || estadoEPS === "rechazado") && (
              <button
                className="btn-upload-individual"
                onClick={() => handleSubir("certificado_eps", epsFile)}
                disabled={uploading["certificado_eps"] || !puedeSubir}
              >
                {uploading["certificado_eps"] ? (
                  <>
                    <FaSpinner className="spinner-small" /> Subiendo...
                  </>
                ) : (
                  "Subir Certificado EPS"
                )}
              </button>
            )}
          </div>
        </div>

        {/* Pie del modal: botones de acción */}
        {(pagoFile || epsFile) && (
          <div className="modal-footer">
            <button className="btn-secondary" onClick={handleCancelar}>
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubirDocumentos;
