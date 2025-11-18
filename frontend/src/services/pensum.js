import api from './auth';

export const pensumService = {
  // Obtener pensum completo del estudiante
  async getPensumEstudiante() {
    const response = await api.get('/api/pensum');
    return response.data;
  },
};

