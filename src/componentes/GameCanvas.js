// src/componentes/GameCanvas.js
'use client';
import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

const spritePlataformaBase = { x: 0, y: 0, width: 300, height: 80 };

const GameCanvas = forwardRef(({ onGameOver, isPaused, initialMuted = false }, ref) => {
  const canvasRef = useRef(null);

  // 🖼️ REFERENCIAS PARA IMÁGENES (Evita el error "Image is not defined" en SSR)
  const imgPortalCompletadoRef = useRef(null);
  const imgPlataformasRef = useRef(null);
  const imgPortalVerdeRef = useRef(null);

  // 🔊 MÚSICA DE FONDO: una pista por nivel + referencia a la que suena ahora
  const musicaPistasRef = useRef({});
  const musicaActualRef = useRef(null);

  // 🔊 SONIDOS DEL PERSONAJE: salto, doble salto y daño
  const audioSaltoRef = useRef(null);
  const audioDobleSaltoRef = useRef(null);
  const audioDanoRef = useRef(null);

  // 🔇 MUTE COMPARTIDO
  const isMutedRef = useRef(initialMuted);
  
  // ESTADO FÍSICO INTEGRADO DEL JUEGO
  const gameState = useRef({
    personaje: { x: 380, y: 400, vx: 0, vy: 0, size: 40, enSuelo: false },
    plataformas: [],
    camaraY: 0,
    gravedad: 0.32,
    fuerzaSalto: -8.2,
    velocidadCubo: 3.5, 
    nivelActual: 1,
    metrosParaSiguienteNivel: 200, 
    dobleSaltoDisponible: true,
    vidas: 5,
    puntoMasAltoAlcanzadoY: 400, 
    caidaCriticaDistancia: 200,
    inmune: false,
    direccionMirada: 'derecha',
    cuadroActual: 0,
    contadorAnimacion: 0,
    ticksPorCuadro: 6 
  });

  // 🔊 y 🖼️ CARGA DE ASSETS (Audio e Imágenes): Solo se ejecuta en el cliente tras el montaje
  useEffect(() => {
    // Inicialización de Imágenes de forma segura en el cliente
    imgPortalCompletadoRef.current = new Image();
    imgPortalCompletadoRef.current.src = '/imagenes/portal-completado.jpg';

    imgPlataformasRef.current = new Image();
    imgPlataformasRef.current.src = '/imagenes/Escalones1.png';

    imgPortalVerdeRef.current = new Image();
    imgPortalVerdeRef.current.src = '/imagenes/portal-vortex.png';

    // Inicialización de Audios
    musicaPistasRef.current = {
      1: new Audio('/sonido/musica-nivel1.mp3'),
      2: new Audio('/sonido/musica-nivel2.mp3'),
      3: new Audio('/sonido/musica-nivel3.mp3'),
    };
    Object.values(musicaPistasRef.current).forEach((pista) => {
      pista.loop = true;
      pista.volume = 0.35;
      pista.muted = isMutedRef.current;
    });

    audioSaltoRef.current = new Audio('/sonido/salto.mp3');
    audioSaltoRef.current.volume = 0.5;
    audioSaltoRef.current.muted = isMutedRef.current;

    audioDobleSaltoRef.current = new Audio('/sonido/doble-salto.mp3');
    audioDobleSaltoRef.current.volume = 0.5;
    audioDobleSaltoRef.current.muted = isMutedRef.current;

    audioDanoRef.current = new Audio('/sonido/damage.mp3');
    audioDanoRef.current.volume = 0.6;
    audioDanoRef.current.muted = isMutedRef.current;

    // Limpieza
    return () => {
      Object.values(musicaPistasRef.current).forEach((pista) => {
        pista.pause();
        pista.src = '';
      });
      [audioSaltoRef, audioDobleSaltoRef, audioDanoRef].forEach((refAudio) => {
        if (refAudio.current) {
          refAudio.current.pause();
          refAudio.current.src = '';
        }
      });
    };
  }, []);

  // 🔊 Reproduce un efecto de sonido desde el inicio
  const reproducirEfecto = (audioRef) => {
    const audio = audioRef.current;
    if (!audio || isMutedRef.current) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  };

  // 🌗 Fundido de entrada
  const fundidoEntrada = (audio, volumenObjetivo = 0.35, duracionMs = 700) => {
    if (!audio) return;
    const pasos = 20;
    const intervaloMs = duracionMs / pasos;
    let pasoActual = 0;
    audio.volume = 0;
    const intervalo = setInterval(() => {
      pasoActual++;
      audio.volume = Math.min(volumenObjetivo * (pasoActual / pasos), volumenObjetivo);
      if (pasoActual >= pasos) clearInterval(intervalo);
    }, intervaloMs);
  };

  // 🔊 Cambia la pista activa
  const cambiarMusicaDeFondo = (nivel) => {
    const nuevaPista = musicaPistasRef.current[nivel];
    if (!nuevaPista || musicaActualRef.current === nuevaPista) return;

    if (musicaActualRef.current) {
      musicaActualRef.current.pause();
      musicaActualRef.current.currentTime = 0;
    }
    musicaActualRef.current = nuevaPista;
    if (!isPaused && !isMutedRef.current) {
      nuevaPista.currentTime = 0;
      fundidoEntrada(nuevaPista, 0.35, 700);
      nuevaPista.play().catch(() => {});
    }
  };

  // 🔁 Reinicia la pista de música actual
  const reiniciarMusicaActual = () => {
    const pista = musicaActualRef.current;
    if (!pista) return;
    pista.currentTime = 0;
    if (!isPaused && !isMutedRef.current) {
      pista.play().catch(() => {});
    }
  };

  // 🔇 Aplica un estado de mute exacto
  const aplicarMute = (muted) => {
    isMutedRef.current = muted;
    if (musicaActualRef.current) {
      musicaActualRef.current.muted = muted;
      if (muted) {
        musicaActualRef.current.pause();
      } else if (!isPaused) {
        musicaActualRef.current.play().catch(() => {});
      }
    }
    [audioSaltoRef, audioDobleSaltoRef, audioDanoRef].forEach((refAudio) => {
      if (refAudio.current) refAudio.current.muted = muted;
    });
  };

  // 🔊 Pausa/reanuda la música al pausar
  useEffect(() => {
    const pista = musicaActualRef.current;
    if (!pista) return;
    if (isPaused || isMutedRef.current) {
      pista.pause();
    } else {
      pista.play().catch(() => {});
    }
  }, [isPaused]);

  // DISPARADOR DE SALTO COMPATIBLE CON DOBLE SALTO
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
        reproducirEfecto(audioSaltoRef);
      } 
      else if (state.dobleSaltoDisponible) {
        p.vy = state.fuerzaSalto * 0.85; 
        state.dobleSaltoDisponible = false; 
        state.puntoMasAltoAlcanzadoY = p.y; 
        reproducirEfecto(audioDobleSaltoRef);
      }
    },
    setMuted(muted) {
      aplicarMute(muted);
    },
    restartMusic() {
      restartMusic();
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

    const spriteCorrer = new Image();
    spriteCorrer.src = '/imagenes/Caballero.png';

    const spriteSalto = new Image();
    spriteSalto.src = '/imagenes/Salto1.png';

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
        state.direccionMirada = 'izquierda';
      } else if (teclasPresionadas['ArrowRight']) {
        p.vx = state.velocidadCubo;
        state.direccionMirada = 'derecha';
      } else {
        p.vx = 0;
      }
    };

    window.addEventListener('keydown', manejarKeyDown);
    window.addEventListener('keyup', manejarKeyUp);

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

      // A. FÍSICAS GENERALES
      p.x += p.vx;
      if (p.x < 0) p.x = 0;
      if (p.x + p.size > canvas.width) p.x = canvas.width - p.size;

      p.vy += state.gravedad;
      p.y += p.vy;

      if (p.vy < 0 && p.y < state.puntoMasAltoAlcanzadoY) {
        state.puntoMasAltoAlcanzadoY = p.y;
      }

      state.contadorAnimacion++;
      if (state.contadorAnimacion >= state.ticksPorCuadro) {
        state.contadorAnimacion = 0;
        const totalCuadros = p.enSuelo ? 4 : 6;
        state.cuadroActual = (state.cuadroActual + 1) % totalCuadros;
      }

      // B. COLISIONES
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
                cambiarMusicaDeFondo(state.nivelActual);

                // 🔄 MODIFICADO: Usamos .current para la imagen global
                if (imgPortalCompletadoRef.current) {
                  ctx.drawImage(imgPortalCompletadoRef.current, 0, 0, canvas.width, canvas.height);
                }
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
                if (musicaActualRef.current) musicaActualRef.current.pause();
                onGameOver(4);
              }
              return;
            }
            const distanciaCaida = p.y - state.puntoMasAltoAlcanzadoY;
            if (distanciaCaida >= state.caidaCriticaDistancia && !state.inmune) {
              state.vidas -= 1;
              state.inmune = true; 
              reproducirEfecto(audioDanoRef);
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

      // C. CÁMARA FLUIDA
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

      // D. CONDICIÓN DE GAME OVER
      if (state.vidas <= 0 || (state.plataformas[0] && state.plataformas[0].y < p.y)) {
        cancelAnimationFrame(loopId);
        if (musicaActualRef.current) musicaActualRef.current.pause();
        onGameOver(state.nivelActual); 
        return;
      }

      // E. RENDERIZADO GRÁFICO
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
            // 🔄 MODIFICADO: Usamos .current para el portal verde
            const imgPortal = imgPortalVerdeRef.current;
            if (imgPortal && imgPortal.complete && imgPortal.naturalWidth > 0) {
              const anchoPortal = 115;
              const altoPortal = 105;
              const portalX = plat.x + (plat.width / 2) - (anchoPortal / 2);
              const portalY = plat.y + plat.height - altoPortal;

              ctx.drawImage(imgPortal, portalX, portalY, anchoPortal, altoPortal);
            } else {
              ctx.fillStyle = '#22c55e';
              ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
            }
          } else {
            if (plat.width > 500) {
              ctx.fillStyle = '#1e2530';
              ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
              ctx.fillStyle = '#0f141c';
              ctx.fillRect(plat.x, plat.y, plat.width, 4);
            } else {
              // 🔄 MODIFICADO: Usamos .current para las plataformas
              const imgPlat = imgPlataformasRef.current;
              if (imgPlat && imgPlat.complete && imgPlat.naturalWidth > 0) {
                const grosorVisual = 45;
                ctx.drawImage(imgPlat, plat.x, plat.y - 10, plat.width, grosorVisual);
              } else {
                ctx.fillStyle = '#4a5568';
                ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
              }
            }
          }
        }
      }

      // RENDERIZADO AVANZADO DEL SPRITE
      ctx.save();

      if (state.inmune && Math.floor(Date.now() / 100) % 2 === 0) {
        ctx.globalAlpha = 0.5;
      }

      const usarSpriteSalto = !p.enSuelo;
      const imagenActiva = usarSpriteSalto ? spriteSalto : spriteCorrer;
      const totalCuadrosNativos = usarSpriteSalto ? 6 : 4;
      
      if (imagenActiva.complete && imagenActiva.naturalWidth > 0) {
        const anchoCuadroNativo = imagenActiva.naturalWidth / totalCuadrosNativos;
        const altoCuadroNativo = imagenActiva.naturalHeight;
        const cuadroCalculado = state.cuadroActual % totalCuadrosNativos;

        if (state.direccionMirada === 'izquierda') {
          ctx.translate(p.x + p.size, p.y);
          ctx.scale(-1, 1);
          ctx.drawImage(
            imagenActiva,
            cuadroCalculado * anchoCuadroNativo, 0, anchoCuadroNativo, altoCuadroNativo,
            0, 0, p.size, p.size
          );
        } else {
          ctx.drawImage(
            imagenActiva,
            cuadroCalculado * anchoCuadroNativo, 0, anchoCuadroNativo, altoCuadroNativo,
            p.x, p.y, p.size, p.size
          );
        }
      } else {
        ctx.fillStyle = '#ecc94b';
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }

      ctx.restore();

      // MARCADORES CENTRADOS
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
    cambiarMusicaDeFondo(gameState.current.nivelActual);

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