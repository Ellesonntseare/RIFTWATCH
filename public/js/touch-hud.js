const STORAGE_PREFIX = 'riftwatch-touch-hud-v1-';
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const orientation = () => innerWidth < innerHeight ? 'portrait' : 'landscape';

export function initTouchHud(enabled) {
  const byId = id => document.getElementById(id);
  const controls = byId('mobile-controls');
  const items = [byId('touch-stick'), ...controls.querySelectorAll('[data-touch]')];
  const editor = byId('hud-editor');
  const sizeSlider = byId('hud-size');
  const opacitySlider = byId('hud-opacity');
  const editButton = byId('edit-touch-hud');
  if (!enabled) return;
  editButton.classList.remove('hidden');

  let editing = false;
  let selected = null;
  let activePointer = null;
  let currentOrientation = orientation();
  let drafts = {};

  function baseSize(element) {
    if (element.id === 'touch-stick') return currentOrientation === 'portrait' ? 102 : 116;
    if (element.dataset.touch === 'fire') return 78;
    if (element.dataset.touch === 'pause') return 38;
    return 48;
  }

  function readLayout(key) {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_PREFIX + key));
      return value && typeof value === 'object' ? value : null;
    } catch { return null; }
  }

  function clearPositions() {
    for (const element of items) {
      element.style.left = '';
      element.style.top = '';
      element.style.right = '';
      element.style.bottom = '';
      element.style.width = '';
      element.style.height = '';
    }
  }

  function applyLayout(layout) {
    clearPositions();
    const opacity = clamp(Number(layout?.opacity) || 90, 35, 100);
    controls.style.setProperty('--touch-opacity', String(opacity / 100));
    opacitySlider.value = opacity;
    for (const element of items) {
      const entry = layout?.items?.[element.id || element.dataset.touch];
      if (!entry || !Number.isFinite(entry.x) || !Number.isFinite(entry.y) || !Number.isFinite(entry.size)) continue;
      const side = baseSize(element) * clamp(entry.size, .6, 1.6);
      const x = clamp(entry.x * innerWidth, side / 2, innerWidth - side / 2);
      const y = clamp(entry.y * innerHeight, side / 2, innerHeight - side / 2);
      element.style.width = side + 'px';
      element.style.height = side + 'px';
      element.style.left = x - side / 2 + 'px';
      element.style.top = y - side / 2 + 'px';
      element.style.right = 'auto';
      element.style.bottom = 'auto';
    }
  }

  function captureLayout() {
    const result = {opacity: Number(opacitySlider.value), items: {}};
    for (const element of items) {
      const rect = element.getBoundingClientRect();
      result.items[element.id || element.dataset.touch] = {
        x: clamp((rect.left + rect.width / 2) / innerWidth, 0, 1),
        y: clamp((rect.top + rect.height / 2) / innerHeight, 0, 1),
        size: clamp(rect.width / baseSize(element), .6, 1.6)
      };
    }
    return result;
  }

  function moveTo(element, centerX, centerY) {
    const side = element.getBoundingClientRect().width;
    element.style.left = clamp(centerX - side / 2, 0, innerWidth - side) + 'px';
    element.style.top = clamp(centerY - side / 2, 0, innerHeight - side) + 'px';
    element.style.right = 'auto';
    element.style.bottom = 'auto';
  }

  function select(element) {
    selected?.classList.remove('selected');
    selected = element;
    selected.classList.add('selected');
    sizeSlider.value = Math.round(element.getBoundingClientRect().width / baseSize(element) * 100);
  }

  function closeEditor(save) {
    if (save) {
      drafts[currentOrientation] = captureLayout();
      for (const [key, layout] of Object.entries(drafts)) {
        try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(layout)); } catch {}
      }
    }
    activePointer = null;
    selected?.classList.remove('selected');
    selected = null;
    sizeSlider.value = 100;
    editing = false;
    drafts = {};
    editor.classList.add('hidden');
    document.body.classList.remove('hud-editing', 'mobile-playing');
    byId('pause').classList.remove('hidden');
    applyLayout(readLayout(currentOrientation));
  }

  editButton.addEventListener('click', event => {
    event.stopPropagation();
    currentOrientation = orientation();
    editing = true;
    drafts = {};
    sizeSlider.value = 100;
    byId('pause').classList.add('hidden');
    document.body.classList.add('mobile-playing', 'hud-editing');
    editor.classList.remove('hidden');
    applyLayout(readLayout(currentOrientation));
  });

  for (const element of items) {
    element.addEventListener('pointerdown', event => {
      if (!editing || activePointer !== null) return;
      event.preventDefault();
      event.stopPropagation();
      select(element);
      const rect = element.getBoundingClientRect();
      activePointer = {id: event.pointerId, element, dx: event.clientX - (rect.left + rect.width / 2), dy: event.clientY - (rect.top + rect.height / 2)};
      element.setPointerCapture(event.pointerId);
    });
    element.addEventListener('pointermove', event => {
      if (!editing || activePointer?.id !== event.pointerId || activePointer.element !== element) return;
      event.preventDefault();
      moveTo(element, event.clientX - activePointer.dx, event.clientY - activePointer.dy);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      element.addEventListener(type, event => { if (activePointer?.id === event.pointerId) activePointer = null; });
    }
  }

  sizeSlider.addEventListener('input', () => {
    if (!selected) return;
    const rect = selected.getBoundingClientRect();
    const side = baseSize(selected) * Number(sizeSlider.value) / 100;
    selected.style.width = side + 'px';
    selected.style.height = side + 'px';
    moveTo(selected, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });
  opacitySlider.addEventListener('input', () => controls.style.setProperty('--touch-opacity', String(Number(opacitySlider.value) / 100)));
  byId('hud-save').addEventListener('click', () => closeEditor(true));
  byId('hud-cancel').addEventListener('click', () => closeEditor(false));
  byId('hud-reset').addEventListener('click', () => {
    selected?.classList.remove('selected');
    selected = null;
    sizeSlider.value = 100;
    drafts[currentOrientation] = null;
    applyLayout(null);
  });

  addEventListener('resize', () => {
    const next = orientation();
    if (next === currentOrientation) {
      if (!editing) applyLayout(readLayout(currentOrientation));
      return;
    }
    if (editing) drafts[currentOrientation] = captureLayout();
    currentOrientation = next;
    selected?.classList.remove('selected');
    selected = null;
    sizeSlider.value = 100;
    applyLayout(editing && Object.hasOwn(drafts, next) ? drafts[next] : readLayout(next));
  });
  applyLayout(readLayout(currentOrientation));
}
