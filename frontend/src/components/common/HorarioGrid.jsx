import React from 'react';

// HorarioGrid: renders a schedule grid using the existing .horario-* CSS classes.
// Props:
// - entries: array of items. Each item may have:
//     asignatura (string), codigo (string), grupoCodigo (string), docente (string), horarios: [{dia, hora_inicio, hora_fin, salon}]
//   or items with single horario fields: dia, hora_inicio, hora_fin
// - diasSemana: array of day names (strings)
// - horas: array of hour numbers (e.g., [7,8,...,22])
// - showHorario: boolean
// - hideEmptyHours: boolean
// - obtenerColorAsignatura: optional function(codigo) -> color

function formatearHora(h) {
  if (!h) return '';
  const [hh, mm] = h.split(':');
  return `${hh}:${mm}`;
}

function obtenerPosicionHorario(horaInicio, horaFin) {
  // returns offset and duration in minutes relative to 1 hour block
  const [h1, m1] = horaInicio.split(':').map(Number);
  const [h2, m2] = horaFin.split(':').map(Number);
  const inicioMin = h1 * 60 + m1;
  const finMin = h2 * 60 + m2;
  const dur = finMin - inicioMin;
  const offsetDentroHora = m1; // minutes offset inside start hour
  return { duracionMinutos: dur, offsetDentroHora };
}

export default function HorarioGrid({ entries = [], diasSemana = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO'], horas = Array.from({length:16},(_,i)=>7+i), showHorario = true, hideEmptyHours = false, obtenerColorAsignatura = () => '#6b7280' }) {
  if (!showHorario) {
    return <div className="horario-collapsed">Horario oculto. Pulsa "Mostrar horario" para expandir.</div>;
  }

  // Normalize entries: ensure each has horarios array
  const normalized = entries.map((e) => {
    if (e.horarios && Array.isArray(e.horarios)) return e;
    if (e.dia && e.hora_inicio && e.hora_fin) {
      return { asignatura: e.asignatura || e.asignatura_nombre || e.asignaturaCodigo || e.asignatura_codigo || e.codigo, codigo: e.asignatura_codigo || e.codigo, grupoCodigo: e.grupo_codigo || e.grupoCodigo || e.grupoCodigo, docente: e.docente, horarios: [{dia: e.dia, hora_inicio: e.hora_inicio, hora_fin: e.hora_fin, salon: e.salon} ] };
    }
    return e;
  });

  const horaTieneAsignatura = (hora) => {
    return normalized.some((h) =>
      (h.horarios || []).some((hor) => {
        const dia = hor.dia;
        if (!dia) return false;
        const hi = parseInt(hor.hora_inicio.split(':')[0], 10);
        const hf = parseInt(hor.hora_fin.split(':')[0], 10);
        return hi <= hora && hf > hora;
      })
    );
  };

  const visibleHoras = hideEmptyHours ? horas.filter(horaTieneAsignatura) : horas;
  if (visibleHoras.length === 0) {
    return <div className="horario-empty-message">Aún no hay clases para mostrar en este horario.</div>;
  }

  return (
    <>
      <div className="horario-header">
        <div className="horario-time-col">Hora</div>
        {diasSemana.map((dia) => (
          <div key={dia} className="horario-day-col">{dia.substring(0,3)}</div>
        ))}
      </div>
      <div className="horario-body">
        {visibleHoras.map((hora) => (
          <div key={hora} className="horario-row">
            <div className="horario-time-cell">{hora}:00</div>
            {diasSemana.map((dia) => (
              <div key={`${hora}-${dia}`} className="horario-cell">
                {normalized
                  .filter((h) =>
                    (h.horarios || []).some((hor) => {
                      return hor.dia === dia && parseInt(hor.hora_inicio.split(':')[0]) <= hora && parseInt(hor.hora_fin.split(':')[0]) > hora;
                    })
                  )
                  .map((h, idx) => {
                    const horarioDia = (h.horarios || []).find((hor) => hor.dia === dia);
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
                          backgroundColor: obtenerColorAsignatura(h.codigo || h.asignatura_codigo || h.codigoAsignatura),
                          height: `${bloqueAltura}px`,
                          top: `${bloqueTop}px`,
                        }}
                        title={`${h.asignatura || h.asignatura_nombre || ''} - ${h.grupoCodigo || h.grupo_codigo || ''}\n${h.docente || ''}\n${horarioDia.salon || ''}\n${formatearHora(horarioDia.hora_inicio)} - ${formatearHora(horarioDia.hora_fin)}`}
                      >
                        <div className="horario-block-content">
                          <div className="horario-block-title">{h.asignatura || h.asignatura_nombre || h.codigo}</div>
                          <div className="horario-block-subtitle">{h.grupoCodigo || h.grupo_codigo || ''} - {horarioDia.salon || ''}</div>
                          <div className="horario-block-time">{formatearHora(horarioDia.hora_inicio)} - {formatearHora(horarioDia.hora_fin)}</div>
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
}
