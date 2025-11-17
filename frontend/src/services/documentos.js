import axios from "axios";

// Usar la misma configuración que auth.js
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

const documentosService = {
  // Obtener documentos del estudiante actual
  getDocumentosEstudiante: async () => {
    const token = localStorage.getItem("token");
    const response = await axios.get(`${API_URL}/api/documentos`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  // Subir un documento
  subirDocumento: async (tipoDocumento, archivo) => {
    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("tipo_documento", tipoDocumento);
    formData.append("archivo", archivo);

    const response = await axios.post(`${API_URL}/api/documentos`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  // Obtener documentos por programa (para jefatura)
  getDocumentosPorPrograma: async () => {
    const token = localStorage.getItem("token");
    const response = await axios.get(`${API_URL}/api/documentos/programa`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  // Revisar documento (aprobado/rechazado) - para jefatura
  revisarDocumento: async (documentoId, estado, observacion) => {
    const token = localStorage.getItem("token");
    const response = await axios.put(
      `${API_URL}/api/documentos/${documentoId}/revisar`,
      {
        estado,
        observacion,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
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

