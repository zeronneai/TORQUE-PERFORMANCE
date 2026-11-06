// Content approval (Admin > Content). The social media videos live in Roots Engine (Purple Roots Agency):
// the agency connects the Dropbox folder there; Roots Engine downloads each video, transcribes it and writes
// the copy options, on screen text ideas and a suggested cover. This only relays what the admin picks.
// The Dropbox link never comes through here. Same flow as the Tippin' Cowgirl and DejaVu portals.
// Env: ROOTS_PANEL_TOKEN (Roots Engine > Torque Baseball > Aprobar > Panel propio del cliente), ROOTS_ENGINE_URL (optional).

const env = (k, d = '') => process.env[k] || d;
const BASE = () => env('ROOTS_ENGINE_URL', 'https://roots-engine.vercel.app').replace(/\/$/, '');
export const contentReady = () => /^[0-9a-f]{64}$/.test(env('ROOTS_PANEL_TOKEN'));

async function roots(method, body) {
  const r = await fetch(BASE() + '/api/panel/content', {
    method,
    headers: { authorization: 'Bearer ' + env('ROOTS_PANEL_TOKEN'), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j };
}

export async function listContent() {
  if (!contentReady()) return { ok: true, connected: false, items: [], slots: [] };
  try {
    const { status, j } = await roots('GET');
    if (status !== 200) return { ok: true, connected: false, error: status === 401 ? 'token' : 'down', items: [], slots: [] };
    return { ok: true, connected: true, items: j.items || [], slots: j.slots || [], folders: j.folders || null, at: j.at };
  } catch (e) {
    console.error('roots list', e.message);
    return { ok: true, connected: false, error: 'down', items: [], slots: [] };
  }
}

const ACTIONS = ['save', 'approve', 'reject', 'pending', 'upload', 'cover', 'day', 'refresh'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export async function contentAction(b = {}) {
  if (!contentReady()) return { ok: false, error: 'not_connected' };
  if (!ACTIONS.includes(b.action)) return { ok: false, error: 'bad_action' };
  const body = { action: b.action, id: String(b.id || ''), by: "Torque admin panel" };
  if (b.action === 'save' || b.action === 'approve') body.caption = String(b.caption || '').slice(0, 2200);
  if (b.action === 'approve' && b.mediaPath) { body.mediaPath = String(b.mediaPath); body.overlayText = String(b.overlayText || '').slice(0, 200); }
  if (b.action === 'upload') { body.ext = b.ext === 'jpg' ? 'jpg' : 'mp4'; if (b.cover) { body.cover = true; body.ext = 'jpg'; } }
  if ((b.action === 'approve' || b.action === 'day') && DAY.test(String(b.postOn || ''))) body.postOn = b.postOn;
  if (b.action === 'cover') { body.coverPath = String(b.coverPath || ''); body.coverTime = Number(b.coverTime); }
  if (b.action === 'refresh') delete body.id;
  try {
    const { status, j } = await roots('POST', body);
    if (status === 200 && j.ok) return { ok: true, ...(b.action === 'upload' ? { path: j.path, url: j.url } : {}) };
    return { ok: false, error: status === 409 ? 'changed' : status === 401 ? 'token' : 'failed', message: j.error };
  } catch (e) {
    console.error('roots action', e.message);
    return { ok: false, error: 'down' };
  }
}
