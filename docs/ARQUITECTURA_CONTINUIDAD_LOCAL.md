# BOT-IA-PC — Arquitectura de continuidad local

## Decisión de arquitectura

La unidad de trabajo es el proyecto/tarea, no el proveedor ni la conversación de un único modelo. La tarea conserva objetivo, estado, decisiones, artefactos, resultado y siguiente paso. El coordinador puede cambiar de agente o proveedor sin reiniciar el trabajo.

## Componentes

- Proveedores: credenciales, endpoint y capacidades de conexión. No se guardan IDs de modelos como si fueran proveedores.
- Agentes: instrucciones/persona, proveedor y modelo preferidos, capacidades y permisos locales.
- Chat: conversación persistente que puede invocar agentes mediante comandos con alias o elegir un modelo directamente.
- Coordinador: cola de tareas, checkpoints, límite de intentos/tiempo y validación de finalización.
- Servicio local Windows: única puerta de acceso a archivos locales; valida token, carpetas permitidas y operaciones aprobadas.
- Memoria local: resumen, decisiones, tareas pendientes y referencias a artefactos en disco.
- Telegram: entrada remota autenticada y notificaciones; los bots solo pueden invocar agentes asignados.
- Firebase/Cloudflare: pueden seguir para autenticación y configuración sincronizada; no son la fuente principal de la memoria local.

## Persistencia

El servicio local usa local-service/data/projects/<id>.json para memoria y local-service/data/tasks.jsonl para la cola. El directorio data/ está excluido de Git. Los artefactos reales viven dentro de las raíces permitidas que configura el usuario.

## Seguridad

- El servicio escucha en 127.0.0.1 por defecto.
- No iniciar si falta un token aleatorio de al menos 32 caracteres o una raíz permitida.
- No exponer directamente el puerto local a Internet. El acceso remoto debe pasar por un túnel autenticado y por la capa Cloudflare/Telegram.
- Validar rutas y symlinks para impedir escapar de las carpetas permitidas.
- Escritura/creación/movimiento requieren una marca de aprobación explícita.
- No ejecutar comandos arbitrarios en esta primera versión. El ejecutor de comandos debe tener su propio permiso, allowlist y registro.
- La memoria puede contener datos sensibles: no sincronizarla automáticamente con la nube.

## Estado de implementación

La primera base local ofrece salud, registro persistente de tareas, memoria JSON por proyecto y operaciones restringidas de listar/leer/crear/mover archivos. La cola aún no ejecuta tareas por sí misma; se debe añadir un worker local y conectar el Worker de Cloudflare/Telegram con un túnel autenticado antes de usarla remotamente.
