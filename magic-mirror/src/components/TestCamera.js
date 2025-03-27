// TestCamera.js
import React, { useRef, useEffect } from 'react';

const TestCamera = () => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          console.log("Camera stream acquired:", stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(err => {
          console.error("Error accessing camera:", err);
        });
    } else {
      console.error("getUserMedia not supported in this browser");
    }
  }, []);

  return (
    <div style={{ textAlign: 'center', marginTop: '20px' }}>
      <h2>Test Camera</h2>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ width: '400px', border: '2px solid black' }}
      />
    </div>
  );
};

export default TestCamera;
