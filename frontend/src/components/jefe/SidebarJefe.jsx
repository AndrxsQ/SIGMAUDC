import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import {
  FaBars,
  FaSignOutAlt,
  FaCalendarAlt,
  FaClipboardCheck,
  FaSearch,
  FaBook,
  FaUser
} from "react-icons/fa";
import { GoHomeFill } from "react-icons/go";
import "../../styles/Sidebar.css";

const SidebarJefe = forwardRef(({ activePage, setActivePage, onLogout }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const pageChangeCountRef = React.useRef(0);
  const autoCloseTimerRef = React.useRef(null);
  
  // Exponer métodos al componente padre (para sincronización con botón hamburguesa)
  useImperativeHandle(ref, () => ({
    toggle: () => {
      toggleSidebar();
    },
    close: () => {
      closeSidebar();
    },
    isOpen: () => isOpen
  }));
  
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
    } else {
      // En móviles, cerrar automáticamente al cambiar de página
      if (isOpen) {
        closeSidebar();
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

  // Inicializar estado del sidebar y manejar resize
  useEffect(() => {
    const handleResize = () => {
      const sidebar = document.querySelector('.sidebar');
      if (!sidebar) return;
      
      if (window.innerWidth >= 1025) {
        // En desktop, mantener estado actual pero asegurar que backdrop esté oculto
        const backdrop = document.querySelector('.sidebar-backdrop');
        if (backdrop) backdrop.classList.remove('active');
      } else {
        // En móviles, asegurar que sidebar esté cerrado si se cambia de tamaño
        // Leer estado actual del DOM en lugar de depender de la captura de isOpen
        if (sidebar.classList.contains('open')) {
          setIsOpen(false);
          document.documentElement.classList.remove('sidebar-open');
          document.documentElement.classList.add('sidebar-closed');
          const backdrop = document.querySelector('.sidebar-backdrop');
          if (backdrop) backdrop.classList.remove('active');
        }
      }
    };
    
    // Configurar estado inicial
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
    
    // Agregar listener para resize
    window.addEventListener('resize', handleResize);
    
    // Cleanup timer y listener al desmontar
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
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

        {/* Opción: Validar Documentos */}
        <div className="icon-content">
          <button 
            className={activePage === "verificar-documentos" ? "active" : ""} 
            onClick={() => setActivePage("verificar-documentos")}
          >
            <FaClipboardCheck size={23} />
            <span>Validar Documentos</span>
          </button>
          {!isOpen && <span className="tooltip">Validar Documentos</span>}
        </div>

        {/* Opción: Validar Solicitudes */}
        <div className="icon-content">
          <button 
            className={activePage === "validar-solicitudes" ? "active" : ""} 
            onClick={() => setActivePage("validar-solicitudes")}
          >
            <FaClipboardCheck size={23} />
            <span>Validar Solicitudes</span>
          </button>
          {!isOpen && <span className="tooltip">Validar Solicitudes</span>}
        </div>

        {/* Opción: Consultar Estudiante */}
        <div className="icon-content">
          <button 
            className={activePage === "modificaciones" ? "active" : ""} 
            onClick={() => setActivePage("modificaciones")}
          >
            <FaSearch size={23} />
            <span>Consultar Matrícula</span>
          </button>
          {!isOpen && <span className="tooltip">Consultar Matrícula</span>}
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
});

SidebarJefe.displayName = 'SidebarJefe';

export default SidebarJefe;

