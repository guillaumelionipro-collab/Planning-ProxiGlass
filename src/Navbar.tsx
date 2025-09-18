import React, { useState } from "react";
import "./index.css"; // pour les styles de la navbar

function Navbar() {
  const [open, setOpen] = useState(false);

  const onNavigate = () => setOpen(false);

  return (
    <nav className="nav">
      <div className="nav-inner">
        <div className="brand">MonSite</div>

        {/* Bouton burger (visible sur mobile) */}
        <button
          className="burger"
          aria-label="Ouvrir le menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span className="bar" />
          <span className="bar" />
          <span className="bar" />
        </button>

        {/* Liens desktop */}
        <ul className="links">
          <li><a href="#accueil">Accueil</a></li>
          <li><a href="#services">Services</a></li>
          <li><a href="#tarifs">Tarifs</a></li>
          <li><a href="#contact" className="btn">Contact</a></li>
        </ul>
      </div>

      {/* Menu mobile */}
      <div className={`mobile-menu ${open ? "open" : ""}`}>
        <a onClick={onNavigate} href="#accueil">Accueil</a>
        <a onClick={onNavigate} href="#services">Services</a>
        <a onClick={onNavigate} href="#tarifs">Tarifs</a>
        <a onClick={onNavigate} href="#contact" className="btn">Contact</a>
      </div>
    </nav>
  );
}

export default Navbar;
