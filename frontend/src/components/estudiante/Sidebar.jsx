/**
* Barra lateral de navegación (Sidebar)
* Este componente maneja la navegación principal del sistema SIGMA,
* permitiendo acceder a las diferentes funciones del proceso de matrícula.
* Incluye banderas de activación visual (botones activos) y modo colapsable.
*/

import React, { useState, useEffect } from "react";
// Importación de íconos desde react-icons (representan cada opción del menú)
import {
  FaBars,
  FaBookOpen,
  FaClipboardList,
  FaEdit,
  FaSearch,
  FaFileAlt,
  FaChartBar,
  FaCalendarAlt,
  FaSignOutAlt
} from "react-icons/fa";
import { FaFileUpload } from "react-icons/fa";
import { GoHomeFill } from "react-icons/go";
import { MdOutlineUploadFile } from "react-icons/md";
import "../../styles/Sidebar.css";

// Componente principal Sidebar
// Recibe como props el estado actual de la página activa y la función que permite cambiarla.
const Sidebar = ({ activePage, setActivePage, onLogout }) => {
  // Estado local para controlar si la barra lateral está abierta o cerrada.
  const [isOpen, setIsOpen] = useState(false);
  const pageChangeCountRef = React.useRef(0);
  const autoCloseTimerRef = React.useRef(null);
  
  // Función que alterna entre los estados abierto/cerrado del menú lateral.
  const toggleSidebar = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    
    // Controlar backdrop
    const backdrop = document.querySelector('.sidebar-backdrop');
    
    // Actualizar clase en el documento para CSS
    if (newState) {
      document.documentElement.classList.remove('sidebar-closed');
      document.documentElement.classList.add('sidebar-open');
      if (backdrop) backdrop.classList.add('active');
    } else {
      document.documentElement.classList.remove('sidebar-open');
      document.documentElement.classList.add('sidebar-closed');
      if (backdrop) backdrop.classList.remove('active');
    }
  };

  // Función para cerrar el sidebar con animación suave
  const closeSidebar = () => {
    if (isOpen) {
      setIsOpen(false);
      const backdrop = document.querySelector('.sidebar-backdrop');
      document.documentElement.classList.remove('sidebar-open');
      document.documentElement.classList.add('sidebar-closed');
      if (backdrop) backdrop.classList.remove('active');
    }
  };

  // Efecto para auto-cerrar después de cambiar de página (después de 3 cambios)
  useEffect(() => {
    // Solo en desktop (>= 1025px)
    if (window.innerWidth >= 1025) {
      // Incrementar contador de cambios de página
      pageChangeCountRef.current += 1;
      
      // Limpiar timer anterior si existe
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
      
      // Si ha habido 3 o más cambios de página, cerrar después de un delay suave
      if (pageChangeCountRef.current >= 3) {
        autoCloseTimerRef.current = setTimeout(() => {
          closeSidebar();
          // Resetear contador después de cerrar
          pageChangeCountRef.current = 0;
        }, 600); // Delay elegante de 600ms
      }
    }
  }, [activePage]);

  // Cerrar sidebar al hacer click en backdrop
  useEffect(() => {
    const backdrop = document.querySelector('.sidebar-backdrop');
    const handleBackdropClick = () => {
      if (isOpen) {
        setIsOpen(false);
        document.documentElement.classList.remove('sidebar-open');
        document.documentElement.classList.add('sidebar-closed');
        if (backdrop) backdrop.classList.remove('active');
      }
    };
    
    if (backdrop) {
      backdrop.addEventListener('click', handleBackdropClick);
      return () => backdrop.removeEventListener('click', handleBackdropClick);
    }
  }, [isOpen]);

  // Inicializar estado del sidebar en desktop
  useEffect(() => {
    if (window.innerWidth >= 1025) {
      // En desktop, sidebar cerrado por defecto para mejor experiencia
      document.documentElement.classList.remove('sidebar-open');
      document.documentElement.classList.add('sidebar-closed');
      setIsOpen(false);
    } else {
      // En móviles, sidebar cerrado por defecto
      document.documentElement.classList.remove('sidebar-open');
      document.documentElement.classList.add('sidebar-closed');
      setIsOpen(false);
    }
    
    // Cleanup timer al desmontar
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, []);

  return (
    <div className={`sidebar ${isOpen ? "open" : "closed"}`}>
      <div className="top-section">
        {isOpen && <h2 className="logo">Portal</h2>}
        <FaBars className="toggle-btn" onClick={toggleSidebar} />
      </div>

      {/* --- Sección del menú principal --- */}
      <div className="menu">
        {/*  Opción: Inicio */}
        <div className="icon-content">
          <button className={activePage === "home" ? "active" : ""} onClick={() => setActivePage("home")}>
            <GoHomeFill size={25} />
            <span>Inicio</span>
          </button>

          {!isOpen && <span className="tooltip">Inicio</span>}
        </div>
        
        {/* Sección de opciones básicas */}
        <p className="menu-title">Básicas</p>

        {/* Opción: Pensum académico */}
        <div className="icon-content">
          <button className={activePage === "pensum" ? "active" : ""} onClick={() => setActivePage("pensum")}>
            <FaCalendarAlt size={23} />
            <span>Pensum</span>
          </button>

          {!isOpen && <span className="tooltip">Pensum</span>}
        </div>
        
        {/* Opción: Guía de matrícula */}
        <div className="icon-content">
          <button  className={activePage === "guia" ? "active" : ""} onClick={() => setActivePage("guia")}>
            <FaBookOpen /> 
            <span>Guía de matrícula</span>
          </button>
          {!isOpen && <span className="tooltip">Guía de matrícula</span>}
        </div>
        
        {/* Opción: Datos del estudiante */}
        <div className="icon-content">
          <button className={activePage === "hoja" ? "active" : ""} onClick={() => setActivePage("hoja")}>
            <FaFileAlt /> <span>Datos del estudiante</span>
          </button>
          {!isOpen && <span className="tooltip">Datos del estudiante</span>}
        </div>

        {/* Sección de opciones de matrícula */}
        <p className="menu-title">Matrícula</p>
        {/* Opción: Subir documentos */}
        <div className="icon-content">
          <button className={activePage === "Subir" ? "active" : ""} onClick={() => setActivePage("subir")}>
            <FaFileUpload /> <span>Subir documentos</span>
          </button>
          {!isOpen && <span className="tooltip">Subir documentos</span>}
        </div>

        {/* Opción: Inscribir asignaturas */}
        <div className="icon-content">
          <button className={activePage === "inscribir" ? "active" : ""} onClick={() => setActivePage("inscribir")}>
            <FaClipboardList /> <span>Inscribir asignaturas</span>
          </button>
          {!isOpen && <span className="tooltip">Inscribir asignaturas</span>}
        </div>

        {/* Opción: Modificar matrícula */}
        <div className="icon-content">
          <button className={activePage === "Modificar" ? "active" : ""} onClick={() => setActivePage("modificar")}>
            <FaEdit /> <span>Modificar matrícula</span>
          </button>
          {!isOpen && <span className="tooltip">Modificar matrícula</span>}
        </div>

        {/* Opción: Consultar matrícula */}
        <div className="icon-content">
          <button className={activePage === "Consultar" ? "active" : ""} onClick={() => setActivePage("prueba")}>
            <FaSearch /> <span>Consultar matrícula</span>
          </button>
          {!isOpen && <span className="tooltip">Consultar matrícula</span>}
        </div>

        {/* Opción: Cerrar sesión */}
        <div className="icon-content" style={{ marginTop: "auto", paddingTop: "20px" }}>
          <button 
            onClick={onLogout}
            style={{ 
              color: "#dc3545",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              width: "100%",
              padding: "10px"
            }}
          >
            <FaSignOutAlt size={23} />
            <span>Cerrar Sesión</span>
          </button>
          {!isOpen && <span className="tooltip">Cerrar Sesión</span>}
        </div>

      </div>
    </div>
  );
};

export default Sidebar;
