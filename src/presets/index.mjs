import furniture from './furniture.mjs';
import electronics from './electronics.mjs';
import apparel from './apparel.mjs';

const presets = { furniture, electronics, apparel };

export function loadPreset(name) {
  if (!name) return null;
  const preset = presets[name];
  if (!preset) {
    const available = Object.keys(presets).join(', ');
    throw new Error(`Unknown preset "${name}". Available: ${available}`);
  }
  return preset;
}

export function listPresets() {
  return Object.keys(presets);
}
