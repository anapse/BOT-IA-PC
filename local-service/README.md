# Servicio local de BOT-IA-PC (Windows)

Esta primera versión proporciona almacenamiento local para tareas y memoria de proyectos, además de operaciones de archivos restringidas. No está conectado aún al coordinador de IA ni al webhook de Telegram; no ejecutar como si ya completara tareas autónomas.

## Requisitos
- Node.js 20 o superior.
- Una carpeta de proyectos autorizada, por ejemplo C:\BOT-IA-PC\Proyectos.

## Instalación inicial
1. Abre PowerShell en la carpeta local-service.
2. Ejecuta: npm install
3. Copia .env.example a .env.
4. Genera un token aleatorio de al menos 32 caracteres y colócalo en BOT_PC_TOKEN.
5. Cambia BOT_PC_ALLOWED_ROOTS por las carpetas reales que quieras autorizar. No autorices todo el disco.
6. Ejecuta: npm start

El servicio escucha en 127.0.0.1:4317 por defecto. Comprueba el estado en http://127.0.0.1:4317/health.

## API local autenticada
Todas las rutas /api requieren Authorization: Bearer <BOT_PC_TOKEN>.
- GET /api/tasks
- POST /api/tasks { "text": "...", "source": "telegram|web", "projectId": "..." }
- GET /api/memory/:projectId
- PUT /api/memory/:projectId { "memory": { "summary": "...", "decisions": [], "pendingTasks": [], "artifacts": [] } }
- POST /api/files/list { "path": "..." }
- POST /api/files/read { "path": "..." }
- POST /api/files/write { "path": "...", "content": "...", "approved": true } (solo crea archivos nuevos)
- POST /api/files/mkdir { "path": "...", "approved": true }
- POST /api/files/move { "from": "...", "to": "...", "approved": true }

## Seguridad importante
No expongas el puerto 4317 directamente a Internet. Para control remoto se integrará con el Worker mediante un túnel autenticado. No publiques el archivo .env ni el directorio data. El token de este servicio es distinto de las claves de proveedores. La primera versión no ejecuta comandos del sistema y no hace cambios sin el indicador explícito de aprobación.
