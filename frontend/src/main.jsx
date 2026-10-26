import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App.jsx";
import { ProveedorAutenticacion } from "./auth/ProveedorAutenticacion.jsx";
import "./estilos.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ProveedorAutenticacion>
        <App />
      </ProveedorAutenticacion>
    </BrowserRouter>
  </React.StrictMode>,
);
