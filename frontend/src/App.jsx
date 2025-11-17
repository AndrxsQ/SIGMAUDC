import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
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

// Páginas de jefes
import HomeJefe from "./pages/jefe/HomeJefe";
import Plazos from "./pages/jefe/Plazos";
import { authService } from "./services/auth";

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
  const navigate = useNavigate();
  const location = useLocation();

  // Cargar rol del usuario al montar el componente
  useEffect(() => {
    const loadUserRole = async () => {
      try {
        // Siempre obtener del servidor para asegurar datos actualizados
        if (authService.isAuthenticated()) {
          const user = await authService.getCurrentUser();
          if (user) {
            authService.saveUser(user);
            setUserRole(user.rol || null);
          }
        }
      } catch (error) {
        console.error("Error loading user role:", error);
        // Si falla, intentar usar el de localStorage como fallback
        const cachedUser = authService.getUser();
        if (cachedUser) {
          setUserRole(cachedUser.rol || null);
        }
      }
    };

    if (authService.isAuthenticated()) {
      loadUserRole();
    }
  }, []);

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
            <div style={{ display: "flex", height: "100vh", background: "#e2e8f0" }}>
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
              <div style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
                <Routes>
                  {/* Rutas para estudiantes */}
                  {userRole !== "jefe_departamental" && (
                    <>
                      <Route path="/" element={<Home />} />
                      <Route path="/home" element={<Home />} />
                      <Route path="/subir" element={<Subir />} />
                      <Route path="/hoja" element={<HojaDeVida />} />
                      <Route path="/pensul" element={<PensumVisual />} />
                    </>
                  )}
                  
                  {/* Rutas para jefes departamentales */}
                  {userRole === "jefe_departamental" && (
                    <>
                      <Route path="/" element={<HomeJefe />} />
                      <Route path="/home" element={<HomeJefe />} />
                      <Route path="/plazos" element={<Plazos />} />
                      <Route path="/verificar-documentos" element={<div>Verificar Documentos (En desarrollo)</div>} />
                      <Route path="/modificaciones" element={<div>Modificaciones (En desarrollo)</div>} />
                      <Route path="/plan-estudio" element={<div>Modificar Plan de Estudio (En desarrollo)</div>} />
                      <Route path="/perfil" element={<div>Mi Información (En desarrollo)</div>} />
                    </>
                  )}
                  
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </div>
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
