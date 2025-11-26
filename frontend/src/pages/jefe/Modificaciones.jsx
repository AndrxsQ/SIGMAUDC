import React, { useState } from 'react';
import { matriculaService } from '../../services/matricula';
import '../../styles/InscribirAsignaturas.css';

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

  const handleDesmatricular = async (grupoId) => {
    if (!student) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      await matriculaService.jefeDesmatricular(student.id, grupoId);
      setMessage('Desmatriculación realizada correctamente');
      // Refresh
      const data = await matriculaService.getStudentMatricula({ id: student.id });
      setClases(data.clases || []);
    } catch (err) {
      console.error(err);
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
      const grupos = enrollInput.split(',').map((s) => Number(s.trim())).filter(Boolean);
      if (grupos.length === 0) {
        setError('Debes ingresar al menos un ID de grupo separado por comas');
        setLoading(false);
        return;
      }
      await matriculaService.jefeInscribir(student.id, grupos);
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

  return (
    <div className="inscribir-container">
      <div className="inscribir-header">
        <h1>Modificaciones - Matricula Estudiantil</h1>
        <p>Busca un estudiante por su código y revisa su matrícula. Desde aquí puedes inscribir o desmatricular asignaturas.</p>
      </div>

      <div className="asignaturas-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px' }}>
            <label> Código del estudiante</label>
            <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej. 202012345" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="carrito-inscribir" onClick={handleSearch} disabled={loading}>Buscar</button>
          </div>
        </div>
      </div>

      {error && <div className="inscribir-alert" style={{ background: 'rgba(255,107,107,0.12)' }}>{String(error)}</div>}
      {message && <div className="inscribir-resumen" style={{ background: 'rgba(80,200,120,0.06)' }}>{message}</div>}

      {student && (
        <div className="asignaturas-card">
          <h2>Estudiante: {student.nombre} ({student.codigo})</h2>
          <p>Periodo: {periodo ? `${periodo.year}-${periodo.semestre}` : 'N/A'}</p>

          <div style={{ marginTop: 12 }}>
            <h3>Horario matriculado</h3>
            <div className="horario-grid">
              {clases.length === 0 ? (
                <div className="horario-empty-message">El estudiante no tiene asignaturas matriculadas en este periodo.</div>
              ) : (
                <div className="horario-header">
                  <div className="horario-time-col">Asignatura</div>
                  <div className="horario-day-col">Grupo</div>
                  <div className="horario-day-col">Día</div>
                  <div className="horario-day-col">Hora</div>
                  <div className="horario-day-col">Salón</div>
                  <div className="horario-day-col">Docente</div>
                  <div className="horario-day-col">Acciones</div>
                </div>
              )}
              <div className="horario-body">
                {clases.map((c, idx) => (
                  <div key={idx} className="horario-row" style={{ gridTemplateColumns: '1fr repeat(6, 1fr)' }}>
                    <div className="horario-time-cell">{c.asignatura_nombre} ({c.asignatura_codigo})</div>
                    <div className="horario-cell">{c.grupo_codigo} (#{c.grupo_id})</div>
                    <div className="horario-cell">{c.dia}</div>
                    <div className="horario-cell">{c.hora_inicio} - {c.hora_fin}</div>
                    <div className="horario-cell">{c.salon}</div>
                    <div className="horario-cell">{c.docente}</div>
                    <div className="horario-cell">
                      <button className="carrito-remove" onClick={() => handleDesmatricular(c.grupo_id)}>Desmatricular</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <h3>Inscribir nuevos grupos</h3>
              <p>Ingresa los IDs de los grupos separados por coma (p. ej. 12,34) y pulsa Inscribir.</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="text" value={enrollInput} onChange={(e) => setEnrollInput(e.target.value)} placeholder="IDs separados por comas" style={{ flex: '1' }} />
                <button className="carrito-inscribir" onClick={handleInscribir} disabled={loading}>Inscribir</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Modificaciones;
