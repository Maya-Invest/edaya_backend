// Process-only coordination shared by local entrypoints and repository tooling.
// Never imported from a Worker entrypoint.
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const controls = ['PAUSE_API', 'PAUSE_SCHEDULER', 'PAUSE_JOBS'];
const delay = ms => new Promise(done => setTimeout(done, ms));
function alive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code !== 'ESRCH'; }
}
function bool(value) {
  if (value === undefined) return false;
  if (['true', '1'].includes(String(value).trim().toLowerCase())) return true;
  if (['false', '0'].includes(String(value).trim().toLowerCase())) return false;
  throw new Error('Invalid local pause control');
}
export function localOperations(env, base = root, scopeOverride) {
  const database = value => String(value ?? '').startsWith('pglite:') ? `pglite:${resolve(base, String(value).slice(7))}` : value;
  const identity = JSON.stringify([new URL(env.API_ORIGIN).origin, database(env.DATABASE_URL), database(env.AUTH_DATABASE_URL)]);
  if (scopeOverride !== undefined && !/^[a-f0-9]{64}$/.test(scopeOverride)) throw new Error('Invalid local operational scope');
  const scope = scopeOverride ?? createHash('sha256').update(identity).digest('hex');
  const operationsRoot = resolve(env.LOCAL_OPERATIONS_ROOT || resolve(base, '.local-state/operations'));
  const rootId = createHash('sha256').update(operationsRoot).digest('hex');
  const directory = resolve(operationsRoot, scope);
  const stateFile = resolve(directory, 'state.json');
  const mutex = resolve(directory, 'mutex');
  function read() {
    const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : { revision: 0, controls: {}, seed: null };
    if (!Number.isInteger(state.revision) || !state.controls) throw new Error('Invalid local operational state');
    state.controls = Object.fromEntries(controls.map(key => [key, bool(state.controls[key] ?? env[key])]));
    return state;
  }
  async function locked(fn) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const deadline = Date.now() + 5000;
    for (;;) {
      try { mkdirSync(mutex); break; }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        if (Date.now() >= deadline) throw new Error(`Local operation lock is busy; inspect ${mutex} before recovery`);
        await delay(20);
      }
    }
    try { return fn(); }
    finally { rmSync(mutex, { recursive: true }); }
  }
  function write(state) {
    const temporary = `${stateFile}.${randomUUID()}`;
    writeFileSync(temporary, JSON.stringify(state), { mode: 0o600 });
    renameSync(temporary, stateFile);
    return state;
  }
  async function set(values, expectedRevision) {
    return locked(() => {
      const state = read();
      if (expectedRevision !== undefined && state.revision !== expectedRevision) throw new Error('Local controls changed; refusing automatic restoration');
      if (state.seed && alive(state.seed.pid)) throw new Error('A seed operation owns the local controls');
      state.seed = null;
      for (const [key, value] of Object.entries(values)) {
        if (!controls.includes(key)) throw new Error('Unknown local pause control');
        state.controls[key] = bool(value);
      }
      state.revision++;
      return write(state);
    });
  }
  async function background(keys, work) {
    const marker = await locked(() => {
      if (keys.some(key => read().controls[key])) return undefined;
      const file = resolve(directory, `active-${randomUUID()}.json`);
      writeFileSync(file, JSON.stringify({ pid: process.pid }), { mode: 0o600 });
      return file;
    });
    if (!marker) return;
    try { return await work(); }
    finally { await locked(() => rmSync(marker, { force: true })); }
  }
  async function beginSeed() {
    const owner = randomUUID();
    const before = await locked(() => {
      const state = read();
      if (state.seed && alive(state.seed.pid)) throw new Error('Another seed operation is already running');
      const prior = { ...state.controls };
      state.controls.PAUSE_SCHEDULER = true;
      state.controls.PAUSE_JOBS = true;
      state.seed = { owner, pid: process.pid };
      state.revision++;
      write(state);
      return { prior, revision: state.revision };
    });
    return {
      async drain(timeout = 60000) {
        const deadline = Date.now() + timeout;
        for (;;) {
          const active = await locked(() => readdirSync(directory).filter(name => name.startsWith('active-')).filter(name => {
            const file = resolve(directory, name);
            if (alive(JSON.parse(readFileSync(file, 'utf8')).pid)) return true;
            rmSync(file, { force: true });
            return false;
          }));
          if (!active.length) return;
          if (Date.now() >= deadline) throw new Error('Local background work did not drain; processing remains paused');
          await delay(25);
        }
      },
      async finish(success) {
        return locked(() => {
          const state = read();
          if (state.seed?.owner !== owner || state.revision !== before.revision) throw new Error('Local controls changed; processing remains paused');
          if (success) state.controls = before.prior;
          state.seed = null;
          state.revision++;
          write(state);
        });
      },
    };
  }
  return { scope, rootId, directory, read, set, background, beginSeed };
}
