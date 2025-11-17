import React from "react";
import "../../styles/PensumVisual.css"; // archivo de estilos
import { FaCalendarAlt } from "react-icons/fa";

// ==========================================================
// DATOS SIMULADOS 
// ==========================================================
// Por ahora, los datos del pénsum se encuentran definidos localmente
// mientras no se implementa la conexión al backend.
// Cuando se integre el servidor, se obtendra
// semestres y materias del programa académico real.

const pensumData = {
  carrera: "Ingeniería de Sistemas",
  año: 2022,
  semestres: [
    {
      numero: 1,
      materias: [
        { codigo: "FB1102", nombre: "Cálculo Diferencial", creditos: 3.5 },
        { codigo: "FB1103", nombre: "Fundamentos de Física", creditos: 3.0 },
        { codigo: "FP0414", nombre: "Introducción a la Programación", creditos: 4.0 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
      ],
    },
    {
      numero: 2,
      materias: [
        { codigo: "FB1104", nombre: "Cálculo Integral", creditos: 3.6 },
        { codigo: "FB1105", nombre: "Álgebra Lineal", creditos: 3.5 },
        { codigo: "FP0415", nombre: "Física Mecánica", creditos: 4.0 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
      ],
    },
    {
      numero: 3,
      materias: [
        { codigo: "FB1108", nombre: "Cálculo Vectorial", creditos: 3.5 },
        { codigo: "FP0416", nombre: "Electromagnetismo", creditos: 4.0 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
      ],
    },
    {
      numero: 4,
      materias: [
        { codigo: "FB1108", nombre: "Cálculo Vectorial", creditos: 3.5 },
        { codigo: "FP0416", nombre: "Electromagnetismo", creditos: 4.0 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
      ],
    },
    {
      numero: 5,
      materias: [
        { codigo: "FB1108", nombre: "Cálculo Vectorial", creditos: 3.5 },
        { codigo: "FP0416", nombre: "Electromagnetismo", creditos: 4.0 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
      ],
    },
    {
      numero: 6,
      materias: [
        { codigo: "FB1108", nombre: "Cálculo Vectorial", creditos: 3.5 },
        { codigo: "FP0416", nombre: "Electromagnetismo", creditos: 4.0 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
      ],
    },
    {
      numero: 7,
      materias: [
        { codigo: "FB1108", nombre: "Cálculo Vectorial", creditos: 3.5 },
        { codigo: "FP0416", nombre: "Electromagnetismo", creditos: 4.0 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
      ],
    },
    {
      numero: 8,
      materias: [
        { codigo: "FB1108", nombre: "Cálculo Vectorial", creditos: 3.5 },
        { codigo: "FP0416", nombre: "Electromagnetismo", creditos: 4.0 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
      ],
    },
    {
      numero: 9,
      materias: [
        { codigo: "FB1108", nombre: "Cálculo Vectorial", creditos: 3.5 },
        { codigo: "FP0416", nombre: "Electromagnetismo", creditos: 4.0 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
      ],
    },
    {
      numero: 10,
      materias: [
        { codigo: "FB1108", nombre: "Cálculo Vectorial", creditos: 3.5 },
        { codigo: "FP0416", nombre: "Electromagnetismo", creditos: 4.0 },
        { codigo: "IA1014", nombre: "Programación Avanzada", creditos: 3.5 },
      ],
    },
  ],
};

// ==========================================================
//  COMPONENTE PRINCIPAL: PensumVisual
// ==========================================================
// Este componente muestra de forma visual y organizada la estructura del pénsum
// de un programa académico. Utiliza los datos definidos anteriormente
// para construir columnas por semestre y tarjetas por materia.

const PensumVisual = () => {
  return (
    <div className="pensum-container">
      
      {/*  Encabezado con ícono y título del programa */}
      <div className="modal-header">
                <div className="modal-logo">
                  <span className="logo-circle">
                    <FaCalendarAlt size={20} />
                  </span>
                </div>
                <h3>Pénsum - {pensumData.carrera} ({pensumData.año})</h3>
      </div>

      {/*  Sección principal: cuadrícula con los semestres */}
      <div className="pensum-grid">
        {pensumData.semestres.map((semestre) => (
          <div key={semestre.numero} className="semestre-column">
            <h3 className="semestre-title">Mod: {semestre.numero}</h3>

            {/*  Lista de materias dentro del semestre */}
            <div className="materias-list">
              {semestre.materias.map((materia, index) => (
                <div key={`${semestre.numero}-${materia.codigo}-${index}`} className="materia-card">
                  <div className="materia-nombre">{materia.nombre}</div>
                  <div className="materia-info">
                    <span>{materia.codigo}</span>
                    <span>{materia.creditos}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Informacion para el usuario */}
    <div className="pensum-legend">
        <div className="legend-item activa">Activa</div>
        <div className="legend-item matriculada">Matriculada</div>
        <div className="legend-item cursada">Cursada</div>
        <div className="legend-item descripcion">
        <strong>ASIGNATURA</strong><br />
        <small>Código | Crd | Nota</small>
        </div>
    </div>
    </div>
  );
};

export default PensumVisual;