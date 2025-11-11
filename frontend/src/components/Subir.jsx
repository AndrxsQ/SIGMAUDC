/* 
Por el momento los datos (archivos cargados) se manejan solo en el estado local del componente.
Cuando exista backend, los archivos seleccionados se para almacenaran y validaran en la base de datos.
*/
import React, { useState } from "react";
import "../styles/Subir.css";
import { FaUpload, FaFileAlt } from "react-icons/fa";
import { FaFileUpload } from "react-icons/fa";

const SubirDocumentos = () => {
  // 📁 Estados locales para guardar los archivos seleccionados (simulados por ahora)
  const [pagoFile, setPagoFile] = useState(null);
  const [epsFile, setEpsFile] = useState(null);

  const handlePagoChange = (e) => setPagoFile(e.target.files[0]);
  const handleEpsChange = (e) => setEpsFile(e.target.files[0]);

  const handleCancelar = () => {
    setPagoFile(null);
    setEpsFile(null);
  };

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
          <h3>Subir Documentos Requeridos</h3>
        </div>

        {/* Cuerpo principal */}
        <div className="modal-body">

          {/* Comprobante de Pago */}
          <div className="section">
            <p className="section-title">Comprobante de Pago</p>
            <p className="modal-description">
              Sube tu comprobante de pago en formato PDF o imagen.
            </p>

            {/* Zona interactiva de subida */}
            <label className="upload-area">
              <span className="upload-area-icon">
                <FaUpload size={30} />
              </span>
              <span className="upload-area-title">
                {pagoFile ? pagoFile.name : "Arrastra o haz clic para subir"}
              </span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handlePagoChange}
                hidden
              />
            </label>
          </div>

          {/* 🩺 Certificado de EPS */}
          <div className="section">
            <p className="section-title">Certificado de EPS</p>
            <p className="modal-description">
              Sube tu certificado de EPS en formato PDF o imagen.
            </p>

            <label className="upload-area">
              <span className="upload-area-icon">
                <FaUpload size={30} />
              </span>
              <span className="upload-area-title">
                {epsFile ? epsFile.name : "Arrastra o haz clic para subir"}
              </span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleEpsChange}
                hidden
              />
            </label>
          </div>
        </div>

        {/* Pie del modal: botones de acción */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={handleCancelar}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            disabled={!pagoFile || !epsFile}
          >
            Subir archivos
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubirDocumentos;
