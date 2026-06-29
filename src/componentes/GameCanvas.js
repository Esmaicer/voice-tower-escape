// src/componentes/GameCanvas.js
'use client';
import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

const GameCanvas = forwardRef(({ onGameOver, isPaused }, ref) => {
  const canvasRef = useRef(null);
  
  // ESTADO FÍSICO INTEGRADO DEL JUEGO
  const gameState = useRef({
    // vx inicializado en 0 porque ahora depende de las flechas
    personaje: { x: 380, y: 400, vx: 0, vy: 0, size: 20, enSuelo: false },
    plataformas: [],
    camaraY: 0,
    alturaMaxima: 0, 
    gravedad: 0.32,
    fuerzaSalto: -8.2,
    velocidadCubo: 3.5, // Velocidad manual del cubo al presionar las flechas
    
    // CONTROL DEL DOBLE SALTO
    dobleSaltoDisponible: true,

    // SISTEMA DE VIDAS Y CAÍDAS CRÍTICAS
    vidas: 5,
    puntoMasAltoAlcanzadoY: 400, 
    caidaCriticaDistancia: 200,
    inmune: false 
  });

  // DISPARADOR DE SALTO COMPATIBLE CON DOBLE SALTO (Solo Voz)
  useImperativeHandle(ref, () => ({
    triggerJump() {
      const state = gameState.current;
      const p = state.personaje;
      
      if (isPaused) return;

      if (p.enSuelo) {
        p.vy = state.fuerzaSalto;
        p.enSuelo = false;
        state.dobleSaltoDisponible = true; 
        state.puntoMasAltoAlcanzadoY = p.y;
        state.inmune = false;
      } 
      else if (state.dobleSaltoDisponible) {
        p.vy = state.fuerzaSalto * 0.82; 
        state.dobleSaltoDisponible = false; 
        state.puntoMasAltoAlcanzadoY = p.y; 
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

    // DETECTORES DE TECLAS PARA MOVIMIENTO HORIZONTAL (FLECHAS)
    const teclasPresionadas = {};
    
    const manejarKeyDown = (e) => {
      if (isPaused) return;
      teclasPresionadas[e.code] = true;
      actualizarVelocidadHorizontal();
    };

    const manejarKeyUp = (e) => {
      teclasPresionadas[e.code] = false;
      actualizarVelocidadHorizontal();
    };

    const actualizarVelocidadHorizontal = () => {
      const state = gameState.current;
      const p = state.personaje;
      
      if (teclasPresionadas['ArrowLeft']) {
        p.vx = -state.velocidadCubo;
      } else if (teclasPresionadas['ArrowRight']) {
        p.vx = state.velocidadCubo;
      } else {
        p.vx = 0; // Se detiene si no se presiona ninguna flecha
      }
    };

    window.addEventListener('keydown', manejarKeyDown);
    window.addEventListener('keyup', manejarKeyUp);

    const generarPlataformasIniciales = () => {
      const lista = [];
      lista.push({ x: 0, y: 520, width: canvas.width, height: 15 });
      
      let ultimaY = 520;
      for (let i = 0; i < 150; i++) { 
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

      // ==========================================
      // A. FISICAS GENERALES (MOVIMIENTO Y LÍMITES)
      // ==========================================
      p.x += p.vx;
      
      // Bloqueo de bordes para que no se salga de los 760px del canvas
      if (p.x < 0) p.x = 0;
      if (p.x + p.size > canvas.width) p.x = canvas.width - p.size;

      p.vy += state.gravedad;
      p.y += p.vy;

      if (p.vy < 0 && p.y < state.puntoMasAltoAlcanzadoY) {
        state.puntoMasAltoAlcanzadoY = p.y;
      }

      // ==========================================
      // B. COLISIONES
      // ==========================================
      p.enSuelo = false;

      if (p.vy >= 0) {
        for (let plat of state.plataformas) {
          if (
            p.x + p.size > plat.x &&
            p.x < plat.x + plat.width &&
            p.y + p.size >= plat.y &&
            p.y + p.size <= plat.y + 12
          ) {
            const distanciaCaida = p.y - state.puntoMasAltoAlcanzadoY;
            if (distanciaCaida >= state.caidaCriticaDistancia && !state.inmune) {
              state.vidas -= 1;
              state.inmune = true; 
            }

            p.y = plat.y - p.size;
            p.vy = 0;
            p.enSuelo = true;
            state.dobleSaltoDisponible = true; 
            state.puntoMasAltoAlcanzadoY = p.y; 
            break;
          }
        }
      }

      // ==========================================
      // C. CAMARA FLUIDA
      // ==========================================
      const limiteSuperior = canvas.height * 0.4; 
      const limiteInferior = canvas.height * 0.7; 

      if (p.y < limiteSuperior) {
        const desfase = limiteSuperior - p.y;
        p.y = limiteSuperior;
        
        state.camaraY += desfase;
        const alturaActualCalculada = state.camaraY;
        
        if (alturaActualCalculada > state.alturaMaxima) {
          state.alturaMaxima = alturaActualCalculada;
        }

        state.puntoMasAltoAlcanzadoY += desfase;

        for (let plat of state.plataformas) {
          plat.y += desfase;
        }
      } 
      else if (p.y > limiteInferior) {
        const desfase = p.y - limiteInferior;
        p.y = limiteInferior;
        
        state.camaraY -= desfase; 
        state.puntoMasAltoAlcanzadoY -= desfase;

        for (let plat of state.plataformas) {
          plat.y -= desfase;
        }
      }

      // ==========================================
      // D. CONDICIÓN DE GAME OVER
      // ==========================================
      if (state.vidas <= 0) {
        cancelAnimationFrame(loopId);
        onGameOver(Math.floor(state.alturaMaxima / 10)); 
        return;
      }

      if (state.plataformas[0] && state.plataformas[0].y < p.y) {
        cancelAnimationFrame(loopId);
        onGameOver(Math.floor(state.alturaMaxima / 10)); 
        return;
      }

      // ==========================================
      // E. RENDERIZADO
      // ==========================================
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let fondoY = (state.camaraY) % canvas.height;
      if (fondoY < 0) fondoY += canvas.height; 
      ctx.drawImage(imagenFondo, 0, fondoY, canvas.width, canvas.height);
      ctx.drawImage(imagenFondo, 0, fondoY - canvas.height, canvas.width, canvas.height);

      for (let plat of state.plataformas) {
        if (plat.y >= -20 && plat.y <= canvas.height + 20) {
          ctx.fillStyle = '#4a5568';
          ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
          ctx.fillStyle = '#48bb78';
          ctx.fillRect(plat.x, plat.y, plat.width, 3);
        }
      }

      ctx.fillStyle = state.inmune && Math.floor(Date.now() / 100) % 2 === 0 ? '#e53e3e' : '#ecc94b'; 
      ctx.fillRect(p.x, p.y, p.size, p.size);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px "Courier New", monospace';
      ctx.fillText(`ALTURA: ${Math.floor(state.alturaMaxima / 10)}m`, 20, 30);
      ctx.fillText("VIDAS: ", 20, 50);
      
      for (let i = 0; i < state.vidas; i++) {
        ctx.fillText("❤️", 85 + (i * 25), 50);
      }

      loopId = requestAnimationFrame(gameLoop);
    };

    imagenFondo.onload = () => { loopId = requestAnimationFrame(gameLoop); };
    imagenFondo.onerror = () => { loopId = requestAnimationFrame(gameLoop); };

    return () => {
      cancelAnimationFrame(loopId);
      window.removeEventListener('keydown', manejarKeyDown);
      window.removeEventListener('keyup', manejarKeyUp);
    };
  }, [onGameOver, isPaused]);

  return (
    <canvas
      ref={canvasRef}
      width={760} 
      height={600} 
      style={{
        display: 'block',
        margin: '0 auto',
        background: '#1a202c',
        borderRadius: '8px',
        border: '2px solid #4a5568'
      }}
    />
  );
});

GameCanvas.displayName = 'GameCanvas';
export default GameCanvas;