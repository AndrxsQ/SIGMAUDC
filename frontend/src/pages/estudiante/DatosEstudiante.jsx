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

  const recordCards = [
    {
      title: "Programa",
      value: perfil?.programa || "Sin datos",
      helper: "Plan de estudios asignado",
    },
    {
      title: "Semestre",
      value: perfil?.semestre ? `Semestre ${perfil.semestre}` : "Sin datos",
      helper: "Avance acumulado",
    },
    {
      title: "Estado académico",
      value: perfil?.estado || "Sin datos",
      helper: "Situación actual (NORMAL / PSE)",
    },
    {
      title: "Promedio acumulado",
      value: formatPromedio(),
      helper: "Notas registradas",
    },
    {
      title: "Sexo",
      value: perfil?.sexo || "Sin datos",
      helper: "Dato registrado",
    },
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
      <article className="datos-card datos-main-card">
        <div className="datos-hero datos-main-header">
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
        </div>

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
          </div>
        </div>

        <div className="datos-record-grid">
          {recordCards.map((card) => (
            <div className="datos-record-card" key={card.title}>
              <p className="datos-record-title">{card.title}</p>
              <strong className="datos-record-value">{card.value}</strong>
              <p className="datos-record-helper">{card.helper}</p>
            </div>
          ))}
        </div>

        {infoMessage && <p className="perfil-note">{infoMessage}</p>}
        {error && <p className="form-error">{error}</p>}
      </article>
    </div>
  );
};

export default DatosEstudiante;
