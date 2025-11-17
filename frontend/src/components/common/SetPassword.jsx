import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { authService } from "../../services/auth";
import "../../styles/Login.css";

const SetPassword = () => {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({
    length: false,
    hasLetter: false,
    hasNumber: false,
    alphanumeric: false,
  });
  const [emailError, setEmailError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const userId = location.state?.userId;
  const codigo = location.state?.codigo;

  useEffect(() => {
    // Si no hay userId o codigo, redirigir al login
    if (!userId || !codigo) {
      navigate("/login");
    }
  }, [userId, codigo, navigate]);

  // Validar email en tiempo real
  useEffect(() => {
    if (email.length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setEmailError("Ingresa un correo electrónico válido");
      } else {
        setEmailError("");
      }
    } else {
      setEmailError("");
    }
  }, [email]);

  // Validar contraseña en tiempo real
  useEffect(() => {
    if (newPassword.length > 0) {
      const errors = {
        length: newPassword.length < 8,
        hasLetter: !/[a-zA-Z]/.test(newPassword),
        hasNumber: !/[0-9]/.test(newPassword),
        alphanumeric: !/^[a-zA-Z0-9]+$/.test(newPassword),
      };
      setPasswordErrors(errors);
      setError(""); // Limpiar error al escribir
    } else {
      setPasswordErrors({
        length: false,
        hasLetter: false,
        hasNumber: false,
        alphanumeric: false,
      });
    }
  }, [newPassword]);

  // Validar confirmación en tiempo real
  useEffect(() => {
    if (confirmPassword.length > 0 && newPassword.length > 0) {
      if (confirmPassword !== newPassword) {
        setConfirmError("Las contraseñas no coinciden");
      } else {
        setConfirmError("");
      }
    } else {
      setConfirmError("");
    }
  }, [confirmPassword, newPassword]);

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    setError("");
  };

  const handleNewPasswordChange = (e) => {
    const value = e.target.value;
    setNewPassword(value);
    setError("");
  };

  const handleConfirmPasswordChange = (e) => {
    setConfirmPassword(e.target.value);
    setError("");
  };

  const isEmailValid = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isPasswordValid = () => {
    return (
      !passwordErrors.length &&
      !passwordErrors.hasLetter &&
      !passwordErrors.hasNumber &&
      !passwordErrors.alphanumeric
    );
  };

  const handleCloseModal = () => {
    setShowSuccessModal(false);
    // Redirigir al login después de cerrar el modal
    setTimeout(() => {
      navigate("/login");
    }, 300);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setShowSuccessModal(false);

    // Validaciones
    if (!email || !isEmailValid()) {
      setError("Ingresa un correo electrónico válido");
      return;
    }

    if (!isPasswordValid()) {
      setError("La contraseña no cumple con los requisitos");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);

    try {
      const response = await authService.setPassword(userId, codigo, email, newPassword);

      if (response.success && response.token) {
        setSuccess(true);
        setLoading(false);
        
        // Mostrar modal de éxito
        setShowSuccessModal(true);
      } else {
        setError(response.message || "Error al establecer la contraseña");
      }
    } catch (err) {
      // Manejar diferentes tipos de errores
      if (err.response) {
        const errorData = err.response.data || {};
        const status = err.response.status;
        
        if (errorData.message) {
          setError(errorData.message);
        } else if (status === 401) {
          setError("El correo electrónico no coincide con el registrado para este código");
        } else if (status === 400) {
          setError(errorData.message || "Error en los datos ingresados");
        } else if (status === 500) {
          setError("Error de conexión con el servidor. Por favor intenta más tarde");
        } else {
          setError("Error al establecer la contraseña. Por favor intenta nuevamente");
        }
      } else if (err.request) {
        setError("Error de conexión. Verifica que el servidor esté funcionando");
      } else {
        setError("Ocurrió un error inesperado. Por favor intenta nuevamente");
      }
    } finally {
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
          <h1 className="login-title">Crear Contraseña</h1>
          <p className="login-subtitle">
            Es tu primer inicio de sesión. Verifica tu identidad con tu correo institucional y crea una contraseña segura.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {/* Mensaje de éxito */}
          {success && (
            <div className="success-message">
              <svg className="success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Contraseña creada exitosamente</span>
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

          {/* Campo Correo Electrónico */}
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Correo Institucional
            </label>
            <div className="input-wrapper">
              <input
                id="email"
                type="email"
                value={email}
                onChange={handleEmailChange}
                placeholder="correo@udc.edu.co"
                required
                disabled={loading}
                className={emailError ? "input-error" : ""}
                autoComplete="email"
              />
            </div>
            {emailError && (
              <span className="field-error">{emailError}</span>
            )}
          </div>

          {/* Campo Nueva Contraseña */}
          <div className="form-group">
            <label htmlFor="newPassword" className="form-label">
              Nueva Contraseña
            </label>
            <div className="input-wrapper">
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={handleNewPasswordChange}
                placeholder="Mínimo 8 caracteres alfanuméricos"
                required
                disabled={loading}
                className={
                  newPassword.length > 0 && !isPasswordValid() ? "input-error" : ""
                }
                autoComplete="new-password"
              />
              {newPassword.length > 0 && (
                <span className="input-counter">{newPassword.length}</span>
              )}
            </div>
            
            {/* Indicadores de validación */}
            {newPassword.length > 0 && (
              <div className="password-requirements">
                <div className={`requirement ${!passwordErrors.length ? "valid" : ""}`}>
                  <svg className="requirement-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    {!passwordErrors.length ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    )}
                  </svg>
                  <span>Mínimo 8 caracteres</span>
                </div>
                <div className={`requirement ${!passwordErrors.hasLetter ? "valid" : ""}`}>
                  <svg className="requirement-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    {!passwordErrors.hasLetter ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    )}
                  </svg>
                  <span>Al menos una letra</span>
                </div>
                <div className={`requirement ${!passwordErrors.hasNumber ? "valid" : ""}`}>
                  <svg className="requirement-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    {!passwordErrors.hasNumber ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    )}
                  </svg>
                  <span>Al menos un número</span>
                </div>
                <div className={`requirement ${!passwordErrors.alphanumeric ? "valid" : ""}`}>
                  <svg className="requirement-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    {!passwordErrors.alphanumeric ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    )}
                  </svg>
                  <span>Solo letras y números (alfanumérica)</span>
                </div>
              </div>
            )}
          </div>

          {/* Campo Confirmar Contraseña */}
          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">
              Confirmar Contraseña
            </label>
            <div className="input-wrapper">
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                placeholder="Confirma tu contraseña"
                required
                disabled={loading}
                className={
                  confirmError || (error && !passwordErrors.length && !passwordErrors.hasLetter && !passwordErrors.hasNumber && !passwordErrors.alphanumeric)
                    ? "input-error"
                    : ""
                }
                autoComplete="new-password"
              />
            </div>
            {confirmError && (
              <span className="field-error">{confirmError}</span>
            )}
          </div>

          {/* Botón de submit */}
          <button
            type="submit"
            className={`login-button ${loading ? "loading" : ""} ${success ? "success" : ""}`}
            disabled={loading || success || !isEmailValid() || !isPasswordValid() || !!confirmError || newPassword !== confirmPassword}
          >
            {loading ? (
              <>
                <svg className="spinner" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="32" strokeDashoffset="32">
                    <animate attributeName="stroke-dasharray" dur="2s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite" />
                    <animate attributeName="stroke-dashoffset" dur="2s" values="0;-16;-32;-32" repeatCount="indefinite" />
                  </circle>
                </svg>
                <span>Guardando...</span>
              </>
            ) : success ? (
              <>
                <svg className="success-icon-small" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>¡Contraseña creada!</span>
              </>
            ) : (
              "Guardar Contraseña"
            )}
          </button>

          {/* Botón cancelar */}
          <button
            type="button"
            className="cancel-button"
            onClick={() => navigate("/login")}
            disabled={loading || success}
          >
            Cancelar
          </button>
        </form>

        {/* Footer */}
        <div className="login-footer">
          <p className="footer-text">Universidad de Cartagena</p>
        </div>
      </div>

      {/* Modal de éxito */}
      {showSuccessModal && (
        <div className="success-modal-overlay" onClick={handleCloseModal}>
          <div className="success-modal" onClick={(e) => e.stopPropagation()}>
            <div className="success-modal-content">
              <div className="success-modal-icon-wrapper">
                <svg className="success-modal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={3} 
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="success-modal-title">¡Contraseña creada exitosamente!</h2>
              <p className="success-modal-message">
                Tu contraseña ha sido configurada correctamente. Ahora puedes iniciar sesión con tu código y contraseña.
              </p>
              <button 
                className="success-modal-button"
                onClick={handleCloseModal}
              >
                Ir a iniciar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SetPassword;
