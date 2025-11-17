import api from './auth';

export const plazosService = {
  // Obtener todos los periodos académicos
  async getPeriodos() {
    const response = await api.get('/api/periodos');
    return response.data;
  },

  // Obtener el periodo activo
  async getPeriodoActivo() {
    const response = await api.get('/api/periodos/activo');
    return response.data;
  },

  // Obtener todos los periodos con sus plazos
  async getPeriodosConPlazos() {
    const response = await api.get('/api/periodos-con-plazos');
    return response.data;
  },

  // Crear un nuevo periodo académico
  async createPeriodo(year, semestre) {
    const response = await api.post('/api/periodos', {
      year,
      semestre,
    });
    return response.data;
  },

  // Actualizar un periodo académico
  async updatePeriodo(periodoId, activo) {
    const response = await api.put(`/api/periodos/${periodoId}`, {
      activo,
    });
    return response.data;
  },

  // Eliminar un periodo académico
  async deletePeriodo(periodoId) {
    await api.delete(`/api/periodos/${periodoId}`);
  },

  // Obtener los plazos de un periodo
  async getPlazos(periodoId) {
    const response = await api.get(`/api/periodos/${periodoId}/plazos`);
    return response.data;
  },

  // Actualizar los plazos de un periodo
  async updatePlazos(periodoId, plazos) {
    const response = await api.put(`/api/periodos/${periodoId}/plazos`, plazos);
    return response.data;
  },
};

