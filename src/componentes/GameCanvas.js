'use client';
import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

const GameCanvas = forwardRef(({ onGameOver, isPaused }, ref) => {
  const canvasRef = useRef(null);
  
  // ESTADO FÍSICO INTEGRADO DEL JUEGO
  const gameState = useRef({
    personaje: { x: 200, y: 400, vx: 1.0, vy: 0, size: 20, enSuelo: false },
    plataformas: [],
    camaraY: 0,
    alturaMaxima: 0, 
    gravedad: 0.32,
    fuerzaSalto: -8.2,
    
    // CONTROL DEL DOBLE SALTO
    dobleSaltoDisponible: true,

    // SISTEMA DE VIDAS Y CAÍDAS CRÍTICAS
    vidas: 5,
    puntoMasAltoAlcanzadoY: 400, 
    caidaCriticaDistancia: 200,
    inmune: false 
  });

  // DISPARADOR DE SALTO COMPATIBLE CON DOBLE SALTO
  useImperativeHandle(ref, () => ({
    triggerJump() {
      const state = gameState.current;
      const p = state.personaje;
      
      if (isPaused) return;

      // Primer salto desde una plataforma
      if (p.enSuelo) {
        p.vy = state.fuerzaSalto;
        p.enSuelo = false;
        state.dobleSaltoDisponible = true; 
        state.puntoMasAltoAlcanzadoY = p.y;
        state.inmune = false;
      } 
      // Segundo salto en el aire (Doble Salto)
      else if (state.dobleSaltoDisponible) {
        p.vy = state.fuerzaSalto * 0.82; 
        state.dobleSaltoDisponible = false; 
        state.puntoMasAltoAlcanzadoY = p.y; // Resetea para evitar daño injusto
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
      // A. FISICAS GENERALES
      // ==========================================
      p.x += p.vx;
      if (p.x <= 0 || p.x + p.size >= canvas.width) {
        p.vx *= -1; 
      }

      p.vy += state.gravedad;
      p.y += p.vy;

      if (p.vy < 0 && p.y < state.puntoMasAltoAlcanzadoY) {
        state.puntoMasAltoAlcanzadoY = p.y;
      }

      // ==========================================
      // B. COLISIONES Y DAÑO POR CAÍDA
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
      // C. CAMARA FLUIDA BIDIRECCIONAL (EFECTO CAÍDA)
      // ==========================================
const limiteSuperior = canvas.height * 0.4; 
      const limiteInferior = canvas.height * 0.7; 

      if (p.y < limiteSuperior) {
        const desfase = limiteSuperior - p.y;
        p.y = limiteSuperior;
        
        // La cámara física se mueve hacia abajo para mostrar lo de arriba
        state.camaraY += desfase;
        
        // CORRECCIÓN: Registramos la altura acumulada total de la cámara física
        const alturaActualCalculada = state.camaraY;
        
        // Solo aumentamos la altura máxima si superamos el punto más alto de esta partida
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
        
        // Al caer, la cámara física retrocede hacia arriba
        state.camaraY -= desfase; 
        state.puntoMasAltoAlcanzadoY -= desfase;

        // YA NO RESTAMOS de state.alturaMaxima aquí, así se queda fija en tu récord

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

      // CONTROL DE VACÍO REAL: Si el suelo base inicial (plataformas[0]) 
      // sube más allá de la mitad de la pantalla y el personaje está abajo, es muerte instantánea.
      if (state.plataformas[0] && state.plataformas[0].y < p.y) {
        cancelAnimationFrame(loopId);
        onGameOver(Math.floor(state.alturaMaxima / 10)); 
        return;
      }

      // ==========================================
      // E. RE-RENDERIZADO GRÁFICO
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

      // El personaje parpadea en rojo si es inmune temporal por caída
      ctx.fillStyle = state.inmune && Math.floor(Date.now() / 100) % 2 === 0 ? '#e53e3e' : '#ecc94b'; 
      ctx.fillRect(p.x, p.y, p.size, p.size);

      // MARCADORES DE RENDIMIENTO
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