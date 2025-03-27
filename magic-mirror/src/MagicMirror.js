// src/MagicMirror.js
import React, { useState, useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import Curtains from '../components/Curtains';
import Mirror from '../components/Mirror';

const MagicMirror = () => {
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [displayedTranscript, setDisplayedTranscript] = useState('');
  const [displayedResponse, setDisplayedResponse] = useState('');

  const headerRef = useRef(null);

  // Set up Speech Recognition API.
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = SpeechRecognition ? new SpeechRecognition() : null;

  // Function to "stream" the spoken response in sync with text appearance.
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

  // Function to trigger the pixie dust animation using GSAP.
  const triggerPixieDust = () => {
    gsap.utils.toArray(".pixie").forEach((pixie, i) => {
      gsap.fromTo(pixie, 
        { opacity: 1, scale: 0, x: 0, y: 0 },
        { 
          opacity: 0, 
          scale: 1.5, 
          x: (Math.random() - 0.5) * 100, 
          y: (Math.random() - 0.5) * 100, 
          duration: 1, 
          ease: "power2.out", 
          delay: i * 0.1 
        }
      );
    });
  };

  // Handle speech recognition and generate a response.
  const startListening = () => {
    if (!recognition) {
      alert("Speech Recognition API is not supported in your browser.");
      return;
    }
    recognition.start();
    recognition.onresult = (event) => {
      const spokenText = event.results[0][0].transcript;
      setTranscript(spokenText);
      setDisplayedTranscript(spokenText);
      // Simulate processing delay.
      setTimeout(() => {
        let generatedResponse;
        if (spokenText.toLowerCase().includes("mirror on the wall")) {
          generatedResponse = "You're the fairest of them all... but don't let it go to your head!";
        } else {
          generatedResponse = "I only answer magic mirror questions!";
        }
        setResponse(generatedResponse);
        setDisplayedResponse('');
        streamSpeakResponse(generatedResponse);
        triggerPixieDust();
      }, 2000);
    };
  };

  // Animate the header on mount.
  useEffect(() => {
    gsap.from(headerRef.current, { opacity: 0, duration: 2, y: -50, delay: 2 });
  }, []);

  return (
    <div style={{ position: 'relative', textAlign: 'center', marginTop: '20px', overflow: 'hidden' }}>
      {/* Curtains overlay */}
      <Curtains />
      <h1 ref={headerRef}>Snow White Magic Mirror</h1>
      <Mirror />
      <button onClick={startListening}>Ask the Mirror</button>
      <p><strong>You said:</strong> {displayedTranscript}</p>
      <p><strong>Mirror replies:</strong> {displayedResponse}</p>
    </div>
  );
};

export default MagicMirror;
