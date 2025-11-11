import React, { useState } from "react";
import { Container, Button } from "react-bootstrap";
import { Link } from "react-router-dom";
import "../styles/Login.css";

// ===============================
// 🧩 COMPONENTE: Login
// ===============================
// Este componente representa el formulario de inicio de sesión del sistema SIGMA.
// Actualmente no se conecta con ningún backend. 
// Los campos "Código" y "Password" son puramente de ejemplo visual.



const Login = () => {
  return (
    <div className="Contenedor">
    {/* Formulario principal de login */}
    <form className="form">
      <p className="title">SIGMA</p>

      {/* Campo para ingresar el código del usuario */}
      <label>
        <input required placeholder="" type="codigo" className="input" />
        <span>Codigo</span>
      </label>

      {/* Campo para ingresar la contraseña */}
      <label>
        <input required placeholder="" type="password" className="input" />
        <span>Password</span>
      </label>

      <button className="submit">Submit</button>
    </form>
    </div>
  );
};

export default Login;
