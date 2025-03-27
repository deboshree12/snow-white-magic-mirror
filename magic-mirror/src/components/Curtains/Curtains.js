// src/components/Curtains.js
import React, { useEffect } from 'react';
import { gsap } from 'gsap';
import './Curtains.css';

const Curtains = () => {
  useEffect(() => {
    // Animate the curtains off-screen.
    gsap.to(".curtain.left", { x: "-100%", duration: 2, ease: "power2.out" });
    gsap.to(".curtain.right", { x: "100%", duration: 2, ease: "power2.out" });
    // Disable pointer events and hide the curtains after animation.
    gsap.to(".curtains", { duration: 0, pointerEvents: "none", delay: 2 });
    gsap.to(".curtains", { duration: 0, css: { display: "none" }, delay: 2.1 });
  }, []);

  return (
    <div className="curtains" style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: 10
    }}>
      <div className="curtain left"></div>
      <div className="curtain right"></div>
    </div>
  );
};

export default Curtains;
