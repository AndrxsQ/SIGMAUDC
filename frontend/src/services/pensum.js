import api from './auth';

export const pensumService = {
  // Obtener pensum completo del estudiante
  async getPensumEstudiante() {
    const response = await api.get('/api/pensum');
    return response.data;
  },
  // Jefatura: listar pensums disponibles
  async listPensums() {
    const response = await api.get('/api/pensum/list');
    return response.data;
  },

  // Jefatura: obtener asignaturas de un pensum por id
  async getAsignaturasPensum(pensumId) {
    const response = await api.get(`/api/pensum/${pensumId}/asignaturas`);
    return response.data;
  },

  // Jefatura: obtener grupos de un pensum por id (con info de asignatura y horarios)
  async getGruposPensum(pensumId) {
    const response = await api.get(`/api/pensum/${pensumId}/grupos`);
    return response.data;
  },
};

