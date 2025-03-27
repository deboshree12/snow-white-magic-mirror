// src/components/Mirror/Mirror.js
import React, { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import './Mirror.css';

const Mirror = ({ videoRefProp }) => {
  const mirrorRef = useRef(null);
  const localVideoRef = useRef(null);

  // Pass the ref from parent if provided, otherwise use our own.
  const videoRef = videoRefProp || localVideoRef;

  useEffect(() => {
    // Stop previous stream if any.
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    // Request camera access.
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.error("Error accessing camera:", err);
        });
    }
    // Animate mirror container.
    gsap.fromTo(
      mirrorRef.current,
      { opacity: 0, scale: 0.8, rotation: 0, scaleX: -0.8 },
      { opacity: 1, scale: 1, rotation: 0, scaleX: -1, duration: 2, delay: 2.5, ease: "elastic.out(1, 0.5)" }
    );
    gsap.to(mirrorRef.current, {
      boxShadow: '0px 0px 20px 5px rgba(255,255,255,0.8)',
      repeat: -1,
      yoyo: true,
      duration: 1.5,
      ease: "power1.inOut"
    });
  }, [videoRef]);

  return (
    <div ref={mirrorRef} className="mirror-container">
      <video ref={videoRef} autoPlay muted playsInline className="mirror-video" />
      <div className="pixieDust">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className="pixie" style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`
          }}></span>
        ))}
      </div>
    </div>
  );
};

export default Mirror;
