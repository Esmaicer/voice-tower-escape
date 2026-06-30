// src/componentes/GameCanvas.js
'use client';
import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

// Agrega esto arriba en las declaraciones de variables de tu archivo
const imgPortalCompletado = new Image();
imgPortalCompletado.src = '/imagenes/portal-completado.jpg'; // Asegúrate de usar este nombre exacto si renombraste el archivo

const GameCanvas = forwardRef(({ onGameOver, isPaused }, ref) => {
  const canvasRef = useRef(null);
  
  // ESTADO FÍSICO INTEGRADO DEL JUEGO
  const gameState = useRef({
    personaje: { x: 380, y: 400, vx: 0, vy: 0, size: 20, enSuelo: false },
    plataformas: [],
    camaraY: 0,
    gravedad: 0.32,
    fuerzaSalto: -8.2,
    velocidadCubo: 3.5, 
    
    // SISTEMA DE NIVELES (3 NIVELES EN TOTAL)
    nivelActual: 1,
    metrosParaSiguienteNivel: 50, 

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
        p.vy = state.fuerzaSalto * 0.85; 
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

    const fondosNiveles = {
      1: '/imagenes/fondo-torre.png',
      2: '/imagenes/fondo-torre2.png',
      3: '/imagenes/fondo-torre3.png'
    };

    const imagenFondo = new Image();
    imagenFondo.src = fondosNiveles[gameState.current.nivelActual];

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
        p.vx = 0;
      }
    };

    window.addEventListener('keydown', manejarKeyDown);
    window.addEventListener('keyup', manejarKeyUp);

    // Inicialización única de plataformas
    if (gameState.current.plataformas.length === 0) {
      const state = gameState.current;
      const lista = [];
      lista.push({ x: 0, y: 520, width: canvas.width, height: 15, esPortal: false });
      const limiteYPortal = 520 - (state.metrosParaSiguienteNivel * 10);
      let ultimaY = 520;
      
      while (ultimaY > limiteYPortal + 150) {
        ultimaY -= Math.floor(Math.random() * 15) + 45; 
        const width = Math.floor(Math.random() * 30) + 75; 
        const x = Math.floor(Math.random() * (canvas.width - width));
        lista.push({ x, y: ultimaY, width, height: 12, esPortal: false });
      }

      lista.push({ x: (canvas.width / 2) - 60, y: limiteYPortal, width: 120, height: 15, esPortal: true });
      state.plataformas = lista;
    }

    const generarPlataformasDelNivel = () => {
      const state = gameState.current;
      const lista = [];
      lista.push({ x: 0, y: 520, width: canvas.width, height: 15, esPortal: false });
      const limiteYPortal = 520 - (state.metrosParaSiguienteNivel * 10);
      let ultimaY = 520;
      
      while (ultimaY > limiteYPortal + 150) {
        ultimaY -= Math.floor(Math.random() * 15) + 45; 
        const width = Math.floor(Math.random() * 30) + 75; 
        const x = Math.floor(Math.random() * (canvas.width - width));
        lista.push({ x, y: ultimaY, width, height: 12, esPortal: false });
      }

      lista.push({ x: (canvas.width / 2) - 60, y: limiteYPortal, width: 120, height: 15, esPortal: true });
      state.plataformas = lista;
      state.personaje.x = 380;
      state.personaje.y = 400;
      state.personaje.vx = 0;
      state.personaje.vy = 0;
      state.puntoMasAltoAlcanzadoY = 400;
      imagenFondo.src = fondosNiveles[state.nivelActual];
    };

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
        loopId = requestAnimationFrame(gameLoop);
        return;
      }

      // ==========================================
      // A. FÍSICAS GENERALES
      // ==========================================
      p.x += p.vx;
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
            p.x + p.size > plat.x && p.x < plat.x + plat.width &&
            p.y + p.size >= plat.y && p.y + p.size <= plat.y + 15
          ) {
            if (plat.esPortal) {
              p.vy = 0;
              p.vx = 0;
              cancelAnimationFrame(loopId);

              if (state.nivelActual < 3) {
                state.nivelActual += 1;
                state.camaraY = 0;

                ctx.drawImage(imgPortalCompletado, 0, 0, canvas.width, canvas.height);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.fillStyle = '#ecc94b';
                ctx.font = 'bold 28px "Courier New", monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`¡PORTAL COMPLETADO! ESCENARIO ${state.nivelActual}`, canvas.width / 2, canvas.height / 2);

                setTimeout(() => {
                  generarPlataformasDelNivel();
                  loopId = requestAnimationFrame(gameLoop);
                  }, 1200);
                  } else {
                    onGameOver(4);
                  }
                  return;
                }
              
  
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
      // C. CÁMARA FLUIDA (CORREGIDA PARA DAÑO POR CAÍDA)
      // ==========================================
      const limiteSuperior = canvas.height * 0.4; 
      const limiteInferior = canvas.height * 0.7; 

      if (p.y < limiteSuperior) {
        const desfase = limiteSuperior - p.y;
        p.y = limiteSuperior;
        state.camaraY += desfase;
        state.puntoMasAltoAlcanzadoY += desfase; 
        for (let plat of state.plataformas) plat.y += desfase;
      } 
      else if (p.y > limiteInferior) {
        const desfase = p.y - limiteInferior;
        p.y = limiteInferior;
        state.camaraY -= desfase; 
        state.puntoMasAltoAlcanzadoY -= desfase; 
        for (let plat of state.plataformas) plat.y -= desfase;
      }

      // ==========================================
      // D. CONDICIÓN DE GAME OVER
      // ==========================================
      if (state.vidas <= 0 || (state.plataformas[0] && state.plataformas[0].y < p.y)) {
        cancelAnimationFrame(loopId);
        onGameOver(state.nivelActual); 
        return;
      }

      // ==========================================
      // E. RENDERIZADO GRÁFICO CONTROLADO
      // ==========================================
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (imagenFondo.complete && imagenFondo.naturalWidth !== 0) {
        let fondoY = (state.camaraY) % canvas.height;
        if (fondoY < 0) fondoY += canvas.height; 
        ctx.drawImage(imagenFondo, 0, fondoY, canvas.width, canvas.height);
        ctx.drawImage(imagenFondo, 0, fondoY - canvas.height, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = '#111827'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      for (let plat of state.plataformas) {
        if (plat.y >= -40 && plat.y <= canvas.height + 40) {
          if (plat.esPortal) {
            ctx.fillStyle = '#3182ce';
            ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
            ctx.fillStyle = '#63b3ed';
            ctx.fillRect(plat.x + 5, plat.y - 12, plat.width - 10, 12); 
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText("PORTAL", plat.x + plat.width / 2, plat.y + 11);
          } else {
            ctx.fillStyle = '#4a5568';
            ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
            ctx.fillStyle = '#48bb78';
            ctx.fillRect(plat.x, plat.y, plat.width, 3);
          }
        }
      }

      ctx.fillStyle = state.inmune && Math.floor(Date.now() / 100) % 2 === 0 ? '#e53e3e' : '#ecc94b'; 
      ctx.fillRect(p.x, p.y, p.size, p.size);

      // MARCADORES CENTRADOS BASADOS EN ESCENARIOS (X: 80)
      ctx.fillStyle = '#63b3ed';
      ctx.font = 'bold 16px "Courier New", monospace';
      ctx.textAlign = 'left';
      
      ctx.fillText(`ESCENARIO ACTUAL: ${state.nivelActual}/3`, 80, 35);
      
      ctx.fillStyle = '#fff';
      ctx.fillText("VIDAS: ", 80, 55);
      for (let i = 0; i < state.vidas; i++) {
        ctx.fillText("❤️", 145 + (i * 22), 55);
      }

      loopId = requestAnimationFrame(gameLoop);
    };

    loopId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(loopId);
      window.removeEventListener('keydown', manejarKeyDown);
      window.removeEventListener('keyup', manejarKeyUp);
    };
  }, [onGameOver, isPaused]);

  return (
    <canvas ref={canvasRef} width={760} height={600} style={{ display: 'block', margin: '0 auto', background: '#1a202c', borderRadius: '8px', border: '2px solid #4a5568' }} />
  );
});

GameCanvas.displayName = 'GameCanvas';
export default GameCanvas;