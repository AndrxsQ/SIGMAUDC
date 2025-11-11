import React, { useState } from "react";
import Sidebar from "./components/Sidebar";
import Home from "./pages/Home";
import HojaDeVida from "./components/HojaDeVida";
import Subir from "./components/Subir";
import PensumVisual from "./components/PensumVisual";
import Login from "./components/Login";


function App() {
  const [activePage, setActivePage] = useState("home");

  return (
    <div style={{ display: "flex", height: "100vh", background: "#e2e8f0"}}>
      {/* Le pasamos activePage y setActivePage al Sidebar */}
      <Sidebar activePage={activePage} setActivePage={setActivePage} />

      <div style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
        {activePage === "subir" && <Subir />}
        {activePage === "home" && <Home />}
        {activePage === "hoja" && <HojaDeVida />}
        {activePage === "pensul" && <PensumVisual />}
        {activePage === "login" && <Login />}
        {/* agrega más componentes según activePage */}
      </div>
    </div>
  );
}

export default App;
