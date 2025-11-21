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

  const formatPromedio = () => (perfil?.promedio == null ? "Pendiente" : perfil.promedio.toFixed(2));
  const nombreCompleto = `${perfil?.nombre || ""} ${perfil?.apellido || ""}`.trim() || "Sin datos";

  const datosRows = [
    { label: "Nombre completo", value: nombreCompleto },
    { label: "Programa", value: perfil?.programa },
    { label: "Semestre", value: perfil?.semestre ?? "Sin datos" },
    { label: "Estado", value: perfil?.estado },
    { label: "Sexo", value: perfil?.sexo },
    { label: "Promedio acumulado", value: formatPromedio() },
    { label: "Correo institucional", value: perfil?.email },
  ];

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
          <h1>Datos del estudiante</h1>
          <p className="datos-hero-caption">
            Mantén la información actualizada para que el sistema muestre siempre tu estado académico real.
          </p>
        </div>
      </header>

      <section className="datos-panel">
        <article className="datos-card datos-main-card">
          <div className="datos-main-grid">
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
              <p className="perfil-photo-hint">{uploading ? "Subiendo..." : "Haz clic en la foto para actualizar"}</p>
            </div>

            <div className="perfil-info">
              <div className="perfil-info-row">
                <div>
                  <p className="perfil-label">Código institucional</p>
                  <p className="perfil-value">{perfil?.codigo || "Sin datos"}</p>
                </div>
                <div>
                  <p className="perfil-label">Correo institucional</p>
                  <p className="perfil-value">{perfil?.email || "Sin datos"}</p>
                </div>
              </div>
              <div className="perfil-meta">
                <div>
                  <span>Programa</span>
                  <strong>{perfil?.programa || "Sin datos"}</strong>
                </div>
                <div>
                  <span>Semestre</span>
                  <strong>{perfil?.semestre ?? "Sin datos"}</strong>
                </div>
                <div>
                  <span>Estado</span>
                  <strong>{perfil?.estado || "Sin datos"}</strong>
                </div>
              </div>
              <div className="perfil-meta">
                <div>
                  <span>Promedio</span>
                  <strong>{formatPromedio()}</strong>
                </div>
                <div>
                  <span>Sexo</span>
                  <strong>{perfil?.sexo || "Sin datos"}</strong>
                </div>
              </div>
            </div>
          </div>

          {infoMessage && <p className="perfil-note">{infoMessage}</p>}
          {error && <p className="form-error">{error}</p>}

          <div className="datos-detail-grid">
            {datosRows.map((row) => (
              <div className="datos-detail-row" key={row.label}>
                <span>{row.label}</span>
                <strong>{row.value || "Sin datos"}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
};

export default DatosEstudiante;
