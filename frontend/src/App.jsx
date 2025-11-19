import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { FaBars } from "react-icons/fa";
// Componentes comunes
import Login from "./components/common/Login";
import SetPassword from "./components/common/SetPassword";

// Componentes de estudiantes
import Sidebar from "./components/estudiante/Sidebar";
import HojaDeVida from "./components/estudiante/HojaDeVida";
import Subir from "./components/estudiante/Subir";
import PensumVisual from "./components/estudiante/PensumVisual";

// Componentes de jefes
import SidebarJefe from "./components/jefe/SidebarJefe";

// Páginas de estudiantes
import Home from "./pages/estudiante/Home";
import InscribirAsignaturas from "./pages/estudiante/InscribirAsignaturas";

// Páginas de jefes
import HomeJefe from "./pages/jefe/HomeJefe";
import Plazos from "./pages/jefe/Plazos";
import VerificarDocumentos from "./pages/jefe/VerificarDocumentos";
import { authService } from "./services/auth";

// Botón hamburguesa para móviles
const MobileMenuButton = ({ userRole, onToggle }) => {
  return (
    <button
      className="mobile-menu-button"
      onClick={onToggle}
      aria-label="Abrir menú"
    >
      <FaBars size={20} />
    </button>
  );
};

// Componente para proteger rutas
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = authService.isAuthenticated();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Componente principal de la aplicación
function AppContent() {
  const [activePage, setActivePage] = useState("home");
  const [userRole, setUserRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Cargar rol del usuario (al montar y cuando cambia la ruta)
  useEffect(() => {
    const loadUserRole = async () => {
      try {
        if (!authService.isAuthenticated()) {
          setUserRole(null);
          return;
        }

        setRoleLoading(true);

        // Primero intentar con el usuario en localStorage para evitar parpadeos
        const cachedUser = authService.getUser();
        if (cachedUser?.rol) {
          setUserRole(cachedUser.rol);
        }

        // Luego refrescar desde el servidor para asegurar datos actualizados
        const user = await authService.getCurrentUser();
        if (user) {
          authService.saveUser(user);
          setUserRole(user.rol || null);
        }
      } catch (error) {
        console.error("Error loading user role:", error);
        const cachedUser = authService.getUser();
        if (cachedUser?.rol) {
          setUserRole(cachedUser.rol || null);
        }
      } finally {
        setRoleLoading(false);
      }
    };

    loadUserRole();
  }, [location.pathname]);

  // Sincronizar activePage con la ruta actual
  React.useEffect(() => {
    const path = location.pathname;
    if (path === "/" || path === "/home") {
      setActivePage("home");
    } else if (path === "/subir") {
      setActivePage("subir");
    } else if (path === "/hoja") {
      setActivePage("hoja");
    } else if (path === "/pensul") {
      setActivePage("pensul");
    } else if (path === "/inscribir") {
      setActivePage("inscribir");
    } else if (path === "/plazos") {
      setActivePage("plazos");
    } else if (path === "/verificar-documentos") {
      setActivePage("verificar-documentos");
    } else if (path === "/modificaciones") {
      setActivePage("modificaciones");
    } else if (path === "/plan-estudio") {
      setActivePage("plan-estudio");
    } else if (path === "/perfil") {
      setActivePage("perfil");
    }
  }, [location]);

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const handlePageChange = (page) => {
    setActivePage(page);
    // Navegar a la ruta correspondiente
    if (page === "home") {
      navigate("/");
    } else {
      navigate(`/${page}`);
    }
  };

  return (
    <Routes>
      {/* Rutas públicas */}
      <Route path="/login" element={<Login />} />
      <Route path="/set-password" element={<SetPassword />} />

      {/* Rutas protegidas */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            {roleLoading && authService.isAuthenticated() ? (
              <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "#e2e8f0" }}>
                <div className="loading-spinner">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 40, height: 40 }}>
                    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="32">
                      <animate attributeName="stroke-dasharray" dur="2s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite" />
                      <animate attributeName="stroke-dashoffset" dur="2s" values="0;-16;-32;-32" repeatCount="indefinite" />
                    </circle>
                  </svg>
                </div>
              </div>
            ) : (
            <div style={{ display: "flex", height: "100vh", background: "#e2e8f0", position: "relative", width: "100%" }}>
              {/* Backdrop overlay para sidebar en móviles */}
              <div className="sidebar-backdrop"></div>
              
              {/* Botón hamburguesa para móviles */}
              <MobileMenuButton 
                userRole={userRole}
                onToggle={() => {
                  const sidebar = document.querySelector('.sidebar');
                  const backdrop = document.querySelector('.sidebar-backdrop');
                  if (sidebar) {
                    const isOpen = sidebar.classList.contains('open');
                    if (isOpen) {
                      sidebar.classList.remove('open');
                      sidebar.classList.add('closed');
                      if (backdrop) backdrop.classList.remove('active');
                    } else {
                      sidebar.classList.remove('closed');
                      sidebar.classList.add('open');
                      if (backdrop) backdrop.classList.add('active');
                    }
                  }
                }}
              />
              
              {/* Mostrar Sidebar según el rol */}
              {userRole === "jefe_departamental" ? (
                <SidebarJefe 
                  activePage={activePage} 
                  setActivePage={handlePageChange}
                  onLogout={handleLogout}
                />
              ) : (
                <Sidebar 
                  activePage={activePage} 
                  setActivePage={handlePageChange}
                  onLogout={handleLogout}
                />
              )}
              <div className="main-content" style={{ width: "100%", padding: 0, overflowY: "auto", minHeight: "100vh", marginLeft: 0 }}>
                <Routes>
                  {/* Rutas para estudiantes */}
                  {userRole !== "jefe_departamental" && (
                    <>
                      <Route path="/" element={<Home />} />
                      <Route path="/home" element={<Home />} />
                      <Route path="/subir" element={<Subir />} />
                      <Route path="/hoja" element={<HojaDeVida />} />
                      <Route path="/pensul" element={<PensumVisual />} />
                      <Route path="/inscribir" element={<InscribirAsignaturas />} />
                    </>
                  )}
                  
                  {/* Rutas para jefes departamentales */}
                  {userRole === "jefe_departamental" && (
                    <>
                      <Route path="/" element={<HomeJefe />} />
                      <Route path="/home" element={<HomeJefe />} />
                      <Route path="/plazos" element={<Plazos />} />
                      <Route path="/verificar-documentos" element={<VerificarDocumentos />} />
                      <Route path="/modificaciones" element={<div>Modificaciones (En desarrollo)</div>} />
                      <Route path="/plan-estudio" element={<div>Modificar Plan de Estudio (En desarrollo)</div>} />
                      <Route path="/perfil" element={<div>Mi Información (En desarrollo)</div>} />
                    </>
                  )}
                  
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </div>
            )}
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

// Componente wrapper para App
function App() {
  return <AppContent />;
}

export default App;
