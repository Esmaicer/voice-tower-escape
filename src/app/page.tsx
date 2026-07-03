// src/app/page.tsx
'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import GameCanvas from '@/componentes/GameCanvas';
import AudioCalibrator from '@/componentes/AudioCalibrator';

export default function Home() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false); 
  const [showSettings, setShowSettings] = useState(false);
  const [controlMethod, setControlMethod] = useState<'voz' | 'teclado'>('teclado'); 
  
  const [jugadores, setJugadores] = useState<string[]>(['Invitado']);
  const [jugadorActivo, setJugadorActivo] = useState<string>('Invitado');
  const [nuevoNombre, setNuevoNombre] = useState<string>('');
  
  // AHORA EL RECORD ALMACENA EL NIVEL MÁXIMO (1, 2 o 3)
  const [highScore, setHighScore] = useState(1);
  const [currentScore, setCurrentScore] = useState(1);
  
  const audioTagRef = useRef<HTMLAudioElement | null>(null);
  const muteRef = useRef<boolean>(false);
  const botonMuteRef = useRef<HTMLButtonElement | null>(null);
  const gameCanvasRef = useRef<any>(null);

  useEffect(() => {
    const listaGuardada = localStorage.getItem('vt_lista_jugadores');
    const ultimoActivo = localStorage.getItem('vt_jugador_activo');

    if (listaGuardada) {
      const nombres = JSON.parse(listaGuardada);
      setJugadores(nombres);
      if (ultimoActivo && nombres.includes(ultimoActivo)) {
        setJugadorActivo(ultimoActivo);
      } else {
        setJugadorActivo(nombres[0]);
      }
    }

    const forzarReproduccion = () => {
      if (audioTagRef.current && !isPlaying) {
        audioTagRef.current.play()
          .then(() => {
            window.removeEventListener('click', forzarReproduccion);
          })
          .catch(() => console.log("Permiso de audio diferido"));
      }
    };

    window.addEventListener('click', forzarReproduccion);
    return () => window.removeEventListener('click', forzarReproduccion);
  }, [isPlaying]);

  // 🌗 Baja el volumen de una pista gradualmente hasta 0 y la pausa (fundido de salida)
  const fundidoSalidaYPausa = (audio: HTMLAudioElement, duracionMs = 600) => {
    const pasos = 20;
    const intervaloMs = duracionMs / pasos;
    const volumenInicial = audio.volume;
    let pasoActual = 0;
    const intervalo = setInterval(() => {
      pasoActual++;
      audio.volume = Math.max(volumenInicial * (1 - pasoActual / pasos), 0);
      if (pasoActual >= pasos) {
        clearInterval(intervalo);
        audio.pause();
        audio.currentTime = 0;
        audio.volume = volumenInicial; // restaurar para la próxima vez que se reproduzca desde el inicio
      }
    }, intervaloMs);
  };

  useEffect(() => {
    if (!audioTagRef.current) return;
    if (isPlaying) {
      // Se está jugando un nivel: nos aseguramos de que quede pausada
      // (el fundido de salida ya la lleva a 0 y la pausa desde handleIniciarJuego)
      audioTagRef.current.pause();
    } else {
      // Volvemos al menú o llegamos a Game Over: SIEMPRE desde el inicio, no reanudar donde quedó
      audioTagRef.current.currentTime = 0;
      audioTagRef.current.volume = muteRef.current ? 0 : 0.6;
      if (!muteRef.current) {
        audioTagRef.current.play().catch(() => {});
      }
    }
  }, [isPlaying]);

  // CARGAR EL RÉCORD DE NIVEL SEGÚN EL USUARIO Y PERIFÉRICO
  useEffect(() => {
    const recordEspecifico = localStorage.getItem(`vt_maxlevel_${jugadorActivo}_${controlMethod}`);
    if (recordEspecifico) {
      setHighScore(parseInt(recordEspecifico, 10));
    } else {
      setHighScore(1); // El nivel base por defecto es 1
    }
    localStorage.setItem('vt_jugador_activo', jugadorActivo);
  }, [jugadorActivo, controlMethod]);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const nuevoEstadoMute = !muteRef.current;
    muteRef.current = nuevoEstadoMute;

    // Música de portada (menú / pantalla de Game Over)
    if (audioTagRef.current) {
      audioTagRef.current.muted = nuevoEstadoMute;
      if (!isPlaying) {
        audioTagRef.current.volume = nuevoEstadoMute ? 0 : 0.6;
        if (nuevoEstadoMute) {
          audioTagRef.current.pause();
        } else {
          audioTagRef.current.play().catch(() => {});
        }
      }
    }

    // Música de nivel + efectos de sonido del personaje (si se está jugando)
    if (gameCanvasRef.current) {
      gameCanvasRef.current.setMuted(nuevoEstadoMute);
    }

    if (botonMuteRef.current) {
      botonMuteRef.current.innerText = nuevoEstadoMute ? 'Muted' : 'Audio';
    }
  };

  const agregarJugador = (e: React.FormEvent) => {
    e.preventDefault();
    const nombreLimpio = nuevoNombre.trim();
    if (!nombreLimpio) return;

    if (jugadores.includes(nombreLimpio)) {
      alert('Este nombre de jugador ya existe!');
      return;
    }

    const nuevaListaFiltrada = [...jugadores, nombreLimpio];
    setJugadores(nuevaListaFiltrada);
    setJugadorActivo(nombreLimpio);
    setNuevoNombre('');
    localStorage.setItem('vt_lista_jugadores', JSON.stringify(nuevaListaFiltrada));
  };

  const handleJumpTrigger = useCallback(() => {
    if (gameCanvasRef.current && !isPaused) {
      gameCanvasRef.current.triggerJump();
    }
  }, [isPaused]);

  // RECIBE EL NIVEL ALCANZADO DESDE EL CANVAS AL MORIR O GANAR
  const handleGameOver = (nivelAlcanzado: number) => {
    setCurrentScore(nivelAlcanzado); 
    if (nivelAlcanzado > highScore) {
      setHighScore(nivelAlcanzado);
      localStorage.setItem(`vt_maxlevel_${jugadorActivo}_${controlMethod}`, nivelAlcanzado.toString());
    }
    setIsPlaying(false);
    setIsGameOver(true);
    setIsPaused(false);
  };

  // INICIA (O REINICIA) EL JUEGO: funde la música de portada mientras arranca la del nivel 1
  const handleIniciarJuego = () => {
    if (audioTagRef.current && !muteRef.current && !audioTagRef.current.paused) {
      fundidoSalidaYPausa(audioTagRef.current, 600);
    } else if (audioTagRef.current) {
      audioTagRef.current.pause();
      audioTagRef.current.currentTime = 0;
    }
    setIsGameOver(false);
    setIsPlaying(true);
    setIsPaused(false);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isPlaying && !isPaused && controlMethod === 'teclado' && event.code === 'Space') {
        event.preventDefault();
        handleJumpTrigger();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isPaused, controlMethod, handleJumpTrigger]);

  return (
    <main style={{ 
      maxWidth: '800px', margin: '20px auto', padding: '30px 20px', 
      fontFamily: '"Courier New", Courier, monospace', 
      backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0.75)), url("/imagenes/fondo-torre.png")',
      backgroundSize: 'cover', backgroundPosition: 'center', color: '#fff',
      borderRadius: '12px', boxShadow: '0px 0px 25px rgba(43, 108, 176, 0.4)', 
      border: '3px solid #2b6cb0', position: 'relative'
    }}>
      
      <audio ref={audioTagRef} src="/sonido/dark-souls-golem.mp3" loop preload="auto" />

      <button ref={botonMuteRef} onClick={toggleMute} style={{ position: 'absolute', top: '15px', right: '15px', background: '#2d3748', border: '1px solid #4a5568', color: 'white', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', zIndex: 999, fontWeight: 'bold' }}>Audio</button>

      <h1 style={{ textAlign: 'center', color: '#ecc94b', fontSize: '2.5rem', textShadow: '3px 3px #c05621', marginBottom: '10px' }}>VOICE TOWER ESCAPE</h1>
      
      {!isPlaying && !isGameOver && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', margin: '30px 0' }}>
          
          <div style={{ background: '#1a202c', width: '100%', padding: '15px', borderRadius: '8px', border: '1px solid #4a5568', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3 style={{ margin: '0', color: '#ecc94b', fontSize: '1rem', textAlign: 'center' }}>PERFIL DEL EXPLORADOR</h3>
            <form onSubmit={agregarJugador} style={{ display: 'flex', gap: '8px' }}>
              <input type="text" placeholder="Nuevo Nombre..." value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} maxLength={12} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #4a5568', background: '#2d3748', color: '#fff' }} />
              <button type="submit" style={{ padding: '8px 15px', background: '#3182ce', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Añadir</button>
            </form>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
              <label style={{ fontSize: '14px' }}>Elegir personaje:</label>
              <select value={jugadorActivo} onChange={(e) => setJugadorActivo(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #4a5568', background: '#2d3748', color: '#fff', fontWeight: 'bold' }}>
                {jugadores.map((nombre) => <option key={nombre} value={nombre}>{nombre}</option>)}
              </select>
            </div>
          </div>

          {/* INDICADOR MODIFICADO A NIVELES */}
          <div style={{ background: '#2d3748', padding: '12px 25px', borderRadius: '8px', border: '2px dashed #ecc94b', fontSize: '1.1rem', color: '#ecc94b', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>
            MÁXIMO ESCENARIO DE <strong>{jugadorActivo.toUpperCase()}</strong> ({controlMethod.toUpperCase()}): {highScore === 4 ? '¡TORRE COMPLETADA! 🏆' : `NIVEL ${highScore}`}
          </div>

          <div style={{ display: 'flex', gap: '10px', background: '#2d3748', padding: '8px', borderRadius: '8px' }}>
            <button onClick={() => setControlMethod('voz')} style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: controlMethod === 'voz' ? '#ecc94b' : '#4a5568', color: controlMethod === 'voz' ? '#000' : '#fff' }}>Voz</button>
            <button onClick={() => setControlMethod('teclado')} style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: controlMethod === 'teclado' ? '#ecc94b' : '#4a5568', color: controlMethod === 'teclado' ? '#000' : '#fff' }}>Teclado</button>
          </div>

          <button style={{ padding: '15px 40px', fontSize: '22px', fontWeight: 'bold', cursor: 'pointer', background: '#38a169', color: 'white', border: 'none', borderRadius: '6px', boxShadow: '0 5px #22543d' }} onClick={handleIniciarJuego}>¡INICIAR JUEGO!</button>
          <button style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer', background: '#4a5568', color: 'white', border: 'none', borderRadius: '6px' }} onClick={() => setShowSettings(!showSettings)}>{showSettings ? 'Ocultar Ajustes' : 'Configurar Dispositivo'}</button>

          {showSettings && (
            <div style={{ width: '100%', background: '#1a202c', padding: '15px', borderRadius: '8px', border: '1px solid #4a5568' }}>
              <p style={{ margin: '0 0 10px 0' }}>Modo seleccionado: <strong>{controlMethod === 'voz' ? 'Voz' : 'Teclado'}</strong></p>
              {controlMethod === 'voz' && <AudioCalibrator onJump={() => {}} />}
            </div>
          )}
        </div>
      )}

      {/* PANTALLA GAME OVER MODIFICADA A NIVELES */}
      {isGameOver && (
        <div style={{ textAlign: 'center', margin: '30px 0', background: '#742a2a', padding: '25px', borderRadius: '8px', border: '2px solid #e53e3e' }}>
          <h2 style={{ color: '#fff', fontSize: '2rem', marginBottom: '10px' }}>
            {currentScore === 4 ? '¡FELICIDADES!' : 'TE ALCANZÓ EL VACÍO!'}
          </h2>
          <p style={{ color: '#fff', fontSize: '1.1rem' }}>Explorador: <strong>{jugadorActivo}</strong></p>
          <div style={{ color: '#ecc94b', fontSize: '1.2rem', marginBottom: '20px' }}>
            {currentScore === 4 ? (
              <span>¡Dominaste todos los escenarios!</span>
            ) : (
              <span>Llegaste hasta el: <strong>Nivel {currentScore}</strong></span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
            <button style={{ padding: '12px 25px', fontSize: '16px', cursor: 'pointer', background: '#ecc94b', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '6px' }} onClick={handleIniciarJuego}>Reintentar</button>
            <button style={{ padding: '12px 25px', fontSize: '16px', cursor: 'pointer', background: '#4a5568', color: '#fff', border: 'none', borderRadius: '6px' }} onClick={() => setIsGameOver(false)}>Menú Principal</button>
          </div>
        </div>
      )}

      {isPlaying && (
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '15px' }}>
            <button onClick={() => setIsPaused(!isPaused)} style={{ flex: 1, padding: '10px', background: isPaused ? '#3182ce' : '#dd6b20', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>{isPaused ? 'Reanudar' : 'Pausar'}</button>
            <button onClick={() => { setIsPlaying(false); setIsPaused(false); }} style={{ flex: 1, padding: '10px', background: '#e53e3e', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>Salir al Menú</button>
          </div>

          {controlMethod === 'voz' && !isPaused && (
            <div style={{ position: 'fixed', top: '180px', left: 'calc(50% - 580px)', zIndex: 100, background: '#1a202c', padding: '12px', borderRadius: '8px', border: '2px solid #2b6cb0', width: '170px' }}>
              <AudioCalibrator onJump={handleJumpTrigger} />
            </div>
          )}

          <div style={{ marginTop: '15px' }}>
            {/* @ts-ignore */}
            <GameCanvas ref={gameCanvasRef} isPaused={isPaused} onGameOver={handleGameOver} initialMuted={muteRef.current} />
          </div>
        </div>
      )}
    </main>
  );
}