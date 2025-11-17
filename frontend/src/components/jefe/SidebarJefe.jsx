import React, { useState, useEffect } from "react";
import {
  FaBars,
  FaSignOutAlt,
  FaCalendarAlt,
  FaClipboardCheck,
  FaEdit,
  FaBook,
  FaUser
} from "react-icons/fa";
import { GoHomeFill } from "react-icons/go";
import "../../styles/Sidebar.css";

const SidebarJefe = ({ activePage, setActivePage, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const toggleSidebar = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    
    // Controlar backdrop
    const backdrop = document.querySelector('.sidebar-backdrop');
    const sidebar = document.querySelector('.sidebar');
    
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
    const sidebar = document.querySelector('.sidebar');
    if (window.innerWidth >= 1025) {
      // En desktop, sidebar abierto por defecto
      document.documentElement.classList.remove('sidebar-closed');
      document.documentElement.classList.add('sidebar-open');
      setIsOpen(true);
    } else {
      // En móviles, sidebar cerrado por defecto
      document.documentElement.classList.remove('sidebar-open');
      document.documentElement.classList.add('sidebar-closed');
      setIsOpen(false);
    }
  }, []);

  return (
    <div className={`sidebar ${isOpen ? "open" : "closed"}`}>
      <div className="top-section">
        {isOpen && <h2 className="logo">Portal Jefatura</h2>}
        <FaBars className="toggle-btn" onClick={toggleSidebar} />
      </div>

      <div className="menu">
        {/* Opción: Inicio */}
        <div className="icon-content">
          <button 
            className={activePage === "home" ? "active" : ""} 
            onClick={() => setActivePage("home")}
          >
            <GoHomeFill size={25} />
            <span>Inicio</span>
          </button>
          {!isOpen && <span className="tooltip">Inicio</span>}
        </div>

        {/* Sección: Administración */}
        <p className="menu-title">Administración</p>

        {/* Opción: Administración de Plazos */}
        <div className="icon-content">
          <button 
            className={activePage === "plazos" ? "active" : ""} 
            onClick={() => setActivePage("plazos")}
          >
            <FaCalendarAlt size={23} />
            <span>Administración de Plazos</span>
          </button>
          {!isOpen && <span className="tooltip">Administración de Plazos</span>}
        </div>

        {/* Opción: Verificar Documentos */}
        <div className="icon-content">
          <button 
            className={activePage === "verificar-documentos" ? "active" : ""} 
            onClick={() => setActivePage("verificar-documentos")}
          >
            <FaClipboardCheck size={23} />
            <span>Verificar Documentos</span>
          </button>
          {!isOpen && <span className="tooltip">Verificar Documentos</span>}
        </div>

        {/* Opción: Modificaciones */}
        <div className="icon-content">
          <button 
            className={activePage === "modificaciones" ? "active" : ""} 
            onClick={() => setActivePage("modificaciones")}
          >
            <FaEdit size={23} />
            <span>Modificaciones</span>
          </button>
          {!isOpen && <span className="tooltip">Modificaciones</span>}
        </div>

        {/* Opción: Modificar Plan de Estudio */}
        <div className="icon-content">
          <button 
            className={activePage === "plan-estudio" ? "active" : ""} 
            onClick={() => setActivePage("plan-estudio")}
          >
            <FaBook size={23} />
            <span>Modificar Plan de Estudio</span>
          </button>
          {!isOpen && <span className="tooltip">Modificar Plan de Estudio</span>}
        </div>

        {/* Sección: Perfil */}
        <p className="menu-title">Perfil</p>

        {/* Opción: Mi Información */}
        <div className="icon-content">
          <button 
            className={activePage === "perfil" ? "active" : ""} 
            onClick={() => setActivePage("perfil")}
          >
            <FaUser size={23} />
            <span>Mi Información</span>
          </button>
          {!isOpen && <span className="tooltip">Mi Información</span>}
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

export default SidebarJefe;

