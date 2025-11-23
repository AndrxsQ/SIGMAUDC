import api from "./auth";

const API_URL = import.meta.env.VITE_API_URL || "";

const datosJefeService = {
  async getPerfil() {
    const response = await api.get("/api/jefe/datos");
    return response.data;
  },
  async updatePerfil(payload) {
    const response = await api.put("/api/jefe/datos", payload);
    return response.data;
  },
  async uploadFoto(foto) {
    const formData = new FormData();
    formData.append("foto", foto);
    const response = await api.post("/api/jefe/foto", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },
  getFotoURL(path) {
    if (!path) return "";
    if (path.startsWith("http")) {
      return path;
    }
    return `${API_URL}${path}`;
  },
};

export default datosJefeService;

