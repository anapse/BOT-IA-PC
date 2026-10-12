# Especificación del Cloudflare Worker

## Arquitectura
El Worker actúa como el enrutador central y procesador de mensajes entre Telegram, los Agentes de IA y el Panel Web.

## Endpoints Requeridos

### 1. `GET /status`
Devuelve el estado operativo del Worker.
- **Respuesta:** `{ "status": "ok", "version": "1.0.0" }`

### 2. `POST /sync`
Sincroniza la configuración de agentes desde el Panel Web.
- **Autenticación:** Requiere un `Bearer Token` válido validado contra Firebase Admin SDK.
- **Cuerpo:** JSON con la configuración de agentes, modelos y rutas.
- **Respuesta:** `{ "status": "synced" }`

### 3. `POST /webhook/telegram/:botId`
Recibe mensajes de Telegram.
- **Procesamiento:**
  1. Valida el `botId`.
  2. Identifica el agente asociado desde la configuración sincronizada.
  3. Llama al proveedor de IA configurado para el agente.
  4. Envía la respuesta a Telegram.
  5. **Restricción:** No debe persistir el historial en Firestore ni en el Worker.

## Seguridad
- El endpoint `/sync` debe validar el token de usuario mediante Firebase Admin SDK (requiere guardar `serviceAccountKey.json` en las variables de entorno del Worker).
- Los tokens de Telegram deben almacenarse en las `Cloudflare KV` o `Secretos` del Worker, nunca en el código.
