'use client';
import { useState, useEffect, useRef } from 'react';

export default function AudioCalibrator({ onJump }) {
  const [volume, setVolume] = useState(0);
  const [threshold, setThreshold] = useState(35);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null); 
  // 🎤 Detección por "flanco de subida": en vez de un cooldown fijo (que hacía
  // que el segundo grito llegara demasiado tarde, cuando el personaje ya había
  // aterrizado, perdiendo la ventana del doble salto), ahora se dispara un salto
  // apenas el volumen CRUZA el umbral hacia arriba, y no vuelve a disparar hasta
  // que el volumen baje del umbral otra vez. Así, dos gritos rápidos y seguidos
  // ("¡AH! ¡AH!") se detectan como dos saltos distintos aunque estén muy juntos.
  const yaSuperoUmbralRef = useRef(false);
  const ultimoSaltoTsRef = useRef(0);

  useEffect(() => {
    // 🛡️ Bandera anti-carrera: en desarrollo, React (Strict Mode) monta, desmonta
    // y vuelve a montar este efecto una vez para detectar bugs. Como getUserMedia
    // es asíncrono, si el desmontaje ocurre justo mientras el mic está iniciando,
    // sin esta bandera el código seguiría configurando el micrófono/AudioContext
    // "viejo" DESPUÉS de que el componente ya se limpió, dejando un contexto de
    // audio roto/huérfano que nunca detecta volumen (por eso nunca salta).
    let cancelado = false;
    let rafId = null;

    async function iniciarMicrofono() {
      try {
        // Pedir permiso para usar el hardware nativo (Micrófono)
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

        if (cancelado) {
          // El efecto ya se limpió mientras esperábamos el permiso: apagamos
          // este stream recién obtenido y no seguimos configurando nada más.
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;

        // 🔊 Algunos navegadores crean el AudioContext en estado "suspended"
        // hasta que detectan una interacción del usuario. Sin este resume(),
        // el analyser nunca procesa audio real y el volumen se queda en 0,
        // por lo que el salto por voz jamás se dispara aunque el mic funcione.
        if (audioContext.state === 'suspended') {
          await audioContext.resume().catch(() => {});
        }

        if (cancelado) return;

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const procesarAudio = () => {
          if (cancelado || !analyserRef.current || (audioContextRef.current && audioContextRef.current.state === 'closed')) {
            return;
          }

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

          // Disparar SOLO en el instante en que el volumen cruza el umbral hacia
          // arriba (flanco de subida). Mientras se mantenga por encima, no vuelve
          // a disparar hasta que baje del umbral y vuelva a subir (= un grito nuevo).
          if (volumenNormalizado > threshold) {
            if (!yaSuperoUmbralRef.current) {
              const ahora = Date.now();
              // Pequeño debounce (100ms) solo para filtrar ruido eléctrico/vibración
              // del micrófono, mucho más corto que el cooldown anterior de 400ms,
              // para no perder la ventana del doble salto.
              if (ahora - ultimoSaltoTsRef.current > 100) {
                onJump(); // ¡Activa el salto en el canvas!
                ultimoSaltoTsRef.current = ahora;
              }
              yaSuperoUmbralRef.current = true;
            }
          } else {
            yaSuperoUmbralRef.current = false;
          }

          rafId = requestAnimationFrame(procesarAudio);
        };

        procesarAudio();
      } catch (err) {
        console.error("Error al acceder al micrófono:", err);
      }
    }

    iniciarMicrofono();

    // --- FUNCIÓN DE LIMPIEZA BLINDADA Y PROTEGIDA ---
    return () => {
      cancelado = true;

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

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

      analyserRef.current = null;
      audioContextRef.current = null;
      streamRef.current = null;
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