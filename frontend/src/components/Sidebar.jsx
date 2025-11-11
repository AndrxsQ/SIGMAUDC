/**
* Barra lateral de navegación (Sidebar)
* Este componente maneja la navegación principal del sistema SIGMA,
* permitiendo acceder a las diferentes funciones del proceso de matrícula.
* Incluye banderas de activación visual (botones activos) y modo colapsable.
*/

import React, { useState } from "react";
// Importación de íconos desde react-icons (representan cada opción del menú)
import {
  FaBars,
  FaUserEdit,
  FaBookOpen,
  FaClipboardList,
  FaEdit,
  FaSearch,
  FaFileAlt,
  FaChartBar,
  FaCalendarAlt
} from "react-icons/fa";
import { FaFileUpload } from "react-icons/fa";
import { GoHomeFill } from "react-icons/go";
import { MdOutlineUploadFile } from "react-icons/md";
import "../styles/Sidebar.css";

// Componente principal Sidebar
// Recibe como props el estado actual de la página activa y la función que permite cambiarla.
const Sidebar = ({ activePage, setActivePage }) => {
  // Estado local para controlar si la barra lateral está abierta o cerrada.
  const [isOpen, setIsOpen] = useState(false);
  // Función que alterna entre los estados abierto/cerrado del menú lateral.
  const toggleSidebar = () => setIsOpen(!isOpen);


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

        {/* Opción: Pensul académico */}
        <div className="icon-content">
          <button className={activePage === "pensul" ? "active" : ""} onClick={() => setActivePage("pensul")}>
            <FaCalendarAlt size={23} />
            <span>Pensul</span>
          </button>

          {!isOpen && <span className="tooltip">Pensul</span>}
        </div>
        
        {/* Opción: Actualizar datos del estudiante */}
        <div className="icon-content">
          <button className={activePage === "actualizar" ? "active" : ""} onClick={() => setActivePage("actualizar")}>
            <FaUserEdit />
            <span>Actualizar datos</span>
          </button>

          {!isOpen && <span className="tooltip">Actualizar datos</span>}
        </div>

        {/* Opción: Guía de matrícula */}
        <div className="icon-content">
          <button  className={activePage === "guia" ? "active" : ""} onClick={() => setActivePage("guia")}>
            <FaBookOpen /> 
            <span>Guía de matrícula</span>
          </button>
          {!isOpen && <span className="tooltip">Guía de matrícula</span>}
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
          <button className={activePage === "Inscribir" ? "active" : ""} onClick={() => setActivePage("inscribir")}>
            <FaClipboardList /> <span>Inscribir asignaturas</span>
          </button>
          {!isOpen && <span className="tooltip">Incribir asignaturas</span>}
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

        {/* Sección de consulta adicional */}
        <p className="menu-title">Consultar</p>

        {/* Opción: Hoja de vida académica */}
        <div className="icon-content">
        <button className={activePage === "Hoja" ? "active" : ""} onClick={() => setActivePage("hoja")}>
          <FaFileAlt /> <span>Hoja de vida</span>
        </button>
        {!isOpen && <span className="tooltip">Hoja de vida</span>}
        </div>

        {/* Opción: Login (gestión de acceso: mara que vean el login) */}
        <div className="icon-content">
          <button className={activePage === "login" ? "active" : ""} onClick={() => setActivePage("login")}>
            <FaChartBar /> <span>Login</span>
          </button>
          {!isOpen && <span className="tooltip">Login</span>}
        </div>

      </div>
    </div>
  );
};

export default Sidebar;
