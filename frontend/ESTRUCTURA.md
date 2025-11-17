# Estructura del Frontend - SIGMA-UDC

## Arquitectura Modular por Roles

El frontend está organizado de manera modular para facilitar el mantenimiento, depuración y desarrollo independiente de funcionalidades para diferentes roles de usuario.

## Estructura de Carpetas

```
frontend/src/
├── components/
│   ├── common/              # Componentes compartidos (todos los roles)
│   │   ├── Login.jsx        # Componente de inicio de sesión
│   │   └── SetPassword.jsx  # Componente para crear contraseña inicial
│   │
│   ├── estudiante/          # Componentes específicos para estudiantes
│   │   ├── Sidebar.jsx      # Barra lateral de navegación
│   │   ├── Subir.jsx        # Componente para subir documentos
│   │   ├── HojaDeVida.jsx   # Componente de hoja de vida
│   │   └── PensumVisual.jsx # Visualización del pensum
│   │
│   └── jefe/                # Componentes específicos para jefes departamentales
│       └── SidebarJefe.jsx  # Barra lateral de navegación para jefes
│
├── pages/
│   ├── estudiante/          # Páginas para estudiantes
│   │   └── Home.jsx         # Página principal del estudiante
│   │
│   └── jefe/                # Páginas para jefes departamentales
│       ├── HomeJefe.jsx     # Página principal del jefe
│       └── Plazos.jsx       # Gestión de plazos académicos
│
├── services/                # Servicios de API
│   ├── auth.js              # Servicio de autenticación
│   └── plazos.js            # Servicio de gestión de plazos
│
└── styles/                  # Archivos CSS
    ├── Login.css
    ├── Home.css
    ├── Sidebar.css
    ├── Plazos.css
    └── ...
```

## Principios de Organización

### 1. Separación por Roles
- **`components/common/`**: Componentes que son utilizados por todos los roles (Login, SetPassword)
- **`components/estudiante/`**: Componentes exclusivos para estudiantes
- **`components/jefe/`**: Componentes exclusivos para jefes departamentales

### 2. Separación de Páginas
- **`pages/estudiante/`**: Páginas completas para el flujo de estudiantes
- **`pages/jefe/`**: Páginas completas para el flujo de jefes

### 3. Servicios Centralizados
- Todos los servicios de API están en `services/`
- Cada servicio maneja las peticiones HTTP relacionadas con su dominio

### 4. Estilos Compartidos
- Los estilos están en `styles/` y pueden ser importados por cualquier componente
- Cada componente importa sus estilos usando rutas relativas: `../../styles/Archivo.css`

## Ventajas de esta Estructura

1. **Modularidad**: Cada módulo (estudiante/jefe) es independiente
2. **Mantenibilidad**: Fácil localizar y modificar componentes específicos
3. **Escalabilidad**: Agregar nuevos componentes o páginas es sencillo
4. **Depuración**: Errores se localizan rápidamente por contexto
5. **Colaboración**: Diferentes desarrolladores pueden trabajar en módulos diferentes sin conflictos

## Convenciones de Imports

### Desde componentes en subcarpetas:
```javascript
// Importar servicios
import { authService } from "../../services/auth";

// Importar estilos
import "../../styles/Login.css";

// Importar componentes del mismo nivel
import PensumVisual from "./PensumVisual";
```

### Desde App.jsx (raíz):
```javascript
// Componentes comunes
import Login from "./components/common/Login";

// Componentes de estudiantes
import Sidebar from "./components/estudiante/Sidebar";

// Componentes de jefes
import SidebarJefe from "./components/jefe/SidebarJefe";

// Páginas
import Home from "./pages/estudiante/Home";
import HomeJefe from "./pages/jefe/HomeJefe";
```

## Agregar Nuevos Componentes

### Para Estudiantes:
1. Crear archivo en `components/estudiante/NuevoComponente.jsx`
2. Importar estilos desde `../../styles/NuevoComponente.css`
3. Importar servicios desde `../../services/servicio.js`

### Para Jefes:
1. Crear archivo en `components/jefe/NuevoComponente.jsx`
2. Importar estilos desde `../../styles/NuevoComponente.css`
3. Importar servicios desde `../../services/servicio.js`

### Para Páginas:
1. Crear archivo en `pages/estudiante/` o `pages/jefe/`
2. Seguir las mismas convenciones de imports

## Notas Importantes

- **No mezclar componentes de diferentes roles** en la misma carpeta
- **Mantener servicios centralizados** en `services/`
- **Usar rutas relativas** para imports dentro del mismo módulo
- **Documentar componentes complejos** con comentarios en el código

