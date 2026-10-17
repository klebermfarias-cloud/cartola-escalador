import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { CartolaApp } from "./components/cartola/CartolaApp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CartolaApp />
  </StrictMode>,
);
