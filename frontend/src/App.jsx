import React, { useState } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Home from "./pages/Home";
import HojaDeVida from "./components/HojaDeVida";
import Subir from "./components/Subir";
import PensumVisual from "./components/PensumVisual";
import Login from "./components/Login";
import SetPassword from "./components/SetPassword";
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
  const navigate = useNavigate();
  const location = useLocation();

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
              <Sidebar 
                activePage={activePage} 
                setActivePage={handlePageChange}
                onLogout={handleLogout}
              />
              <div style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/home" element={<Home />} />
                  <Route path="/subir" element={<Subir />} />
                  <Route path="/hoja" element={<HojaDeVida />} />
                  <Route path="/pensul" element={<PensumVisual />} />
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
