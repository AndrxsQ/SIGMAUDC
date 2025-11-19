import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { plazosService } from "../../services/plazos";
import documentosService from "../../services/documentos";
import { matriculaService } from "../../services/matricula";
import "../../styles/InscribirAsignaturas.css";

const InscribirAsignaturas = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [validacion, setValidacion] = useState(null);
  const [asignaturas, setAsignaturas] = useState([]);
  const [gruposSeleccionados, setGruposSeleccionados] = useState(new Set());
  const [horario, setHorario] = useState([]);
  const [conflictos, setConflictos] = useState(new Set());

  // Días de la semana
  const diasSemana = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
  
  // Horas del día (7am - 10pm)
  const horas = Array.from({ length: 16 }, (_, i) => 7 + i);

  useEffect(() => {
    validarYcargar();
  }, []);

  const validarYcargar = async () => {
    try {
      setLoading(true);
      
      // Validar inscripción usando el endpoint del backend
      const validacionData = await matriculaService.validarInscripcion();
      
      if (!validacionData.puede_inscribir) {
        setValidacion({
          puedeInscribir: false,
          razon: validacionData.razon || "No puedes inscribir asignaturas en este momento.",
        });
        setLoading(false);
        return;
      }

      // Si pasa las validaciones, cargar asignaturas disponibles
      setValidacion({ puedeInscribir: true });
      
      // Cargar asignaturas disponibles (mock por ahora si no existe el endpoint)
      try {
        const asignaturasData = await matriculaService.getAsignaturasDisponibles();
        setAsignaturas(asignaturasData || generarDatosMock());
      } catch (error) {
        console.warn("Endpoint no disponible, usando datos mock:", error);
        setAsignaturas(generarDatosMock());
      }
    } catch (error) {
      console.error("Error validando inscripción:", error);
      // Intentar extraer el mensaje de error del backend
      let razonError = "Error al validar los requisitos de inscripción. Por favor, intenta más tarde.";
      if (error.response?.data) {
        if (error.response.data.razon) {
          razonError = error.response.data.razon;
        } else if (error.response.data.error) {
          razonError = error.response.data.error;
        }
      } else if (error.message) {
        razonError = error.message;
      }
      setValidacion({
        puedeInscribir: false,
        razon: razonError,
      });
    } finally {
      setLoading(false);
    }
  };

  // Función para generar datos mock (solo para prototipo)
  const generarDatosMock = () => {
    return [
      {
        id: 1,
        codigo: "MAT101",
        nombre: "Cálculo I",
        creditos: 4,
        estado: "activa",
        obligatoria_repeticion: false,
        grupos: [
          {
            id: 1,
            codigo: "G01",
            docente: "Dr. Juan Pérez",
            cupo_disponible: 25,
            cupo_max: 30,
            horarios: [
              { dia: "LUNES", hora_inicio: "08:00", hora_fin: "10:00", salon: "A-101" },
              { dia: "MIERCOLES", hora_inicio: "08:00", hora_fin: "10:00", salon: "A-101" },
            ],
          },
          {
            id: 2,
            codigo: "G02",
            docente: "Dra. María García",
            cupo_disponible: 15,
            cupo_max: 30,
            horarios: [
              { dia: "MARTES", hora_inicio: "14:00", hora_fin: "16:00", salon: "B-205" },
              { dia: "JUEVES", hora_inicio: "14:00", hora_fin: "16:00", salon: "B-205" },
            ],
          },
        ],
      },
      {
        id: 2,
        codigo: "FIS101",
        nombre: "Física I",
        creditos: 3,
        estado: "activa",
        obligatoria_repeticion: false,
        grupos: [
          {
            id: 3,
            codigo: "G01",
            docente: "Dr. Carlos López",
            cupo_disponible: 20,
            cupo_max: 25,
            horarios: [
              { dia: "LUNES", hora_inicio: "10:00", hora_fin: "12:00", salon: "C-301" },
              { dia: "MIERCOLES", hora_inicio: "10:00", hora_fin: "12:00", salon: "C-301" },
            ],
          },
        ],
      },
      {
        id: 3,
        codigo: "PROG101",
        nombre: "Programación I",
        creditos: 4,
        estado: "obligatoria_repeticion",
        obligatoria_repeticion: true,
        grupos: [
          {
            id: 4,
            codigo: "G01",
            docente: "Ing. Ana Martínez",
            cupo_disponible: 10,
            cupo_max: 30,
            horarios: [
              { dia: "MARTES", hora_inicio: "08:00", hora_fin: "10:00", salon: "LAB-1" },
              { dia: "JUEVES", hora_inicio: "08:00", hora_fin: "10:00", salon: "LAB-1" },
            ],
          },
        ],
      },
    ];
  };

  const verificarConflicto = (grupoId, horariosGrupo) => {
    for (const grupoSelId of gruposSeleccionados) {
      const grupoSel = encontrarGrupoPorId(grupoSelId);
      if (!grupoSel) continue;

      for (const horarioSel of grupoSel.horarios || []) {
        for (const horarioNuevo of horariosGrupo) {
          if (
            horarioSel.dia === horarioNuevo.dia &&
            haySolapamiento(horarioSel.hora_inicio, horarioSel.hora_fin, horarioNuevo.hora_inicio, horarioNuevo.hora_fin)
          ) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const encontrarGrupoPorId = (grupoId) => {
    for (const asignatura of asignaturas) {
      const grupo = asignatura.grupos?.find((g) => g.id === grupoId);
      if (grupo) return grupo;
    }
    return null;
  };

  const haySolapamiento = (inicio1, fin1, inicio2, fin2) => {
    const [h1, m1] = inicio1.split(':').map(Number);
    const [h2, m2] = fin1.split(':').map(Number);
    const [h3, m3] = inicio2.split(':').map(Number);
    const [h4, m4] = fin2.split(':').map(Number);
    
    const inicio1Min = h1 * 60 + m1;
    const fin1Min = h2 * 60 + m2;
    const inicio2Min = h3 * 60 + m3;
    const fin2Min = h4 * 60 + m4;
    
    return !(fin1Min <= inicio2Min || fin2Min <= inicio1Min);
  };

  const toggleGrupo = (grupoId, asignatura) => {
    // Si es obligatoria por repetición, no permitir desmarcar
    if (asignatura.obligatoria_repeticion && gruposSeleccionados.has(grupoId)) {
      return;
    }

    const grupo = asignatura.grupos?.find((g) => g.id === grupoId);
    if (!grupo) return;

    // Verificar cupo
    if (grupo.cupo_disponible <= 0) {
      alert("Este grupo no tiene cupo disponible.");
      return;
    }

    if (gruposSeleccionados.has(grupoId)) {
      // Desmarcar
      const nuevosSeleccionados = new Set(gruposSeleccionados);
      nuevosSeleccionados.delete(grupoId);
      setGruposSeleccionados(nuevosSeleccionados);
      actualizarHorario(nuevosSeleccionados);
    } else {
      // Verificar conflicto antes de marcar
      if (verificarConflicto(grupoId, grupo.horarios || [])) {
        setConflictos(new Set([...conflictos, grupoId]));
        alert("Este grupo tiene conflicto de horario con otra asignatura seleccionada.");
        return;
      }

      // Marcar
      const nuevosSeleccionados = new Set([...gruposSeleccionados, grupoId]);
      setGruposSeleccionados(nuevosSeleccionados);
      actualizarHorario(nuevosSeleccionados);
      setConflictos(new Set([...conflictos].filter((id) => id !== grupoId)));
    }
  };

  const actualizarHorario = (gruposIds) => {
    const nuevoHorario = [];
    for (const grupoId of gruposIds) {
      const grupo = encontrarGrupoPorId(grupoId);
      if (grupo && grupo.horarios) {
        const asignatura = asignaturas.find((a) =>
          a.grupos?.some((g) => g.id === grupoId)
        );
        nuevoHorario.push({
          grupoId,
          asignatura: asignatura?.nombre || "Sin nombre",
          codigo: asignatura?.codigo || "",
          grupoCodigo: grupo.codigo,
          docente: grupo.docente,
          horarios: grupo.horarios,
        });
      }
    }
    setHorario(nuevoHorario);
  };

  const formatearHora = (hora) => {
    const [h, m] = hora.split(':');
    return `${h}:${m}`;
  };

  const obtenerPosicionHorario = (horaInicio, horaFin) => {
    const [hInicio, mInicio] = horaInicio.split(':').map(Number);
    const [hFin, mFin] = horaFin.split(':').map(Number);
    
    const inicioMin = hInicio * 60 + mInicio;
    const finMin = hFin * 60 + mFin;
    
    const inicioHora = Math.floor(inicioMin / 60);
    const finHora = Math.ceil(finMin / 60);
    
    return {
      inicio: inicioHora - 7,
      duracion: finHora - inicioHora,
    };
  };

  const obtenerColorAsignatura = (codigo) => {
    // Generar color basado en el código
    const hash = codigo.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80',
    ];
    return colors[hash % colors.length];
  };

  if (loading) {
    return (
      <div className="inscribir-loading">
        <div className="loading-spinner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="32">
              <animate attributeName="stroke-dasharray" dur="2s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite" />
              <animate attributeName="stroke-dashoffset" dur="2s" values="0;-16;-32;-32" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>
        <p>Validando requisitos de inscripción...</p>
      </div>
    );
  }

  if (!validacion?.puedeInscribir) {
    return (
      <div className="inscribir-bloqueo">
        <div className="bloqueo-card">
          <div className="bloqueo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h2>Inscripción no disponible</h2>
          <p>{validacion?.razon || "No puedes inscribir asignaturas en este momento."}</p>
          <button onClick={() => navigate("/")} className="btn-volver">
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="inscribir-container">
      <div className="inscribir-header">
        <h1>Inscribir Asignaturas</h1>
        <p>Selecciona los grupos de las asignaturas que deseas matricular</p>
      </div>

      <div className="inscribir-content">
        {/* Columna Izquierda: Vista del Horario */}
        <div className="horario-column">
          <div className="horario-card">
            <h2>Tu Horario</h2>
            <div className="horario-grid">
              <div className="horario-header">
                <div className="horario-time-col">Hora</div>
                {diasSemana.map((dia) => (
                  <div key={dia} className="horario-day-col">
                    {dia.substring(0, 3)}
                  </div>
                ))}
              </div>
              <div className="horario-body">
                {horas.map((hora) => (
                  <div key={hora} className="horario-row">
                    <div className="horario-time-cell">
                      {hora}:00
                    </div>
                    {diasSemana.map((dia) => (
                      <div key={`${hora}-${dia}`} className="horario-cell">
                        {horario
                          .filter((h) =>
                            h.horarios.some(
                              (hor) =>
                                hor.dia === dia &&
                                parseInt(hor.hora_inicio.split(':')[0]) <= hora &&
                                parseInt(hor.hora_fin.split(':')[0]) > hora
                            )
                          )
                          .map((h, idx) => {
                            const horarioDia = h.horarios.find((hor) => hor.dia === dia);
                            if (!horarioDia) return null;
                            const pos = obtenerPosicionHorario(horarioDia.hora_inicio, horarioDia.hora_fin);
                            if (parseInt(horarioDia.hora_inicio.split(':')[0]) !== hora) return null;
                            
                            return (
                              <div
                                key={idx}
                                className="horario-block"
                                style={{
                                  backgroundColor: obtenerColorAsignatura(h.codigo),
                                  height: `${pos.duracion * 60}px`,
                                }}
                                title={`${h.asignatura} - ${h.grupoCodigo}\n${h.docente}\n${horarioDia.salon}\n${formatearHora(horarioDia.hora_inicio)} - ${formatearHora(horarioDia.hora_fin)}`}
                              >
                                <div className="horario-block-content">
                                  <div className="horario-block-title">{h.asignatura}</div>
                                  <div className="horario-block-subtitle">{h.grupoCodigo} - {horarioDia.salon}</div>
                                  <div className="horario-block-time">
                                    {formatearHora(horarioDia.hora_inicio)} - {formatearHora(horarioDia.hora_fin)}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Checklist de Asignaturas */}
        <div className="asignaturas-column">
          <div className="asignaturas-card">
            <h2>Asignaturas Disponibles</h2>
            <div className="asignaturas-list">
              {asignaturas.length === 0 ? (
                <div className="asignaturas-empty">
                  <p>No hay asignaturas disponibles para inscripción en este momento.</p>
                </div>
              ) : (
                asignaturas.map((asignatura) => (
                  <div key={asignatura.id} className="asignatura-item">
                    <div className="asignatura-header">
                      <div className="asignatura-info">
                        <h3>{asignatura.nombre}</h3>
                        <div className="asignatura-meta">
                          <span className="asignatura-codigo">{asignatura.codigo}</span>
                          <span className="asignatura-creditos">{asignatura.creditos} créditos</span>
                        </div>
                      </div>
                      {asignatura.obligatoria_repeticion && (
                        <div className="asignatura-badge-obligatoria">
                          🔒 Repetición obligatoria
                        </div>
                      )}
                    </div>

                    {asignatura.grupos && asignatura.grupos.length > 0 ? (
                      <div className="grupos-list">
                        {asignatura.grupos.map((grupo) => {
                          const estaSeleccionado = gruposSeleccionados.has(grupo.id);
                          const tieneConflicto = conflictos.has(grupo.id);
                          const sinCupo = grupo.cupo_disponible <= 0;
                          const esObligatorio = asignatura.obligatoria_repeticion;

                          return (
                            <div
                              key={grupo.id}
                              className={`grupo-item ${estaSeleccionado ? "seleccionado" : ""} ${tieneConflicto ? "conflicto" : ""} ${sinCupo ? "sin-cupo" : ""} ${esObligatorio ? "obligatorio" : ""}`}
                            >
                              <label className="grupo-checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={estaSeleccionado}
                                  disabled={esObligatorio || sinCupo}
                                  onChange={() => toggleGrupo(grupo.id, asignatura)}
                                  className="grupo-checkbox"
                                />
                                <div className="grupo-content">
                                  <div className="grupo-header">
                                    <span className="grupo-codigo">{grupo.codigo}</span>
                                    <span className="grupo-cupo">
                                      {grupo.cupo_disponible}/{grupo.cupo_max} cupos
                                    </span>
                                  </div>
                                  <div className="grupo-docente">{grupo.docente}</div>
                                  <div className="grupo-horario">
                                    {grupo.horarios?.map((hor, idx) => (
                                      <span key={idx} className="horario-badge">
                                        {hor.dia.substring(0, 3)} {formatearHora(hor.hora_inicio)}-{formatearHora(hor.hora_fin)} {hor.salon}
                                      </span>
                                    ))}
                                  </div>
                                  {esObligatorio && estaSeleccionado && (
                                    <div className="grupo-obligatorio-text">
                                      Repetición obligatoria – debe matricularse en este periodo
                                    </div>
                                  )}
                                  {sinCupo && (
                                    <div className="grupo-sin-cupo-text">
                                      Sin cupo disponible
                                    </div>
                                  )}
                                  {tieneConflicto && (
                                    <div className="grupo-conflicto-text">
                                      Conflicto de horario
                                    </div>
                                  )}
                                </div>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="grupos-empty">
                        <p>No hay grupos disponibles para esta asignatura.</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {gruposSeleccionados.size > 0 && (
              <div className="inscribir-actions">
                <button
                  className="btn-inscribir"
                  onClick={async () => {
                    try {
                      await matriculaService.inscribirAsignaturas(Array.from(gruposSeleccionados));
                      alert("Inscripción realizada exitosamente.");
                      navigate("/");
                    } catch (error) {
                      alert("Error al realizar la inscripción. Por favor, intenta nuevamente.");
                    }
                  }}
                >
                  Inscribir {gruposSeleccionados.size} {gruposSeleccionados.size === 1 ? "grupo" : "grupos"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InscribirAsignaturas;

