import React, { useState, useEffect, useRef } from "react";
import "../../styles/PensumVisual.css";
import { FaCalendarAlt, FaInfoCircle, FaCheckCircle, FaClock, FaExclamationTriangle, FaBook } from "react-icons/fa";
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

    // Throttle para mejorar rendimiento
    let timeoutId;
    const throttledUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleUpdate, 50);
    };

    // Escuchar scroll del grid y de la ventana
    const gridElement = containerRef.current.querySelector('.pensum-grid');
    if (gridElement) {
      gridElement.addEventListener('scroll', throttledUpdate, { passive: true });
    }
    window.addEventListener('scroll', throttledUpdate, true);
    window.addEventListener('resize', throttledUpdate);

    return () => {
      if (gridElement) {
        gridElement.removeEventListener('scroll', throttledUpdate);
      }
      window.removeEventListener('scroll', throttledUpdate, true);
      window.removeEventListener('resize', throttledUpdate);
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
    
    // Encontrar el grid que tiene el scroll
    const gridElement = containerRef.current.querySelector('.pensum-grid');
    const scrollLeft = gridElement?.scrollLeft || 0;
    const scrollTop = gridElement?.scrollTop || 0;
    
    // Usar getBoundingClientRect pero compensar el transform si existe
    // Primero obtenemos la posición visual
    const elementRect = element.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    
    let baseX = elementRect.left - containerRect.left + scrollLeft;
    let baseY = elementRect.top - containerRect.top + scrollTop;
    
    // Obtener el estilo computado para detectar transform de hover
    const computedStyle = window.getComputedStyle(element);
    const transform = computedStyle.transform;
    
    // Si hay transform (por hover), compensar para obtener la posición original
    if (transform && transform !== 'none') {
      // El transform es: translateY(-6px) scale(1.03)
      // Esto se convierte en una matrix transform
      // Necesitamos revertir el translateY y el scale
      
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

  // Obtener colores y estilos variados para las líneas - Paleta Universidad
  const obtenerEstiloLinea = (completado, index) => {
    // Grosor base - se ajustará con CSS responsive
    const baseWidth = 3;
    
    if (completado) {
      // Variaciones de dorado/verde - Paleta Universidad
      const estilos = [
        { color: "#C9A23F", width: baseWidth }, // Primary gold
        { color: "#34c759", width: baseWidth - 0.3 }, // Success green
        { color: "#FFD860", width: baseWidth - 0.2 }, // Secondary gold
        { color: "#10b981", width: baseWidth - 0.1 }, // Emerald
        { color: "#E8D5A3", width: baseWidth - 0.1 }, // Gold light
        { color: "#22c55e", width: baseWidth - 0.2 }, // Green bright
      ];
      return estilos[index % estilos.length];
    } else {
      // Variaciones de rojo/naranja para pendientes
      const estilos = [
        { color: "#ff3b30", width: baseWidth }, // Danger red
        { color: "#ff9500", width: baseWidth - 0.3 }, // Warning orange
        { color: "#ef4444", width: baseWidth - 0.2 }, // Red
        { color: "#f97316", width: baseWidth - 0.1 }, // Orange
        { color: "#dc2626", width: baseWidth - 0.1 }, // Dark red
        { color: "#ea580c", width: baseWidth - 0.2 }, // Dark orange
      ];
      return estilos[index % estilos.length];
    }
  };

  // Dibujar flechas SVG para prerrequisitos con camino en L
  const renderPrerequisitoArrows = () => {
    if (!pensumData || !containerRef.current) return null;

    const allAsignaturas = getAllAsignaturas();
    const arrows = [];

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
                  colorIndex: prereqIndex,
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

    return (
      <svg 
        key={arrowsKey}
        className="prerequisitos-arrows" 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
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
      {/* Encabezado con ícono y título del programa */}
      <div className="modal-header">
        <div className="modal-logo">
          <span className="logo-circle">
            <FaCalendarAlt size={20} />
          </span>
        </div>
        <div className="header-info">
          <h3>Pénsum - {pensumData.programa_nombre}</h3>
          <p className="pensum-name">{pensumData.pensum_nombre}</p>
        </div>
      </div>

      {/* Sección principal: cuadrícula con los semestres */}
      <div className="pensum-flow-container" ref={containerRef}>
        {/* Renderizar flechas primero (capa inferior) */}
        {renderPrerequisitoArrows()}
        
        {/* Grid de semestres en columnas */}
        <div className="pensum-grid" role="list" aria-label="Pensum académico por semestres">
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
                    <div className="materia-header">
                      <div className="materia-nombre">{asignatura.nombre}</div>
                      {getEstadoIcon(asignatura.estado) && (
                        <div className="estado-icon">{getEstadoIcon(asignatura.estado)}</div>
                      )}
                    </div>
                    <div className="materia-info">
                      <span className="materia-codigo">{asignatura.codigo}</span>
                      <span className="materia-creditos">{asignatura.creditos} crd</span>
                    </div>
                    <div className="materia-extra">
                      <span className="materia-tipo">{formatTipo(asignatura.tipo_nombre)}</span>
                      {asignatura.tiene_laboratorio && (
                        <span className="laboratorio-badge">Lab</span>
                      )}
                    </div>
                    {asignatura.nota !== null && asignatura.nota !== undefined && (
                      <div className="materia-nota">
                        Nota: {asignatura.nota.toFixed(2)}
                      </div>
                    )}
                    {asignatura.repeticiones > 0 && (
                      <div className="materia-repeticiones">
                        Repeticiones: {asignatura.repeticiones}
                      </div>
                    )}
                    {asignatura.prerequisitos && asignatura.prerequisitos.length > 0 && (
                      <div className="prerequisitos-indicator">
                        <FaInfoCircle /> {asignatura.prerequisitos.length} prereq.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip con prerrequisitos faltantes */}
      {hoveredAsignatura && hoveredAsignatura.prerequisitos_faltantes && hoveredAsignatura.prerequisitos_faltantes.length > 0 && (
        <div
          className="tooltip-prerequisitos"
          style={{
            position: 'fixed',
            left: `${tooltipPosition.x + 10}px`,
            top: `${tooltipPosition.y + 10}px`,
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
        <div className="legend-item activa">
          <FaInfoCircle /> Activa
        </div>
        <div className="legend-item matriculada">
          <FaBook /> Matriculada
        </div>
        <div className="legend-item cursada">
          <FaCheckCircle /> Cursada
        </div>
        <div className="legend-item en-espera">
          <FaClock /> En Espera
        </div>
        <div className="legend-item pendiente-repeticion">
          <FaExclamationTriangle /> Pendiente Repetición
        </div>
        <div className="legend-item obligatoria-repeticion">
          <FaExclamationTriangle /> Obligatoria Repetición
        </div>
        <div className="legend-item descripcion">
          <strong>FLECHAS:</strong>
          <br />
          <small>Verde = Completado | Rojo = Pendiente</small>
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
