import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

const HOST = process.env.BOT_PC_HOST || '127.0.0.1';
const PORT = Number(process.env.BOT_PC_PORT || 4317);
const TOKEN = process.env.BOT_PC_TOKEN || '';
const DATA_DIR = path.resolve(process.env.BOT_PC_DATA_DIR || './data');
const ROOTS = (process.env.BOT_PC_ALLOWED_ROOTS || '')
  .split(path.delimiter).map(s => s.trim()).filter(Boolean).map(s => path.resolve(s));
const TASKS_FILE = path.join(DATA_DIR, 'tasks.jsonl');
const MEMORY_DIR = path.join(DATA_DIR, 'projects');

if (TOKEN.length < 32) {
  console.error('BOT_PC_TOKEN debe tener al menos 32 caracteres. Servicio no iniciado.');
  process.exit(1);
}
if (!ROOTS.length) {
  console.error('Configura BOT_PC_ALLOWED_ROOTS con al menos una carpeta autorizada. Servicio no iniciado.');
  process.exit(1);
}

await fs.mkdir(DATA_DIR, { recursive: true });
await fs.mkdir(MEMORY_DIR, { recursive: true });
await fs.appendFile(TASKS_FILE, '');

const sendError = (res, status, message) => res.status(status).json({ ok: false, error: message });
const authenticate = (req, res, next) => {
  const value = req.get('authorization') || '';
  const token = value.startsWith('Bearer ') ? value.slice(7) : '';
  const a = Buffer.from(token);
  const b = Buffer.from(TOKEN);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return sendError(res, 401, 'No autorizado');
  next();
};
app.use('/api', authenticate);

function safeProjectId(value) {
  const id = String(value || '').trim();
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new Error('ID de proyecto no válido');
  return id;
}
function safePath(input) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('Ruta obligatoria');
  const candidate = path.resolve(input);
  const allowed = ROOTS.some(root => candidate === root || candidate.startsWith(root + path.sep));
  if (!allowed) throw new Error('La ruta está fuera de las carpetas autorizadas');
  return candidate;
}
async function ensureInsideRoot(target) {
  const resolved = path.resolve(target);
  const allowed = ROOTS.some(root => resolved === root || resolved.startsWith(root + path.sep));
  if (!allowed) throw new Error('Ruta no autorizada');
  let probe = resolved;
  while (probe !== path.dirname(probe)) {
    try {
      const real = await fs.realpath(probe);
      if (!ROOTS.some(root => real === root || real.startsWith(root + path.sep))) {
        throw new Error('La ruta real sale de la carpeta autorizada');
      }
      break;
    } catch (error) {
      if (error?.code === 'ENOENT') probe = path.dirname(probe);
      else throw error;
    }
  }
  return resolved;
}
async function readTasks() {
  const text = await fs.readFile(TASKS_FILE, 'utf8');
  return text.split('\n').filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
}
async function writeTask(task) {
  await fs.appendFile(TASKS_FILE, JSON.stringify(task) + '\n', 'utf8');
}

app.get('/health', (_req, res) => res.json({
  ok: true, service: 'BOT-IA-PC local service', hostname: os.hostname(),
  allowedRoots: ROOTS.length, time: new Date().toISOString()
}));

app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await readTasks();
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    res.json({ ok: true, tasks: tasks.slice(-limit).reverse() });
  } catch { sendError(res, 500, 'No se pudo leer la cola local'); }
});

app.post('/api/tasks', async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text || text.length > 12000) return sendError(res, 400, 'La tarea debe tener entre 1 y 12000 caracteres');
  const task = {
    id: crypto.randomUUID(), text, source: ['web', 'telegram'].includes(req.body?.source) ? req.body.source : 'web',
    projectId: (() => { try { return safeProjectId(req.body?.projectId || 'inbox'); } catch { return 'inbox'; } })(),
    status: 'queued', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    requiresApproval: true
  };
  await writeTask(task);
  res.status(201).json({ ok: true, task, message: 'Tarea guardada localmente. La ejecución requiere un worker local conectado.' });
});

app.get('/api/memory/:projectId', async (req, res) => {
  try {
    const id = safeProjectId(req.params.projectId);
    const file = path.join(MEMORY_DIR, id + '.json');
    try {
      const data = JSON.parse(await fs.readFile(file, 'utf8'));
      res.json({ ok: true, memory: data });
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      res.json({ ok: true, memory: { projectId: id, summary: '', decisions: [], pendingTasks: [], artifacts: [], updatedAt: null } });
    }
  } catch (error) { sendError(res, 400, error.message || 'Memoria no válida'); }
});

app.put('/api/memory/:projectId', async (req, res) => {
  try {
    const id = safeProjectId(req.params.projectId);
    const input = req.body?.memory;
    if (!input || typeof input !== 'object' || Array.isArray(input)) return sendError(res, 400, 'Se requiere un objeto memory');
    const memory = {
      projectId: id,
      summary: String(input.summary || '').slice(0, 50000),
      decisions: Array.isArray(input.decisions) ? input.decisions.slice(-500) : [],
      pendingTasks: Array.isArray(input.pendingTasks) ? input.pendingTasks.slice(-500) : [],
      artifacts: Array.isArray(input.artifacts) ? input.artifacts.slice(-1000) : [],
      updatedAt: new Date().toISOString()
    };
    const file = path.join(MEMORY_DIR, id + '.json');
    const temp = file + '.' + crypto.randomUUID() + '.tmp';
    await fs.writeFile(temp, JSON.stringify(memory, null, 2), 'utf8');
    await fs.rename(temp, file);
    res.json({ ok: true, memory });
  } catch (error) { sendError(res, 400, error.message || 'No se pudo guardar la memoria'); }
});

app.post('/api/files/list', async (req, res) => {
  try {
    const dir = await ensureInsideRoot(safePath(req.body?.path));
    const entries = await fs.readdir(dir, { withFileTypes: true });
    res.json({ ok: true, path: dir, entries: entries.slice(0, 2000).map(e => ({ name: e.name, type: e.isDirectory() ? 'directory' : e.isFile() ? 'file' : 'other' })) });
  } catch (error) { sendError(res, 400, error.message || 'No se pudo listar la carpeta'); }
});

app.post('/api/files/read', async (req, res) => {
  try {
    const file = await ensureInsideRoot(safePath(req.body?.path));
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > 2 * 1024 * 1024) return sendError(res, 413, 'Solo se leen archivos de hasta 2 MB');
    res.json({ ok: true, path: file, content: await fs.readFile(file, 'utf8') });
  } catch (error) { sendError(res, 400, error.message || 'No se pudo leer el archivo'); }
});

app.post('/api/files/write', async (req, res) => {
  try {
    if (req.body?.approved !== true) return sendError(res, 403, 'Escritura bloqueada: requiere approved=true');
    const file = await ensureInsideRoot(safePath(req.body?.path));
    const content = typeof req.body?.content === 'string' ? req.body.content : '';
    if (Buffer.byteLength(content, 'utf8') > 2 * 1024 * 1024) return sendError(res, 413, 'El contenido supera 2 MB');
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content, { encoding: 'utf8', flag: 'wx' }).catch(async error => {
      if (error?.code !== 'EEXIST') throw error;
      throw new Error('El archivo ya existe; sobrescribir requiere una operación explícita y aprobada');
    });
    res.status(201).json({ ok: true, path: file, bytes: Buffer.byteLength(content, 'utf8') });
  } catch (error) { sendError(res, 400, error.message || 'No se pudo crear el archivo'); }
});

app.post('/api/files/mkdir', async (req, res) => {
  try {
    if (req.body?.approved !== true) return sendError(res, 403, 'Crear carpetas requiere approved=true');
    const dir = await ensureInsideRoot(safePath(req.body?.path));
    await fs.mkdir(dir, { recursive: true });
    res.json({ ok: true, path: dir });
  } catch (error) { sendError(res, 400, error.message || 'No se pudo crear la carpeta'); }
});

app.post('/api/files/move', async (req, res) => {
  try {
    if (req.body?.approved !== true) return sendError(res, 403, 'Mover archivos requiere approved=true');
    const from = await ensureInsideRoot(safePath(req.body?.from));
    const to = await ensureInsideRoot(safePath(req.body?.to));
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.rename(from, to);
    res.json({ ok: true, from, to });
  } catch (error) { sendError(res, 400, error.message || 'No se pudo mover el archivo'); }
});

app.listen(PORT, HOST, () => {
  console.log('BOT-IA-PC local service en http://' + HOST + ':' + PORT);
  console.log('Carpetas autorizadas: ' + ROOTS.join(', '));
});
