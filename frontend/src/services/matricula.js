import api from './auth';

export const matriculaService = {
  // Validar si el estudiante puede inscribir (plazo activo y documentos aprobados)
  async validarInscripcion() {
    const response = await api.get('/api/matricula/validar-inscripcion');
    return response.data;
  },

  // Obtener asignaturas disponibles para inscripción
  async getAsignaturasDisponibles() {
    const response = await api.get('/api/matricula/asignaturas-disponibles');
    return response.data;
  },

  // Obtener grupos de una asignatura
  async getGruposAsignatura(asignaturaId) {
    const response = await api.get(`/api/matricula/asignaturas/${asignaturaId}/grupos`);
    return response.data;
  },

  // Inscribir asignaturas (enviar grupos seleccionados)
  async inscribirAsignaturas(gruposIds) {
    const response = await api.post('/api/matricula/inscribir', {
      grupos_ids: gruposIds,
    });
    return response.data;
  },

  // Obtener horario actual del estudiante (para mostrar en la vista)
  async getHorarioActual() {
    const response = await api.get('/api/matricula/horario-actual');
    return response.data;
  },
};

