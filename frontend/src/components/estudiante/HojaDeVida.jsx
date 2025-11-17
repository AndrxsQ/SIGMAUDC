/**
 * Componente: HojaDeVida
 * -----------------------------------------------------------
 * Este componente muestra la información básica del estudiante
 * en una tarjeta visual (hoja de vida académica).
 * 
 * Funcionalidades actuales:
 *  - Muestra datos simulados del estudiante (sin conexión a backend).
 *  - Permite visualizar el componente <PensumVisual /> dentro de un modal.
 * 
 * Futuro con backend:
 *  - Los datos del estudiante se obtendrán dinámicamente desde una API REST
 *    o servicio backend (por ejemplo, con fetch o axios).
 *  - Se podrá autenticar al usuario y cargar su información real.
 *  - El Pensum y otros apartados podrán generarse según el historial académico.
 */

import React, { useState } from "react";
import PensumVisual from "./PensumVisual";
import "../../styles/HojaDeVida.css";
import {FaCalendarAlt
} from "react-icons/fa";

const HojaDeVida = () => {
  // Estado para controlar las pestañas (futuro uso con más secciones)
  const [activeTab, setActiveTab] = useState("basicos");

  // Estado para mostrar/ocultar el modal del Pensum
  const [mostrarPensum, setMostrarPensum] = useState(false); // controla la ventana

 /* 
    🔹 Datos simulados del estudiante:
    En una versión con backend, estos datos se obtendrán dinámicamente
    desde una API o base de datos mediante una petición fetch/axios.
  */
  const estudiante = {
    periodo: "2025-2",
    estado: "Normal",
    codigo: "202012345",
    identificacion: "1234567890",
    sexo: "Masculino",
    apellidos: "Calderón Kelsey",
    nombres: "Gustavo Enrique",
    correo: "gustavo.calderon@unicartagena.edu.co",
    programa: "Ingeniería de Sistemas",
    semestre: "06",
    avatar: "https://randomuser.me/api/portraits/lego/1.jpg",
  };

  return (

    <div className="hoja-container">
      <div className="card">
        {/* Imagen superior decorativa */}
        <div className="card__img"></div>

        {/* Foto de perfil del estudiante */}
        <div className="card__avatar">
          <img src={estudiante.avatar} alt="Avatar de usuario" />
        </div>

        {/* Contenido principal de la hoja de vida */}
        <div className="card__body">
          <h3 className="card__title">
            {estudiante.nombres} {estudiante.apellidos}
          </h3>
          <p className="card__subtitle">{estudiante.programa}</p>

          {/* Información académica básica */}
          <div className="card__info">
            <div><h2>Periodo actual:</h2><p>{estudiante.periodo}</p></div>
            <div><h2>Académico:</h2><p>{estudiante.estado}</p></div>
            <div><h2>Código:</h2><p>{estudiante.codigo}</p></div>
            <div><h2>Sexo:</h2><p>{estudiante.sexo}</p></div>
            <div><h2>Semestre:</h2><p>{estudiante.semestre}</p></div>
            <div><h2>Correo:</h2><p>{estudiante.correo}</p></div>
          </div>

          {/* Botón que abre la ventana modal del Pensum */}
          <button
            className="btn-ver-pensum"
            onClick={() => setMostrarPensum(true)}
          >
            <FaCalendarAlt/>
          </button>
        </div>

      {/* Modal que muestra el componente del Pensum */}
      {mostrarPensum && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setMostrarPensum(false)}>
              ✖
            </button>
            <PensumVisual />
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default HojaDeVida;
