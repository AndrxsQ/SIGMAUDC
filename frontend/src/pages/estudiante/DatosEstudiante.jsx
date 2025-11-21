import React, { useEffect, useRef, useState } from "react";
import { FaCamera } from "react-icons/fa";
import datosEstudianteService from "../../services/datosEstudiante";
import "../../styles/DatosEstudiante.css";

const DatosEstudiante = () => {
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    const loadPerfil = async () => {
      setLoading(true);
      try {
        const datos = await datosEstudianteService.getPerfil();
        setPerfil(datos);
        setPreview(datos.foto_perfil ? datosEstudianteService.getFotoURL(datos.foto_perfil) : "");
      } catch (err) {
        console.error(err);
        setError("No pudimos cargar la información personal. Intenta más tarde.");
      } finally {
        setLoading(false);
      }
    };
    loadPerfil();
  }, []);

  const handleFotoSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setInfoMessage("");
    setUploading(true);
    try {
      const response = await datosEstudianteService.uploadFoto(file);
      setPreview(datosEstudianteService.getFotoURL(response.foto_perfil));
      setPerfil((prev) => (prev ? { ...prev, foto_perfil: response.foto_perfil } : prev));
      setInfoMessage("Foto actualizada con éxito.");
    } catch (err) {
      console.error(err);
      setError("No pudimos subir la foto. Intenta con otro archivo.");
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoAreaClick = () => {
    fileInputRef.current?.click();
  };

  if (loading) {
    return (
      <div className="datos-loading">
        <div className="datos-spinner" />
        <p>Cargando tus datos personales...</p>
      </div>
    );
  }

  return (
    <div className="datos-page">
      <header className="datos-hero">
        <div className="datos-hero-logo">
          <img src="/logo-udc.png" alt="UDC" />
          <span>Universidad de Cartagena</span>
        </div>
        <div className="datos-hero-text">
          <p className="datos-hero-sub">Inspirado en los principios Apple de claridad y orden</p>
          <h1>Datos del estudiante</h1>
          <p className="datos-hero-caption">
            Tu perfil universitario mostrando únicamente información oficial. Haz clic en la foto para actualizarla si aún está en blanco.
          </p>
        </div>
      </header>

      <div className="datos-grid single-panel">
        <article className="datos-card perfil-panel">
          <div className="perfil-photo" onClick={handlePhotoAreaClick}>
            <div className="perfil-photo-frame">
              {preview ? (
                <img src={preview} alt="Foto de perfil" />
              ) : (
                <div className="perfil-placeholder">
                  <span>{perfil?.nombre?.[0] || "U"}{perfil?.apellido?.[0] || "D"}</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              style={{ display: "none" }}
              onChange={handleFotoSelect}
            />
            <p className="perfil-photo-hint">
              {uploading ? "Subiendo..." : "Haz clic en la foto para actualizar"}
            </p>
          </div>
          <div className="perfil-info">
            <p className="perfil-label">Código institucional</p>
            <p className="perfil-value">{perfil?.codigo || "Sin datos"}</p>
            <p className="perfil-label">Correo institucional</p>
            <p className="perfil-value">{perfil?.email || "Sin datos"}</p>
            <div className="perfil-meta">
              <div>
                <span>Programa</span>
                <strong>{perfil?.programa || "N/D"}</strong>
              </div>
              <div>
                <span>Semestre</span>
                <strong>{perfil?.semestre ?? "N/D"}</strong>
              </div>
              <div>
                <span>Estado</span>
                <strong>{perfil?.estado || "N/D"}</strong>
              </div>
            </div>
            <div className="perfil-meta">
              <div>
                <span>Promedio</span>
                <strong>{perfil?.promedio?.toFixed(2) ?? "Pendiente"}</strong>
              </div>
              <div>
                <span>Sexo</span>
                <strong>{perfil?.sexo || "Sin datos"}</strong>
              </div>
            </div>
          </div>
          {infoMessage && <p className="perfil-note">{infoMessage}</p>}
          {error && <p className="form-error">{error}</p>}
          <div className="datos-list">
            <div className="datos-row">
              <span>Nombre completo</span>
              <strong>{`${perfil?.nombre || ""} ${perfil?.apellido || ""}`.trim() || "Sin datos"}</strong>
            </div>
            <div className="datos-row">
              <span>Documento</span>
              <strong>{perfil?.codigo || "Sin datos"}</strong>
            </div>
            <div className="datos-row">
              <span>Programa</span>
              <strong>{perfil?.programa || "Sin datos"}</strong>
            </div>
            <div className="datos-row">
              <span>Semestre</span>
              <strong>{perfil?.semestre ?? "Sin datos"}</strong>
            </div>
            <div className="datos-row">
              <span>Estado académico</span>
              <strong>{perfil?.estado || "Sin datos"}</strong>
            </div>
            <div className="datos-row">
              <span>Sexo registrado</span>
              <strong>{perfil?.sexo || "Sin datos"}</strong>
            </div>
            <div className="datos-row">
              <span>Promedio acumulado</span>
              <strong>{perfil?.promedio?.toFixed(2) || "Pendiente"}</strong>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
};

export default DatosEstudiante;

