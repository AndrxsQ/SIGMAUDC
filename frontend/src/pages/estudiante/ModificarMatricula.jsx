import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { matriculaService } from "../../services/matricula";
import "../../styles/InscribirAsignaturas.css";
import { FaCheckCircle, FaTimesCircle, FaSpinner, FaClock, FaExclamationTriangle } from "react-icons/fa";

const ModificarMatricula = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [validacion, setValidacion] = useState(null);
  const [materiasMatriculadas, setMateriasMatriculadas] = useState([]);
  const [asignaturas, setAsignaturas] = useState([]);
  const [gruposSeleccionados, setGruposSeleccionados] = useState(new Set());
  const [gruposARetirar, setGruposARetirar] = useState(new Set()); // Nuevo: grupos a retirar en la solicitud
  const [horario, setHorario] = useState([]);
  const [conflictos, setConflictos] = useState(new Set());
  const [resumen, setResumen] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [creditosSeleccionados, setCreditosSeleccionados] = useState(0);
  
  // Estado para solicitudes
  const [solicitudPendiente, setSolicitudPendiente] = useState(null);
  const [historialSolicitudes, setHistorialSolicitudes] = useState([]);
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);

  // Mostrar/ocultar horario y ocultar horas vacías
  const [showHorario, setShowHorario] = useState(true);
  const [hideEmptyHours, setHideEmptyHours] = useState(false);

  // Días de la semana (incluye domingo para coherencia)
  const diasSemana = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
  
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
        setLoading(false);
        return;
      }

      // Si pasa las validaciones, cargar datos
      setValidacion({ puedeModificar: true });

      try {
        const datos = await matriculaService.getModificacionesData();
        
        if (datos.error) {
          setValidacion({
            puedeModificar: false,
            razon: datos.error,
          });
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
        
        actualizarHorarioDesdeMatriculadas(datos.materias_matriculadas || []);

        // Cargar solicitudes del estudiante
        await cargarSolicitudes();

      } catch (error) {
        const razonCarga = getErrorReason(error, "No pudimos cargar los datos de modificaciones en este momento.");
        if (error?.response?.data?.error) {
          setValidacion({
            puedeModificar: false,
            razon: error.response.data.error,
          });
        } else {
          openDialog("Error al cargar", razonCarga);
          setMateriasMatriculadas([]);
          setAsignaturas([]);
          setResumen(null);
        }
      }
    } catch (error) {
      console.error("Error validando modificaciones:", error);
      const razonError = getErrorReason(error, "Error al validar los requisitos de modificaciones.");
      setValidacion({
        puedeModificar: false,
        razon: razonError,
      });
    } finally {
      setLoading(false);
    }
  };

  // Cargar solicitudes del estudiante
  const cargarSolicitudes = async () => {
    try {
      const response = await matriculaService.getSolicitudesModificacion();
      const solicitudes = response.solicitudes || [];
      
      // Buscar solicitud pendiente
      const pendiente = solicitudes.find(s => s.estado === 'pendiente');
      setSolicitudPendiente(pendiente || null);
      
      // Historial (últimas 5 no pendientes)
      setHistorialSolicitudes(
        solicitudes.filter(s => s.estado !== 'pendiente').slice(0, 5)
      );
    } catch (error) {
      // Silenciar el error si el endpoint no existe aún
      console.log("Solicitudes no disponibles aún:", error.message);
      setSolicitudPendiente(null);
      setHistorialSolicitudes([]);
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

  // Modificado: toggleGrupo ahora solo marca para la solicitud
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

      const nuevosSeleccionados = new Set([...gruposSeleccionados, grupoId]);
      setGruposSeleccionados(nuevosSeleccionados);
      actualizarHorario(nuevosSeleccionados);
      setConflictos(new Set([...conflictos].filter((id) => id !== grupoId)));
      setCreditosSeleccionados((prev) => prev + asignatura.creditos);
    }
  };

  // Nuevo: marcar materia para retirar en la solicitud
  const toggleRetirar = (historialId, grupoId) => {
    const materia = materiasMatriculadas.find(m => m.historial_id === historialId);
    if (!materia?.puede_retirar) return;

    if (gruposARetirar.has(historialId)) {
      const nuevos = new Set(gruposARetirar);
      nuevos.delete(historialId);
      setGruposARetirar(nuevos);
    } else {
      const nuevos = new Set([...gruposARetirar, historialId]);
      setGruposARetirar(nuevos);
    }
  };

  // Nuevo: enviar solicitud de modificación
  const enviarSolicitud = async () => {
    if (gruposSeleccionados.size === 0 && gruposARetirar.size === 0) {
      openDialog("Sin cambios", "Selecciona al menos un grupo para agregar o una materia para retirar.");
      return;
    }

    if (solicitudPendiente) {
      openDialog("Solicitud pendiente", "Ya tienes una solicitud de modificación pendiente. Espera a que sea revisada.");
      return;
    }

    try {
      setEnviandoSolicitud(true);
      
      // Preparar grupos a agregar con información completa
      const gruposAgregarCompletos = Array.from(gruposSeleccionados).map(gid => {
        const grupo = encontrarGrupoPorId(gid);
        const asignatura = asignaturas.find((a) => a.grupos?.some((g) => g.id === gid));
        if (!grupo || !asignatura) return null;
        return {
          grupo_id: gid,
          grupo_codigo: grupo.codigo,
          asignatura_id: asignatura.id,
          asignatura_codigo: asignatura.codigo,
          asignatura_nombre: asignatura.nombre,
          creditos: asignatura.creditos,
          docente: grupo.docente || null,
        };
      }).filter(Boolean);
      
      // Preparar grupos a retirar con información completa
      const gruposRetirarCompletos = Array.from(gruposARetirar).map(historialId => {
        const materia = materiasMatriculadas.find(m => m.historial_id === historialId);
        if (!materia) return null;
        return {
          historial_id: historialId,
          grupo_id: materia.grupo_id,
          grupo_codigo: materia.grupo_codigo,
          asignatura_id: materia.asignatura_id,
          asignatura_codigo: materia.codigo,
          asignatura_nombre: materia.nombre,
          creditos: materia.creditos,
        };
      }).filter(Boolean);
      
      await matriculaService.crearSolicitudModificacion({
        grupos_agregar: gruposAgregarCompletos,
        grupos_retirar: gruposRetirarCompletos,
      });

      setGruposSeleccionados(new Set());
      setGruposARetirar(new Set());
      setCreditosSeleccionados(0);
      
      openDialog(
        "Solicitud enviada",
        "Tu solicitud de modificación ha sido enviada. Recibirás una notificación cuando sea revisada por el jefe de departamento.",
        () => validarYcargar()
      );
    } catch (error) {
      const razon = getErrorReason(error, "Error al enviar la solicitud.");
      openDialog("Error", razon);
    } finally {
      setEnviandoSolicitud(false);
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

  // Renderizar estado de solicitud
  const renderEstadoSolicitud = () => {
    if (!solicitudPendiente && historialSolicitudes.length === 0) return null;

    return (
      <div className="solicitudes-section" style={{ marginBottom: '1.5rem' }}>
        {/* Solicitud pendiente */}
        {solicitudPendiente && (
          <div className="solicitud-card pendiente" style={{
            padding: '1rem',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '8px',
            marginBottom: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <FaClock style={{ color: '#856404' }} />
              <strong style={{ color: '#856404' }}>Solicitud Pendiente</strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#856404' }}>
              Tienes una solicitud de modificación pendiente de revisión.
              No puedes enviar otra hasta que sea procesada.
            </p>
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
              <strong>Enviada:</strong> {new Date(solicitudPendiente.fecha_creacion).toLocaleString('es-ES')}
            </div>
          </div>
        )}

        {/* Última solicitud procesada */}
        {historialSolicitudes.length > 0 && (
          <div style={{ marginTop: '0.5rem' }}>
            <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Última solicitud:</p>
            {historialSolicitudes.slice(0, 1).map((sol) => (
              <div 
                key={sol.id} 
                className={`solicitud-card ${sol.estado}`}
                style={{
                  padding: '0.75rem',
                  backgroundColor: sol.estado === 'aprobada' ? '#d4edda' : '#f8d7da',
                  border: `1px solid ${sol.estado === 'aprobada' ? '#28a745' : '#dc3545'}`,
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {sol.estado === 'aprobada' ? (
                    <FaCheckCircle style={{ color: '#28a745' }} />
                  ) : (
                    <FaTimesCircle style={{ color: '#dc3545' }} />
                  )}
                  <strong style={{ color: sol.estado === 'aprobada' ? '#155724' : '#721c24' }}>
                    {sol.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'}
                  </strong>
                  <span style={{ fontSize: '0.85rem', marginLeft: 'auto' }}>
                    {new Date(sol.fecha_revision).toLocaleString('es-ES')}
                  </span>
                </div>
                {sol.estado === 'rechazada' && sol.observacion && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#721c24' }}>
                    <strong>Observación:</strong> {sol.observacion}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
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
            <div className="horario-card-header">
              <h2>Tu Horario</h2>
              <div className="horario-controls">
                <label className="horario-hide-empty">
                  <input
                    type="checkbox"
                    checked={hideEmptyHours}
                    onChange={() => setHideEmptyHours((v) => !v)}
                  />
                  Ocultar horas sin asignaturas
                </label>
                <button
                  className={`horario-toggle-arrow ${showHorario ? 'open' : ''}`}
                  onClick={() => setShowHorario((s) => !s)}
                  aria-label={showHorario ? 'Ocultar horario' : 'Mostrar horario'}
                />
              </div>
            </div>

            <div className="horario-grid">
              {!showHorario ? (
                <div className="horario-collapsed">Horario oculto. Pulsa la flecha para expandir.</div>
              ) : (
                (() => {
                  const horaTieneAsignatura = (hora) =>
                    horario.some((h) =>
                      h.horarios.some((hor) =>
                        parseInt(hor.hora_inicio.split(':')[0]) <= hora && parseInt(hor.hora_fin.split(':')[0]) > hora
                      )
                    );

                  // Si se pidió ocultar horas vacías y no hay nada en el horario
                  if (hideEmptyHours && horario.length === 0) {
                    return (
                      <div className="horario-empty-message">No hay asignaturas en tu horario actual.</div>
                    );
                  }

                  // Filtrar horas visibles
                  const visibleHoras = hideEmptyHours && horario.length > 0
                    ? horas.filter(horaTieneAsignatura)
                    : horas;

                  if (visibleHoras.length === 0) {
                    return (
                      <div className="horario-empty-message">No hay asignaturas en tu horario actual.</div>
                    );
                  }

                  return (
                    <>
                      <div className="horario-header">
                        <div className="horario-time-col">Hora</div>
                        {diasSemana.map((dia) => (
                          <div key={dia} className="horario-day-col">
                            {dia.substring(0, 3)}
                          </div>
                        ))}
                      </div>

                      <div className="horario-body">
                        {visibleHoras.map((hora) => (
                          <div key={hora} className="horario-row">
                            <div className="horario-time-cell">{hora}:00</div>
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
                    </>
                  );
                })()
              )}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Materias Matriculadas y Disponibles */}
        <div className="asignaturas-column">
          <div className="asignaturas-card">
            {/* Mostrar estado de solicitudes */}
            {renderEstadoSolicitud()}

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

            {/* Carrito de Solicitud */}
            <div className="carrito-card">
              <h3 className="carrito-title">Solicitud de Modificación</h3>
              <p className="carrito-sub">
                {solicitudPendiente 
                  ? "Ya tienes una solicitud pendiente de revisión."
                  : "Los cambios que selecciones aparecerán aquí. La solicitud será enviada al jefe de departamento."}
              </p>
              
              {/* Estado de solicitud pendiente */}
              {solicitudPendiente && (
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: '#fff3cd',
                  border: '1px solid #ffc107',
                  borderRadius: '8px',
                  marginBottom: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FaClock style={{ color: '#856404' }} />
                    <strong style={{ color: '#856404' }}>Solicitud Pendiente</strong>
                  </div>
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#856404' }}>
                    Enviada: {new Date(solicitudPendiente.fecha_creacion).toLocaleString('es-ES')}
                  </p>
                </div>
              )}

              {/* Lista de cambios en la solicitud */}
              <div className="carrito-list">
                {gruposSeleccionados.size === 0 && gruposARetirar.size === 0 ? (
                  <div className="carrito-empty">
                    {solicitudPendiente 
                      ? "Espera a que tu solicitud sea procesada."
                      : "No has seleccionado ningún cambio aún."}
                  </div>
                ) : (
                  <>
                    {/* Grupos a agregar */}
                    {Array.from(gruposSeleccionados).map((gid) => {
                      const grupo = encontrarGrupoPorId(gid);
                      const asignatura = asignaturas.find((a) => a.grupos?.some((g) => g.id === gid));
                      if (!grupo || !asignatura) return null;
                      return (
                        <div key={`add-${gid}`} className="carrito-item" style={{ borderLeft: '4px solid #28a745' }}>
                          <div className="carrito-item-info">
                            <div className="carrito-item-title">
                              <span style={{ color: '#28a745', marginRight: '0.5rem' }}>➕</span>
                              {asignatura.nombre}
                            </div>
                            <div className="carrito-item-meta">{asignatura.codigo} • {asignatura.creditos} cr • Grupo {grupo.codigo}</div>
                          </div>
                          <div className="carrito-item-actions">
                            <button className="carrito-remove" onClick={() => toggleGrupo(gid, asignatura)}>
                              Quitar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Materias a retirar */}
                    {Array.from(gruposARetirar).map((historialId) => {
                      const materia = materiasMatriculadas.find(m => m.historial_id === historialId);
                      if (!materia) return null;
                      return (
                        <div key={`rem-${historialId}`} className="carrito-item" style={{ borderLeft: '4px solid #dc3545' }}>
                          <div className="carrito-item-info">
                            <div className="carrito-item-title">
                              <span style={{ color: '#dc3545', marginRight: '0.5rem' }}>➖</span>
                              {materia.nombre}
                            </div>
                            <div className="carrito-item-meta">{materia.codigo} • {materia.creditos} cr • Grupo {materia.grupo_codigo}</div>
                          </div>
                          <div className="carrito-item-actions">
                            <button className="carrito-remove" onClick={() => toggleRetirar(historialId)}>
                              Cancelar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Botón de enviar solicitud */}
              {!solicitudPendiente && (gruposSeleccionados.size > 0 || gruposARetirar.size > 0) && (
                <div className="carrito-actions">
                  <button
                    className="carrito-inscribir"
                    onClick={enviarSolicitud}
                    disabled={enviandoSolicitud}
                  >
                    {enviandoSolicitud ? (
                      <>
                        <FaSpinner className="spinner-small" /> Enviando...
                      </>
                    ) : (
                      `Enviar solicitud (${gruposSeleccionados.size + gruposARetirar.size} cambios)`
                    )}
                  </button>
                  <p style={{ fontSize: '0.8rem', color: '#666', textAlign: 'center', marginTop: '0.5rem' }}>
                    Los cambios serán aplicados cuando el jefe los apruebe
                  </p>
                </div>
              )}
            </div>

            {/* Historial de última solicitud */}
            {historialSolicitudes.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                {historialSolicitudes.slice(0, 1).map((sol) => (
                  <div 
                    key={sol.id} 
                    style={{
                      padding: '0.75rem',
                      backgroundColor: sol.estado === 'aprobada' ? '#d4edda' : '#f8d7da',
                      border: `1px solid ${sol.estado === 'aprobada' ? '#28a745' : '#dc3545'}`,
                      borderRadius: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {sol.estado === 'aprobada' ? (
                        <FaCheckCircle style={{ color: '#28a745' }} />
                      ) : (
                        <FaTimesCircle style={{ color: '#dc3545' }} />
                      )}
                      <strong>Última solicitud: {sol.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'}</strong>
                    </div>
                    {sol.estado === 'rechazada' && sol.observacion && (
                      <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>
                        <strong>Motivo:</strong> {sol.observacion}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <h2>Materias Matriculadas</h2>
            <div className="asignaturas-list">
              {materiasMatriculadas.length === 0 ? (
                <div className="asignaturas-empty">
                  <p>No tienes materias matriculadas en este periodo.</p>
                </div>
              ) : (
                materiasMatriculadas.map((materia) => {
                  const marcadaParaRetirar = gruposARetirar.has(materia.historial_id);
                  
                  return (
                    <div 
                      key={materia.historial_id} 
                      className={`asignatura-item ${marcadaParaRetirar ? 'marcada-retirar' : ''}`}
                      style={marcadaParaRetirar ? { opacity: 0.6, backgroundColor: '#ffebee' } : {}}
                    >
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
                          </div>
                        </div>
                      </div>
                      
                      {materia.puede_retirar && !solicitudPendiente && (
                        <button
                          className={`btn-retirar ${marcadaParaRetirar ? 'cancelar' : ''}`}
                          onClick={() => toggleRetirar(materia.historial_id, materia.grupo_id)}
                          style={marcadaParaRetirar ? { backgroundColor: '#6c757d' } : {}}
                        >
                          {marcadaParaRetirar ? 'Cancelar retiro' : 'Marcar para retirar'}
                        </button>
                      )}
                      
                      {!materia.puede_retirar && (
                        <div className="grupo-obligatorio-text">
                          No se puede retirar (materia atrasada o perdida)
                        </div>
                      )}
                    </div>
                  );
                })
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

