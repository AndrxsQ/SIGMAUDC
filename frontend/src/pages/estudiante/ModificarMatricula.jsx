import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { matriculaService } from "../../services/matricula";
import "../../styles/InscribirAsignaturas.css";

const ModificarMatricula = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [validacion, setValidacion] = useState(null);
  const [materiasMatriculadas, setMateriasMatriculadas] = useState([]);
  const [asignaturas, setAsignaturas] = useState([]);
  const [gruposSeleccionados, setGruposSeleccionados] = useState(new Set());
  const [horario, setHorario] = useState([]);
  const [conflictos, setConflictos] = useState(new Set());
  const [resumen, setResumen] = useState(null);
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
      } else if (typeof error.response.data === 'string') {
        reason = error.response.data;
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
      
      // Validar modificaciones usando el endpoint del backend
      const validacionData = await matriculaService.validarModificaciones();
      
      if (!validacionData.puede_modificar) {
        const razon = validacionData.razon || "No puedes realizar modificaciones en este momento.";
        setValidacion({
          puedeModificar: false,
          razon,
        });
        openDialog("Modificaciones bloqueadas", razon);
        setLoading(false);
        return;
      }

      // Si pasa las validaciones, cargar datos
      setValidacion({ puedeModificar: true });

      try {
        const datos = await matriculaService.getModificacionesData();
        
        // Verificar si hay un error en la respuesta
        if (datos.error) {
          setValidacion({
            puedeModificar: false,
            razon: datos.error,
          });
          openDialog("Modificaciones no disponibles", datos.error);
          setLoading(false);
          return;
        }
        
        setMateriasMatriculadas(datos.materias_matriculadas || []);
        setAsignaturas(datos.asignaturas_disponibles || []);
        setResumen({
          periodo: datos.periodo,
          creditos: datos.creditos,
          estadoEstudiante: datos.estado_estudiante,
        });
        
        // Actualizar horario con materias matriculadas
        actualizarHorarioDesdeMatriculadas(datos.materias_matriculadas || []);
      } catch (error) {
        const razonCarga = getErrorReason(error, "No pudimos cargar los datos de modificaciones en este momento.");
        
        // Si el error indica que no hay periodo activo o no tiene materias, mostrar error específico
        if (error?.response?.data?.error) {
          setValidacion({
            puedeModificar: false,
            razon: error.response.data.error,
          });
          openDialog("Modificaciones no disponibles", error.response.data.error);
        } else {
          openDialog("Error al cargar", razonCarga);
          console.warn("Error cargando datos:", error);
          setMateriasMatriculadas([]);
          setAsignaturas([]);
          setResumen(null);
        }
      }
    } catch (error) {
      console.error("Error validando modificaciones:", error);
      const razonError = getErrorReason(error, "Error al validar los requisitos de modificaciones. Por favor, intenta más tarde.");
      setValidacion({
        puedeModificar: false,
        razon: razonError,
      });
      openDialog("Modificaciones bloqueadas", razonError);
    } finally {
      setLoading(false);
    }
  };

  const actualizarHorarioDesdeMatriculadas = (materias) => {
    const nuevoHorario = materias.map((mat) => ({
      grupoId: mat.grupo_id,
      asignatura: mat.nombre,
      codigo: mat.codigo,
      grupoCodigo: mat.grupo_codigo,
      docente: mat.docente,
      horarios: mat.horarios || [],
    }));
    setHorario(nuevoHorario);
  };

  const verificarConflicto = (grupoId, horariosGrupo) => {
    // Verificar contra materias ya matriculadas
    for (const mat of materiasMatriculadas) {
      if (!mat.horarios) continue;
      for (const horarioMat of mat.horarios) {
        for (const horarioNuevo of horariosGrupo) {
          if (
            horarioMat.dia === horarioNuevo.dia &&
            haySolapamiento(horarioMat.hora_inicio, horarioMat.hora_fin, horarioNuevo.hora_inicio, horarioNuevo.hora_fin)
          ) {
            return true;
          }
        }
      }
    }

    // Verificar contra grupos seleccionados
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
    const grupo = asignatura.grupos?.find((g) => g.id === grupoId);
    if (!grupo) return;

    const otroGrupoSeleccionado = asignatura.grupos?.find(
      (g) => g.id !== grupoId && gruposSeleccionados.has(g.id)
    );
    if (otroGrupoSeleccionado && !gruposSeleccionados.has(grupoId)) {
      openDialog(
        "Grupo duplicado",
        "Solo puedes seleccionar un grupo por asignatura. Deselecciona el grupo actual antes de elegir otro."
      );
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
        openDialog("Conflicto de horario", "Este grupo tiene un choque con otra asignatura que ya tienes matriculada o seleccionada.");
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
    const nuevoHorario = [...horario];
    
    // Agregar grupos seleccionados al horario
    for (const grupoId of gruposIds) {
      const grupo = encontrarGrupoPorId(grupoId);
      if (grupo && grupo.horarios) {
        const asignatura = asignaturas.find((a) =>
          a.grupos?.some((g) => g.id === grupoId)
        );
        const existe = nuevoHorario.some((h) => h.grupoId === grupoId);
        if (!existe) {
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
    }
    
    // Remover grupos deseleccionados (pero mantener los matriculados)
    const gruposMatriculados = materiasMatriculadas.map((m) => m.grupo_id);
    const nuevoHorarioFiltrado = nuevoHorario.filter(
      (h) => gruposMatriculados.includes(h.grupoId) || gruposIds.has(h.grupoId)
    );
    
    setHorario(nuevoHorarioFiltrado);
  };

  const handleRetirar = async (historialId) => {
    if (!window.confirm("¿Estás seguro de que deseas retirar esta materia?")) {
      return;
    }

    try {
      await matriculaService.retirarMateria(historialId);
      openDialog("Materia retirada", "La materia ha sido retirada correctamente.", () => {
        validarYcargar(); // Recargar datos
      });
    } catch (error) {
      const razon = getErrorReason(error, "Error al retirar la materia. Por favor, intenta nuevamente.");
      openDialog("Error al retirar", razon);
    }
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
    const hash = codigo.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80',
    ];
    return colors[hash % colors.length];
  };

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
        <p>Validando requisitos de modificaciones...</p>
      </div>
    );
  }

  if (!validacion?.puedeModificar) {
    return (
      <div className="inscribir-bloqueo">
        <div className="bloqueo-card">
          <div className="bloqueo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h2>Modificaciones no disponibles</h2>
          <p>{validacion?.razon || "No puedes realizar modificaciones en este momento."}</p>
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
            <h1>Modificaciones Estudiantiles</h1>
            <p>Gestiona tus materias: retira o agrega asignaturas</p>
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

        {/* Columna Derecha: Materias Matriculadas y Disponibles */}
        <div className="asignaturas-column">
          <div className="asignaturas-card">
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
                    </div>
                  </div>
                </div>
              </div>
            )}

            <h2>Materias Matriculadas</h2>
            <div className="asignaturas-list">
              {materiasMatriculadas.length === 0 ? (
                <div className="asignaturas-empty">
                  <p>No tienes materias matriculadas en este periodo.</p>
                </div>
              ) : (
                materiasMatriculadas.map((materia) => (
                  <div key={materia.historial_id} className="asignatura-item">
                    <div className="asignatura-header">
                      <div className="asignatura-info">
                        <h3>{materia.nombre}</h3>
                        <div className="asignatura-meta">
                          <span className="asignatura-codigo">{materia.codigo}</span>
                          <span className="asignatura-creditos">{materia.creditos} créditos</span>
                        </div>
                      </div>
                    </div>
                    <div className="grupos-list">
                      <div className="grupo-item seleccionado">
                        <div className="grupo-content">
                          <div className="grupo-header">
                            <span className="grupo-codigo">{materia.grupo_codigo}</span>
                            <span className="grupo-docente">{materia.docente}</span>
                          </div>
                          <div className="grupo-horario">
                            {materia.horarios?.map((hor, idx) => (
                              <span key={idx} className="horario-badge">
                                {hor.dia.substring(0, 3)} {formatearHora(hor.hora_inicio)}-{formatearHora(hor.hora_fin)} {hor.salon}
                              </span>
                            ))}
                          </div>
                          {!materia.puede_retirar && (
                            <div className="grupo-obligatorio-text">
                              No se puede retirar (materia atrasada o perdida)
                            </div>
                          )}
                          {materia.puede_retirar && (
                            <button
                              className="btn-retirar"
                              onClick={() => handleRetirar(materia.historial_id)}
                            >
                              Retirar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <h2 style={{ marginTop: '2rem' }}>Asignaturas Disponibles</h2>
            <div className="asignaturas-list">
              {asignaturas.length === 0 ? (
                <div className="asignaturas-empty">
                  <p>No hay asignaturas disponibles para agregar en este momento.</p>
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
                            {asignatura.categoria === 'nucleo_comun' && (
                              <>
                                <span className="asignatura-badge-obligatoria" style={{ backgroundColor: '#4ECDC4' }}>
                                  Núcleo Común
                                </span>
                                {asignatura.programas_disponibles && asignatura.programas_disponibles.length > 0 && (
                                  <div className="programas-disponibles" style={{ marginTop: '8px', fontSize: '0.9em', color: '#666' }}>
                                    <strong>Carreras disponibles:</strong> {asignatura.programas_disponibles.map(p => p.nombre).join(', ')}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <span className="asignatura-state">{formatEstado(asignatura.estado)}</span>
                      </div>

                      {asignatura.grupos && asignatura.grupos.length > 0 ? (
                        <div className="grupos-list">
                          {asignatura.grupos.map((grupo) => {
                            const estaSeleccionado = gruposSeleccionados.has(grupo.id);
                            const tieneConflicto = conflictos.has(grupo.id);
                            const sinCupo = grupo.cupo_disponible <= 0;

                            return (
                              <div
                                key={grupo.id}
                                className={`grupo-item ${estaSeleccionado ? "seleccionado" : ""} ${tieneConflicto ? "conflicto" : ""} ${sinCupo ? "sin-cupo" : ""}`}
                              >
                                <label className="grupo-checkbox-label">
                                  <input
                                    type="checkbox"
                                    checked={estaSeleccionado}
                                    disabled={esCursada || sinCupo}
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
                                    {grupo.programa_nombre && (
                                      <div className="grupo-programa" style={{ fontSize: '0.85em', color: '#4ECDC4', fontWeight: 'bold', marginBottom: '4px' }}>
                                        📚 {grupo.programa_nombre}
                                      </div>
                                    )}
                                    <div className="grupo-docente">{grupo.docente}</div>
                                    <div className="grupo-horario">
                                      {grupo.horarios?.map((hor, idx) => (
                                        <span key={idx} className="horario-badge">
                                          {hor.dia.substring(0, 3)} {formatearHora(hor.hora_inicio)}-{formatearHora(hor.hora_fin)} {hor.salon}
                                        </span>
                                      ))}
                                    </div>
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
                  onClick={async () => {
                    try {
                      await matriculaService.agregarMateriaModificaciones(Array.from(gruposSeleccionados));
                      setGruposSeleccionados(new Set());
                      setCreditosSeleccionados(0);
                      openDialog(
                        "Materia agregada",
                        "La(s) materia(s) han sido agregadas correctamente.",
                        () => validarYcargar(),
                      );
                    } catch (error) {
                      const razon = getErrorReason(error, "Error al agregar la materia. Por favor, intenta nuevamente.");
                      openDialog("No se pudo agregar", razon);
                    }
                  }}
                >
                  Agregar {gruposSeleccionados.size} {gruposSeleccionados.size === 1 ? "grupo" : "grupos"}
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

export default ModificarMatricula;

