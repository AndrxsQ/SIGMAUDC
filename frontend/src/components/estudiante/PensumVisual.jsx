import React, { useState, useEffect, useRef } from "react";
import "../../styles/PensumVisual.css";
import { FaInfoCircle, FaCheckCircle, FaClock, FaExclamationTriangle, FaBook } from "react-icons/fa";
import { pensumService } from "../../services/pensum";

const PensumVisual = () => {
  const [pensumData, setPensumData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAsignatura, setSelectedAsignatura] = useState(null);
  const [hoveredAsignatura, setHoveredAsignatura] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [arrowsKey, setArrowsKey] = useState(0);
  const containerRef = useRef(null);
  const asignaturaRefs = useRef({});

  useEffect(() => {
    const loadPensum = async () => {
      try {
        setLoading(true);
        const data = await pensumService.getPensumEstudiante();
        setPensumData(data);
      } catch (err) {
        console.error("Error loading pensum:", err);
        setError("Error al cargar el pensum. Por favor, intenta nuevamente.");
      } finally {
        setLoading(false);
      }
    };

    loadPensum();
  }, []);

  // Recalcular flechas después de que se rendericen las asignaturas
  useEffect(() => {
    if (pensumData && containerRef.current) {
      // Pequeño delay para asegurar que los elementos estén renderizados
      const timer = setTimeout(() => {
        setArrowsKey(prev => prev + 1);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [pensumData]);

  // Recalcular flechas cuando hay scroll o resize (NO cuando hay hover)
  useEffect(() => {
    if (!pensumData || !containerRef.current) return;

    const handleUpdate = () => {
      setArrowsKey(prev => prev + 1);
    };

    // Throttle más agresivo para móvil (más responsivo)
    let timeoutId;
    const throttledUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleUpdate, 16); // ~60fps para mejor respuesta en móvil
    };

    // Escuchar scroll del grid (el contenedor con scroll horizontal)
    const gridElement = containerRef.current.querySelector('.pensum-grid');
    if (gridElement) {
      // Scroll del grid (horizontal y vertical)
      gridElement.addEventListener('scroll', throttledUpdate, { passive: true });
      // Touch events para móvil (touchmove durante scroll)
      gridElement.addEventListener('touchmove', throttledUpdate, { passive: true });
      gridElement.addEventListener('touchend', handleUpdate, { passive: true });
    }
    
    // También escuchar scroll de la ventana por si acaso
    window.addEventListener('scroll', throttledUpdate, true);
    window.addEventListener('resize', handleUpdate);
    // Touch events globales para móvil
    window.addEventListener('touchmove', throttledUpdate, { passive: true });
    window.addEventListener('touchend', handleUpdate, { passive: true });

    return () => {
      if (gridElement) {
        gridElement.removeEventListener('scroll', throttledUpdate);
        gridElement.removeEventListener('touchmove', throttledUpdate);
        gridElement.removeEventListener('touchend', handleUpdate);
      }
      window.removeEventListener('scroll', throttledUpdate, true);
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('touchmove', throttledUpdate);
      window.removeEventListener('touchend', handleUpdate);
      clearTimeout(timeoutId);
    };
  }, [pensumData]);

  // NO recalcular flechas cuando cambia hoveredAsignatura
  // Esto evita que las líneas se muevan cuando se hace hover

  // Función para obtener la clase CSS según el estado
  const getEstadoClass = (estado) => {
    if (!estado) return "activa";
    switch (estado.toLowerCase()) {
      case "cursada":
        return "cursada";
      case "matriculada":
        return "matriculada";
      case "en_espera":
        return "en-espera";
      case "pendiente_repeticion":
        return "pendiente-repeticion";
      case "obligatoria_repeticion":
        return "obligatoria-repeticion";
      case "activa":
      default:
        return "activa";
    }
  };

  // Función para obtener el ícono según el estado
  const getEstadoIcon = (estado) => {
    if (!estado) return null;
    switch (estado.toLowerCase()) {
      case "cursada":
        return <FaCheckCircle />;
      case "matriculada":
        return <FaBook />;
      case "en_espera":
        return <FaClock />;
      case "pendiente_repeticion":
      case "obligatoria_repeticion":
        return <FaExclamationTriangle />;
      default:
        return null;
    }
  };

  // Función para formatear el tipo de asignatura
  const formatTipo = (tipo) => {
    if (!tipo) return "";
    return tipo
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Obtener todas las asignaturas en un mapa plano para buscar prerrequisitos
  const getAllAsignaturas = () => {
    if (!pensumData) return {};
    const map = {};
    pensumData.semestres.forEach((semestre) => {
      semestre.asignaturas.forEach((asignatura) => {
        map[asignatura.id] = { ...asignatura, semestre: semestre.numero };
      });
    });
    return map;
  };

  // Obtener posición de una asignatura para dibujar flechas
  // isSource: true para el cuadro de inicio (salir desde el borde derecho)
  // isSource: false para el cuadro final (llegar al borde izquierdo)
  // IMPORTANTE: Calcula la posición SIN considerar transforms de hover
  const getAsignaturaPosition = (asignaturaId, isSource = true, offsetY = 0) => {
    const element = asignaturaRefs.current[asignaturaId];
    if (!element || !containerRef.current) return null;
    
    // Encontrar el grid que tiene el scroll (el contenedor con scroll)
    const gridElement = containerRef.current.querySelector('.pensum-grid');
    if (!gridElement) return null;
    
    // Obtener posiciones relativas al grid con scroll
    const gridRect = gridElement.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    
    // Calcular posición relativa al grid (no a la ventana)
    // Esto funciona correctamente con scroll horizontal y vertical
    let baseX = elementRect.left - gridRect.left + gridElement.scrollLeft;
    let baseY = elementRect.top - gridRect.top + gridElement.scrollTop;
    
    // Obtener el estilo computado para detectar transform de hover
    const computedStyle = window.getComputedStyle(element);
    const transform = computedStyle.transform;
    
    // Si hay transform (por hover), compensar para obtener la posición original
    if (transform && transform !== 'none') {
      // Extraer valores del matrix transform
      const matrixMatch = transform.match(/matrix\(([^)]+)\)/);
      if (matrixMatch) {
        const values = matrixMatch[1].split(',').map(v => parseFloat(v.trim()));
        if (values.length >= 6) {
          const scaleX = values[0];
          const scaleY = values[3];
          const translateX = values[4];
          const translateY = values[5];
          
          // Revertir el translate (mover hacia abajo y a la derecha)
          baseX -= translateX;
          baseY -= translateY;
          
          // Revertir el scale: el elemento se agranda desde su centro
          // El ancho/alto visual es mayor, necesitamos el original
          const originalWidth = elementRect.width / scaleX;
          const originalHeight = elementRect.height / scaleY;
          
          // Ajustar la posición porque el scale se aplica desde el centro
          const widthDiff = (elementRect.width - originalWidth) / 2;
          const heightDiff = (elementRect.height - originalHeight) / 2;
          
          baseX += widthDiff;
          baseY += heightDiff;
        }
      }
    }
    
    // Usar el ancho/alto original (sin scale) si hay transform
    const width = (transform && transform !== 'none') 
      ? element.offsetWidth  // offsetWidth no se ve afectado por scale
      : elementRect.width;
    const height = (transform && transform !== 'none')
      ? element.offsetHeight  // offsetHeight no se ve afectado por scale
      : elementRect.height;
    
    // Si es source (inicio), salir desde el borde derecho del cuadro
    // Si es target (final), llegar al borde izquierdo del cuadro
    const x = isSource 
      ? baseX + width  // Borde derecho
      : baseX;         // Borde izquierdo
    
    const y = baseY + height / 2 + offsetY; // Centro vertical
    
    return { x, y };
  };

  // Calcular camino en L (recto, doblando en ángulos rectos tipo escalera)
  // from: borde derecho del source, to: borde izquierdo del target
  const calcularCaminoL = (from, to) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    
    // Si están en la misma posición, no dibujar
    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
      return [{ x: from.x, y: from.y }];
    }
    
    // Calcular punto medio vertical (centro del espacio entre semestres) - aquí es donde se ve mejor
    const centroY = (from.y + to.y) / 2;
    
    // Si están en la misma columna (muy poca diferencia horizontal)
    if (Math.abs(dx) < 30) {
      // Línea vertical directa
      return [
        { x: from.x, y: from.y },
        { x: to.x, y: to.y }
      ];
    }
    
    // Si están en la misma fila (muy poca diferencia vertical)
    if (Math.abs(dy) < 30) {
      // Línea horizontal directa
      return [
        { x: from.x, y: from.y },
        { x: to.x, y: to.y }
      ];
    }
    
    // Caso general: camino en L mejorado que pasa claramente por el espacio entre semestres
    // Estrategia: el recorrido horizontal debe estar exactamente en el medio entre ambas asignaturas
    const puntoMedioX = (from.x + to.x) / 2; // Punto medio exacto entre las dos asignaturas
    
    // Asegurar que la línea pase por el centro del espacio entre semestres
    // Esto hace que se vea claramente en el espacio entre columnas de semestres
    // from.x ya es el borde derecho del source, to.x ya es el borde izquierdo del target
    return [
      { x: from.x, y: from.y }, // Punto inicial desde el borde derecho del prerrequisito (source)
      { x: puntoMedioX, y: from.y }, // Salir horizontalmente hasta el medio
      { x: puntoMedioX, y: centroY }, // Bajar al centro del espacio entre semestres (recorrido vertical)
      { x: puntoMedioX, y: to.y }, // Continuar verticalmente hasta la asignatura destino
      { x: to.x, y: to.y } // Entrar horizontalmente al borde izquierdo de la asignatura (target)
    ];
  };

  // Obtener colores variados para las líneas (como en la imagen de referencia)
  const obtenerEstiloLinea = (completado, index) => {
    // Grosor base - se ajustará con CSS responsive
    const baseWidth = 3;
    
    // Colores variados para diferenciar las líneas (similar a la imagen)
    const colores = [
      "#8B5CF6", // Purple
      "#3B82F6", // Blue
      "#10B981", // Green
      "#F59E0B", // Yellow/Orange
      "#EF4444", // Red
      "#06B6D4", // Light Blue
      "#1E40AF", // Dark Blue
      "#F97316", // Orange
      "#EC4899", // Pink
      "#6366F1", // Indigo
      "#14B8A6", // Teal
      "#F43F5E", // Rose
    ];
    
    return {
      color: colores[index % colores.length],
      width: baseWidth
    };
  };

  // Dibujar flechas SVG para prerrequisitos con camino en L
  const renderPrerequisitoArrows = () => {
    if (!pensumData || !containerRef.current) return null;

    const allAsignaturas = getAllAsignaturas();
    const arrows = [];
    let globalArrowIndex = 0;

    pensumData.semestres.forEach((semestre) => {
      semestre.asignaturas.forEach((asignatura) => {
        if (asignatura.prerequisitos && asignatura.prerequisitos.length > 0) {
          // Contar cuántos prerrequisitos tiene esta asignatura
          const numPrereqs = asignatura.prerequisitos.length;
          
          asignatura.prerequisitos.forEach((prereq, prereqIndex) => {
            const prereqAsignatura = allAsignaturas[prereq.prerequisito_id];
            if (prereqAsignatura) {
              // Calcular offsets verticales para separar múltiples líneas
              const separacionVertical = 30; // Separación vertical entre líneas
              
              const offsetVerticalFrom = numPrereqs > 1 
                ? (prereqIndex - (numPrereqs - 1) / 2) * separacionVertical
                : 0;
              
              const offsetVerticalTo = numPrereqs > 1 
                ? (prereqIndex - (numPrereqs - 1) / 2) * separacionVertical
                : 0;
              
              // Source: salir desde el borde derecho del prerrequisito
              // Target: llegar al borde izquierdo de la asignatura
              const fromPos = getAsignaturaPosition(prereq.prerequisito_id, true, offsetVerticalFrom);
              const toPos = getAsignaturaPosition(asignatura.id, false, offsetVerticalTo);
              
              if (fromPos && toPos) {
                const camino = calcularCaminoL(fromPos, toPos);
                arrows.push({
                  camino: camino,
                  completado: prereq.completado,
                  key: `${prereq.prerequisito_id}-${asignatura.id}-${prereqIndex}`,
                  colorIndex: globalArrowIndex++,
                  asignaturaId: asignatura.id,
                  prerequisitoId: prereq.prerequisito_id,
                });
              }
            }
          });
        }
      });
    });

    if (arrows.length === 0) return null;

    if (!containerRef.current) return null;

    // Obtener el grid para calcular el tamaño real del contenido
    const gridElement = containerRef.current.querySelector('.pensum-grid');
    if (!gridElement) return null;

    // Calcular el tamaño real del contenido (incluyendo lo que está fuera del viewport)
    const scrollWidth = gridElement.scrollWidth;
    const scrollHeight = gridElement.scrollHeight;
    const clientWidth = gridElement.clientWidth;
    const clientHeight = gridElement.clientHeight;

    // Usar el tamaño más grande entre el viewport y el contenido scrolleable
    const svgWidth = Math.max(scrollWidth, clientWidth);
    const svgHeight = Math.max(scrollHeight, clientHeight);

    return (
      <svg 
        key={arrowsKey}
        className="prerequisitos-arrows" 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: `${svgWidth}px`, 
          height: `${svgHeight}px`, 
          pointerEvents: 'none', 
          zIndex: 1,
          overflow: 'visible'
        }}
      >
        {arrows.map((arrow) => {
          // Usar estilo variado según el índice (color y grosor)
          const estilo = obtenerEstiloLinea(arrow.completado, arrow.colorIndex);
          
          // Opacidad mejorada para mejor visibilidad
          const opacity = arrow.completado ? 0.9 : 0.8;
          
          // Dibujar el camino como una polyline (líneas rectas conectadas)
          const puntos = arrow.camino.map(p => `${p.x},${p.y}`).join(' ');
          
          return (
            <g key={arrow.key}>
              {/* Línea principal con mejor visibilidad */}
              <polyline
                points={puntos}
                fill="none"
                stroke={estilo.color}
                strokeWidth={estilo.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={opacity}
                className={arrow.completado ? 'linea-completada' : 'linea-pendiente'}
              />
            </g>
          );
        })}
      </svg>
    );
  };

  // Manejar hover para mostrar tooltip
  const handleAsignaturaHover = (e, asignatura) => {
    setHoveredAsignatura(asignatura);
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  };

  const handleAsignaturaLeave = () => {
    setHoveredAsignatura(null);
  };

  if (loading) {
    return (
      <div className="pensum-container">
        <div className="loading-container">
          <div className="loading-spinner" aria-label="Cargando pensum"></div>
          <p>Cargando pensum...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pensum-container">
        <div className="error-container" role="alert">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!pensumData || !pensumData.semestres || pensumData.semestres.length === 0) {
    return (
      <div className="pensum-container">
        <div className="error-container" role="alert">
          <p>No se encontró información del pensum.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pensum-container">
      {/* Encabezado con logo, ícono y título del programa */}
      <div className="modal-header">
        <div className="pensum-logo-container">
          <img 
            src="/logo-udc.png" 
            alt="Logo Universidad" 
            className="pensum-logo"
          />
        </div>
        <div className="header-info">
          <h3>Pénsum - {pensumData.programa_nombre}</h3>
          <p className="pensum-name">{pensumData.pensum_nombre}</p>
        </div>
      </div>

      {/* Sección principal: cuadrícula con los semestres */}
      <div className="pensum-flow-container" ref={containerRef}>
        {/* Grid de semestres en columnas */}
        <div className="pensum-grid" role="list" aria-label="Pensum académico por semestres">
          {/* Renderizar flechas dentro del grid para que las coordenadas funcionen con scroll */}
          {renderPrerequisitoArrows()}
          {pensumData.semestres.map((semestre) => (
            <div key={semestre.numero} className="semestre-column" role="listitem">
              <h3 className="semestre-title">Semestre {semestre.numero}</h3>

              {/* Lista de materias dentro del semestre */}
              <div className="materias-list" role="list" aria-label={`Asignaturas del semestre ${semestre.numero}`}>
                {semestre.asignaturas.map((asignatura, index) => (
                  <div
                    key={`${semestre.numero}-${asignatura.id}-${index}`}
                    ref={(el) => {
                      if (el) asignaturaRefs.current[asignatura.id] = el;
                    }}
                    className={`materia-card ${getEstadoClass(asignatura.estado)} ${
                      hoveredAsignatura && (
                        hoveredAsignatura.id === asignatura.id ||
                        (hoveredAsignatura.prerequisitos && 
                         hoveredAsignatura.prerequisitos.some(p => p.prerequisito_id === asignatura.id))
                      ) ? 'resaltada' : ''
                    }`}
                    onMouseEnter={(e) => {
                      handleAsignaturaHover(e, asignatura);
                      setHoveredAsignatura(asignatura);
                    }}
                    onMouseLeave={() => {
                      handleAsignaturaLeave();
                      setHoveredAsignatura(null);
                    }}
                    onClick={() => setSelectedAsignatura(asignatura)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedAsignatura(asignatura);
                      }
                    }}
                    role="listitem"
                    tabIndex={0}
                    aria-label={`${asignatura.nombre}, ${asignatura.estado || 'activa'}, ${asignatura.creditos} créditos`}
                    style={{ position: 'relative', zIndex: 2 }}
                  >
                    <div className="materia-nombre">{asignatura.nombre}</div>
                    <div className="materia-info-top">
                      <span className="materia-codigo">{asignatura.codigo}</span>
                      <span className="materia-creditos">{asignatura.creditos}</span>
                    </div>
                    {/* Mostrar nota en la parte inferior izquierda si el estado no es matriculada, activa o en_espera */}
                    {asignatura.nota !== null && asignatura.nota !== undefined && 
                     asignatura.estado && 
                     !['matriculada', 'activa', 'en_espera'].includes(asignatura.estado.toLowerCase()) && (
                      <div className="materia-info-bottom">
                        <span className="materia-nota-left">{asignatura.nota.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip de prerrequisitos faltantes */}
      {hoveredAsignatura && hoveredAsignatura.prerequisitos_faltantes && hoveredAsignatura.prerequisitos_faltantes.length > 0 && (
        <div
          className="tooltip-prerequisitos"
          style={{
            position: 'fixed',
            left: `${tooltipPosition.x + 10}px`,
            top: `${tooltipPosition.y + 50}px`,
            zIndex: 1000,
          }}
        >
          <div className="tooltip-header">Prerrequisitos faltantes:</div>
          <ul className="tooltip-list">
            {hoveredAsignatura.prerequisitos_faltantes.map((prereq) => (
              <li key={prereq.id}>
                {prereq.codigo} - {prereq.nombre}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Información para el usuario - Leyenda */}
      <div className="pensum-legend">
        <div className="legend-header">
          <h4>Estados de Asignaturas</h4>
        </div>
        <div className="legend-content">
          <div className="legend-item activa">
            <div className="legend-color-box activa"></div>
            <FaInfoCircle /> 
            <div className="legend-text">
              <strong>Activa</strong>
              <small>Asignatura disponible para matricular, no tiene prerrequisitos pendientes.</small>
            </div>
          </div>
          <div className="legend-item matriculada">
            <div className="legend-color-box matriculada"></div>
            <FaBook /> 
            <div className="legend-text">
              <strong>Matriculada</strong>
              <small>Asignatura en la que estás actualmente inscrito en el semestre vigente.</small>
            </div>
          </div>
          <div className="legend-item cursada">
            <div className="legend-color-box cursada"></div>
            <FaCheckCircle /> 
            <div className="legend-text">
              <strong>Cursada</strong>
              <small>Asignatura que ya has cursado y aprobado (nota ≥ 3.0).</small>
            </div>
          </div>
          <div className="legend-item en-espera">
            <div className="legend-color-box en-espera"></div>
            <FaClock /> 
            <div className="legend-text">
              <strong>En Espera</strong>
              <small>Asignatura que requiere prerrequisitos que aún no has completado.</small>
            </div>
          </div>
          <div className="legend-item pendiente-repeticion">
            <div className="legend-color-box pendiente-repeticion"></div>
            <FaExclamationTriangle /> 
            <div className="legend-text">
              <strong>Pendiente Repetición</strong>
              <small>Asignatura que debes repetir porque no alcanzaste la nota mínima.</small>
            </div>
          </div>
          <div className="legend-item obligatoria-repeticion">
            <div className="legend-color-box obligatoria-repeticion"></div>
            <FaExclamationTriangle /> 
            <div className="legend-text">
              <strong>Obligatoria Repetición</strong>
              <small>Asignatura que debes repetir obligatoriamente según el reglamento académico.</small>
            </div>
          </div>
        </div>
      </div>

      {/* Información sobre el formato de las cards */}
      <div className="pensum-format-info">
        <div className="format-header">
          <h4>Formato de las Asignaturas</h4>
        </div>
        <div className="format-example">
          <div className="format-card-example">
            <div className="format-card-nombre">Nombre de la Asignatura</div>
            <div className="format-card-info-top">
              <span className="format-card-codigo">CODIGO</span>
              <span className="format-card-creditos">Crd</span>
            </div>
            <div className="format-card-info-bottom">
              <span className="format-card-nota-example">Nota</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal para mostrar detalles de la asignatura */}
      {selectedAsignatura && (
        <div className="modal-overlay" onClick={() => setSelectedAsignatura(null)}>
          <div className="modal-content-detalle" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedAsignatura(null)}>
              ✖
            </button>
            <h3>{selectedAsignatura.nombre}</h3>
            <div className="detalle-info">
              <div className="detalle-row">
                <strong>Código:</strong> {selectedAsignatura.codigo}
              </div>
              <div className="detalle-row">
                <strong>Créditos:</strong> {selectedAsignatura.creditos}
              </div>
              <div className="detalle-row">
                <strong>Tipo:</strong> {formatTipo(selectedAsignatura.tipo_nombre)}
              </div>
              {selectedAsignatura.tiene_laboratorio && (
                <div className="detalle-row">
                  <strong>Laboratorio:</strong> Sí
                </div>
              )}
              <div className="detalle-row">
                <strong>Categoría:</strong>{" "}
                {selectedAsignatura.categoria.charAt(0).toUpperCase() +
                  selectedAsignatura.categoria.slice(1)}
              </div>
              <div className="detalle-row">
                <strong>Estado:</strong>{" "}
                <span className={`estado-badge ${getEstadoClass(selectedAsignatura.estado)}`}>
                  {selectedAsignatura.estado
                    ? selectedAsignatura.estado
                        .split("_")
                        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(" ")
                    : "Activa"}
                </span>
              </div>
              {selectedAsignatura.grupo_id && (
                <div className="detalle-row">
                  <strong>Grupo:</strong> {selectedAsignatura.grupo_id}
                </div>
              )}
              {selectedAsignatura.periodo_cursada && (
                <div className="detalle-row">
                  <strong>Periodo cursada:</strong> {selectedAsignatura.periodo_cursada}
                </div>
              )}
              {selectedAsignatura.nota !== null && selectedAsignatura.nota !== undefined && (
                <div className="detalle-row">
                  <strong>Nota:</strong> {selectedAsignatura.nota.toFixed(2)}
                </div>
              )}
              {selectedAsignatura.repeticiones > 0 && (
                <div className="detalle-row">
                  <strong>Repeticiones:</strong> {selectedAsignatura.repeticiones}
                </div>
              )}
              {selectedAsignatura.prerequisitos && selectedAsignatura.prerequisitos.length > 0 && (
                <div className="detalle-row">
                  <strong>Prerrequisitos:</strong>
                  <ul className="prerequisitos-list">
                    {selectedAsignatura.prerequisitos.map((prereq) => (
                      <li key={prereq.id} className={prereq.completado ? "completado" : "pendiente"}>
                        {prereq.codigo} - {prereq.nombre}
                        {prereq.completado ? (
                          <span className="check-mark"> ✓</span>
                        ) : (
                          <span className="pending-mark"> ⏳</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedAsignatura.prerequisitos_faltantes && selectedAsignatura.prerequisitos_faltantes.length > 0 && (
                <div className="detalle-row">
                  <strong>Prerrequisitos faltantes:</strong>
                  <ul className="prerequisitos-list">
                    {selectedAsignatura.prerequisitos_faltantes.map((prereq) => (
                      <li key={prereq.id} className="pendiente">
                        {prereq.codigo} - {prereq.nombre}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PensumVisual;
