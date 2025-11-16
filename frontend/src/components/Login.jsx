import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/auth";
import "../styles/Login.css";

const Login = () => {
  const [codigo, setCodigo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await authService.login(codigo, password);

      // Si requiere configuración de contraseña
      if (response.requiresPasswordSetup) {
        // Redirigir a la pantalla de creación de contraseña
        navigate("/set-password", { state: { userId: response.userId } });
        return;
      }

      // Si el login fue exitoso
      if (response.token) {
        authService.saveToken(response.token);
        
        // Obtener información del usuario
        try {
          const user = await authService.getCurrentUser();
          authService.saveUser(user);
        } catch (err) {
          console.error("Error fetching user:", err);
        }

        // Redirigir al home
        navigate("/");
      } else {
        setError(response.message || "Error al iniciar sesión");
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Error al conectar con el servidor"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Logo de la Universidad */}
        <div className="login-logo">
          <div className="logo-circle">
            <span className="logo-text">UDC</span>
          </div>
        </div>

        <h1 className="login-title">SIGMA</h1>
        <p className="login-subtitle">Sistema de Gestión de Matrícula</p>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="codigo">Código Institucional</label>
            <input
              id="codigo"
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ingresa tu código"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresa tu contraseña"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
