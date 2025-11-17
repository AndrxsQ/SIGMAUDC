# Gestión de Documentos - Información Técnica

## Ubicación de los Archivos

Los documentos subidos por los estudiantes se guardan en el directorio `./uploads/` (relativo al directorio donde se ejecuta el servidor Go).

### Configuración

- **Variable de entorno:** `UPLOAD_DIR`
- **Valor por defecto:** `./uploads`
- **Ubicación relativa:** Desde el directorio raíz del proyecto (`D:\Github\SIGMAUDC\`)

### Estructura de Nombres de Archivo

Los archivos se guardan con el siguiente formato:
```
{estudiante_id}_{timestamp}_{tipo_documento}_{nombre_original}.{extension}
```

Ejemplo:
```
1_1699123456_certificado_eps_documento.pdf
```

### Rutas de Acceso

- **URL de subida:** `POST /api/documentos` (protegida, requiere JWT)
- **URL de descarga:** `GET /uploads/{nombre_archivo}` (pública, sirve archivos estáticos)

### Notas Importantes

1. El directorio `uploads/` se crea automáticamente al iniciar el servidor si no existe.
2. Los archivos se eliminan automáticamente cuando un documento rechazado es resubido.
3. Los archivos se validan por extensión: solo se permiten `.pdf`, `.png`, `.jpg`, `.jpeg`.
4. Tamaño máximo: 10MB por archivo.

### Seguridad

- Solo estudiantes autenticados pueden subir documentos.
- Solo la jefatura departamental puede revisar documentos de su programa.
- Los archivos se sirven como estáticos pero el acceso se controla mediante la aplicación.

