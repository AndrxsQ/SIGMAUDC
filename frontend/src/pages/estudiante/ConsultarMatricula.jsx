import React, { useState, useEffect } from "react";
import { matriculaService } from "../../services/matricula";
import { FaCalendarAlt, FaUser, FaMapMarkerAlt, FaBook, FaExclamationTriangle } from "react-icons/fa";
import "../../styles/ConsultarMatricula.css";

const FRANJAS = [
  { label: "7:00 - 7:50", start: "07:00", end: "07:50" },
  { label: "7:50 - 8:40", start: "07:50", end: "08:40" },
  { label: "8:40 - 9:30", start: "08:40", end: "09:30" },
  { label: "9:30 - 10:20", start: "09:30", end: "10:20" },
  { label: "10:20 - 11:10", start: "10:20", end: "11:10" },
  { label: "11:10 - 12:00", start: "11:10", end: "12:00" },
  { label: "12:00 - 12:50", start: "12:00", end: "12:50" },
  { label: "13:00 - 13:50", start: "13:00", end: "13:50" },
  { label: "13:50 - 14:40", start: "13:50", end: "14:40" },
  { label: "14:40 - 15:30", start: "14:40", end: "15:30" },
  { label: "15:30 - 16:20", start: "15:30", end: "16:20" },
  { label: "16:20 - 17:10", start: "16:20", end: "17:10" },
  { label: "17:10 - 18:00", start: "17:10", end: "18:00" },
];

const diasSemana = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];
const diasCortos = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const timeToMinutes = (hora) => {
  if (!hora) return null;
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
};

const ConsultarMatricula = () => {
  const [loading, setLoading] = useState(true);
  const [horarioData, setHorarioData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadHorario();
  }, []);

  const loadHorario = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await matriculaService.getHorarioActual();
      setHorarioData(data);
    } catch (err) {
      console.error("Error loading horario:", err);
      setError("Error al cargar el horario. Por favor, intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const buildMatrix = () => {
    if (!horarioData?.clases) return null;
    const matrix = {};
    diasSemana.forEach((dia) => {
      matrix[dia] = FRANJAS.map(() => []);
    });

    horarioData.clases.forEach((clase) => {
      if (!clase.dia || !clase.hora_inicio) return;
      const startMin = timeToMinutes(clase.hora_inicio);
      const slotIndex = FRANJAS.findIndex((slot) => {
        const slotStart = timeToMinutes(slot.start);
        const slotEnd = timeToMinutes(slot.end);
        if (slotStart === null || slotEnd === null || startMin === null) return false;
        return startMin >= slotStart && startMin < slotEnd;
      });
      const index = slotIndex !== -1 ? slotIndex : 0;
      if (matrix[clase.dia]) {
        matrix[clase.dia][index].push(clase);
      }
    });

    return matrix;
  };

  const renderSlot = (dia, franja, index, matrix) => {
    const clases = matrix?.[dia]?.[index] || [];
    if (clases.length === 0) {
      return <div className="celda-franja" key={`${dia}-${index}`}></div>;
    }
    return (
      <div className="celda-franja" key={`${dia}-${index}`}>
        {clases.map((clase, idx) => (
          <div key={`${dia}-${franja.label}-${idx}`} className="celda-franja-block">
            <div className="celda-franja-title">{clase.asignatura_nombre}</div>
            <div className="celda-franja-meta">
              <FaUser size={12} />
              <span>{clase.docente || "Docente asignado"}</span>
            </div>
            {clase.salon && (
              <div className="celda-franja-meta">
                <FaMapMarkerAlt size={12} />
                <span>{clase.salon}</span>
              </div>
            )}
            <div className="celda-franja-time">
              {clase.hora_inicio} - {clase.hora_fin}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="consultar-matricula-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Cargando horario...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="consultar-matricula-container">
        <div className="horario-header">
          <div className="header-content">
            <div className="udc-logo-container">
              <img src="/logo-udc.png" alt="Logo Universidad" className="udc-logo" />
            </div>
            <div className="header-info">
              <h1>Consultar Matrícula</h1>
              <p>Aquí te mostramos cuánto falta para inscribir tus materias.</p>
            </div>
          </div>
        </div>
        <div className="alert-card error">
          <div className="alert-icon">
            <FaExclamationTriangle size={24} />
          </div>
          <div className="alert-body">
            <h2>Plazo inactivo</h2>
            <p>{error}</p>
            <button className="alert-primary" onClick={loadHorario}>
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasClases = horarioData && horarioData.clases && horarioData.clases.length > 0;
  if (!hasClases) {
    return (
      <div className="consultar-matricula-container">
        <div className="horario-header">
          <div className="header-content">
            <div className="udc-logo-container">
              <img src="/logo-udc.png" alt="Logo Universidad" className="udc-logo" />
            </div>
            <div className="header-info">
              <h1>Consultar Matrícula</h1>
              {horarioData?.periodo ? (
                <p>Periodo {horarioData.periodo.year}-{horarioData.periodo.semestre}</p>
              ) : (
                <p>No hay periodo activo</p>
              )}
            </div>
          </div>
        </div>
        <div className="empty-state">
          <FaBook size={48} />
          <h2>No tienes asignaturas matriculadas</h2>
          <p>No hay asignaturas inscritas para el periodo actual.</p>
        </div>
      </div>
    );
  }

  const matrix = buildMatrix();

  return (
    <div className="consultar-matricula-container">
      <div className="horario-header">
        <div className="header-content">
          <div className="udc-logo-container">
            <img src="/logo-udc.png" alt="Logo Universidad" className="udc-logo" />
          </div>
          <div className="header-info">
            <h1>Consultar Matrícula</h1>
            {horarioData.periodo && (
              <p>Periodo {horarioData.periodo.year}-{horarioData.periodo.semestre}</p>
            )}
          </div>
        </div>
      </div>

      <div className="horario-visual-container">
        <h2>Horario por franjas horarias</h2>
        <div className="horario-grid-wrapper">
          <div className="horario-grid tabla-franjas">
            <div className="fila-franja header">
              <div className="celda-franja-label">Franja</div>
              {diasCortos.map((dia, idx) => (
                <div key={dia} className="celda-franja-header">
                  {dia}
                </div>
              ))}
            </div>
            {FRANJAS.map((franja, index) => (
              <div key={franja.label} className="fila-franja">
                <div className="celda-franja-label">
                  <strong>{franja.label}</strong>
                </div>
                {diasSemana.map((dia) => renderSlot(dia, franja, index, matrix))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="asignaturas-resumen">
        <h2>Asignaturas Matriculadas ({horarioData.clases.length})</h2>
        <div className="asignaturas-grid">
          {horarioData.clases.map((clase, idx) => (
            <div key={`${clase.asignatura_id}-${idx}`} className="asignatura-card">
              <div className="asignatura-header">
                <span className="asignatura-codigo">{clase.asignatura_codigo}</span>
                <span className="asignatura-creditos">G{clase.grupo_codigo}</span>
              </div>
              <h3 className="asignatura-nombre">{clase.asignatura_nombre}</h3>
              <div className="asignatura-details">
                <div className="detail-item">
                  <FaUser size={14} />
                  <span>{clase.docente || "Docente no asignado"}</span>
                </div>
                <div className="detail-item">
                  <FaMapMarkerAlt size={14} />
                  <span>{clase.salon || "Salón pendiente"}</span>
                </div>
                <div className="detail-item">
                  <FaCalendarAlt size={14} />
                  <span>{clase.dia} · {clase.hora_inicio} - {clase.hora_fin}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConsultarMatricula;

