/** Compact URL encoding/decoding for circuit state */

export interface SharedCircuitData {
  c: Array<[string, number, number, number]>; // [type, cx, cy, rotation]
  w: Array<Array<[number, number]>>;           // wires: [[hx, hy], ...]
  s: Record<string, boolean>;                  // index → switchState
  v?: Record<string, number>;                  // index → custom voltage
  r?: Record<string, number>;                  // index → custom resistance
  real?: Record<string, boolean>;              // index → isRealSource
  wp?: Record<string, number>;                 // index → wiperPosition (0..1)
}

export interface DecodedCircuit {
  components: Array<{ id: string; type: string; cx: number; cy: number; rotation: number }>;
  wires: Array<{ id: string; points: { hx: number; hy: number }[] }>;
  switchStates: Record<string, boolean>;
  voltageSettings?: Record<string, number>;
  resistanceSettings?: Record<string, number>;
  realSources?: Record<string, boolean>;
  wiperPositions?: Record<string, number>;
}

/** Encode circuit state to URL-safe base64 string */
export function encodeCircuit(
  components: Array<{ id: string; type: string; cx: number; cy: number; rotation: number }>,
  wires: Array<{ id: string; points: { hx: number; hy: number }[] }>,
  switchStates: Record<string, boolean>,
  voltageSettings?: Record<string, number>,
  resistanceSettings?: Record<string, number>,
  realSources?: Record<string, boolean>,
  wiperPositions?: Record<string, number>,
): string {
  const data: SharedCircuitData = {
    c: components.map(c => [c.type, c.cx, c.cy, c.rotation]),
    w: wires.map(w => w.points.map(p => [p.hx, p.hy])),
    s: components.reduce((acc, c, i) => {
      if (c.type === 'switch') acc[String(i)] = switchStates[c.id] ?? false;
      return acc;
    }, {} as Record<string, boolean>),
  };
  
  // Add voltage settings if any exist
  if (voltageSettings) {
    const voltageMap: Record<string, number> = {};
    components.forEach((c, i) => {
      if (voltageSettings[c.id] !== undefined) {
        voltageMap[String(i)] = voltageSettings[c.id];
      }
    });
    if (Object.keys(voltageMap).length > 0) data.v = voltageMap;
  }
  
  // Add resistance settings if any exist
  if (resistanceSettings) {
    const resistanceMap: Record<string, number> = {};
    components.forEach((c, i) => {
      if (resistanceSettings[c.id] !== undefined) {
        resistanceMap[String(i)] = resistanceSettings[c.id];
      }
    });
    if (Object.keys(resistanceMap).length > 0) data.r = resistanceMap;
  }
  
  // Add real sources if any exist
  if (realSources) {
    const realMap: Record<string, boolean> = {};
    components.forEach((c, i) => {
      if (realSources[c.id]) {
        realMap[String(i)] = true;
      }
    });
    if (Object.keys(realMap).length > 0) data.real = realMap;
  }
  
  // Add wiper positions if any exist
  if (wiperPositions) {
    const wiperMap: Record<string, number> = {};
    components.forEach((c, i) => {
      if (wiperPositions[c.id] !== undefined) {
        wiperMap[String(i)] = wiperPositions[c.id];
      }
    });
    if (Object.keys(wiperMap).length > 0) data.wp = wiperMap;
  }
  try {
    const json = JSON.stringify(data);
    // URL-safe base64 (no +, /, =)
    return btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  } catch {
    return '';
  }
}

/** Decode URL-safe base64 string back to circuit state */
export function decodeCircuit(encoded: string): DecodedCircuit | null {
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(escape(atob(base64)));
    const data: SharedCircuitData = JSON.parse(json);

    const components: DecodedCircuit['components'] = data.c.map(([type, cx, cy, rotation]) => ({
      id: crypto.randomUUID(),
      type,
      cx,
      cy,
      rotation,
    }));

    const wires: DecodedCircuit['wires'] = data.w.map(pts => ({
      id: crypto.randomUUID(),
      points: pts.map(([hx, hy]) => ({ hx, hy })),
    }));

    const switchStates: Record<string, boolean> = {};
    for (const [idxStr, state] of Object.entries(data.s)) {
      const idx = Number(idxStr);
      if (components[idx]) {
        switchStates[components[idx].id] = state;
      }
    }

    const voltageSettings: Record<string, number> = {};
    if (data.v) {
      for (const [idxStr, voltage] of Object.entries(data.v)) {
        const idx = Number(idxStr);
        if (components[idx]) {
          voltageSettings[components[idx].id] = voltage;
        }
      }
    }

    const resistanceSettings: Record<string, number> = {};
    if (data.r) {
      for (const [idxStr, resistance] of Object.entries(data.r)) {
        const idx = Number(idxStr);
        if (components[idx]) {
          resistanceSettings[components[idx].id] = resistance;
        }
      }
    }

    const realSources: Record<string, boolean> = {};
    if (data.real) {
      for (const [idxStr, isReal] of Object.entries(data.real)) {
        const idx = Number(idxStr);
        if (components[idx]) {
          realSources[components[idx].id] = isReal;
        }
      }
    }

    const wiperPositions: Record<string, number> = {};
    if (data.wp) {
      for (const [idxStr, pos] of Object.entries(data.wp)) {
        const idx = Number(idxStr);
        if (components[idx]) {
          wiperPositions[components[idx].id] = pos;
        }
      }
    }

    return { 
      components, 
      wires, 
      switchStates,
      voltageSettings: Object.keys(voltageSettings).length > 0 ? voltageSettings : undefined,
      resistanceSettings: Object.keys(resistanceSettings).length > 0 ? resistanceSettings : undefined,
      realSources: Object.keys(realSources).length > 0 ? realSources : undefined,
      wiperPositions: Object.keys(wiperPositions).length > 0 ? wiperPositions : undefined,
    };
  } catch {
    return null;
  }
}

/** Parse circuit state from the current URL hash */
export function parseCircuitFromUrl(): DecodedCircuit | null {
  const hash = window.location.hash;
  const match = hash.match(/[#&]circuit=([^&]+)/);
  if (!match) return null;
  return decodeCircuit(match[1]);
}

/** Build a shareable URL with the encoded circuit */
export function buildShareUrl(encoded: string): string {
  const base = window.location.href.split('#')[0];
  return `${base}#circuit=${encoded}`;
}
