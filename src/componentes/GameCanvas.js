'use client';
import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

const GameCanvas = forwardRef(({ onGameOver, isPaused }, ref) => {
  const canvasRef = useRef(null);
  
  const gameState = useRef({
    // vx reducida a 1.6 para que el personaje vaya más lento y sea fácil jugar
    personaje: { x: 200, y: 450, vx: 1.6, vy: 0, size: 20, enSuelo: false },
    agua: { y: 580, speed: 0.4, baseSpeed: 0.4 },
    plataformas: [],
    camaraY: 0,
    alturaMaxima: 0, 
    gravedad: 0.32,
    fuerzaSalto: -8.2 
  });

  useImperativeHandle(ref, () => ({
    triggerJump() {
      const state = gameState.current;
      const p = state.personaje;
      if (p.enSuelo && !isPaused) {
        p.vy = state.fuerzaSalto;
        p.enSuelo = false;
      }
    }
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let loopId;

    const imagenFondo = new Image();
    imagenFondo.src = '/imagenes/fondo-torre.png';

    const generarPlataformasIniciales = () => {
      const lista = [];
      lista.push({ x: 0, y: 520, width: canvas.width, height: 15 });
      
      let ultimaY = 520;
      for (let i = 0; i < 60; i++) {
        ultimaY -= Math.floor(Math.random() * 15) + 45; 
        const width = Math.floor(Math.random() * 30) + 75; 
        const x = Math.floor(Math.random() * (canvas.width - width));
        lista.push({ x, y: ultimaY, width, height: 12 });
      }
      gameState.current.plataformas = lista;
    };

    generarPlataformasIniciales();

    const gameLoop = () => {
      const state = gameState.current;
      const p = state.personaje;
      const agua = state.agua;

      if (isPaused) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText("JUEGO EN PAUSA", canvas.width / 2, canvas.height / 2);
        ctx.textAlign = 'left'; 
        loopId = requestAnimationFrame(gameLoop);
        return;
      }

      // 1. ACTUALIZAR FÍSICAS (Personaje más lento)
      p.x += p.vx;
      if (p.x <= 0 || p.x + p.size >= canvas.width) {
        p.vx *= -1; 
      }

      p.vy += state.gravedad;
      p.y += p.vy;

      // SOLUCIÓN AL BUG NaN: Aseguramos que alturaMaxima siempre sea un número antes de calcular
      const alturaSegura = Number(state.alturaMaxima) || 0;
      const incrementoDificultad = Math.min(alturaSegura / 3000, 1.2);
      agua.speed = Number(state.agua.baseSpeed) + incrementoDificultad;
      
      // El agua sube de forma constante
      agua.y -= agua.speed;

      // 2. DETECCIÓN DE COLISIONES
      p.enSuelo = false;
      if (p.vy >= 0) {
        for (let plat of state.plataformas) {
          if (
            p.x + p.size > plat.x &&
            p.x < plat.x + plat.width &&
            p.y + p.size >= plat.y &&
            p.y + p.size <= plat.y + 12
          ) {
            p.y = plat.y - p.size;
            p.vy = 0;
            p.enSuelo = true;
            break;
          }
        }
      }

      // 3. MOVIMIENTO DE CÁMARA (CORREGIDO)
      const mitadPantalla = canvas.height / 2;
      if (p.y < mitadPantalla) {
        const desfase = mitadPantalla - p.y;
        p.y = mitadPantalla;
        
        state.camaraY += desfase;
        state.alturaMaxima += desfase;
        
        // El agua baja un poco menos de lo que tú subes para que te persiga
        agua.y += desfase * 0.75; 

        for (let plat of state.plataformas) {
          plat.y += desfase;
        }
      }

      if (state.plataformas[state.plataformas.length - 1].y > 0) {
        let ultimaY = state.plataformas[state.plataformas.length - 1].y;
        for (let i = 0; i < 15; i++) {
          ultimaY -= Math.floor(Math.random() * 15) + 45;
          const width = Math.floor(Math.random() * 30) + 75;
          const x = Math.floor(Math.random() * (canvas.width - width));
          state.plataformas.push({ x, y: ultimaY, width, height: 12 });
        }
      }

      // 4. GAME OVER
      if (p.y + p.size >= agua.y || p.y > canvas.height) {
        cancelAnimationFrame(loopId);
        onGameOver(Math.floor(state.alturaMaxima / 10)); 
        return;
      }

      // 5. RENDERIZADO VISUAL
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let fondoY = (state.camaraY) % canvas.height;
      ctx.drawImage(imagenFondo, 0, fondoY, canvas.width, canvas.height);
      ctx.drawImage(imagenFondo, 0, fondoY - canvas.height, canvas.width, canvas.height);

      for (let plat of state.plataformas) {
        ctx.fillStyle = '#4a5568';
        ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
        ctx.fillStyle = '#48bb78';
        ctx.fillRect(plat.x, plat.y, plat.width, 3);
      }

      ctx.fillStyle = '#ecc94b'; 
      ctx.fillRect(p.x, p.y, p.size, p.size);

      // Dibujar Agua Azul Translúcida
      ctx.fillStyle = 'rgba(49, 130, 206, 0.65)';
      ctx.fillRect(0, agua.y, canvas.width, canvas.height - agua.y);

      // MARCADORES TEXTUALES
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px "Courier New", monospace';
      ctx.fillText(`ALTURA: ${Math.floor(state.alturaMaxima / 10)}m`, 20, 30);
      
      const vAgua = (agua.speed * 10).toFixed(1);
      ctx.fillText(`AGUA: ${vAgua} km/h`, 20, 50);

      loopId = requestAnimationFrame(gameLoop);
    };

    imagenFondo.onload = () => { loopId = requestAnimationFrame(gameLoop); };
    imagenFondo.onerror = () => { loopId = requestAnimationFrame(gameLoop); };

    return () => cancelAnimationFrame(loopId);
  }, [onGameOver, isPaused]);

  return (
    <canvas 
      ref={canvasRef} 
      width={400} 
      height={600} 
      style={{ border: '4px solid #2b6cb0', display: 'block', margin: '0 auto', borderRadius: '8px' }} 
    />
  );
});

GameCanvas.displayName = 'GameCanvas';
export default GameCanvas;