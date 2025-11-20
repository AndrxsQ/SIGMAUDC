import React, { useState, useEffect } from "react";
import { matriculaService } from "../../services/matricula";
import { FaCalendarAlt, FaClock, FaUser, FaMapMarkerAlt, FaBook } from "react-icons/fa";
import "../../styles/ConsultarMatricula.css";

const ConsultarMatricula = () => {
  const [loading, setLoading] = useState(true);
  const [horarioData, setHorarioData] = useState(null);
  const [error, setError] = useState(null);

  // Días de la semana
  const diasSemana = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
  const diasCortos = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  
  // Horas del día (7am - 10pm)
  const horas = Array.from({ length: 16 }, (_, i) => 7 + i);

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

  // Formatear hora (HH:MM -> H:MM AM/PM)
  const formatearHora = (hora) => {
    if (!hora) return "";
    const [h, m] = hora.split(':');
    const horas = parseInt(h);
    const minutos = m || "00";
    if (horas === 0) return `12:${minutos} AM`;
    if (horas < 12) return `${horas}:${minutos} AM`;
    if (horas === 12) return `12:${minutos} PM`;
    return `${horas - 12}:${minutos} PM`;
  };

  // Obtener posición y duración de un bloque de horario
  const obtenerPosicionHorario = (horaInicio, horaFin) => {
    const [hInicio, mInicio] = horaInicio.split(':').map(Number);
    const [hFin, mFin] = horaFin.split(':').map(Number);
    
    const inicioMinutos = hInicio * 60 + mInicio;
    const finMinutos = hFin * 60 + mFin;
    const duracion = finMinutos - inicioMinutos;
    
    // Posición desde las 7:00 AM (420 minutos)
    const posicion = inicioMinutos - 420;
    
    return {
      top: posicion,
      duracion: duracion / 60, // en horas
    };
  };

  // Obtener color para asignatura (basado en código)
  const obtenerColorAsignatura = (codigo) => {
    const colores = [
      "rgba(201, 162, 63, 0.15)", // Gold
      "rgba(60, 158, 228, 0.15)", // Blue
      "rgba(52, 199, 89, 0.15)",  // Green
      "rgba(255, 149, 0, 0.15)",  // Orange
      "rgba(175, 82, 222, 0.15)", // Purple
      "rgba(255, 59, 48, 0.15)",  // Red
      "rgba(0, 199, 190, 0.15)",  // Teal
      "rgba(255, 204, 0, 0.15)",  // Yellow
    ];
    const hash = codigo.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colores[hash % colores.length];
  };

  // Obtener borde color para asignatura
  const obtenerBordeColor = (codigo) => {
    const colores = [
      "#C9A23F", // Gold
      "#3C9EE4", // Blue
      "#34C759", // Green
      "#FF9500", // Orange
      "#AF52DE", // Purple
      "#FF3B30", // Red
      "#00C7BE", // Teal
      "#FFCC00", // Yellow
    ];
    const hash = codigo.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colores[hash % colores.length];
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
        <div className="error-container">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!horarioData || !horarioData.asignaturas || horarioData.asignaturas.length === 0) {
    return (
      <div className="consultar-matricula-container">
        <div className="horario-header">
          <div className="header-content">
            <div className="udc-logo-container">
              <img 
                src="/logo-udc.png" 
                alt="Logo Universidad" 
                className="udc-logo"
              />
            </div>
            <div className="header-info">
              <h1>Consultar Matrícula</h1>
              {horarioData?.periodo?.id ? (
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

  return (
    <div className="consultar-matricula-container">
      {/* Header */}
      <div className="horario-header">
        <div className="header-content">
          <div className="udc-logo-container">
            <img 
              src="/logo-udc.png" 
              alt="Logo Universidad" 
              className="udc-logo"
            />
          </div>
          <div className="header-info">
            <h1>Consultar Matrícula</h1>
            {horarioData.periodo && (
              <p>Periodo {horarioData.periodo.year}-{horarioData.periodo.semestre}</p>
            )}
          </div>
        </div>
      </div>

      {/* Horario Visual */}
      <div className="horario-visual-container">
        <h2>Horario Semanal</h2>
        <div className="horario-grid-wrapper">
          <div className="horario-grid">
            {/* Header con días */}
            <div className="horario-header-row">
              <div className="horario-time-col-header">Hora</div>
              {diasSemana.map((dia, idx) => (
                <div key={dia} className="horario-day-col-header">
                  {diasCortos[idx]}
                </div>
              ))}
            </div>

            {/* Cuerpo del horario */}
            <div className="horario-body">
              {horas.map((hora) => (
                <div key={hora} className="horario-row">
                  <div className="horario-time-cell">
                    {hora}:00
                  </div>
                  {diasSemana.map((dia) => {
                    // Buscar asignaturas que ocupen esta hora en este día
                    const asignaturasEnHora = horarioData.asignaturas.filter((asig) =>
                      asig.horarios.some((hor) => {
                        const horaInicio = parseInt(hor.hora_inicio.split(':')[0]);
                        const horaFin = parseInt(hor.hora_fin.split(':')[0]);
                        return hor.dia === dia && horaInicio <= hora && horaFin > hora;
                      })
                    );

                    // Solo mostrar el bloque en la hora de inicio
                    const bloqueInicio = asignaturasEnHora.find((asig) => {
                      const hor = asig.horarios.find((h) => h.dia === dia);
                      if (!hor) return false;
                      const horaInicio = parseInt(hor.hora_inicio.split(':')[0]);
                      return horaInicio === hora;
                    });

                    if (bloqueInicio) {
                      const horarioDia = bloqueInicio.horarios.find((h) => h.dia === dia);
                      const pos = obtenerPosicionHorario(horarioDia.hora_inicio, horarioDia.hora_fin);
                      
                      return (
                        <div key={dia} className="horario-cell">
                          <div
                            className="horario-block"
                            style={{
                              backgroundColor: obtenerColorAsignatura(bloqueInicio.asignatura_codigo),
                              borderLeft: `3px solid ${obtenerBordeColor(bloqueInicio.asignatura_codigo)}`,
                              height: `${pos.duracion * 60}px`,
                              minHeight: `${pos.duracion * 60}px`,
                            }}
                          >
                            <div className="horario-block-content">
                              <div className="horario-block-title">
                                {bloqueInicio.asignatura_codigo}
                              </div>
                              <div className="horario-block-subtitle">
                                {bloqueInicio.asignatura_nombre.length > 25
                                  ? bloqueInicio.asignatura_nombre.substring(0, 25) + "..."
                                  : bloqueInicio.asignatura_nombre}
                              </div>
                              <div className="horario-block-details">
                                <div className="horario-block-group">
                                  <FaUser size={10} />
                                  <span>G{bloqueInicio.grupo_codigo}</span>
                                </div>
                                {bloqueInicio.docente && bloqueInicio.docente.trim() !== "" && (
                                  <div className="horario-block-profesor">
                                    <FaUser size={10} />
                                    <span>{bloqueInicio.docente.length > 20
                                      ? bloqueInicio.docente.substring(0, 20) + "..."
                                      : bloqueInicio.docente}</span>
                                  </div>
                                )}
                                {horarioDia.salon && (
                                  <div className="horario-block-salon">
                                    <FaMapMarkerAlt size={10} />
                                    <span>{horarioDia.salon}</span>
                                  </div>
                                )}
                              </div>
                              <div className="horario-block-time">
                                {formatearHora(horarioDia.hora_inicio)} - {formatearHora(horarioDia.hora_fin)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return <div key={dia} className="horario-cell"></div>;
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Resumen de asignaturas */}
      <div className="asignaturas-resumen">
        <h2>Asignaturas Matriculadas ({horarioData.asignaturas.length})</h2>
        <div className="asignaturas-grid">
          {horarioData.asignaturas.map((asignatura) => (
            <div key={asignatura.asignatura_id} className="asignatura-card">
              <div className="asignatura-header">
                <span className="asignatura-codigo">{asignatura.asignatura_codigo}</span>
                <span className="asignatura-creditos">{asignatura.creditos} créditos</span>
              </div>
              <h3 className="asignatura-nombre">{asignatura.asignatura_nombre}</h3>
              <div className="asignatura-details">
                <div className="detail-item">
                  <FaUser size={14} />
                  <span>Grupo {asignatura.grupo_codigo}</span>
                </div>
                {asignatura.docente && asignatura.docente.trim() !== "" && (
                  <div className="detail-item">
                    <FaUser size={14} />
                    <span>{asignatura.docente}</span>
                  </div>
                )}
                <div className="detail-item">
                  <FaClock size={14} />
                  <span>
                    {asignatura.horarios.map((h, idx) => (
                      <span key={idx}>
                        {h.dia.substring(0, 3)} {formatearHora(h.hora_inicio)}-{formatearHora(h.hora_fin)}
                        {idx < asignatura.horarios.length - 1 && ", "}
                      </span>
                    ))}
                  </span>
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

