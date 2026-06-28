'use client';
import { useState, useEffect, useRef } from 'react';

export default function AudioCalibrator({ onJump }) {
  const [volume, setVolume] = useState(0);
  const [threshold, setThreshold] = useState(35);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  // Aquí declaramos explícitamente streamRef para solucionar el error de la captura
  const streamRef = useRef(null); 
  const jorobaAntiBucle = useRef(false);

  useEffect(() => {
    async function iniciarMicrofono() {
      try {
        // Pedir permiso para usar el hardware nativo (Micrófono)
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        streamRef.current = stream;

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const procesarAudio = () => {
          if (!analyserRef.current || (audioContextRef.current && audioContextRef.current.state === 'closed')) return;

          analyserRef.current.getByteFrequencyData(dataArray);
          
          // Calcular el promedio del volumen de entrada
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const promedioVolumen = sum / dataArray.length;
          
          // Mapeamos a una escala de 0 a 100
          const volumenNormalizado = Math.min((promedioVolumen / 128) * 100, 100);
          setVolume(volumenNormalizado);

          // Verificar si supera la sensibilidad configurada
          if (volumenNormalizado > threshold) {
            if (!jorobaAntiBucle.current) {
              onJump(); // ¡Activa el salto en el canvas!
              jorobaAntiBucle.current = true;
              // Tiempo de espera para evitar registrar múltiples saltos en un solo grito
              setTimeout(() => { jorobaAntiBucle.current = false; }, 400);
            }
          }

          requestAnimationFrame(procesarAudio);
        };

        procesarAudio();
      } catch (err) {
        console.error("Error al acceder al micrófono:", err);
      }
    }

    iniciarMicrofono();

    // --- FUNCIÓN DE LIMPIEZA BLINDADA Y PROTEGIDA ---
    return () => {
      if (audioContextRef.current) {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close()
            .catch(err => console.log("El contexto ya estaba cerrado:", err));
        }
      }
      // Ahora streamRef existe de forma segura y apagará el micrófono correctamente
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [threshold, onJump]);

  return (
    <div style={{ padding: '15px', background: '#2d3748', color: 'white', borderRadius: '8px', border: '1px solid #4a5568' }}>
      <h4 style={{ margin: '0 0 10px 0', color: '#ecc94b' }}>🎙️ Calibración de Voz</h4>
      <div style={{ marginBottom: '8px' }}>
        Volumen Actual: <progress value={volume} max="100" style={{ width: '60%', marginRight: '10px' }} /> {Math.round(volume)}
      </div>
      <div>
        Sensibilidad (Umbral): 
        <input 
          type="range" 
          min="10" 
          max="100" 
          value={threshold} 
          onChange={(e) => setThreshold(Number(e.target.value))} 
          style={{ cursor: 'pointer', verticalAlign: 'middle', marginRight: '10px' }}
        /> {threshold}
      </div>
    </div>
  );
}
