import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../../services/auth";
import "../../styles/Login.css";

const Login = () => {
  const [codigo, setCodigo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [codigoError, setCodigoError] = useState("");
  const navigate = useNavigate();

  // Validar código en tiempo real
  useEffect(() => {
    if (codigo && codigo.length > 0) {
      // Solo números
      const onlyNumbers = /^\d+$/.test(codigo);
      if (!onlyNumbers) {
        setCodigoError("El código solo debe contener números");
        return;
      }
      
      // Exactamente 10 dígitos
      if (codigo.length !== 10) {
        setCodigoError("El código debe tener exactamente 10 dígitos");
        return;
      }
      
      setCodigoError("");
    } else {
      setCodigoError("");
    }
  }, [codigo]);

  const handleCodigoChange = (e) => {
    const value = e.target.value.replace(/\D/g, ""); // Solo números
    if (value.length <= 10) {
      setCodigo(value);
      setError(""); // Limpiar error al escribir
    }
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    setError(""); // Limpiar error al escribir
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setCodigoError("");

    // Validaciones
    if (!codigo || codigo.length === 0) {
      setCodigoError("Por favor ingresa tu código");
      return;
    }

    if (codigo.length !== 10) {
      setCodigoError("El código debe tener exactamente 10 dígitos");
      return;
    }

    if (!/^\d+$/.test(codigo)) {
      setCodigoError("El código solo debe contener números");
      return;
    }

    if (!password || password.length === 0) {
      setError("Por favor ingresa tu contraseña");
      return;
    }

    setLoading(true);

    try {
      const response = await authService.login(codigo, password);

      // Si requiere configuración de contraseña
      if (response.requiresPasswordSetup) {
        navigate("/set-password", { state: { userId: response.userId, codigo: codigo } });
        return;
      }

      // Si el login fue exitoso
      if (response.token) {
        setSuccess(true);
        authService.saveToken(response.token);

        // Obtener información del usuario
        try {
          const user = await authService.getCurrentUser();
          authService.saveUser(user);
        } catch (err) {
          console.error("Error fetching user:", err);
        }

        // Redirigir después de mostrar éxito
        setTimeout(() => {
          navigate("/");
        }, 800);
      } else {
        // Error del servidor (sin token y sin requiresPasswordSetup)
        setError(response.message || "Error al iniciar sesión");
        setLoading(false);
      }
    } catch (err) {
      // Manejar diferentes tipos de errores
      if (err.response) {
        // Error de respuesta del servidor
        const errorData = err.response.data || {};
        const status = err.response.status;
        
        // Manejar según el tipo de error
        if (errorData.errorType === "user_not_found") {
          setError("El código de usuario no existe en el sistema");
        } else if (errorData.errorType === "wrong_password") {
          setError("La contraseña ingresada es incorrecta");
        } else if (errorData.errorType === "connection_error") {
          setError("Error de conexión con el servidor. Por favor intenta más tarde");
        } else if (errorData.message) {
          setError(errorData.message);
        } else if (status === 401) {
          setError("Credenciales inválidas. Verifica tu código y contraseña");
        } else if (status === 500) {
          setError("Error de conexión con el servidor. Por favor intenta más tarde");
        } else {
          setError("Error al iniciar sesión. Por favor intenta nuevamente");
        }
      } else if (err.request) {
        // Error de conexión (sin respuesta del servidor)
        setError("Error de conexión. Verifica que el servidor esté funcionando");
      } else {
        // Otro error
        setError("Ocurrió un error inesperado. Por favor intenta nuevamente");
      }
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Logo de la Universidad - Escudo PNG */}
        <div className="login-logo">
          <div className="logo-square">
            <img 
              src="/logo-udc.png" 
              alt="Escudo Universidad de Cartagena"
              className="logo-image"
              onError={(e) => {
                e.target.style.display = 'none';
                const fallback = e.target.nextElementSibling;
                if (fallback) fallback.style.display = 'block';
              }}
            />
            <span className="logo-text-fallback">UDC</span>
          </div>
        </div>

        <div className="login-header">
          <h1 className="login-title">SIGMA-UDC</h1>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {/* Mensaje de éxito */}
          {success && (
            <div className="success-message">
              <svg className="success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Inicio de sesión exitoso</span>
            </div>
          )}

          {/* Mensaje de error */}
          {error && (
            <div className="error-message">
              <svg className="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Campo código */}
          <div className="form-group">
            <label htmlFor="codigo" className="form-label">
              Código Institucional
            </label>
            <div className="input-wrapper">
              <input
                id="codigo"
                type="text"
                inputMode="numeric"
                value={codigo}
                onChange={handleCodigoChange}
                placeholder="0000000000"
                maxLength={10}
                required
                disabled={loading}
                className={codigoError ? "input-error" : ""}
                autoComplete="username"
              />
              {codigo && codigo.length > 0 && (
                <span className="input-counter">{codigo.length}/10</span>
              )}
            </div>
            {codigoError && (
              <span className="field-error">{codigoError}</span>
            )}
          </div>

          {/* Campo contraseña */}
          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Contraseña
            </label>
            <div className="input-wrapper">
              <input
                id="password"
                type="password"
                value={password}
                onChange={handlePasswordChange}
                placeholder="Ingresa tu contraseña"
                required
                disabled={loading}
                className={error && !codigoError ? "input-error" : ""}
                autoComplete="current-password"
              />
            </div>
          </div>

          {/* Botón de submit */}
          <button
            type="submit"
            className={`login-button ${loading ? "loading" : ""} ${success ? "success" : ""}`}
            disabled={loading || success || !!codigoError}
          >
            {loading ? (
              <>
                <svg className="spinner" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="32" strokeDashoffset="32">
                    <animate attributeName="stroke-dasharray" dur="2s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite" />
                    <animate attributeName="stroke-dashoffset" dur="2s" values="0;-16;-32;-32" repeatCount="indefinite" />
                  </circle>
                </svg>
                <span>Iniciando sesión...</span>
              </>
            ) : success ? (
              <>
                <svg className="success-icon-small" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>¡Bienvenido!</span>
              </>
            ) : (
              "Iniciar Sesión"
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="login-footer">
          <p className="footer-text">Universidad de Cartagena</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
