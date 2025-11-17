import React, { useState } from "react";
import { Container, Button } from "react-bootstrap";
import { Link } from "react-router-dom";
import "../../styles/Home.css";

const LandingSection = () => {
  return (
    <div className="landing">
      <div className="landing__text">
        <h1>SIGMA</h1>
        <h2>Plataforma Estudiantil</h2>
        <p>
          Accede fácilmente a tus datos académicos, historial, asignaturas y
          notas. SIGMA es tu espacio digital dentro de la universidad,
          diseñado para hacer tu vida estudiantil más simple.
        </p>
        <button className="landing__btn">Leer más</button>
      </div>

    </div>
  );
};

export default LandingSection;