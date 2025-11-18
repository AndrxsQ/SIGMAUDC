import api from './auth';

// Obtener la URL base desde la instancia de api configurada
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

const documentosService = {
  // Obtener documentos del estudiante actual
  async getDocumentosEstudiante() {
    const response = await api.get('/api/documentos');
    return response.data;
  },

  // Subir un documento
  async subirDocumento(tipoDocumento, archivo) {
    const formData = new FormData();
    formData.append("tipo_documento", tipoDocumento);
    formData.append("archivo", archivo);

    // Para FormData, axios automáticamente establece Content-Type: multipart/form-data
    // El interceptor de api ya agrega el Authorization header
    const response = await api.post('/api/documentos', formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  // Obtener documentos por programa (para jefatura)
  async getDocumentosPorPrograma() {
    const response = await api.get('/api/documentos/programa');
    return response.data;
  },

  // Revisar documento (aprobado/rechazado) - para jefatura
  async revisarDocumento(documentoId, estado, observacion) {
    const response = await api.put(
      `/api/documentos/${documentoId}/revisar`,
      {
        estado,
        observacion,
      }
    );
    return response.data;
  },

  // Obtener URL del archivo
  getArchivoURL: (archivoURL) => {
    return `${API_URL}${archivoURL}`;
  },
};

export default documentosService;

