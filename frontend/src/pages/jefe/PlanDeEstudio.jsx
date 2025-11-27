import React, { useEffect, useState, useMemo } from 'react';
import '../../styles/PlanDeEstudio.css';
import '../../styles/Modificaciones.css';
import { pensumService } from '../../services/pensum';
import { matriculaService } from '../../services/matricula';

// NOTE: This is a frontend-only scaffold. Later we'll wire it to real services.

const PlanDeEstudio = () => {
  const [pensums, setPensums] = useState([]); // lista de pensums (mock / to be loaded)
  const [selectedPensumId, setSelectedPensumId] = useState(null);
  const [searchPensum, setSearchPensum] = useState('');
  const [pensumQuery, setPensumQuery] = useState('');
  
  const [grupos, setGrupos] = useState([]); // grupos del pensum seleccionado
  const [filterTexto, setFilterTexto] = useState('');
  const [filterSemestre, setFilterSemestre] = useState('');
  const [loadingPensums, setLoadingPensums] = useState(false);
  const [loadingGrupos, setLoadingGrupos] = useState(false);
  const [error, setError] = useState(null);
  
  // Modal / edición de horario
  const [modalOpen, setModalOpen] = useState(false);
  const [modalGrupo, setModalGrupo] = useState(null);
  const [editableHorarios, setEditableHorarios] = useState([]);
  const [editableDocente, setEditableDocente] = useState(''); // Nuevo estado para docente
  const [savingHorarios, setSavingHorarios] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Load pensums from backend (jefatura)
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoadingPensums(true);
      setError(null);
      try {
        const data = await pensumService.listPensums();
        if (!mounted) return;
        setPensums(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error cargando pensums:', err);
        if (!mounted) return;
        setError('Error cargando pensums');
        setPensums([]);
      } finally {
        if (mounted) setLoadingPensums(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  // Load grupos cuando cambia el pensum seleccionado
  useEffect(() => {
    let mounted = true;
    if (!selectedPensumId) {
      setGrupos([]);
      return;
    }
    const load = async () => {
      setLoadingGrupos(true);
      setError(null);
      try {
        const data = await pensumService.getGruposPensum(selectedPensumId);
        if (!mounted) return;
        setGrupos(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error cargando grupos:', err);
        if (!mounted) return;
        setError('Error cargando grupos');
        setGrupos([]);
      } finally {
        if (mounted) setLoadingGrupos(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [selectedPensumId]);

  // Filtrar grupos por texto y semestre
  const filteredGrupos = useMemo(() => {
    const txt = filterTexto.trim().toLowerCase();
    return grupos.filter((g) => {
      if (filterSemestre && String(g.semestre) !== String(filterSemestre)) return false;
      if (!txt) return true;
      return (
        (g.codigo || '').toLowerCase().includes(txt) ||
        (g.asignatura_codigo || '').toLowerCase().includes(txt) ||
        (g.asignatura_nombre || '').toLowerCase().includes(txt) ||
        (g.docente || '').toLowerCase().includes(txt)
      );
    });
  }, [grupos, filterTexto, filterSemestre]);

  // Abrir modal para editar horario del grupo
  const openGrupoModal = (grupo) => {
    setModalError(null);
    setModalGrupo(grupo);
    setEditableDocente(grupo.docente || ''); // Inicializar docente
    setEditableHorarios(
      (grupo.horarios || []).map((h) => ({
        dia: h.dia,
        hora_inicio: h.hora_inicio,
        hora_fin: h.hora_fin,
        salon: h.salon || '',
      }))
    );
    setModalOpen(true);
  };

  const updateHorarioField = (index, field, value) => {
    setEditableHorarios((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const addHorario = () => {
    setEditableHorarios((prev) => [...prev, { dia: 'LUNES', hora_inicio: '07:00', hora_fin: '08:00', salon: '' }]);
  };

  const removeHorario = (idx) => {
    setEditableHorarios((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveHorarios = async () => {
    if (!modalGrupo) return;
    setSavingHorarios(true);
    setModalError(null);
    try {
      const payloadHorarios = editableHorarios.map((h) => ({
        dia: h.dia,
        hora_inicio: h.hora_inicio,
        hora_fin: h.hora_fin,
        salon: h.salon || '',
      }));
      await matriculaService.updateGrupoHorario(modalGrupo.id, payloadHorarios, editableDocente);
      // Actualizar el grupo en el estado local (horarios y docente)
      setGrupos((prev) =>
        prev.map((g) =>
          g.id === modalGrupo.id ? { ...g, horarios: payloadHorarios, docente: editableDocente } : g
        )
      );
      setSavingHorarios(false);
      setModalOpen(false);
    } catch (err) {
      console.error('Error guardando horarios:', err);
      setModalError('No se pudo guardar. Revisa la consola.');
      setSavingHorarios(false);
    }
  };

  // Formatear horario para mostrar en la tarjeta
  const formatHorarios = (horarios) => {
    if (!horarios || horarios.length === 0) return 'Sin horario definido';
    return horarios.map((h) => `${h.dia.substring(0, 3)} ${h.hora_inicio}-${h.hora_fin}`).join(' | ');
  };

  return (
    <div className="plan-container">
      <div className="plan-header">
        <h1>Modificaciones en Plan de Estudio</h1>
        <p>Selecciona un pensum para ver y editar los grupos (horarios) de cada asignatura.</p>
      </div>

      <div className="plan-controls">
        <div className="control-block">
          <label>Buscar pensum</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              className="input-text"
              placeholder="Filtrar pensums por nombre"
              value={searchPensum}
              onChange={(e) => setSearchPensum(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setPensumQuery(searchPensum);
              }}
            />
            <button className="btn" onClick={() => setPensumQuery(searchPensum)} disabled={loadingPensums}>
              Filtrar
            </button>
            <button
              className="btn btn-clear"
              onClick={() => {
                setSearchPensum('');
                setPensumQuery('');
              }}
              disabled={loadingPensums}
            >
              Limpiar
            </button>
          </div>
          <div className="pensum-list">
            {pensums
              .filter((p) => p.nombre.toLowerCase().includes(pensumQuery.trim().toLowerCase()))
              .map((p) => (
                <div
                  key={p.id}
                  className={`pensum-item ${selectedPensumId === p.id ? 'selected' : ''}`}
                  onClick={() => setSelectedPensumId(p.id)}
                >
                  {p.nombre}
                </div>
              ))}
          </div>
        </div>

        <div className="control-block">
          <label>Filtro de grupos</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              className="input-text"
              placeholder="Código, nombre o docente"
              value={filterTexto}
              onChange={(e) => setFilterTexto(e.target.value)}
            />
            <input
              type="number"
              min="1"
              max="10"
              className="input-text"
              placeholder="Semestre"
              value={filterSemestre}
              onChange={(e) => setFilterSemestre(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && <div className="inscribir-alert">{error}</div>}

      <div className="plan-list">
        <h3>
          Grupos del pensum {selectedPensumId ? `#${selectedPensumId}` : '(ninguno seleccionado)'}
          {grupos.length > 0 && ` (${filteredGrupos.length} grupos)`}
        </h3>
        {selectedPensumId == null ? (
          <div className="empty">Selecciona un pensum para ver sus grupos.</div>
        ) : loadingGrupos ? (
          <div className="empty">Cargando grupos...</div>
        ) : filteredGrupos.length === 0 ? (
          <div className="empty">No hay grupos disponibles para este pensum en el periodo activo.</div>
        ) : (
          <div className="asignaturas-grid">
            {filteredGrupos.map((g) => (
              <div key={g.id} className="asignatura-card" onClick={() => openGrupoModal(g)} style={{ cursor: 'pointer' }}>
                <div className="asig-header">
                  <div className="asig-codigo">{g.codigo}</div>
                  <div className="asig-nombre">{g.asignatura_nombre}</div>
                </div>
                <div className="asig-meta">
                  Semestre {g.semestre} • {g.creditos} créditos
                </div>
                <div className="asig-meta" style={{ marginTop: 4 }}>
                  <strong>Docente:</strong> {g.docente || '—'}
                </div>
                <div className="asig-meta" style={{ marginTop: 4 }}>
                  <strong>Cupo:</strong> {g.cupo_disponible}/{g.cupo_max}
                </div>
                <div className="asig-meta" style={{ marginTop: 4, fontSize: '0.85em', color: '#666' }}>
                  {formatHorarios(g.horarios)}
                </div>
                <div style={{ marginTop: 8 }}>
                  <button className="btn" onClick={(e) => { e.stopPropagation(); openGrupoModal(g); }}>
                    Editar horario
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {modalOpen && modalGrupo && (
          <div className="dialog-overlay" role="presentation">
            <div className="dialog-card" style={{ maxWidth: 800 }}>
              <p className="dialog-title">
                Editar grupo — {modalGrupo.codigo} ({modalGrupo.asignatura_nombre})
              </p>
              
              {/* Campo editable para docente */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Docente:</label>
                <input
                  type="text"
                  className="input-text"
                  placeholder="Nombre del docente"
                  value={editableDocente}
                  onChange={(e) => setEditableDocente(e.target.value)}
                  style={{ width: '100%', maxWidth: 400 }}
                />
              </div>

              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Horarios:</label>
              </div>
              
              {modalError && <div style={{ color: 'red', marginBottom: 8 }}>{modalError}</div>}
              <div style={{ maxHeight: 320, overflow: 'auto', marginBottom: 8 }}>
                {editableHorarios.length === 0 ? (
                  <div>Este grupo no tiene horarios definidos.</div>
                ) : (
                  editableHorarios.map((h, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <select value={h.dia} onChange={(e) => updateHorarioField(idx, 'dia', e.target.value)}>
                        {['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'].map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                      <input
                        type="time"
                        value={h.hora_inicio}
                        onChange={(e) => updateHorarioField(idx, 'hora_inicio', e.target.value)}
                      />
                      <input
                        type="time"
                        value={h.hora_fin}
                        onChange={(e) => updateHorarioField(idx, 'hora_fin', e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Salón"
                        value={h.salon}
                        onChange={(e) => updateHorarioField(idx, 'salon', e.target.value)}
                      />
                      <button className="btn btn-clear" onClick={() => removeHorario(idx)}>
                        Eliminar
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn" onClick={addHorario}>
                  Agregar horario
                </button>
                <button
                  className="btn btn-clear"
                  onClick={() => {
                    setModalOpen(false);
                    setModalError(null);
                  }}
                >
                  Cancelar
                </button>
                <button className="btn" onClick={saveHorarios} disabled={savingHorarios}>
                  {savingHorarios ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanDeEstudio;
