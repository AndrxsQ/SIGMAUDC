import React, { useState, useMemo } from 'react';
import { matriculaService } from '../../services/matricula';
import '../../styles/Modificaciones.css';
// Reuse student schedule styles and the new HorarioGrid component
import '../../styles/InscribirAsignaturas.css';
import HorarioGrid from '../../components/common/HorarioGrid';

const Modificaciones = () => {
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [student, setStudent] = useState(null);
  const [clases, setClases] = useState([]);
  const [periodo, setPeriodo] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [enrollInput, setEnrollInput] = useState('');

  const handleSearch = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);
    setStudent(null);
    setClases([]);
    try {
      const data = await matriculaService.getStudentMatricula({ codigo });
      setStudent(data.estudiante || null);
      setPeriodo(data.periodo || null);
      setClases(data.clases || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data || err.message || 'Error buscando estudiante');
    } finally {
      setLoading(false);
    }
  };

  // Schedule UI state (match student view controls)
  const [showHorario, setShowHorario] = useState(true);
  const [hideEmptyHours, setHideEmptyHours] = useState(false);

  // Simple local state for asignaturas disponibles (search area)
  // Nota: la sección de oferta y filtros fue removida — la inscripción se hará por código.

  const groupedMatriculas = useMemo(() => {
    const map = new Map();
    (clases || []).forEach((c) => {
      const key = `${c.asignatura_nombre}||${c.grupo_codigo}`;
      if (!map.has(key)) map.set(key, { asignatura: c.asignatura_nombre, codigo: c.asignatura_codigo, grupoCodigo: c.grupo_codigo, grupoId: c.grupo_id, horarios: [] });
      const item = map.get(key);
      item.horarios.push({ dia: c.dia, hora_inicio: c.hora_inicio, hora_fin: c.hora_fin, salon: c.salon });
    });
    return Array.from(map.values());
  }, [clases]);

  const handleDesmatricular = async (grupoId) => {
    if (!student) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      console.log('Attempting desmatricular', { estudianteId: student.id, grupoId });
      await matriculaService.jefeDesmatricular(student.id, grupoId);
      console.log('Desmatricular request successful for grupo', grupoId);
      setMessage('Desmatriculación realizada correctamente');
      // Refresh
      const data = await matriculaService.getStudentMatricula({ id: student.id });
      setClases(data.clases || []);
    } catch (err) {
      console.error(err);
      console.error('Desmatricular error response:', err.response?.data || err.message);
      setError(err.response?.data || err.message || 'Error desmatriculando');
    } finally {
      setLoading(false);
    }
  };

  const handleInscribir = async () => {
    if (!student) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      // Only allow a single code (backend enforces single-code rule)
      const grupos = enrollInput.split(',').map((s) => s.trim()).filter(Boolean);
      if (grupos.length === 0) {
        setError('Debes ingresar al menos un código de grupo');
        setLoading(false);
        return;
      }
      if (grupos.length > 1) {
        setError('Solo se permite inscribir un grupo a la vez cuando se usan códigos');
        setLoading(false);
        return;
      }
      // Use group codes instead of numeric IDs (single code)
      await matriculaService.jefeInscribirByCodigo(student.id, grupos);
      setMessage('Inscripción realizada correctamente');
      setEnrollInput('');
      // Refresh
      const data = await matriculaService.getStudentMatricula({ id: student.id });
      setClases(data.clases || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data || err.message || 'Error inscribiendo');
    } finally {
      setLoading(false);
    }
  };

  // No usamos oferta ni filtros — todo se hace por código manual.

  // Build set of matriculated asignatura IDs
  const matriculadasSet = useMemo(() => {
    const s = new Set();
    (clases || []).forEach((c) => {
      if (c.asignatura_id) s.add(c.asignatura_id);
      if (c.asignaturaId) s.add(c.asignaturaId);
    });
    return s;
  }, [clases]);
  

  return (
    <div className="inscribir-container">
      <div className="inscribir-header">
        <h1>Consultar Matricula</h1>
        <p>Busca un estudiante por su código para consultar su matrícula. Puedes matricular o desmatricular asignaturas.</p>
      </div>

      <div className="asignaturas-card">
        <div className="form-row">
          <div className="flex-1-300">
            <label> Código del estudiante</label>
            <input className="input-text" type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej. 202012345" />
          </div>
          <div className="btn-group">
            <button className="carrito-inscribir" onClick={handleSearch} disabled={loading}>Buscar</button>
          </div>
        </div>
      </div>

      {error && <div className="inscribir-alert">{String(error)}</div>}
      {message && <div className="inscribir-resumen">{message}</div>}

      {student && (
        <div className="asignaturas-card">
          <h2>Estudiante: {student.nombre} ({student.codigo})</h2>
          <p>Periodo: {periodo ? `${periodo.year}-${periodo.semestre}` : 'N/A'}</p>

            <div className="section-block">
              <h3>Horario matriculado</h3>
              <div className="horario-grid">
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
                  <div />
                  <div className="horario-controls">
                    <label className="horario-hide-empty">
                      <input type="checkbox" checked={hideEmptyHours} onChange={() => setHideEmptyHours((v) => !v)} />
                      Ocultar horas sin asignaturas
                    </label>
                    <button className={`horario-toggle-arrow ${showHorario ? 'open' : ''}`} onClick={() => setShowHorario((s) => !s)} aria-label={showHorario ? 'Ocultar horario' : 'Mostrar horario'} />
                  </div>
                </div>

                {clases.length === 0 ? (
                  <div className="horario-empty-message">El estudiante no tiene asignaturas matriculadas en este periodo.</div>
                ) : (
                  <HorarioGrid
                    entries={clases}
                    showHorario={showHorario}
                    hideEmptyHours={hideEmptyHours}
                  />
                )}
              </div>
            </div>

            {/* Matriculas list: grouped view similar to student side */}
            <div className="section-block">
              <h3>Asignaturas matriculadas</h3>
              {clases.length === 0 ? (
                <div className="horario-empty-message">No hay asignaturas matriculadas.</div>
              ) : (
                <div className="grupos-list">
                  {groupedMatriculas.map((g, idx) => (
                    <div key={idx} className="grupo-item">
                      <div className="grupo-header">
                        <div>
                          <div className="grupo-codigo">{g.asignatura} <span style={{fontWeight:600, marginLeft:8}}>{g.codigo}</span></div>
                          <div className="grupo-cupo">Grupo: {g.grupoCodigo} (#{g.grupoId})</div>
                        </div>
                        <div className="carrito-item-actions">
                          <button className="carrito-remove" onClick={() => handleDesmatricular(g.grupoId)}>Desmatricular</button>
                        </div>
                      </div>
                      <div className="grupo-horario">
                        {g.horarios.map((h, i) => (
                          <div key={i} className="horario-badge">{h.dia} {h.hora_inicio}-{h.hora_fin} {h.salon ? `• ${h.salon}` : ''}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Matricular únicamente por código */}
            <div className="section-block">
              <h3>Matricular por código</h3>
              <div style={{display:'flex', gap:8, alignItems:'center'}}>
                <input className="input-flex input-text" value={enrollInput} onChange={(e) => setEnrollInput(e.target.value)} placeholder="Ingresa el código del grupo (ej. A1B2C3)" />
                <button className="carrito-inscribir" onClick={handleInscribir} disabled={loading}>Matricular</button>
              </div>
              <p style={{marginTop:8, color:'#666'}}>Solo se permite matricular un grupo a la vez usando su código.</p>
            </div>
            
        </div>
      )}

    </div>
  );
};

export default Modificaciones;
