import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  const [resumen, setResumen] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [creditosSeleccionados, setCreditosSeleccionados] = useState(0);

  // Días de la semana
  const diasSemana = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
  
  const estadoLabels = {
    activa: "Activa",
    cursada: "Aprobada",
    pendiente_repeticion: "Pendiente repetición",
    obligatoria_repeticion: "Repetición obligatoria",
  };

  const formatEstado = (estado) => estadoLabels[estado] || estado || "Desconocido";

  const openDialog = (title, body, onClose) => {
    setDialog({ title, body, onClose });
  };

  const closeDialog = () => {
    if (!dialog) return;
    const callback = dialog.onClose;
    setDialog(null);
    if (callback) {
      callback();
    }
  };

  const getErrorReason = (error, fallback) => {
    let reason = fallback;
    if (error?.response?.data) {
      if (error.response.data.razon) {
        reason = error.response.data.razon;
      } else if (error.response.data.error) {
        reason = error.response.data.error;
      }
    } else if (error?.message) {
      reason = error.message;
    }
    return reason;
  };

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
        const razon = validacionData.razon || "No puedes inscribir asignaturas en este momento.";
        setValidacion({
          puedeInscribir: false,
          razon,
        });
        openDialog("Inscripción bloqueada", razon);
        setLoading(false);
        return;
      }

      // Si pasa las validaciones, cargar asignaturas disponibles
      setValidacion({ puedeInscribir: true });

      try {
        const asignaturasData = await matriculaService.getAsignaturasDisponibles();
        const payload = Array.isArray(asignaturasData)
          ? { asignaturas: asignaturasData }
          : asignaturasData || {};
        const nuevasAsignaturas = payload.asignaturas || [];
        setAsignaturas(nuevasAsignaturas);
        setMensajes(payload.mensajes || []);
        if (payload.periodo || payload.creditos || payload.estado_estudiante) {
          setResumen({
            periodo: payload.periodo,
            creditos: payload.creditos,
            estadoEstudiante: payload.estado_estudiante,
            obligatoriasSinGrupo: payload.obligatorias_sin_grupo || [],
          });
        }
      } catch (error) {
        const razonCarga = "No pudimos cargar la oferta de asignaturas en este momento.";
        openDialog("Oferta temporalmente indisponible", razonCarga);
        console.warn("Error cargando asignaturas:", error);
        setAsignaturas([]);
        setMensajes([]);
        setResumen(null);
      }
    } catch (error) {
      console.error("Error validando inscripción:", error);
      // Intentar extraer el mensaje de error del backend
      const razonError = getErrorReason(error, "Error al validar los requisitos de inscripción. Por favor, intenta más tarde.");
      setValidacion({
        puedeInscribir: false,
        razon: razonError,
      });
      openDialog("Inscripción bloqueada", razonError);
    } finally {
      setLoading(false);
    }
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
    if (asignatura.estado === "cursada") {
      return;
    }
    // Si es obligatoria por repetición, no permitir desmarcar
    if (asignatura.obligatoria_repeticion && gruposSeleccionados.has(grupoId)) {
      return;
    }

    const grupo = asignatura.grupos?.find((g) => g.id === grupoId);
    if (!grupo) return;

    const otroGrupoSeleccionado = asignatura.grupos?.some(
      (g) => g.id !== grupoId && gruposSeleccionados.has(g.id)
    );
    if (otroGrupoSeleccionado) {
      openDialog("Grupo duplicado", "Solo puedes inscribir un grupo por asignatura.");
      return;
    }

    // Verificar cupo
    if (grupo.cupo_disponible <= 0) {
      openDialog("Sin cupo", "Este grupo ya no tiene cupos disponibles en este momento.");
      return;
    }

    if (gruposSeleccionados.has(grupoId)) {
      // Desmarcar
      const nuevosSeleccionados = new Set(gruposSeleccionados);
      nuevosSeleccionados.delete(grupoId);
      setGruposSeleccionados(nuevosSeleccionados);
      actualizarHorario(nuevosSeleccionados);
      setCreditosSeleccionados((prev) => Math.max(prev - asignatura.creditos, 0));
    } else {
      // Verificar conflicto antes de marcar
      if (verificarConflicto(grupoId, grupo.horarios || [])) {
        setConflictos(new Set([...conflictos, grupoId]));
        openDialog("Conflicto de horario", "Este grupo tiene un choque con otra asignatura que ya seleccionaste.");
        return;
      }

      const creditosDisponibles = resumen?.creditos?.disponibles ?? 0;
      if (creditosSeleccionados + asignatura.creditos > creditosDisponibles) {
        openDialog(
          "Límite de créditos excedido",
          "Seleccionaste más créditos de los que permite tu semestre actual."
        );
        return;
      }

      // Marcar
      const nuevosSeleccionados = new Set([...gruposSeleccionados, grupoId]);
      setGruposSeleccionados(nuevosSeleccionados);
      actualizarHorario(nuevosSeleccionados);
      setConflictos(new Set([...conflictos].filter((id) => id !== grupoId)));
      setCreditosSeleccionados((prev) => prev + asignatura.creditos);
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
    const duracionMinutos = Math.max(finMin - inicioMin, 15);
    const offsetDentroHora = inicioMin % 60;
    
    return {
      duracionMinutos,
      offsetDentroHora,
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

  const bloqueoObligatorias = resumen?.obligatoriasSinGrupo?.length > 0;
  const creditosDisponiblesBackend = resumen?.creditos?.disponibles ?? 0;
  const creditosDisponiblesActual = Math.max(creditosDisponiblesBackend - creditosSeleccionados, 0);

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
        <div className="header-logo-title">
          <div className="udc-logo-container">
            <img 
              src="/logo-udc.png" 
              alt="Logo Universidad" 
              className="udc-logo"
            />
          </div>
          <div>
            <h1>Inscribir Asignaturas</h1>
            <p>Selecciona los grupos de las asignaturas que deseas matricular</p>
          </div>
        </div>
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
                            
                            const bloqueAltura = Math.max(pos.duracionMinutos - 4, 28);
                            const bloqueTop = 4 + Math.min(pos.offsetDentroHora, 52);
                            return (
                              <div
                                key={idx}
                                className="horario-block"
                                style={{
                                  backgroundColor: obtenerColorAsignatura(h.codigo),
                                  height: `${bloqueAltura}px`,
                                  top: `${bloqueTop}px`,
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
          {resumen && (
            <div className="inscribir-resumen">
              <div className="resumen-card">
                <div className="resumen-header">
                  <div>
                    <p className="resumen-label">Periodo activo</p>
                    <p className="resumen-value">
                      {resumen.periodo
                        ? `${resumen.periodo.year}-${resumen.periodo.semestre}`
                        : "Pendiente"}
                    </p>
                  </div>
                  {resumen.estadoEstudiante && (
                    <span className={`resumen-estado resumen-estado-${resumen.estadoEstudiante?.toLowerCase()}`}>
                      {resumen.estadoEstudiante}
                    </span>
                  )}
                </div>
                <div className="resumen-grid">
                  <div>
                    <span className="resumen-label">Créditos máximo</span>
                    <strong className="resumen-value">{resumen.creditos?.maximo ?? "-"}</strong>
                  </div>
                  <div>
                    <span className="resumen-label">Créditos inscritos</span>
                    <strong className="resumen-value">{resumen.creditos?.inscritos ?? 0}</strong>
                    {creditosSeleccionados > 0 && (
                      <span className="resumen-sub">+{creditosSeleccionados} en selección</span>
                    )}
                  </div>
                  <div>
                    <span className="resumen-label">Créditos disponibles</span>
                    <strong className="resumen-value">{creditosDisponiblesActual}</strong>
                    <span className="resumen-sub">
                      {creditosDisponiblesBackend} disponibles, {creditosSeleccionados} seleccionados
                    </span>
                  </div>
                </div>
                {resumen.obligatoriasSinGrupo?.length > 0 && (
                  <p className="resumen-warning">
                    💡 Debes matricular las asignaturas en repetición obligatoria ({resumen.obligatoriasSinGrupo
                      .map((a) => a.codigo)
                      .join(", ")}) antes de agregar otras materias.
                  </p>
                )}
              </div>
            </div>
          )}
          {resumen?.obligatoriasSinGrupo?.length > 0 && (
            <div className="inscribir-alert">
              <p>
                Mientras no se abra cupo para las asignaturas en repetición obligatoria, no puedes inscribir
                otras materias. Contacta a tu asesor académico si necesitas ayuda.
              </p>
            </div>
          )}
          {mensajes.length > 0 && (
            <div className="inscribir-feedback">
              {mensajes.map((mensaje, idx) => (
                <div key={idx} className="feedback-mensaje">
                  <h4>Actualización de matrícula</h4>
                  <p>{mensaje}</p>
                </div>
              ))}
            </div>
          )}
            <div className="asignaturas-list">
              {asignaturas.length === 0 ? (
                <div className="asignaturas-empty">
                  <p>No hay asignaturas disponibles para inscripción en este momento.</p>
                </div>
              ) : (
                asignaturas.map((asignatura) => {
                  const estadoClass = asignatura.estado ? `estado-${asignatura.estado}` : "";
                  const esCursada = asignatura.estado === "cursada";
                  return (
                    <div key={asignatura.id} className={`asignatura-item ${estadoClass}`}>
                      <div className="asignatura-header">
                        <div className="asignatura-info">
                          <h3>{asignatura.nombre}</h3>
                          <div className="asignatura-meta">
                            <span className="asignatura-codigo">{asignatura.codigo}</span>
                            <span className="asignatura-creditos">{asignatura.creditos} créditos</span>
                          </div>
                        </div>
                        <span className="asignatura-state">{formatEstado(asignatura.estado)}</span>
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
                                    disabled={esCursada || esObligatorio || sinCupo}
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
                  );
                })
              )}
            </div>

            {gruposSeleccionados.size > 0 && (
              <div className="inscribir-actions">
                <button
                  className="btn-inscribir"
                  disabled={bloqueoObligatorias}
                  title={
                    bloqueoObligatorias
                      ? "Debes matricular primero las asignaturas en repetición obligatoria"
                      : undefined
                  }
                  onClick={async () => {
                    try {
                      await matriculaService.inscribirAsignaturas(Array.from(gruposSeleccionados));
                      setGruposSeleccionados(new Set());
                      openDialog(
                        "Inscripción confirmada",
                        "Tus materias han quedado matriculadas. Verifica tu horario y revisa el resumen de créditos.",
                        () => navigate("/"),
                      );
                    } catch (error) {
                      const razon =
                        getErrorReason(error, "Error al realizar la inscripción. Por favor, intenta nuevamente.");
                      openDialog("No se pudo inscribir", razon);
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
      {dialog && (
        <div className="dialog-overlay" role="presentation">
          <div className="dialog-card">
            <p className="dialog-title">{dialog.title}</p>
            <p className="dialog-body">{dialog.body}</p>
            <button className="dialog-close" onClick={closeDialog}>
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InscribirAsignaturas;

