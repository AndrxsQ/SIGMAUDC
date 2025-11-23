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

  // Validar si el estudiante puede realizar modificaciones
  async validarModificaciones() {
    const response = await api.get('/api/matricula/validar-modificaciones');
    return response.data;
  },

  // Obtener datos de modificaciones (materias matriculadas y disponibles)
  async getModificacionesData() {
    const response = await api.get('/api/matricula/modificaciones');
    return response.data;
  },

  // Retirar una materia
  async retirarMateria(historialId) {
    const response = await api.post('/api/matricula/retirar-materia', {
      historial_id: historialId,
    });
    return response.data;
  },

  // Agregar una materia en modificaciones
  async agregarMateriaModificaciones(gruposIds) {
    const response = await api.post('/api/matricula/agregar-materia', {
      grupos_ids: gruposIds,
    });
    return response.data;
  },
};

