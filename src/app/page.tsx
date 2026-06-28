'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import GameCanvas from '@/componentes/GameCanvas';
import AudioCalibrator from '@/componentes/AudioCalibrator';

export default function Home() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false); // Estado de pausa añadido
  const [showSettings, setShowSettings] = useState(false);
  const [controlMethod, setControlMethod] = useState<'voz' | 'teclado'>('teclado'); 
  const [highScore, setHighScore] = useState(0);
  const [currentScore, setCurrentScore] = useState(0);
  const gameCanvasRef = useRef<any>(null);

  useEffect(() => {
    const savedScore = localStorage.getItem('voice_tower_highscore');
    if (savedScore) {
      setHighScore(parseInt(savedScore, 10));
    }
  }, []);

  const handleJumpTrigger = useCallback(() => {
    if (gameCanvasRef.current && !isPaused) {
      gameCanvasRef.current.triggerJump();
    }
  }, [isPaused]);

  // Manejar el final de la partida y evaluar récords
  const handleGameOver = (scoreFinal: number) => {
    setCurrentScore(scoreFinal);
    if (scoreFinal > highScore) {
      setHighScore(scoreFinal);
      localStorage.setItem('voice_tower_highscore', scoreFinal.toString());
    }
    setIsPlaying(false);
    setIsGameOver(true);
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
      maxWidth: '600px', margin: '20px auto', padding: '30px 20px', fontFamily: '"Courier New", Courier, monospace', 
      backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0.75)), url("/imagenes/fondo-torre.png")',
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', color: '#fff',
      borderRadius: '12px', boxShadow: '0px 0px 25px rgba(43, 108, 176, 0.4)', border: '3px solid #2b6cb0'
    }}>
      <h1 style={{ textAlign: 'center', color: '#ecc94b', fontSize: '2.5rem', textShadow: '3px 3px #c05621', marginBottom: '10px' }}>
        🏰 VOICE TOWER ESCAPE
      </h1>
      
      {/* MENÚ INICIAL */}
      {!isPlaying && !isGameOver && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', margin: '40px 0' }}>
          <div style={{ background: '#2d3748', padding: '12px 25px', borderRadius: '8px', border: '2px dashed #ecc94b', fontSize: '1.2rem', color: '#ecc94b' }}>
            🏆 RÉCORD MÁXIMO: {highScore} METROS
          </div>

          <div style={{ display: 'flex', gap: '10px', background: '#2d3748', padding: '8px', borderRadius: '8px' }}>
            <button onClick={() => setControlMethod('voz')} style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: controlMethod === 'voz' ? '#ecc94b' : '#4a5568', color: controlMethod === 'voz' ? '#000' : '#fff' }}>🎙️ Voz</button>
            <button onClick={() => setControlMethod('teclado')} style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: controlMethod === 'teclado' ? '#ecc94b' : '#4a5568', color: controlMethod === 'teclado' ? '#000' : '#fff' }}>⌨️ Teclado</button>
          </div>

          <button style={{ padding: '15px 40px', fontSize: '22px', fontWeight: 'bold', cursor: 'pointer', background: '#38a169', color: 'white', border: 'none', borderRadius: '6px' }} onClick={() => { setIsPlaying(true); setIsPaused(false); }}>¡INICIAR JUEGO!</button>
          <button style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer', background: '#4a5568', color: 'white', border: 'none', borderRadius: '6px' }} onClick={() => setShowSettings(!showSettings)}>{showSettings ? '⚙️ Ocultar Ajustes' : '⚙️ Configurar Dispositivo'}</button>

          {showSettings && (
            <div style={{ marginTop: '15px', width: '100%', background: '#1a202c', padding: '15px', borderRadius: '8px', border: '1px solid #4a5568' }}>
              <p>Modo activo: <strong>{controlMethod === 'voz' ? 'Voz' : 'Teclado'}</strong></p>
              {controlMethod === 'voz' && <AudioCalibrator onJump={() => {}} />}
            </div>
          )}
        </div>
      )}

      {/* PANTALLA GAME OVER */}
      {isGameOver && (
        <div style={{ textAlign: 'center', margin: '30px 0', background: '#742a2a', padding: '25px', borderRadius: '8px', border: '2px solid #e53e3e' }}>
          <h2 style={{ color: '#fff', fontSize: '2rem', marginBottom: '10px' }}>💀 ¡TE ALCANZÓ EL AGUA!</h2>
          <p style={{ color: '#ecc94b', fontSize: '1.2rem', marginBottom: '20px' }}>Lograste subir: <strong>{currentScore} metros</strong></p>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
            <button style={{ padding: '12px 25px', fontSize: '16px', cursor: 'pointer', background: '#ecc94b', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '6px' }} onClick={() => { setIsGameOver(false); setIsPlaying(true); }}>Reintentar</button>
            <button style={{ padding: '12px 25px', fontSize: '16px', cursor: 'pointer', background: '#4a5568', color: '#fff', border: 'none', borderRadius: '6px' }} onClick={() => setIsGameOver(false)}>Menú Principal</button>
          </div>
        </div>
      )}

      {/* PANEL DE JUEGO ACTIVO */}
      {isPlaying && (
        <div>
          {/* BOTONES DE CONTROL DE INTERFAZ (PAUSA Y SALIR) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '15px' }}>
            <button onClick={() => setIsPaused(!isPaused)} style={{ flex: 1, padding: '10px', background: isPaused ? '#3182ce' : '#dd6b20', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
              {isPaused ? '▶️ Reanudar' : '⏸️ Pausar'}
            </button>
            <button onClick={() => { setIsPlaying(false); setIsPaused(false); }} style={{ flex: 1, padding: '10px', background: '#e53e3e', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
              🚪 Salir al Menú
            </button>
          </div>

          {controlMethod === 'voz' && !isPaused && (
            <div style={{ marginBottom: '15px' }}><AudioCalibrator onJump={handleJumpTrigger} /></div>
          )}

          <div style={{ marginTop: '15px' }}>
            {/* @ts-ignore */}
            <GameCanvas ref={gameCanvasRef} isPaused={isPaused} onGameOver={handleGameOver} />
          </div>
        </div>
      )}
    </main>
  );
}