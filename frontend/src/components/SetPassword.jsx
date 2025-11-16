import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { authService } from "../services/auth";
import "../styles/Login.css";

const SetPassword = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const userId = location.state?.userId;

  useEffect(() => {
    // Si no hay userId, redirigir al login
    if (!userId) {
      navigate("/login");
    }
  }, [userId, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validaciones
    if (newPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);

    try {
      const response = await authService.setPassword(userId, newPassword);

      if (response.success && response.token) {
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
        setError(response.message || "Error al establecer la contraseña");
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

        <h1 className="login-title">Crear Contraseña</h1>
        <p className="login-subtitle">
          Es tu primer inicio de sesión. Por favor, crea una contraseña segura.
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="newPassword">Nueva Contraseña</label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              disabled={loading}
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirmar Contraseña</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirma tu contraseña"
              required
              disabled={loading}
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? "Guardando..." : "Guardar Contraseña"}
          </button>

          <button
            type="button"
            className="cancel-button"
            onClick={() => navigate("/login")}
            disabled={loading}
          >
            Cancelar
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetPassword;

