// src/componentes/GameCanvas.js
'use client';
import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

const spritePlataformaBase = { x: 0, y: 0, width: 300, height: 80 };

const GameCanvas = forwardRef(({ onGameOver, isPaused, initialMuted = false }, ref) => {
  const canvasRef = useRef(null);

  // REFERENCIAS PARA IMÁGENES
  const imgPortalCompletadoRef = useRef(null);
  const imgPlataformasRef = useRef(null);
  const imgPortalVerdeRef = useRef(null);
  
  // REFERENCIAS ENEMIGO (SLIME)
  const imgSlimeMoverRef = useRef(null);
  const imgSlimeDanoRef = useRef(null);
  const imgSlimeMuerteRef = useRef(null);

  // MÚSICA DE FONDO
  const musicaPistasRef = useRef({});
  const musicaActualRef = useRef(null);

  // SONIDOS DEL PERSONAJE Y ENEMIGO
  const audioSaltoRef = useRef(null);
  const audioDobleSaltoRef = useRef(null);
  const audioDanoRef = useRef(null);
  const audioEnemigoMuerteRef = useRef(null);
  const audioVidaRef = useRef(null); // sonido al recoger un corazón

  const isMutedRef = useRef(initialMuted);
  
  // ESTADO FÍSICO INTEGRADO DEL JUEGO
  const gameState = useRef({
    personaje: { x: 380, y: 400, vx: 0, vy: 0, size: 40, enSuelo: false },
    plataformas: [],
    enemigos: [], // Lista de enemigos activos
    corazones: [], // Corazones de vida recolectables en la plataforma
    camaraY: 0,
    gravedad: 0.32,
    fuerzaSalto: -8.2,
    velocidadCubo: 3.5, 
    nivelActual: 1,
    metrosParaSiguienteNivel: 50, 

    dobleSaltoDisponible: true,
    vidas: 5,
    vidasMaximas: 5, // tope de corazones; al llegar aquí, los corazones en el mapa desaparecen solos
    puntoMasAltoAlcanzadoY: 400, 
    caidaCriticaDistancia: 200,
    inmune: false,

    // VARIABLES PARA ANIMACIÓN DE SPRITES
    direccionMirada: 'derecha', 
    cuadroActual: 0,
    contadorAnimacion: 0,
    ticksPorCuadro: 6 
  });

  // CARGA DE ASSETS
  useEffect(() => {
    imgPortalCompletadoRef.current = new Image();
    imgPortalCompletadoRef.current.src = '/imagenes/portal-completado.jpg';

    imgPlataformasRef.current = new Image();
    imgPlataformasRef.current.src = '/imagenes/Escalones1.png';

    imgPortalVerdeRef.current = new Image();
    imgPortalVerdeRef.current.src = '/imagenes/portal-vortex.png';

    imgSlimeMoverRef.current = new Image();
    imgSlimeMoverRef.current.src = '/imagenes/Primer movimiento.png';

    imgSlimeDanoRef.current = new Image();
    imgSlimeDanoRef.current.src = '/imagenes/Daño.png';

    imgSlimeMuerteRef.current = new Image();
    imgSlimeMuerteRef.current.src = '/imagenes/Muerte.png';

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

    audioEnemigoMuerteRef.current = new Audio('/sonido/salto.mp3'); 
    audioEnemigoMuerteRef.current.volume = 0.5;
    audioEnemigoMuerteRef.current.muted = isMutedRef.current;

    // Sonido al recoger un corazón de vida
    audioVidaRef.current = new Audio('/sonido/vida.mp3');
    audioVidaRef.current.volume = 0.6;
    audioVidaRef.current.muted = isMutedRef.current;

    return () => {
      Object.values(musicaPistasRef.current).forEach((pista) => {
        pista.pause();
        pista.src = '';
      });
      [audioSaltoRef, audioDobleSaltoRef, audioDanoRef, audioEnemigoMuerteRef, audioVidaRef].forEach((refAudio) => {
        if (refAudio.current) {
          refAudio.current.pause();
          refAudio.current.src = '';
        }
      });
    };
  }, []);

  const reproducirEfecto = (audioRef) => {
    const audio = audioRef.current;
    if (!audio || isMutedRef.current) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  };

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
    [audioSaltoRef, audioDobleSaltoRef, audioDanoRef, audioEnemigoMuerteRef, audioVidaRef].forEach((refAudio) => {
      if (refAudio.current) refAudio.current.muted = muted;
    });
  };

  useEffect(() => {
    const pista = musicaActualRef.current;
    if (!pista) return;
    if (isPaused || isMutedRef.current) {
      pista.pause();
    } else {
      pista.play().catch(() => {});
    }
  }, [isPaused]);

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

    const generarEnemigosNivel3 = (plataformas) => {
      const enemigos = [];
      for (let i = 1; i < plataformas.length - 1; i++) {
        const plat = plataformas[i];
        if (Math.random() < 0.45 && plat.width > 80) {
          enemigos.push({
            id: i,
            x: plat.x + (plat.width / 2) - 17,
            y: plat.y - 30, 
            sizeX: 35,
            sizeY: 30,
            vx: Math.random() > 0.5 ? 0.9 : -0.9, 
            platLeft: plat.x,
            platRight: plat.x + plat.width,
            estado: 'patrulla', 
            cuadroAnim: 0,
            contadorAnim: 0
          });
        }
      }
      return enemigos;
    };

    // 💗 Coloca SIEMPRE 3 corazones de vida por nivel, sin importar si al jugador
    // ya le sobran vidas al llegar: quedan ahí como reserva por si más adelante,
    // en ese mismo nivel, pierde una vida y necesita recuperarla.
    // Esta función corre para CUALQUIER nivel (1, 2 o 3) desde generarPlataformasDelNivel.
    const generarCorazonesDelNivel = (plataformas) => {
      // Preferimos las plataformas más angostas (más difíciles de aterrizar)
      let candidatas = plataformas.filter(
        (plat, idx) => !plat.esPortal && idx !== 0 && plat.width <= 90
      );

      // Si no hay 3 plataformas angostas disponibles, completamos con cualquier
      // otra plataforma normal para llegar a los 3 corazones siempre que se pueda.
      if (candidatas.length < 3) {
        const resto = plataformas.filter(
          (plat, idx) => !plat.esPortal && idx !== 0 && plat.width > 90
        );
        candidatas = [...candidatas, ...resto];
      }
      if (candidatas.length === 0) return [];

      const barajadas = [...candidatas].sort(() => Math.random() - 0.5);
      const cantidad = Math.min(3, barajadas.length);
      const seleccionadas = barajadas.slice(0, cantidad);

      return seleccionadas.map((plat) => ({
        x: plat.x + plat.width / 2 - 10,
        y: plat.y - 26,
        size: 20,
      }));
    };

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
      
      if (state.nivelActual === 3) {
        state.enemigos = generarEnemigosNivel3(lista);
      } else {
        state.enemigos = [];
      }

      state.corazones = generarCorazonesDelNivel(lista);

      state.personaje.x = 380;
      state.personaje.y = 400;
      state.personaje.vx = 0;
      state.personaje.vy = 0;
      state.puntoMasAltoAlcanzadoY = 400;
      imagenFondo.src = fondosNiveles[state.nivelActual];
    };

    if (gameState.current.plataformas.length === 0) {
      generarPlataformasDelNivel();
    }

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
      // A. FÍSICAS JUGADOR
      // ==========================================
      p.x += p.vx;
      if (p.x < 0) p.x = 0;
      if (p.x + p.size > canvas.width) p.x = canvas.width - p.size;

      p.vy += state.gravedad;
      p.y += p.vy;

      if (p.vy < 0 && p.y < state.puntoMasAltoAlcanzadoY) {
        state.puntoMasAltoAlcanzadoY = p.y;
      }

      // ACTUALIZACIÓN DE ENEMIGOS Y PATRULLA EFECTIVA
      if (state.nivelActual === 3) {
        for (let ene of state.enemigos) {
          if (ene.estado === 'muerto') {
            ene.contadorAnim++;
            if (ene.contadorAnim >= 8) {
              ene.contadorAnim = 0;
              if (ene.cuadroAnim < 3) ene.cuadroAnim++;
            }
            continue; 
          }

          // Desplazamiento horizontal continuo
          ene.x += ene.vx;

          // Corrección: El rebote evalúa dinámicamente los bordes actuales de la plataforma
          if (ene.x <= ene.platLeft || ene.x + ene.sizeX >= ene.platRight) {
            ene.vx *= -1;
            ene.x = ene.x <= ene.platLeft ? ene.platLeft : ene.platRight - ene.sizeX;
          }

          ene.contadorAnim++;
          if (ene.contadorAnim >= 10) {
            ene.contadorAnim = 0;
            ene.cuadroAnim = (ene.cuadroAnim + 1) % 4;
          }
        }
      }

      // ANIMACIÓN JUGADOR
      state.contadorAnimacion++;
      if (state.contadorAnimacion >= state.ticksPorCuadro) {
        state.contadorAnimacion = 0;
        const totalCuadros = p.enSuelo ? 4 : 6;
        state.cuadroActual = (state.cuadroActual + 1) % totalCuadros;
      }

      // ==========================================
      // B. COLISIONES PLATAFORMAS
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
                cambiarMusicaDeFondo(state.nivelActual);

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
              setTimeout(() => { state.inmune = false; }, 1000);
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
      // B2. CORAZONES DE VIDA (RECOLECTABLES)
      // ==========================================
      if (state.corazones && state.corazones.length > 0) {
        state.corazones = state.corazones.filter((corazon) => {
          const colisiona =
            p.x + p.size > corazon.x &&
            p.x < corazon.x + corazon.size &&
            p.y + p.size > corazon.y &&
            p.y < corazon.y + corazon.size;

          // Solo se recoge (y desaparece) si el jugador realmente tiene una vida faltante.
          // Si ya tiene las vidas completas, el corazón se queda en la plataforma tal cual,
          // por si más adelante en este mismo nivel pierde una vida y necesita recuperarla.
          if (colisiona && state.vidas < state.vidasMaximas) {
            state.vidas = Math.min(state.vidas + 1, state.vidasMaximas);
            reproducirEfecto(audioVidaRef);
            return false; // se recoge y desaparece
          }
          return true; // se mantiene en la plataforma
        });
      }

      // DAÑO Y ELIMINACIÓN DE ENEMIGOS (CORREGIDO)
      if (state.nivelActual === 3 && !state.inmune) {
        for (let ene of state.enemigos) {
          if (ene.estado === 'muerto') continue;

          if (
            p.x + p.size > ene.x &&
            p.x < ene.x + ene.sizeX &&
            p.y + p.size > ene.y &&
            p.y < ene.y + ene.sizeY
          ) {
            // Caso A: Pisarle la cabeza cayendo
            if (p.vy > 0 && p.y + p.size - p.vy <= ene.y + 12) {
              ene.estado = 'muerto';
              ene.cuadroAnim = 0;
              ene.contadorAnim = 0;
              p.vy = state.fuerzaSalto * 0.85; // Salto de rebote
              reproducirEfecto(audioEnemigoMuerteRef);
            } 
            // Caso B: Choque lateral (Recibe daño el jugador)
            else {
              state.vidas -= 1;
              state.inmune = true;
              ene.estado = 'alerta';
              ene.cuadroAnim = 0;
              ene.contadorAnim = 0;
              reproducirEfecto(audioDanoRef);
              
              // Pequeño rebote controlado hacia arriba en lugar de empuje lateral para evitar bugs de control
              p.vy = -3.5;

              // Temporizador para quitar la inmunidad del jugador y restablecer la patrulla del slime
              setTimeout(() => {
                state.inmune = false;
                if (ene.estado === 'alerta') ene.estado = 'patrulla';
              }, 1200);
            }
          }
        }
      }

      // ==========================================
      // C. AJUSTE DE CÁMARA (ACTUALIZA PLATAFORMAS Y LÍMITES)
      // ==========================================
      const limiteSuperior = canvas.height * 0.4; 
      const limiteInferior = canvas.height * 0.7; 

      if (p.y < limiteSuperior) {
        const desfase = limiteSuperior - p.y;
        p.y = limiteSuperior;
        state.camaraY += desfase;
        state.puntoMasAltoAlcanzadoY += desfase; 
        for (let plat of state.plataformas) {
          plat.y += desfase;
        }
        for (let ene of state.enemigos) {
          ene.y += desfase;
          ene.platLeft = ene.platLeft; // Se mantienen consistentes
          ene.platRight = ene.platRight;
        }
        for (let cor of state.corazones) {
          cor.y += desfase;
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
        for (let ene of state.enemigos) {
          ene.y -= desfase;
        }
        for (let cor of state.corazones) {
          cor.y -= desfase;
        }
      }

      // Corregir posiciones de límites de patrulla dinámicamente según se muevan las plataformas vinculadas
      if (state.nivelActual === 3) {
        for (let ene of state.enemigos) {
          const platAsociada = state.plataformas[ene.id];
          if (platAsociada) {
            ene.platLeft = platAsociada.x;
            ene.platRight = platAsociada.x + platAsociada.width;
          }
        }
      }

      // ==========================================
      // D. CONDICIÓN DE GAME OVER
      // ==========================================
      if (state.vidas <= 0 || (state.plataformas[0] && state.plataformas[0].y < p.y)) {
        cancelAnimationFrame(loopId);
        if (musicaActualRef.current) musicaActualRef.current.pause();
        onGameOver(state.nivelActual); 
        return;
      }

      // ==========================================
      // E. RENDERIZADO GRÁFICO
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

      // Dibujar plataformas
      for (let plat of state.plataformas) {
        if (plat.y >= -40 && plat.y <= canvas.height + 40) {
          if (plat.esPortal) {
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
            } else {
              const imgPlat = imgPlataformasRef.current;
              if (imgPlat && imgPlat.complete && imgPlat.naturalWidth > 0) {
                ctx.drawImage(imgPlat, plat.x, plat.y - 10, plat.width, 45);
              } else {
                ctx.fillStyle = '#4a5568';
                ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
              }
            }
          }
        }
      }

      // DIBUJAR CORAZONES DE VIDA RECOLECTABLES
      if (state.corazones && state.corazones.length > 0) {
        ctx.save();
        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let cor of state.corazones) {
          if (cor.y >= -40 && cor.y <= canvas.height + 40) {
            // Pequeño efecto de flotación para que destaquen sobre la plataforma
            const flotacion = Math.sin(Date.now() / 250 + cor.x) * 3;
            ctx.fillText('❤️', cor.x + cor.size / 2, cor.y + cor.size / 2 + flotacion);
          }
        }
        ctx.restore();
      }

      // DIBUJAR ENEMIGOS (SLIMES VERDES)
      if (state.nivelActual === 3) {
        for (let ene of state.enemigos) {
          if (ene.y < -40 || ene.y > canvas.height + 40) continue;

          let imgEne = imgSlimeMoverRef.current;
          let totalCuadrosEne = 4;

          if (ene.estado === 'alerta') {
            imgEne = imgSlimeDanoRef.current;
            totalCuadrosEne = 2;
          } else if (ene.estado === 'muerto') {
            imgEne = imgSlimeMuerteRef.current;
            totalCuadrosEne = 4;
          }

          // Verificación de carga limpia
          if (imgEne && imgEne.complete && imgEne.naturalWidth > 0) {
            const anchoFrame = imgEne.naturalWidth / totalCuadrosEne;
            const altoFrame = imgEne.naturalHeight;
            const frameActual = ene.cuadroAnim % totalCuadrosEne;

            ctx.save();
            if (ene.vx > 0) {
              ctx.translate(ene.x + ene.sizeX, ene.y);
              ctx.scale(-1, 1);
              ctx.drawImage(imgEne, frameActual * anchoFrame, 0, anchoFrame, altoFrame, 0, 0, ene.sizeX, ene.sizeY);
            } else {
              ctx.drawImage(imgEne, frameActual * anchoFrame, 0, anchoFrame, altoFrame, ene.x, ene.y, ene.sizeX, ene.sizeY);
            }
            ctx.restore();
          } else {
            // Respaldo visual: Si el sprite falla, se dibuja un Slime circular verde en lugar de un cubo rojo confuso
            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.arc(ene.x + ene.sizeX / 2, ene.y + ene.sizeY / 2, ene.sizeY / 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // RENDERIZADO DEL JUGADOR
      ctx.save();
      if (state.inmune && Math.floor(Date.now() / 100) % 2 === 0) {
        ctx.globalAlpha = 0.4;
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

      // MARCADORES
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