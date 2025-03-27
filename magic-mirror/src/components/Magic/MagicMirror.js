// src/components/MagicMirror/MagicMirror.js
import React, { useState, useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import Curtains from '../Curtains/Curtains';
import Mirror from '../Mirror/Mirror';
import './MagicMirror.css';
import { loadModel, captureAndProcess } from './modelProcessing';

const MagicMirror = () => {
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [displayedTranscript, setDisplayedTranscript] = useState('');
  const [displayedResponse, setDisplayedResponse] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [model, setModel] = useState(null);
  const headerRef = useRef(null);
  const mirrorVideoRef = useRef(null); // Optionally, pass a ref to Mirror component if needed
  
  // NEW FUNCTION: Capture video frame and send to backend.
  const sendFrameToBackend = async () => {
    if (!mirrorVideoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = mirrorVideoRef.current.videoWidth;
    canvas.height = mirrorVideoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(mirrorVideoRef.current, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async (blob) => {
      if (blob) {
        const formData = new FormData();
        formData.append("file", blob, "frame.jpg");
        try {
          const response = await fetch("http://localhost:8000/inference", {
            method: "POST",
            body: formData,
          });
          const data = await response.json();
          console.log("Backend response:", data.response);
          setResponse(data.response);
          streamSpeakResponse(data.response);
        } catch (err) {
          console.error("Error sending frame:", err);
        }
      }
    }, "image/jpeg");
  };

  // Load the model on component mount.
  useEffect(() => {
    const loadMyModel = async () => {
      const m = await loadModel();
      setModel(m);
    };
    loadMyModel();
  }, []);

  // Function to stream the spoken response.
  const streamSpeakResponse = (text) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.onboundary = (event) => {
        setDisplayedResponse(text.substring(0, event.charIndex + event.charLength));
      };
      window.speechSynthesis.speak(utterance);
    }
  };

  const triggerLocalPixieDust = () => {
    gsap.utils.toArray(".pixie").forEach((pixie, i) => {
      gsap.fromTo(
        pixie,
        { opacity: 1, scale: 0, x: 0, y: 0 },
        { opacity: 0, scale: 1.5, x: (Math.random() - 0.5) * 150, y: (Math.random() - 0.5) * 150, duration: 1.5, ease: "power2.out", delay: i * 0.1 }
      );
    });
  };

  const triggerGlobalPixieDust = () => {
    gsap.utils.toArray(".global-pixie").forEach((pixie, i) => {
      gsap.fromTo(
        pixie,
        { opacity: 1, scale: 0, x: 0, y: 0 },
        { 
          opacity: 0, 
          scale: 2.5,
          x: (Math.random() - 0.5) * 500,
          y: (Math.random() - 0.5) * 500,
          duration: 2.5,
          ease: "power2.out",
          delay: i * 0.03
        }
      );
    });
  };

  // Handle speech recognition.
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech Recognition API is not supported in your browser.");
      return;
    }
    setIsListening(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = async (event) => {
      const spokenText = event.results[0][0].transcript;
      setTranscript(spokenText);
      setDisplayedTranscript(spokenText);
      // Simulate processing delay.
      setTimeout(async () => {
        let generatedResponse;
        if (spokenText.toLowerCase().includes("mirror on the wall")) {
          // Instead of local processing, send the frame to the backend.
          await sendFrameToBackend();
          // sendFrameToBackend() will update response state and trigger speech synthesis.
        } else {
          generatedResponse = "I only answer magic mirror questions!";
          setResponse(generatedResponse);
          setDisplayedResponse('');
          setIsListening(false);
          streamSpeakResponse(generatedResponse);
        }
        triggerLocalPixieDust();
        triggerGlobalPixieDust();
      }, 2000);
    };
    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event);
      setIsListening(false);
    };
    recognition.start();
  };

  useEffect(() => {
    gsap.from(headerRef.current, { opacity: 0, duration: 2, y: -50, delay: 2 });
  }, []);

  return (
    <div className="magic-mirror-container">
      <Curtains />
      <h1 ref={headerRef}>Snow White Magic Mirror</h1>
      <Mirror videoRefProp={mirrorVideoRef} />
      <button className={isListening ? "ask-button listening" : "ask-button"} onClick={startListening}>
        Ask the Mirror
      </button>
      <p><strong>You said:</strong> {displayedTranscript}</p>
      <p><strong>Mirror replies:</strong> {displayedResponse}</p>
      <div className="global-pixie-dust">
        {Array.from({ length: 50 }).map((_, i) => (
          <span key={i} className="global-pixie"></span>
        ))}
      </div>
    </div>
  );
};

export default MagicMirror;
