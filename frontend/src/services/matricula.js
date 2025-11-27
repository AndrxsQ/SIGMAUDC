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

  // Buscar asignaturas con parámetros (soporta filtrado en backend si se implementa)
  async buscarAsignaturas(params) {
    const response = await api.get('/api/matricula/asignaturas-disponibles', { params });
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

  // Obtener matrícula / horario de un estudiante (para jefatura)
  async getStudentMatricula(params) {
    // params: { codigo } or { id }
    const response = await api.get('/api/modificaciones/estudiante', { params });
    return response.data;
  },

  // Jefatura: inscribir asignaturas en nombre de un estudiante
  async jefeInscribir(estudianteId, gruposIds) {
    const response = await api.post(`/api/modificaciones/estudiante/${estudianteId}/inscribir`, {
      grupos_ids: gruposIds,
    });
    return response.data;
  },

  // Jefatura: inscribir usando códigos de grupo en lugar de IDs
  async jefeInscribirByCodigo(estudianteId, gruposCodigos) {
    const response = await api.post(`/api/modificaciones/estudiante/${estudianteId}/inscribir`, {
      grupos_codigos: gruposCodigos,
    });
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

  // Jefatura: obtener asignaturas disponibles para modificaciones para un estudiante específico
  async getAsignaturasDisponiblesForEstudiante(estudianteId) {
    const response = await api.get(`/api/modificaciones/estudiante/${estudianteId}/disponibles`);
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

  // Jefatura: desmatricular un grupo de un estudiante
  async jefeDesmatricular(estudianteId, grupoId) {
    const response = await api.post(`/api/modificaciones/estudiante/${estudianteId}/desmatricular`, {
      grupo_id: grupoId,
    });
    return response.data;
  },

  // Actualizar horarios de un grupo (jefatura)
  async updateGrupoHorario(grupoId, horarios, docente = null) {
    const payload = { horarios };
    if (docente !== null) {
      payload.docente = docente;
    }
    const response = await api.put(`/api/grupo/${grupoId}/horario`, payload);
    return response.data;
  },

  // Obtener solicitudes de modificación del estudiante
  async getSolicitudesModificacion() {
    const response = await api.get('/api/matricula/solicitudes-modificacion');
    return response.data;
  },

  // Crear solicitud de modificación
  async crearSolicitudModificacion(payload) {
    const response = await api.post('/api/matricula/solicitudes-modificacion', payload);
    return response.data;
  },

  // Jefe: obtener todas las solicitudes de modificación por programa
  async getSolicitudesPorPrograma() {
    const response = await api.get('/api/jefe/solicitudes-modificacion');
    return response.data;
  },

  // Jefe: validar (aprobar/rechazar) una solicitud de modificación
  async validarSolicitud(solicitudId, estado, observacion) {
    const response = await api.put(`/api/jefe/solicitudes-modificacion/${solicitudId}`, {
      estado,
      observacion,
    });
    return response.data;
  },
};

