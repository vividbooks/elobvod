import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Undo2, Redo2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  ComponentSvg,
  RealisticTile,
  schemaDefaultResistanceLabel,
  schemaDefaultVoltageLabel,
  type ComponentType,
  type ViewMode,
  type BulbState,
} from './ComponentSvg';
import type { Tool } from './ComponentPalette';
import { encodeCircuit, buildShareUrl } from '../utils/circuitUrl';
import { DraggablePanel } from './DraggablePanel';

const GRID_SIZE = 60;
const HALF = GRID_SIZE / 2;
const TILE_INSET = 3;
const TILE_RADIUS = 10;
const CONN_HIGHLIGHT_R = 7;
const CONN_SNAP_DIST = GRID_SIZE;

// ── Circuit physics constants ──
const BATTERY_EMF = 4.5;          // V (slabší baterie)
const BATTERY2_EMF = 9.0;         // V (střední baterie)
const BATTERY3_EMF = 12.0;        // V (silnější baterie)
const BATTERY_INTERNAL_R = 0;     // Ω (ideální zdroj)
const BATTERY2_INTERNAL_R = 0;    // Ω (ideální zdroj)
const BATTERY3_INTERNAL_R = 0;    // Ω (ideální zdroj)
// Vnitřní odpor reálných zdrojů
const BATTERY_REAL_R = 2.0;       // Ω (reálná baterie 4.5V)
const BATTERY2_REAL_R = 1.0;      // Ω (reálná baterie 9V)
const BATTERY3_REAL_R = 1.0;      // Ω (reálná baterie 12V)

const RESISTOR_R = 50.0;          // Ω (slabý)
const RESISTOR2_R = 500.0;        // Ω (střední)
const RESISTOR3_R = 5000.0;       // Ω (5 kΩ, silný)
const POTENTIOMETER_R = 1000.0;   // Ω (potenciometr, výchozí 1 kΩ, rozsah 0–10 kΩ)
// Žárovky – odpory navrženy tak, aby I_nom = 0,75 A při jmenovitém napětí
//   bulb  (slabá,  4,5 V): R = 6 Ω   → I_nom = 4,5/6  = 0,75 A
//   bulb2 (střední, 9 V):  R = 12 Ω  → I_nom = 9/12   = 0,75 A
//   bulb3 (silná,  12 V):  R = 16 Ω  → I_nom = 12/16  = 0,75 A
const BULB_R  = 6.0;
const BULB2_R = 12.0;
const BULB3_R = 16.0;
const LED_R = 10.0;           // Ω – dynamický odpor LED po překročení Vf
const LED_VF = 1.8;            // V – prahové napětí LED (forward voltage, červená LED)
const LED2_VF = 2.2;           // V – zelená LED
const LED3_VF = 3.0;           // V – modrá LED
const isLedType = (t: string) => t === 'led' || t === 'led2' || t === 'led3';
const isBatteryType = (t: ComponentType) => t === 'battery' || t === 'battery2' || t === 'battery3';
const isResistorTypeForSchemaLabel = (t: ComponentType) =>
  t === 'resistor' || t === 'resistor2' || t === 'resistor3';
const getLedVf = (t: string) => t === 'led3' ? LED3_VF : t === 'led2' ? LED2_VF : LED_VF;
const LED_MIN_CURRENT = 0.001; // A – minimální proud pro svícení LED (1 mA)
const LED_MAX_CURRENT = 0.020; // A – jmenovitý max. proud LED (20 mA) pro plný jas
const LED_BURN_THRESHOLD = 0.500; // A – při proudu > 500 mA se LED zničí (přepálí)
// ammeter, switch, wire ≈ 0 Ω

// ── NPN transistor constants ──
const NPN_VBE = 0.7;             // V – base-emitter threshold voltage
const NPN_BETA = 100;            // current gain (β)
const NPN_RBE = 100;             // Ω – base-emitter series resistance (forward biased)
const NPN_RCE_SAT = 1;           // Ω – collector-emitter resistance in saturation
const NPN_VCE_SAT = 0.2;         // V – VCE saturation threshold

// Prahové proudy (stejné pro všechny typy)
//   off:    I < 300 mA (přísně pod — při přesně 300 mA už „dim“, ať sériové větve neblikají kvůli floatu)
//   dim:    300 mA ≤ I ≤ 500 mA
//   on:     500 mA < I ≤ 800 mA
//   bright: 800 mA < I ≤ 1500 mA
//   broken: I > 1500 mA
const BULB_OFF_MAX    = 0.300;
const BULB_DIM_MAX    = 0.500;
const BULB_ON_MAX     = 0.800;
const BULB_BRIGHT_MAX = 1.500;
// > BULB_BRIGHT_MAX → broken

// ── Short-circuit threshold ──
const SHORT_CIRCUIT_THRESHOLD = 100; // A – over this → visual short-circuit effect
const SHORT_CIRCUIT_PATH_THRESHOLD = 10; // A – wires/components with current ≥ this are highlighted orange

/** Rychlost elektronů: px/s na 1 A (striktně úměrné proudu v obvodu) */
const ELECTRON_SPEED_PER_AMP = 60;

interface PlacedComponent {
  id: string;
  type: ComponentType;
  cx: number;
  cy: number;
  rotation: number;
}

interface Wire {
  id: string;
  points: { hx: number; hy: number }[];
}

interface ConnPoint { x: number; y: number }

interface VoltmeterProbe {
  /** half-grid position of probe tip (snapped to circuit node) */
  pos: { hx: number; hy: number } | null;
}

interface VoltmeterProbes {
  probe1: VoltmeterProbe;
  probe2: VoltmeterProbe;
}

interface Props {
  tool: Tool;
  viewMode: ViewMode;
  clearTrigger: number;
  zoom: number;
  setTool: (t: Tool) => void;
  setZoom: (z: number) => void;
  isViewOnly?: boolean;
  /** Optional ref to the underlying SVG element (for export/screenshot). */
  svgElementRef?: React.MutableRefObject<SVGSVGElement | null>;
  initialState?: {
    components: PlacedComponent[];
    wires: Wire[];
    switchStates: Record<string, boolean>;
    voltageSettings?: Record<string, number>;
    resistanceSettings?: Record<string, number>;
    realSources?: Record<string, boolean>;
    wiperPositions?: Record<string, number>;
  };
  /** App.tsx plní tento ref funktorem pro získání share URL */
  shareHandlerRef?: React.MutableRefObject<(() => string) | null>;
  /** Volá se, když se otevře/zavře editor panelu */
  onPanelOpenChange?: (open: boolean) => void;
  /** True = primární vstup je dotyk (tablet/telefon) */
  isTouch?: boolean;
  /** Animace elektronů podél drátů (jen realistický pohled). Výchozí false – zapnout: true nebo prop z App. */
  showWireElectrons?: boolean;
  /** Ve schématu: u baterií a rezistorů zobraz upravitelný text hodnoty (editor kreslení). */
  editableSchemaValueLabels?: boolean;
  /** Přepsané štítky (klíč = id součástky). Chybí klíč → výchozí z napětí/odporu; prázdný řetězec → nic. */
  schemaValueLabels?: Record<string, string>;
  onSchemaValueLabelChange?: (compId: string, value: string) => void;
  /** Volitelný obsah vpravo od Undo/Redo (např. tlačítko „Zadání“ na studentské stránce). */
  editChromeEndSlot?: React.ReactNode;
}

interface Snapshot {
  components: PlacedComponent[];
  wires: Wire[];
  switchStates: Record<string, boolean>;
  bulbStates: Record<string, BulbState>;
}

function simplifyPath(raw: { hx: number; hy: number }[]) {
  const d = raw.filter((p, i) => i === 0 || p.hx !== raw[i - 1].hx || p.hy !== raw[i - 1].hy);
  if (d.length <= 2) return d;
  const r = [d[0]];
  for (let i = 1; i < d.length - 1; i++) {
    const prev = r[r.length - 1], curr = d[i], next = d[i + 1];
    if (!(prev.hy === curr.hy && curr.hy === next.hy) && !(prev.hx === curr.hx && curr.hx === next.hx)) r.push(curr);
  }
  r.push(d[d.length - 1]);
  return r;
}

/**
 * Snap a half-grid integer to the nearest ODD value (= cell centre).
 * In the half-grid system cell (cx,cy) has centre at hx=cx*2+1, hy=cy*2+1 –
 * both odd.  Component terminals sit on even hx (cell edge) but odd hy
 * (cell-centre row), so they are the only exempted endpoints.
 */
function toOdd(v: number): number {
  if (v % 2 !== 0) return v;   // already a cell-centre coordinate
  return v + 1;                 // even (cell edge) → next cell centre
}

/**
 * Orthogonal route between two half-grid points that keeps every segment
 * on a cell-centre line (odd hx / odd hy) wherever possible.
 * Terminal endpoints stay untouched (they sit on even hx, odd hy);
 * only the intermediate corner is placed at a cell-centre intersection.
 */
function orthoRoute(
  p1: { hx: number; hy: number },
  p2: { hx: number; hy: number },
): { hx: number; hy: number }[] {
  if (p1.hx === p2.hx || p1.hy === p2.hy) return [p1, p2];

  // Pick a cell-centre column (odd hx) for the vertical run.
  const midHx = Math.round((p1.hx + p2.hx) / 2);
  const vcol = midHx % 2 !== 0 ? midHx : midHx + (p2.hx > p1.hx ? 1 : -1);

  return simplifyPath([
    p1,
    { hx: vcol, hy: p1.hy },
    { hx: vcol, hy: p2.hy },
    p2,
  ]);
}

/**
 * Ensure every segment in a half-grid path is purely horizontal or vertical.
 * Diagonal steps become an L; dominant axis of (prev→curr) picks the corner so a stroke
 * drawn mainly downward does not jog horizontally first.
 */
function orthogonalizePath(
  pts: { hx: number; hy: number }[],
): { hx: number; hy: number }[] {
  if (pts.length < 2) return pts;
  const result: { hx: number; hy: number }[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const prev = result[result.length - 1];
    const curr = pts[i];
    if (prev.hx !== curr.hx && prev.hy !== curr.hy) {
      const dhx = Math.abs(curr.hx - prev.hx);
      const dhy = Math.abs(curr.hy - prev.hy);
      if (dhy >= dhx) {
        result.push({ hx: prev.hx, hy: curr.hy });
      } else {
        result.push({ hx: curr.hx, hy: prev.hy });
      }
    }
    result.push(curr);
  }
  return simplifyPath(result);
}

function getConnPoints(comp: PlacedComponent): ConnPoint[] {
  const cx = comp.cx * GRID_SIZE + HALF;
  const cy = comp.cy * GRID_SIZE + HALF;
  const offsets = [{ dx: -HALF, dy: 0 }, { dx: HALF, dy: 0 }];
  const rad = (comp.rotation * Math.PI) / 180;
  const cos = Math.round(Math.cos(rad));
  const sin = Math.round(Math.sin(rad));
  return offsets.map(({ dx, dy }) => ({
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  }));
}

/** Wiper (third) terminal of potentiometer – bottom of cell when rotation=0 */
function getWiperConnPoint(comp: PlacedComponent): ConnPoint | null {
  if (comp.type !== 'potentiometer') return null;
  const cx = comp.cx * GRID_SIZE + HALF;
  const cy = comp.cy * GRID_SIZE + HALF;
  const dx = 0, dy = HALF;
  const rad = (comp.rotation * Math.PI) / 180;
  const cos = Math.round(Math.cos(rad));
  const sin = Math.round(Math.sin(rad));
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

function getWiperTerminalHalfGrid(comp: PlacedComponent): { hx: number; hy: number } | null {
  const pt = getWiperConnPoint(comp);
  if (!pt) return null;
  return { hx: Math.round(pt.x / HALF), hy: Math.round(pt.y / HALF) };
}

/** Base (third) terminal of NPN transistor – bottom of cell when rotation=0 */
function getBaseConnPoint(comp: PlacedComponent): ConnPoint | null {
  if (comp.type !== 'npn') return null;
  const cx = comp.cx * GRID_SIZE + HALF;
  const cy = comp.cy * GRID_SIZE + HALF;
  const dx = 0, dy = HALF;
  const rad = (comp.rotation * Math.PI) / 180;
  const cos = Math.round(Math.cos(rad));
  const sin = Math.round(Math.sin(rad));
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

function getBaseTerminalHalfGrid(comp: PlacedComponent): { hx: number; hy: number } | null {
  const pt = getBaseConnPoint(comp);
  if (!pt) return null;
  return { hx: Math.round(pt.x / HALF), hy: Math.round(pt.y / HALF) };
}

function getTerminalHalfGrid(comp: PlacedComponent): [{ hx: number; hy: number }, { hx: number; hy: number }] {
  const pts = getConnPoints(comp);
  return [
    { hx: Math.round(pts[0].x / HALF), hy: Math.round(pts[0].y / HALF) },
    { hx: Math.round(pts[1].x / HALF), hy: Math.round(pts[1].y / HALF) },
  ];
}

/**
 * Iterate all unit-step edges of all wires (expanding H/V segments into
 * individual half-grid steps). Calls `cb(key1, key2)` for each edge.
 * This ensures graph-building code sees ALL half-grid points on a wire,
 * not just the stored vertices, so T-junctions mid-segment are detected.
 */
function forEachWireUnitEdge(
  wires: Wire[],
  nodeKey: (hx: number, hy: number) => string,
  cb: (k1: string, k2: string) => void,
) {
  for (const wire of wires) {
    for (let i = 0; i < wire.points.length - 1; i++) {
      const a = wire.points[i];
      const b = wire.points[i + 1];
      if (a.hx === b.hx) {
        const step = a.hy < b.hy ? 1 : -1;
        for (let hy = a.hy; hy !== b.hy; hy += step) {
          cb(nodeKey(a.hx, hy), nodeKey(a.hx, hy + step));
        }
      } else if (a.hy === b.hy) {
        const step = a.hx < b.hx ? 1 : -1;
        for (let hx = a.hx; hx !== b.hx; hx += step) {
          cb(nodeKey(hx, a.hy), nodeKey(hx + step, a.hy));
        }
      } else {
        cb(nodeKey(a.hx, a.hy), nodeKey(b.hx, b.hy));
      }
    }
  }
}

/** Oddělovač v interním klíči „drát × buňka“ (UUID neobsahuje \\u001f). */
const WIRE_CELL_SEP = '\u001f';
function wireScopedKey(wireId: string, hx: number, hy: number): string {
  return `${wireId}${WIRE_CELL_SEP}${hx},${hy}`;
}

function pointOnWirePolyline(wire: Wire, hx: number, hy: number): boolean {
  for (let i = 0; i < wire.points.length - 1; i++) {
    const a = wire.points[i], b = wire.points[i + 1];
    if (a.hx === b.hx && a.hx === hx) {
      const lo = Math.min(a.hy, b.hy), hi = Math.max(a.hy, b.hy);
      if (hy >= lo && hy <= hi) return true;
    } else if (a.hy === b.hy && a.hy === hy) {
      const lo = Math.min(a.hx, b.hx), hi = Math.max(a.hx, b.hx);
      if (hx >= lo && hx <= hi) return true;
    }
  }
  return false;
}

/** Každý uzlový bod (hx,hy) ležící na některém úseku drátu. */
function forEachWireGridPoint(wire: Wire, cb: (hx: number, hy: number) => void) {
  for (let i = 0; i < wire.points.length - 1; i++) {
    const a = wire.points[i], b = wire.points[i + 1];
    if (a.hx === b.hx) {
      const step = a.hy < b.hy ? 1 : -1;
      for (let hy = a.hy; hy !== b.hy; hy += step) cb(a.hx, hy);
      cb(a.hx, b.hy);
    } else if (a.hy === b.hy) {
      const step = a.hx < b.hx ? 1 : -1;
      for (let hx = a.hx; hx !== b.hx; hx += step) cb(hx, a.hy);
      cb(b.hx, a.hy);
    } else {
      cb(a.hx, a.hy);
      cb(b.hx, b.hy);
    }
  }
}

function forEachHalfGridOnPolyline(
  points: { hx: number; hy: number }[],
  cb: (hx: number, hy: number) => void,
) {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (a.hx === b.hx) {
      const step = a.hy < b.hy ? 1 : -1;
      for (let hy = a.hy; hy !== b.hy; hy += step) cb(a.hx, hy);
      cb(a.hx, b.hy);
    } else if (a.hy === b.hy) {
      const step = a.hx < b.hx ? 1 : -1;
      for (let hx = a.hx; hx !== b.hx; hx += step) cb(hx, a.hy);
      cb(b.hx, a.hy);
    } else {
      cb(a.hx, a.hy);
      cb(b.hx, b.hy);
    }
  }
}

/** Střed políčka (hx,hy) leží uvnitř obdélníku dlaždice (stejně jako kreslení součástky). */
function halfGridCenterInTileRect(comp: PlacedComponent, hx: number, hy: number): boolean {
  const px = hx * HALF;
  const py = hy * HALF;
  const tileL = comp.cx * GRID_SIZE + TILE_INSET;
  const tileT = comp.cy * GRID_SIZE + TILE_INSET;
  const tileR = comp.cx * GRID_SIZE + GRID_SIZE - TILE_INSET;
  const tileB = comp.cy * GRID_SIZE + GRID_SIZE - TILE_INSET;
  return px >= tileL && px <= tileR && py >= tileT && py <= tileB;
}

/** Všechny svorky, přes které smí drát vstoupit na dlaždici (včetně stírače / báze). */
function getWireCheckTerminals(comp: PlacedComponent): { hx: number; hy: number }[] {
  const [t0, t1] = getTerminalHalfGrid(comp);
  const list: { hx: number; hy: number }[] = [t0, t1];
  if (comp.type === 'potentiometer') {
    const w = getWiperTerminalHalfGrid(comp);
    if (w) list.push(w);
  } else if (comp.type === 'npn') {
    const b = getBaseTerminalHalfGrid(comp);
    if (b) list.push(b);
  }
  return list;
}

function segmentTouchesAnyTerminal(
  a: { hx: number; hy: number },
  b: { hx: number; hy: number },
  terminals: { hx: number; hy: number }[],
): boolean {
  return terminals.some(
    t => (a.hx === t.hx && a.hy === t.hy) || (b.hx === t.hx && b.hy === t.hy),
  );
}

/** Bod na ose mezi dvěma hlavními svorkami (vodorovně nebo svisle). */
function onMainAxisBetween(
  hx: number,
  hy: number,
  t0: { hx: number; hy: number },
  t1: { hx: number; hy: number },
): boolean {
  if (t0.hx === t1.hx) {
    const lo = Math.min(t0.hy, t1.hy);
    const hi = Math.max(t0.hy, t1.hy);
    return hx === t0.hx && hy >= lo && hy <= hi;
  }
  if (t0.hy === t1.hy) {
    const lo = Math.min(t0.hx, t1.hx);
    const hi = Math.max(t0.hx, t1.hx);
    return hy === t0.hy && hx >= lo && hx <= hi;
  }
  return false;
}

/**
 * Drát „pod“ součástkou: vede přes dlaždici bez připojení na svorku.
 * Úsek je OK, pokud končí nebo začíná na některé svorce, nebo je to jeden spojitý
 * úsek mezi oběma hlavními svorkami v téže polylinii (import / výjimečné zapojení).
 */
function wirePolylineViolatesComponent(
  points: { hx: number; hy: number }[],
  comp: PlacedComponent,
): boolean {
  if (points.length < 2) return false;
  const terminals = getWireCheckTerminals(comp);
  const termKey = new Set(terminals.map(t => `${t.hx},${t.hy}`));
  const vertKey = new Set(points.map(p => `${p.hx},${p.hy}`));
  const [t0, t1] = getTerminalHalfGrid(comp);
  const hasBothMainTerminalsInWire =
    vertKey.has(`${t0.hx},${t0.hy}`) && vertKey.has(`${t1.hx},${t1.hy}`);

  let bad = false;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    forEachHalfGridOnPolyline([a, b], (hx, hy) => {
      if (bad) return;
      if (!halfGridCenterInTileRect(comp, hx, hy)) return;
      const k = `${hx},${hy}`;
      if (termKey.has(k)) return;
      if (segmentTouchesAnyTerminal(a, b, terminals)) return;
      if (hasBothMainTerminalsInWire && onMainAxisBetween(hx, hy, t0, t1)) return;
      bad = true;
    });
  }
  return bad;
}

function wirePolylinePassesUnderComponentTile(
  points: { hx: number; hy: number }[],
  components: PlacedComponent[],
): boolean {
  for (const comp of components) {
    if (wirePolylineViolatesComponent(points, comp)) return true;
  }
  return false;
}

function anyWirePassesUnderSomeComponent(
  wires: Wire[],
  components: PlacedComponent[],
): boolean {
  for (const w of wires) {
    if (w.points.length < 2) continue;
    if (wirePolylinePassesUnderComponentTile(w.points, components)) return true;
  }
  return false;
}

function createUnionFindMap() {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = x;
    while (c !== r) {
      const n = parent.get(c)!;
      parent.set(c, r);
      c = n;
    }
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  return { parent, find, union };
}

/**
 * Elektrické spojení drátů jen tam, kde se polyline fyzicky dotýká:
 * – společný zapsaný vrchol (T, konec, roh),
 * – svorka součástky na úseku (připojení na konkrétní drát).
 * Průsečík úseků bez společného vrcholu = vizuální křížení bez spojení.
 */
function mergeJunctionAwareWiresIntoUF(
  wires: Wire[],
  components: PlacedComponent[],
  nodeKey: (hx: number, hy: number) => string,
  uf: { find: (s: string) => string; union: (a: string, b: string) => void },
) {
  const { union } = uf;
  for (const wire of wires) {
    const id = wire.id;
    for (let i = 0; i < wire.points.length - 1; i++) {
      const a = wire.points[i], b = wire.points[i + 1];
      if (a.hx === b.hx) {
        const step = a.hy < b.hy ? 1 : -1;
        for (let hy = a.hy; hy !== b.hy; hy += step) {
          union(wireScopedKey(id, a.hx, hy), wireScopedKey(id, a.hx, hy + step));
        }
      } else if (a.hy === b.hy) {
        const step = a.hx < b.hx ? 1 : -1;
        for (let hx = a.hx; hx !== b.hx; hx += step) {
          union(wireScopedKey(id, hx, a.hy), wireScopedKey(id, hx + step, a.hy));
        }
      } else {
        union(wireScopedKey(id, a.hx, a.hy), wireScopedKey(id, b.hx, b.hy));
      }
    }
  }
  const atVertex = new Map<string, Set<string>>();
  for (const w of wires) {
    for (const p of w.points) {
      const k = `${p.hx},${p.hy}`;
      if (!atVertex.has(k)) atVertex.set(k, new Set());
      atVertex.get(k)!.add(w.id);
    }
  }
  for (const [k, ids] of atVertex) {
    const [hx, hy] = k.split(',').map(Number);
    const g = nodeKey(hx, hy);
    for (const wid of ids) union(g, wireScopedKey(wid, hx, hy));
  }
  for (const comp of components) {
    if (comp.type === 'voltmeter') continue;
    const pts: { hx: number; hy: number }[] = [];
    const [t0, t1] = getTerminalHalfGrid(comp);
    pts.push(t0, t1);
    if (comp.type === 'potentiometer') {
      const wt = getWiperTerminalHalfGrid(comp);
      if (wt) pts.push(wt);
    } else if (comp.type === 'npn') {
      const bt = getBaseTerminalHalfGrid(comp);
      if (bt) pts.push(bt);
    }
    for (const t of pts) {
      const g = nodeKey(t.hx, t.hy);
      for (const w of wires) {
        if (pointOnWirePolyline(w, t.hx, t.hy)) {
          union(g, wireScopedKey(w.id, t.hx, t.hy));
        }
      }
    }
  }
}

/**
 * Union-find stejný jako topologie obvodu včetně baterie (oba póly patří do jedné součástky).
 * Voltmetr vynechán (nekonečný odpor). Použití: sondy v různých izolovaných sítích → neplatné U.
 */
function buildElectricalConnectivityUnionFind(
  components: PlacedComponent[],
  wires: Wire[],
  switchStates: Record<string, boolean>,
  openCircuitIds?: Set<string>,
) {
  const nk = (hx: number, hy: number) => `${hx},${hy}`;
  const uf = createUnionFindMap();
  mergeJunctionAwareWiresIntoUF(wires, components, nk, uf);
  const { union } = uf;

  for (const comp of components) {
    if (comp.type === 'voltmeter') continue;
    if (comp.type === 'switch' && !switchStates[comp.id]) continue;
    if (openCircuitIds?.has(comp.id)) continue;
    const [t0, t1] = getTerminalHalfGrid(comp);
    if (comp.type === 'potentiometer') {
      const wt = getWiperTerminalHalfGrid(comp);
      if (wt) {
        union(nk(t0.hx, t0.hy), nk(wt.hx, wt.hy));
        union(nk(wt.hx, wt.hy), nk(t1.hx, t1.hy));
      } else {
        union(nk(t0.hx, t0.hy), nk(t1.hx, t1.hy));
      }
    } else if (comp.type === 'npn') {
      const bt = getBaseTerminalHalfGrid(comp);
      union(nk(t0.hx, t0.hy), nk(t1.hx, t1.hy));
      if (bt) {
        union(nk(bt.hx, bt.hy), nk(t1.hx, t1.hy));
      }
    } else {
      union(nk(t0.hx, t0.hy), nk(t1.hx, t1.hy));
    }
  }
  return uf;
}

/**
 * Find a wire segment that passes through a grid cell, allowing us to
 * insert a component there by splitting the wire.
 */
function findWireThroughCell(
  cx: number, cy: number, wires: Wire[],
): { wireIndex: number; segIndex: number; orientation: 'h' | 'v' } | null {
  const leftH = cx * 2;
  const rightH = (cx + 1) * 2;
  const topH = cy * 2;
  const bottomH = (cy + 1) * 2;
  const centerHy = cy * 2 + 1;
  const centerHx = cx * 2 + 1;

  for (let wi = 0; wi < wires.length; wi++) {
    const wire = wires[wi];
    for (let i = 0; i < wire.points.length - 1; i++) {
      const a = wire.points[i];
      const b = wire.points[i + 1];

      // Horizontal segment passing through cell
      if (a.hy === b.hy && a.hy === centerHy) {
        const minHx = Math.min(a.hx, b.hx);
        const maxHx = Math.max(a.hx, b.hx);
        if (minHx <= leftH && maxHx >= rightH) {
          return { wireIndex: wi, segIndex: i, orientation: 'h' };
        }
      }

      // Vertical segment passing through cell
      if (a.hx === b.hx && a.hx === centerHx) {
        const minHy = Math.min(a.hy, b.hy);
        const maxHy = Math.max(a.hy, b.hy);
        if (minHy <= topH && maxHy >= bottomH) {
          return { wireIndex: wi, segIndex: i, orientation: 'v' };
        }
      }
    }
  }
  return null;
}

/**
 * Split a wire at the two terminal points of a component being inserted.
 * Returns two new wires (before-terminal and after-terminal).
 */
function splitWireForComponent(
  wire: Wire,
  segIndex: number,
  term0: { hx: number; hy: number },
  term1: { hx: number; hy: number },
): Wire[] {
  const pts = wire.points;
  const a = pts[segIndex];
  const b = pts[segIndex + 1];

  // Determine which terminal is closer to the start of the segment
  const distA0 = Math.abs(a.hx - term0.hx) + Math.abs(a.hy - term0.hy);
  const distA1 = Math.abs(a.hx - term1.hx) + Math.abs(a.hy - term1.hy);
  const [nearTerm, farTerm] = distA0 <= distA1 ? [term0, term1] : [term1, term0];

  // Wire 1: start … nearTerm
  const beforePts = [...pts.slice(0, segIndex + 1), { ...nearTerm }];
  // Wire 2: farTerm … end
  const afterPts = [{ ...farTerm }, ...pts.slice(segIndex + 1)];

  // Remove duplicate endpoints
  const dedup = (arr: { hx: number; hy: number }[]) => {
    const r = [arr[0]];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i].hx !== arr[i - 1].hx || arr[i].hy !== arr[i - 1].hy) r.push(arr[i]);
    }
    return r;
  };

  const w1pts = dedup(beforePts);
  const w2pts = dedup(afterPts);

  const result: Wire[] = [];
  if (w1pts.length >= 2) result.push({ id: crypto.randomUUID(), points: w1pts });
  if (w2pts.length >= 2) result.push({ id: crypto.randomUUID(), points: w2pts });
  return result;
}

function runTopologyCheck(
  components: PlacedComponent[],
  wires: Wire[],
  effectiveSwitchStates: Record<string, boolean>,
): { activeComponents: Set<string>; activeNodes: Set<string> } {
  const nodeKey = (hx: number, hy: number) => `${hx},${hy}`;
  const ufT = createUnionFindMap();
  mergeJunctionAwareWiresIntoUF(wires, components, nodeKey, ufT);
  const norm = (s: string) => ufT.find(s);

  type Edge = { to: string; compId?: string };
  const adj = new Map<string, Edge[]>();

  const addEdge = (a: string, b: string, compId?: string) => {
    const na = norm(a), nb = norm(b);
    if (na === nb) return;
    if (!adj.has(na)) adj.set(na, []);
    if (!adj.has(nb)) adj.set(nb, []);
    adj.get(na)!.push({ to: nb, compId });
    adj.get(nb)!.push({ to: na, compId });
  };

  for (const comp of components) {
    if (comp.type === 'voltmeter') continue; // voltmeter has infinite impedance
    const [t0, t1] = getTerminalHalfGrid(comp);
    const a = nodeKey(t0.hx, t0.hy);
    const b = nodeKey(t1.hx, t1.hy);
    if (comp.type === 'switch') {
      if (effectiveSwitchStates[comp.id]) addEdge(a, b, comp.id);
    } else if (comp.type === 'potentiometer') {
      const wt = getWiperTerminalHalfGrid(comp);
      if (wt) {
        const wk = nodeKey(wt.hx, wt.hy);
        addEdge(a, wk, comp.id);
        addEdge(wk, b, comp.id);
      } else {
        addEdge(a, b, comp.id);
      }
    } else if (comp.type === 'npn') {
      // NPN: C(t0)↔E(t1) main path, B(base)↔E(t1) control path
      const bt = getBaseTerminalHalfGrid(comp);
      addEdge(a, b, comp.id); // C-E
      if (bt) {
        const bk = nodeKey(bt.hx, bt.hy);
        addEdge(bk, b, comp.id); // B-E
      }
    } else {
      addEdge(a, b, comp.id);
    }
  }

  const bfsWithout = (start: string, excludeId: string): Set<string> => {
    const s0 = norm(start);
    const visited = new Set<string>([s0]);
    const q = [s0];
    while (q.length > 0) {
      const curr = q.shift()!;
      for (const { to, compId } of (adj.get(curr) || [])) {
        if (compId === excludeId) continue;
        const toN = norm(to);
        if (!visited.has(toN)) { visited.add(toN); q.push(toN); }
      }
    }
    return visited;
  };

  const activeComponents = new Set<string>();
  const activeNodes = new Set<string>();
  const batteries = components.filter(c => c.type === 'battery' || c.type === 'battery2' || c.type === 'battery3');

  for (const batt of batteries) {
    const [t0, t1] = getTerminalHalfGrid(batt);
    const sn = nodeKey(t0.hx, t0.hy);
    const en = nodeKey(t1.hx, t1.hy);

    const vA = bfsWithout(sn, batt.id);
    if (!vA.has(norm(en))) continue;

    const vB = bfsWithout(en, batt.id);
    for (const n of vA) { if (vB.has(n)) activeNodes.add(n); }
    activeNodes.add(norm(sn));
    activeNodes.add(norm(en));
    activeComponents.add(batt.id);

    for (const comp of components) {
      if (comp.id === batt.id) continue;
      if (comp.type === 'switch' && !effectiveSwitchStates[comp.id]) continue;
      const [ct0, ct1] = getTerminalHalfGrid(comp);
      const ca = norm(nodeKey(ct0.hx, ct0.hy));
      const cb = norm(nodeKey(ct1.hx, ct1.hy));
      if ((vA.has(ca) && vB.has(cb)) || (vA.has(cb) && vB.has(ca))) {
        activeComponents.add(comp.id);
      }
    }
  }

  return { activeComponents, activeNodes };
}

/**
 * Leaf-trimming: build undirected graph (wires + components including battery),
 * then iteratively remove degree-1 nodes until only true cycles remain.
 * Returns the set of nodes that are part of a closed loop.
 */
function leafTrimNodes(
  components: PlacedComponent[],
  wires: Wire[],
  effectiveSwitchStates: Record<string, boolean>,
  openCircuitIds?: Set<string>,
): Set<string> {
  const nodeKey = (hx: number, hy: number) => `${hx},${hy}`;
  const ufL = createUnionFindMap();
  mergeJunctionAwareWiresIntoUF(wires, components, nodeKey, ufL);
  const norm = (s: string) => ufL.find(s);

  // Multigraf: baterie i žárovka mohou spojovat stejný pár superuzlů — v jednoduchém grafu
  // by oba měly stupeň 1 a smyčka by se celá ořezala (žádný proud).
  const adj = new Map<string, Map<string, number>>();
  const addEdge = (a: string, b: string) => {
    const na = norm(a), nb = norm(b);
    if (na === nb) return;
    const bump = (u: string, v: string) => {
      if (!adj.has(u)) adj.set(u, new Map());
      const m = adj.get(u)!;
      m.set(v, (m.get(v) ?? 0) + 1);
    };
    bump(na, nb);
    bump(nb, na);
  };

  // Pouze hrany součástek – vodivost drátů je v norm() přes mergeJunctionAwareWiresIntoUF
  for (const comp of components) {
    if (comp.type === 'voltmeter') continue; // voltmeter has infinite impedance
    if (comp.type === 'switch' && !effectiveSwitchStates[comp.id]) continue;
    if (openCircuitIds?.has(comp.id)) continue; // broken bulb / blocked LED = open circuit
    const [t0, t1] = getTerminalHalfGrid(comp);
    if (comp.type === 'potentiometer') {
      const wt = getWiperTerminalHalfGrid(comp);
      if (wt) {
        const wk = nodeKey(wt.hx, wt.hy);
        addEdge(nodeKey(t0.hx, t0.hy), wk);
        addEdge(wk, nodeKey(t1.hx, t1.hy));
      } else {
        addEdge(nodeKey(t0.hx, t0.hy), nodeKey(t1.hx, t1.hy));
      }
    } else if (comp.type === 'npn') {
      const bt = getBaseTerminalHalfGrid(comp);
      addEdge(nodeKey(t0.hx, t0.hy), nodeKey(t1.hx, t1.hy)); // C-E
      if (bt) {
        addEdge(nodeKey(bt.hx, bt.hy), nodeKey(t1.hx, t1.hy)); // B-E
      }
    } else {
      addEdge(nodeKey(t0.hx, t0.hy), nodeKey(t1.hx, t1.hy));
    }
  }

  const sumDeg = (u: string) => {
    let s = 0;
    for (const c of (adj.get(u) ?? new Map()).values()) s += c;
    return s;
  };
  const degree = new Map<string, number>();
  for (const u of adj.keys()) degree.set(u, sumDeg(u));

  const removed = new Set<string>();
  const queue: string[] = [];
  for (const [node, deg] of degree.entries()) { if (deg <= 1) queue.push(node); }

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (removed.has(node)) continue;
    if ((degree.get(node) ?? 0) > 1) continue;
    removed.add(node);
    const nbrs = adj.get(node);
    if (!nbrs) continue;
    for (const [neighbor, c] of nbrs) {
      if (removed.has(neighbor) || c <= 0) continue;
      degree.set(neighbor, (degree.get(neighbor) ?? 0) - c);
      const back = adj.get(neighbor);
      if (back) {
        const bc = back.get(node) ?? 0;
        if (bc <= c) back.delete(node);
        else back.set(node, bc - c);
      }
      if ((degree.get(neighbor) ?? 0) <= 1) queue.push(neighbor);
    }
    adj.delete(node);
  }

  const survivingReps = new Set<string>();
  for (const node of adj.keys()) { if (!removed.has(node)) survivingReps.add(node); }

  const out = new Set<string>();
  for (const w of wires) {
    forEachWireGridPoint(w, (hx, hy) => {
      const r = ufL.find(wireScopedKey(w.id, hx, hy));
      if (survivingReps.has(r)) out.add(nodeKey(hx, hy));
    });
  }
  for (const comp of components) {
    if (comp.type === 'voltmeter') continue;
    const [t0, t1] = getTerminalHalfGrid(comp);
    const pts = [t0, t1];
    if (comp.type === 'potentiometer') {
      const wt = getWiperTerminalHalfGrid(comp);
      if (wt) pts.push(wt);
    } else if (comp.type === 'npn') {
      const bt = getBaseTerminalHalfGrid(comp);
      if (bt) pts.push(bt);
    }
    for (const t of pts) {
      const k = nodeKey(t.hx, t.hy);
      if (survivingReps.has(ufL.find(k))) out.add(k);
    }
  }
  return out;
}

function analyzeCircuit(
  components: PlacedComponent[],
  wires: Wire[],
  switchStates: Record<string, boolean>,
  openCircuitIds?: Set<string>,
): {
  wiredComponents: Set<string>;
  wiredNodes: Set<string>;
  energizedComponents: Set<string>;
  energizedNodes: Set<string>;
} {
  const nodeKey = (hx: number, hy: number) => `${hx},${hy}`;
  const allOn: Record<string, boolean> = {};
  for (const c of components) { if (c.type === 'switch') allOn[c.id] = true; }

  // Use leaf-trim for energized (only true closed loops carry current)
  // Broken bulbs / blocked LEDs act as open circuits for both wired and energized
  let energizedNodes = leafTrimNodes(components, wires, switchStates, openCircuitIds);
  const wiredNodes     = leafTrimNodes(components, wires, allOn, openCircuitIds);

  // ── REQUIRE at least one battery in the energized loop ──
  const hasBatteryInLoop = components.some(c => {
    if (c.type !== 'battery' && c.type !== 'battery2' && c.type !== 'battery3') return false;
    const [t0, t1] = getTerminalHalfGrid(c);
    return energizedNodes.has(nodeKey(t0.hx, t0.hy)) && energizedNodes.has(nodeKey(t1.hx, t1.hy));
  });
  if (!hasBatteryInLoop) energizedNodes = new Set<string>();

  const wiredComponents     = new Set<string>();
  const energizedComponents = new Set<string>();
  for (const comp of components) {
    const [t0, t1] = getTerminalHalfGrid(comp);
    const a = nodeKey(t0.hx, t0.hy);
    const b = nodeKey(t1.hx, t1.hy);
    if (comp.type === 'potentiometer') {
      const wt = getWiperTerminalHalfGrid(comp);
      const w = wt ? nodeKey(wt.hx, wt.hy) : null;
      // Potentiometer is wired/energized if at least 2 of its 3 terminals are in the set
      const wiredCount = [a, b, w].filter(n => n && wiredNodes.has(n)).length;
      const energizedCount = [a, b, w].filter(n => n && energizedNodes.has(n)).length;
      if (wiredCount >= 2) wiredComponents.add(comp.id);
      if (energizedCount >= 2) energizedComponents.add(comp.id);
    } else if (comp.type === 'npn') {
      const bt = getBaseTerminalHalfGrid(comp);
      const base = bt ? nodeKey(bt.hx, bt.hy) : null;
      // NPN is wired/energized if at least 2 of its 3 terminals are in the set
      const wiredCount = [a, b, base].filter(n => n && wiredNodes.has(n)).length;
      const energizedCount = [a, b, base].filter(n => n && energizedNodes.has(n)).length;
      if (wiredCount >= 2) wiredComponents.add(comp.id);
      if (energizedCount >= 2) energizedComponents.add(comp.id);
    } else {
      if (wiredNodes.has(a)     && wiredNodes.has(b))     wiredComponents.add(comp.id);
      if (energizedNodes.has(a) && energizedNodes.has(b)) energizedComponents.add(comp.id);
    }
  }

  return { wiredComponents, wiredNodes, energizedComponents, energizedNodes };
}

/**
 * Electron direction – the SIMPLEST possible approach.
 * Rule: electrons ALWAYS flow CCW on screen.
 *
 * For each wire / component INDEPENDENTLY:
 *   1. Compute centroid C of all energized nodes.
 *   2. r = (midpoint of wire) − C          (position relative to centre)
 *   3. d = last_point − first_point         (wire direction vector)
 *   4. cross = r × d  (2-D cross product)
 *      cross < 0 → forward is CCW  ✓
 *      cross > 0 → backward is CCW (flip)
 *      cross = 0 → default forward
 *
 * No graphs, no DFS, no loop walking.  Works per-element.
 */
function computeWireDirections(
  components: PlacedComponent[],
  wires: Wire[],
  switchStates: Record<string, boolean>,
  energizedNodes: Set<string>,
): { wireMap: Map<string, boolean>; compMap: Map<string, boolean> } {
  const wireMap = new Map<string, boolean>();
  const compMap = new Map<string, boolean>();
  if (energizedNodes.size === 0) return { wireMap, compMap };

  const nodeKey = (hx: number, hy: number) => `${hx},${hy}`;

  // ── Centroid of all energized nodes (half-grid coords) ──
  let sumX = 0, sumY = 0, cnt = 0;
  for (const nk of energizedNodes) {
    const sep = nk.indexOf(',');
    sumX += Number(nk.slice(0, sep));
    sumY += Number(nk.slice(sep + 1));
    cnt++;
  }
  const cx = sumX / cnt;
  const cy = sumY / cnt;

  // helper: given first/last half-grid points → forward=CCW?
  const isCCW = (pts: { hx: number; hy: number }[]): boolean => {
    // midpoint of ALL points (handles L-shaped wires better)
    let mx = 0, my = 0;
    for (const p of pts) { mx += p.hx; my += p.hy; }
    mx /= pts.length; my /= pts.length;

    const first = pts[0], last = pts[pts.length - 1];
    const dx = last.hx - first.hx;
    const dy = last.hy - first.hy;
    const rx = mx - cx;
    const ry = my - cy;
    const cross = rx * dy - ry * dx;
    return cross <= 0;   // ≤ 0 → forward is CCW (or on the centre line → default fwd)
  };

  // ─ Wires ──
  for (const wire of wires) {
    if (wire.points.length < 2) continue;
    const fk = nodeKey(wire.points[0].hx, wire.points[0].hy);
    const lk = nodeKey(wire.points[wire.points.length - 1].hx, wire.points[wire.points.length - 1].hy);
    if (!energizedNodes.has(fk) || !energizedNodes.has(lk)) continue;
    wireMap.set(wire.id, isCCW(wire.points));
  }

  // ── Components ──
  for (const comp of components) {
    const [t0, t1] = getTerminalHalfGrid(comp);
    const a = nodeKey(t0.hx, t0.hy);
    const b = nodeKey(t1.hx, t1.hy);
    // For potentiometer/NPN, check if any 2 of 3 terminals are energized
    if (comp.type === 'potentiometer') {
      const wt = getWiperTerminalHalfGrid(comp);
      const w = wt ? nodeKey(wt.hx, wt.hy) : null;
      const count = [a, b, w].filter(n => n && energizedNodes.has(n)).length;
      if (count < 2) continue;
    } else if (comp.type === 'npn') {
      const bt = getBaseTerminalHalfGrid(comp);
      const base = bt ? nodeKey(bt.hx, bt.hy) : null;
      const count = [a, b, base].filter(n => n && energizedNodes.has(n)).length;
      if (count < 2) continue;
    } else {
      if (!energizedNodes.has(a) || !energizedNodes.has(b)) continue;
    }
    compMap.set(comp.id, isCCW([t0, t1]));
  }

  return { wireMap, compMap };
}

export function CircuitCanvas({
  tool,
  viewMode,
  clearTrigger,
  zoom,
  setTool,
  setZoom,
  isViewOnly,
  svgElementRef,
  initialState,
  shareHandlerRef,
  onPanelOpenChange,
  isTouch = false,
  showWireElectrons = false,
  editableSchemaValueLabels = false,
  schemaValueLabels,
  onSchemaValueLabelChange,
  editChromeEndSlot,
}: Props) {
  const [components, setComponents] = useState<PlacedComponent[]>(initialState?.components ?? []);
  const [wires, setWires] = useState<Wire[]>(initialState?.wires ?? []);
  const [switchStates, setSwitchStates] = useState<Record<string, boolean>>(initialState?.switchStates ?? {});
  const [bulbStates, setBulbStates] = useState<Record<string, BulbState>>({});
  const [bulbNominalId, setBulbNominalId] = useState<string | null>(null);
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [voltageSettings, setVoltageSettings] = useState<Record<string, number>>(initialState?.voltageSettings ?? {});
  const [resistanceSettings, setResistanceSettings] = useState<Record<string, number>>(initialState?.resistanceSettings ?? {});
  const [realSources, setRealSources] = useState<Record<string, boolean>>(initialState?.realSources ?? {});
  const [wiperPositions, setWiperPositions] = useState<Record<string, number>>(initialState?.wiperPositions ?? {});
  const [ammeterMilliMode, setAmmeterMilliMode] = useState<Record<string, boolean>>({});
  const [bypassedResistors, setBypassedResistors] = useState<Record<string, boolean>>({});
  const [editingVoltageId, setEditingVoltageId] = useState<string | null>(null);
  const [editingResistanceId, setEditingResistanceId] = useState<string | null>(null);

  // Notify parent when any panel opens/closes
  useEffect(() => {
    onPanelOpenChange?.(editingVoltageId !== null || editingResistanceId !== null);
  }, [editingVoltageId, editingResistanceId, onPanelOpenChange]);

  // bulbNominalId is a simple toggle (click again to hide)

  // ── Voltmeter probes ──
  const [voltmeterProbes, setVoltmeterProbes] = useState<Record<string, VoltmeterProbes>>({});
  const probeDragRef = useRef<{
    voltmeterId: string;
    probeKey: 'probe1' | 'probe2';
  } | null>(null);
  const [probeDragPos, setProbeDragPos] = useState<{ x: number; y: number } | null>(null);

  // ── Wiper drag ──
  const wiperDragRef = useRef<{
    compId: string;
    startWiperPos: number;
    axisX: number; // component horizontal axis direction
    axisY: number;
    startSvgX: number;
    startSvgY: number;
  } | null>(null);

  // ── Helper: Get voltage for a component (custom or default) ──
  const getComponentVoltage = useCallback((comp: PlacedComponent): number => {
    if (voltageSettings[comp.id] !== undefined) return voltageSettings[comp.id];
    // Default voltages
    switch (comp.type) {
      case 'battery': return BATTERY_EMF;
      case 'battery2': return BATTERY2_EMF;
      case 'battery3': return BATTERY3_EMF;

      default: return 0;
    }
  }, [voltageSettings]);

  // ── Helper: Get resistance for a component (custom or default) ──
  const getComponentResistance = useCallback((comp: PlacedComponent): number => {
    if (resistanceSettings[comp.id] !== undefined) return resistanceSettings[comp.id];
    // Default resistances
    switch (comp.type) {
      case 'resistor': return RESISTOR_R;
      case 'resistor2': return RESISTOR2_R;
      case 'resistor3': return RESISTOR3_R;
      case 'potentiometer': return POTENTIOMETER_R;
      default: return 0;
    }
  }, [resistanceSettings]);

  // ── Helper: Get internal resistance for a voltage source (real vs ideal) ──
  const getSourceInternalResistance = useCallback((comp: PlacedComponent): number => {
    const isReal = realSources[comp.id] ?? false;
    if (!isReal) {
      // Ideální zdroj (vnitřní odpor = 0)
      switch (comp.type) {
        case 'battery': return BATTERY_INTERNAL_R;
        case 'battery2': return BATTERY2_INTERNAL_R;
        case 'battery3': return BATTERY3_INTERNAL_R;

        default: return 0;
      }
    } else {
      // Reálný zdroj (s vnitřním odporem)
      switch (comp.type) {
        case 'battery': return BATTERY_REAL_R;
        case 'battery2': return BATTERY2_REAL_R;
        case 'battery3': return BATTERY3_REAL_R;

        default: return 0;
      }
    }
  }, [realSources]);

  // ── Broken bulbs act as open circuits ──
  const brokenBulbIds = useMemo(() => {
    const s = new Set<string>();
    for (const [id, st] of Object.entries(bulbStates)) { if (st === 'broken') s.add(id); }
    return s;
  }, [bulbStates]);

  const histRef = useRef<Snapshot[]>([{
    components: initialState?.components ?? [],
    wires: initialState?.wires ?? [],
    switchStates: initialState?.switchStates ?? {},
    bulbStates: {},
  }]);
  const histIdxRef = useRef(0);
  const [histUI, setHistUI] = useState({ canUndo: false, canRedo: false });

  const pushHistory = useCallback((snap: Snapshot) => {
    histRef.current = histRef.current.slice(0, histIdxRef.current + 1);
    histRef.current.push(snap);
    histIdxRef.current = histRef.current.length - 1;
    setHistUI({ canUndo: histIdxRef.current > 0, canRedo: false });
  }, []);

  const undo = useCallback(() => {
    if (histIdxRef.current <= 0) return;
    histIdxRef.current -= 1;
    const s = histRef.current[histIdxRef.current];
    setComponents(s.components); setWires(s.wires);
    setSwitchStates(s.switchStates); setBulbStates(s.bulbStates);
    setHistUI({ canUndo: histIdxRef.current > 0, canRedo: histIdxRef.current < histRef.current.length - 1 });
  }, []);

  const redo = useCallback(() => {
    if (histIdxRef.current >= histRef.current.length - 1) return;
    histIdxRef.current += 1;
    const s = histRef.current[histIdxRef.current];
    setComponents(s.components); setWires(s.wires);
    setSwitchStates(s.switchStates); setBulbStates(s.bulbStates);
    setHistUI({ canUndo: histIdxRef.current > 0, canRedo: histIdxRef.current < histRef.current.length - 1 });
  }, []);

  const stateRef = useRef({ components, wires, switchStates, bulbStates, voltageSettings, resistanceSettings, realSources, wiperPositions });
  useEffect(() => { stateRef.current = { components, wires, switchStates, bulbStates, voltageSettings, resistanceSettings, realSources, wiperPositions }; },
    [components, wires, switchStates, bulbStates, voltageSettings, resistanceSettings, realSources, wiperPositions]);

  const circuitAnalysis = useMemo(
    () => analyzeCircuit(components, wires, switchStates, brokenBulbIds),
    [components, wires, switchStates, brokenBulbIds],
  );

  // ── Physics: Modified Nodal Analysis (MNA) for series AND parallel circuits ──
  const circuitPhysics = useMemo(() => {
    const { energizedComponents } = circuitAnalysis;
    const currents = new Map<string, number>();
    for (const comp of components) currents.set(comp.id, 0);

    const nodeVoltages = new Map<string, number>();

    const nodeKey = (hx: number, hy: number) => `${hx},${hy}`;

    // ── Union-Find: stejný model jako leafTrim – spoj jen na vrcholech / svorkách, ne při křížení ──
    const ufM = createUnionFindMap();
    mergeJunctionAwareWiresIntoUF(wires, components, nodeKey, ufM);
    const ufParent = ufM.parent;
    const ufFind = ufM.find;
    const ufUnion = ufM.union;

    const isSourceType = (t: ComponentType) =>
      t === 'battery' || t === 'battery2' || t === 'battery3';

    // Zkrat zdroje: oba póly ve stejném superuzlu. Leaf-trim při čistém zkratu neudělá hranu baterie
    // (norm(t0) === norm(t1)), takže energizedComponents může být prázdný — musíme kontrolovat vždy.
    let hasShortCircuit = false;
    let shortedSourceVoltageSum = 0;
    for (const comp of components) {
      if (!isSourceType(comp.type)) continue;
      const [t0, t1] = getTerminalHalfGrid(comp);
      if (ufFind(nodeKey(t0.hx, t0.hy)) === ufFind(nodeKey(t1.hx, t1.hy))) {
        hasShortCircuit = true;
        shortedSourceVoltageSum += getComponentVoltage(comp);
      }
    }
    if (hasShortCircuit) {
      for (const comp of components) {
        currents.set(comp.id, energizedComponents.has(comp.id) ? 999 : 0);
      }
      return { totalVoltage: shortedSourceVoltageSum, totalResistance: 0, totalCurrent: 999, currents, nodeVoltages, blockedLedIds: new Set<string>(), blockedNpnIds: new Set<string>(), npnDebug: new Map() };
    }

    if (energizedComponents.size === 0) {
      return { totalVoltage: 0, totalResistance: 0, totalCurrent: 0, currents, nodeVoltages, blockedLedIds: new Set<string>(), blockedNpnIds: new Set<string>(), npnDebug: new Map() };
    }

    // ── Collect super-nodes from energized component terminals ──
    const superNodeSet = new Set<string>();
    for (const comp of components) {
      if (!energizedComponents.has(comp.id)) continue;
      const [t0, t1] = getTerminalHalfGrid(comp);
      superNodeSet.add(ufFind(nodeKey(t0.hx, t0.hy)));
      superNodeSet.add(ufFind(nodeKey(t1.hx, t1.hy)));
      // Potentiometer wiper terminal
      if (comp.type === 'potentiometer') {
        const wt = getWiperTerminalHalfGrid(comp);
        if (wt) superNodeSet.add(ufFind(nodeKey(wt.hx, wt.hy)));
      }
      // NPN base terminal
      if (comp.type === 'npn') {
        const bt = getBaseTerminalHalfGrid(comp);
        if (bt) superNodeSet.add(ufFind(nodeKey(bt.hx, bt.hy)));
      }
    }
    const nodeList = Array.from(superNodeSet);
    const nodeIdx = new Map<string, number>();
    nodeList.forEach((n, i) => nodeIdx.set(n, i));
    const N = nodeList.length;

    if (N < 2) {
      return { totalVoltage: 0, totalResistance: 0, totalCurrent: 0, currents, nodeVoltages, blockedLedIds: new Set<string>(), blockedNpnIds: new Set<string>(), npnDebug: new Map() };
    }

    // ── Categorize energized components into branches ──
    const TINY_R = 0.001; // Ω — near-zero resistance for switches / ammeters

    interface RBranch { compId: string; nA: number; nB: number; R: number }
    interface VBranch { compId: string; nMinus: number; nPlus: number; E: number; Ri: number }

    // ── Iterativní model diody LED & NPN tranzistoru ──
    // LED vede proud pouze v propustném směru (anoda t0 → katoda t1, tj. nA → nB).
    // NPN tranzistor má tři režimy: cutoff (IB < 0), active (IC = β·IB), saturated (VCE < 0.2V).
    // Opakujeme MNA řešení, dokud konverguje (max 8 iterací).
    const blockedLeds = new Set<string>(); // zpětně polarizované LED = otevřený obvod
    const blockedNpns = new Set<string>(); // cutoff NPN = otevřený obvod
    const saturatedNpns = new Set<string>(); // saturated NPN: CE = malý odpor
    let x: number[] = [];
    let rBranchesFinal: RBranch[] = [];
    let vSourcesFinal: VBranch[] = [];
    let potSubBranchesFinal = new Map<string, { leftId: string; rightId: string }>();
    let M = 0;

    for (let iter = 0; iter < 8; iter++) {
      const rBranches: RBranch[] = [];
      const vSources: VBranch[] = [];
      const potSubBranches = new Map<string, { leftId: string; rightId: string }>();
      // Index LED v poli vSources (pro kontrolu polarity a proudu)
      const ledVSourceIdx = new Map<string, number>();
      // NPN: track BE VBranch indices and CCCS stamps
      const npnBeVSourceIdx = new Map<string, number>();
      const npnCccsStamps: { compId: string; nC: number; nE: number; beIdx: number }[] = [];

      for (const comp of components) {
        if (comp.type === 'voltmeter') continue; // voltmeter = nekonečný odpor
        if (!energizedComponents.has(comp.id)) continue;
        // Přeskočit zpětně polarizované LED (otevřený obvod)
        if (isLedType(comp.type) && blockedLeds.has(comp.id)) continue;
        // Přeskočit cutoff NPN (otevřený obvod)
        if (comp.type === 'npn' && blockedNpns.has(comp.id)) continue;
        // Otevřený vypínač nevede proud — oba kontakty mohou být v energizedNodes, ale nesmí se modelovat jako TINY_R
        if (comp.type === 'switch' && !switchStates[comp.id]) continue;

        const [t0, t1] = getTerminalHalfGrid(comp);
        const nA = nodeIdx.get(ufFind(nodeKey(t0.hx, t0.hy)))!;
        const nB = nodeIdx.get(ufFind(nodeKey(t1.hx, t1.hy)))!;

        if (isSourceType(comp.type)) {
          if (nA === nB) continue;
          // t0 (levý terminál) = kladný pól (vizuální "+", vysoká čára v schématu)
          // t1 (pravý terminál) = záporný pól (vizuální "−", krátká čára v schématu)
          vSources.push({
            compId: comp.id, nMinus: nB, nPlus: nA,
            E: getComponentVoltage(comp),
            Ri: getSourceInternalResistance(comp),
          });
        } else if (comp.type === 'potentiometer') {
          // Tři terminály: rozdělíme na dvě R větve přes uzel stírače
          const wt = getWiperTerminalHalfGrid(comp);
          const wp = wiperPositions[comp.id] ?? 0.5;
          const totalR = getComponentResistance(comp);
          const stepPos = 1 / 100;
          const qwp = Math.round(wp / stepPos) * stepPos;
          const R_left  = Math.max(TINY_R, totalR * qwp);
          const R_right = Math.max(TINY_R, totalR * (1 - qwp));
          if (wt) {
            const nW = nodeIdx.get(ufFind(nodeKey(wt.hx, wt.hy)));
            if (nW !== undefined) {
              const leftId = `${comp.id}__potL`;
              const rightId = `${comp.id}__potR`;
              if (nA !== nW) rBranches.push({ compId: leftId, nA, nB: nW, R: R_left });
              if (nW !== nB) rBranches.push({ compId: rightId, nA: nW, nB, R: R_right });
              potSubBranches.set(comp.id, { leftId, rightId });
            } else {
              if (nA !== nB) rBranches.push({ compId: comp.id, nA, nB, R: totalR });
            }
          } else {
            if (nA !== nB) rBranches.push({ compId: comp.id, nA, nB, R: totalR });
          }
        } else if (comp.type === 'npn') {
          // ── NPN transistor: tříterminálová součástka ──
          // t0 (left) = Collector, t1 (right) = Emitter, base = bottom
          const bt = getBaseTerminalHalfGrid(comp);
          if (!bt) continue;
          const nBase = nodeIdx.get(ufFind(nodeKey(bt.hx, bt.hy)));
          if (nBase === undefined) continue;
          if (nA === nB) continue;

          // BE junction: VBranch (nPlus = emitter, nMinus = base)
          // V[emitter] - V[base] + Ri * IB = -VBE
          // IB > 0 when V[base] > V[emitter] + VBE → forward biased ✓
          // IB ≤ 0 when V[base] ≤ V[emitter] + VBE → reverse / cutoff
          const beIdx = vSources.length;
          npnBeVSourceIdx.set(comp.id, beIdx);
          vSources.push({
            compId: `${comp.id}__be`,
            nPlus: nB, // emitter
            nMinus: nBase,
            E: -NPN_VBE,
            Ri: NPN_RBE,
          });

          if (saturatedNpns.has(comp.id)) {
            // Saturation: CE path = small resistor
            rBranches.push({ compId: `${comp.id}__ce`, nA, nB, R: NPN_RCE_SAT });
          } else {
            // Active: CCCS IC = β * IB (stamped after matrix build)
            npnCccsStamps.push({ compId: comp.id, nC: nA, nE: nB, beIdx });
          }
        } else {
          if (nA === nB) continue;
          let R: number;
          switch (comp.type) {
            case 'resistor': case 'resistor2': case 'resistor3':
              R = bypassedResistors[comp.id] ? TINY_R : getComponentResistance(comp); break;
            case 'bulb':  R = BULB_R;  break;
            case 'bulb2': R = BULB2_R; break;
            case 'bulb3': R = BULB3_R; break;
            case 'led':
            case 'led2':
            case 'led3':
              // LED = napěťový zdroj Vf (propustné napětí) + dynamický odpor Rd
              // t0 (left) = katoda, t1 (right) = anoda
              // VBranch: V[katoda] - V[anoda] + Ri*I = -Vf
              // nPlus=katoda(nA), nMinus=anoda(nB) → I > 0 = forward (proud anoda→katoda)
              ledVSourceIdx.set(comp.id, vSources.length);
              vSources.push({
                compId: comp.id, nPlus: nA, nMinus: nB,
                E: -getLedVf(comp.type),
                Ri: LED_R,
              });
              // nesmí se přidávat do rBranches
              R = -1; // sentinel – přeskočit rBranches.push
              break;
            default: // vypínač (zavřený), ampérmetr, …
              R = TINY_R; break;
          }
          if (R >= 0) rBranches.push({ compId: comp.id, nA, nB, R });
        }
      }

      M = vSources.length;
      if (M === 0) break;

      // ── Sestavení MNA systému: (N + M) neznámých ──
      const sz = N + M;
      const A: number[][] = Array.from({ length: sz }, () => new Array(sz + 1).fill(0));

      // Stamp odporové větve (vodivost G = 1/R)
      for (const br of rBranches) {
        const G = 1 / br.R;
        A[br.nA][br.nA] += G;
        A[br.nB][br.nB] += G;
        A[br.nA][br.nB] -= G;
        A[br.nB][br.nA] -= G;
      }

      // Stamp napěťové zdroje (KCL: součet odtékajících proudů = 0)
      for (let k = 0; k < M; k++) {
        const vs = vSources[k];
        const iVar = N + k;
        A[vs.nMinus][iVar] += 1;
        A[vs.nPlus][iVar]  -= 1;
        A[iVar][vs.nPlus]  =  1;
        A[iVar][vs.nMinus] = -1;
        A[iVar][iVar]      = vs.Ri;
        A[iVar][sz]         = vs.E;
      }

      // ── Stamp NPN CCCS: IC = β * IB (proudově řízený proudový zdroj) ──
      // MNA konvence: IB > 0 = forward bias (V[base] > V[emitter] + VBE)
      // +β at nC: IB>0 → kladné outgoing = IC odchází z collectoru do tranzistoru ✓
      // -β at nE: IB>0 → záporné outgoing = IC přichází do emitteru z tranzistoru ✓
      for (const cccs of npnCccsStamps) {
        const beIVar = N + cccs.beIdx;
        A[cccs.nC][beIVar] += NPN_BETA;
        A[cccs.nE][beIVar] -= NPN_BETA;
      }

      // Uzemnění: V[nMinus prvního zdroje] = 0
      const gnd = vSources[0].nMinus;
      for (let j = 0; j <= sz; j++) A[gnd][j] = 0;
      A[gnd][gnd] = 1;

      // ── Gaussova eliminace s částečným pivotováním ──
      for (let col = 0; col < sz; col++) {
        let maxRow = col, maxVal = Math.abs(A[col][col]);
        for (let row = col + 1; row < sz; row++) {
          if (Math.abs(A[row][col]) > maxVal) { maxVal = Math.abs(A[row][col]); maxRow = row; }
        }
        if (maxVal < 1e-15) continue;
        if (maxRow !== col) [A[col], A[maxRow]] = [A[maxRow], A[col]];
        const pivot = A[col][col];
        for (let row = col + 1; row < sz; row++) {
          const f = A[row][col] / pivot;
          if (f === 0) continue;
          for (let j = col; j <= sz; j++) A[row][j] -= f * A[col][j];
        }
      }

      // Zpětná substituce
      x = new Array(sz).fill(0);
      for (let i = sz - 1; i >= 0; i--) {
        if (Math.abs(A[i][i]) < 1e-15) continue;
        let s = A[i][sz];
        for (let j = i + 1; j < sz; j++) s -= A[i][j] * x[j];
        x[i] = s / A[i][i];
      }

      rBranchesFinal = rBranches;
      vSourcesFinal = vSources;
      potSubBranchesFinal = potSubBranches;

      // ── Kontrola polarity LED: propustný směr ──
      let anyNewBlocked = false;
      for (const [compId, vsIdx] of ledVSourceIdx) {
        const ledI = x[N + vsIdx];
        if (ledI < -1e-9) {
          blockedLeds.add(compId);
          anyNewBlocked = true;
        }
      }

      // ── Kontrola NPN režimů: cutoff / active / saturated ──
      for (const [compId, beIdx] of npnBeVSourceIdx) {
        const IB = x[N + beIdx];
        if (IB < 1e-9 && !saturatedNpns.has(compId)) {
          // Cutoff: IB ≤ 0 or negligible → no forward base current → transistor off
          // MNA convention: IB > 0 = forward bias (V[base] > V[emitter] + VBE)
          if (!blockedNpns.has(compId)) {
            blockedNpns.add(compId);
            anyNewBlocked = true;
          }
        } else if (!saturatedNpns.has(compId) && !blockedNpns.has(compId)) {
          // Check for saturation: VCE < VCE_SAT
          const comp = components.find(c => c.id === compId)!;
          const [ct0, ct1] = getTerminalHalfGrid(comp);
          const nC = nodeIdx.get(ufFind(nodeKey(ct0.hx, ct0.hy)))!;
          const nE = nodeIdx.get(ufFind(nodeKey(ct1.hx, ct1.hy)))!;
          const VCE = x[nC] - x[nE];
          if (VCE < NPN_VCE_SAT) {
            saturatedNpns.add(compId);
            anyNewBlocked = true;
          }
        }
      }

      if (!anyNewBlocked) break; // konvergence
    }

    // ── NPN debug info ──
    const npnDebug = new Map<string, { IB: number; IC: number; VCE: number; mode: string; extra: string }>();
    for (const comp of components) {
      if (comp.type !== 'npn') continue;
      const ener = energizedComponents.has(comp.id);
      const blk = blockedNpns.has(comp.id);
      const sat = saturatedNpns.has(comp.id);
      const beVs = vSourcesFinal.find(v => v.compId === `${comp.id}__be`);
      const beIdx2 = beVs ? vSourcesFinal.indexOf(beVs) : -1;
      const rawIB = beIdx2 >= 0 && x.length > N + beIdx2 ? x[N + beIdx2] : -999;
      const [ct0, ct1] = getTerminalHalfGrid(comp);
      const nCi = nodeIdx.get(ufFind(nodeKey(ct0.hx, ct0.hy)));
      const nEi = nodeIdx.get(ufFind(nodeKey(ct1.hx, ct1.hy)));
      const btDbg = getBaseTerminalHalfGrid(comp);
      const nBi = btDbg ? nodeIdx.get(ufFind(nodeKey(btDbg.hx, btDbg.hy))) : undefined;
      const vc = nCi !== undefined && x.length > nCi ? x[nCi] : -999;
      const ve = nEi !== undefined && x.length > nEi ? x[nEi] : -999;
      const vb = nBi !== undefined && x.length > nBi ? x[nBi] : -999;
      const vce = (vc !== -999 && ve !== -999) ? vc - ve : -999;
      const reversed = ener && vce !== -999 && vce < -0.1;
      let mode = !ener ? 'NO_ENRG' : blk ? (reversed ? 'REVERSED' : 'CUTOFF') : sat ? 'SAT' : 'ACTIVE';
      const extra = `e=${ener?1:0} b=${blk?1:0} s=${sat?1:0} N=${N} M=${M} bf=${beVs?1:0}` +
        ` nC=${nCi??'?'} nE=${nEi??'?'} nB=${nBi??'?'}` +
        ` VC=${vc!==-999?vc.toFixed(1):'?'} VE=${ve!==-999?ve.toFixed(1):'?'} VB=${vb!==-999?vb.toFixed(1):'?'}` +
        ` t0=(${ct0.hx},${ct0.hy}) t1=(${ct1.hx},${ct1.hy})` + (btDbg ? ` bT=(${btDbg.hx},${btDbg.hy})` : ' bT=null');
      npnDebug.set(comp.id, { IB: rawIB, IC: rawIB > 0 ? rawIB * NPN_BETA : 0, VCE: vce, mode, extra });
    }

    if (M === 0) {
      return { totalVoltage: 0, totalResistance: 0, totalCurrent: 0, currents, nodeVoltages, blockedLedIds: blockedLeds, blockedNpnIds: blockedNpns, npnDebug };
    }

    // ── Naplnění nodeVoltages: každý half-grid uzel → napětí z MNA ──
    for (const [node] of ufParent) {
      const rep = ufFind(node);
      const idx = nodeIdx.get(rep);
      if (idx !== undefined && idx < N) {
        nodeVoltages.set(node, x[idx]);
      }
    }
    for (const w of wires) {
      forEachWireGridPoint(w, (hx, hy) => {
        const rep = ufFind(wireScopedKey(w.id, hx, hy));
        const idx = nodeIdx.get(rep);
        if (idx !== undefined && idx < N) {
          nodeVoltages.set(nodeKey(hx, hy), x[idx]);
        }
      });
    }

    // ── Výpočet proudů jednotlivých součástek ──
    // Sada comp ID pro vyloučení z maxSourceI (LED VBranches + NPN BE VBranches)
    const excludeFromMaxI = new Set(blockedLeds);
    for (const vs of vSourcesFinal) {
      if (vs.E < 0) excludeFromMaxI.add(vs.compId); // LED VBranch
      if (vs.compId.endsWith('__be')) excludeFromMaxI.add(vs.compId); // NPN BE VBranch
    }
    let maxSourceI = 0;
    for (let k = 0; k < M; k++) {
      const I = Math.abs(x[N + k]);
      currents.set(vSourcesFinal[k].compId, I);
      // maxSourceI počítáme pouze z baterií, ne z LED/NPN
      if (!excludeFromMaxI.has(vSourcesFinal[k].compId) && I > maxSourceI) maxSourceI = I;
    }
    const subBranchCurrents = new Map<string, number>();
    for (const br of rBranchesFinal) {
      const I = Math.abs((x[br.nA] - x[br.nB]) / br.R);
      subBranchCurrents.set(br.compId, I);
      currents.set(br.compId, I);
    }
    // Zpětně polarizované LED mají nulový proud
    for (const compId of blockedLeds) {
      currents.set(compId, 0);
    }
    // Cutoff NPN mají nulový proud
    for (const compId of blockedNpns) {
      currents.set(compId, 0);
    }
    // Sloučení proudů větví potenciometru → maximum z levé/pravé větve
    for (const [compId, { leftId, rightId }] of potSubBranchesFinal) {
      const iL = subBranchCurrents.get(leftId) ?? 0;
      const iR = subBranchCurrents.get(rightId) ?? 0;
      currents.set(compId, Math.max(iL, iR));
    }
    // NPN: proud komponenty = IC (collector current)
    // V active režimu IC = β * IB, v saturaci IC = VCE / RCE_SAT
    for (const comp of components) {
      if (comp.type !== 'npn') continue;
      if (blockedNpns.has(comp.id)) continue;
      const beI = currents.get(`${comp.id}__be`) ?? 0; // IB
      const ceI = subBranchCurrents.get(`${comp.id}__ce`); // saturace: IC z R větve
      if (ceI !== undefined) {
        currents.set(comp.id, ceI); // saturace
      } else {
        currents.set(comp.id, beI * NPN_BETA); // active: IC = β * IB
      }
    }

    let totalV = 0;
    for (const vs of vSourcesFinal) {
      // Sčítáme pouze EMF skutečných zdrojů (baterie), ne LED Vf ani NPN VBE
      if (vs.E > 0 && !vs.compId.endsWith('__be')) totalV += vs.E;
    }

    // Pokud jsou všechny LED zpětně polarizovány nebo NPN v cutoff (otevřený obvod), proud = 0
    const isOpenDueToBlocked = (blockedLeds.size > 0 || blockedNpns.size > 0) && maxSourceI < 1e-9;
    return {
      totalVoltage: totalV,
      totalResistance: maxSourceI > 0 ? totalV / maxSourceI : 0,
      totalCurrent: isOpenDueToBlocked ? 0
        : maxSourceI > 0 ? maxSourceI
        : (totalV > 0 ? 999 : 0),
      currents,
      nodeVoltages,
      blockedLedIds: blockedLeds,
      blockedNpnIds: blockedNpns,
      npnDebug,
    };
  }, [components, wires, circuitAnalysis, switchStates, getComponentVoltage, getComponentResistance, getSourceInternalResistance, wiperPositions, bypassedResistors]);

  // ── Display-corrected analysis: excludes blocked LEDs as open circuits ──
  const openCircuitIds = useMemo(() => {
    const ids = new Set(brokenBulbIds);
    for (const id of circuitPhysics.blockedLedIds) ids.add(id);
    for (const id of circuitPhysics.blockedNpnIds) ids.add(id);
    return ids;
  }, [brokenBulbIds, circuitPhysics.blockedLedIds, circuitPhysics.blockedNpnIds]);

  const displayAnalysis = useMemo(
    () => analyzeCircuit(components, wires, switchStates, openCircuitIds),
    [components, wires, switchStates, openCircuitIds],
  );

  const wireDirections = useMemo(
    () => computeWireDirections(components, wires, switchStates, displayAnalysis.energizedNodes),
    [components, wires, switchStates, displayAnalysis.energizedNodes],
  );

  /** NPN s kladným pólem na emitoru a záporným na bázi i kolektoru (záver B–E + „obrácené“ V_CE) – reálně zničující, ve výpočtu často záver bez velkého proudu. */
  const npnReverseDestructiveWiring = useMemo(() => {
    for (const dbg of circuitPhysics.npnDebug.values()) {
      if (dbg.mode === 'REVERSED') return true;
    }
    return false;
  }, [circuitPhysics.npnDebug]);

  // ── Short-circuit detection: velký proud z baterie NEBO destruktivní zapojení NPN ──
  const isShortCircuit = useMemo(() => {
    return circuitPhysics.totalCurrent >= SHORT_CIRCUIT_THRESHOLD || npnReverseDestructiveWiring;
  }, [circuitPhysics.totalCurrent, npnReverseDestructiveWiring]);

  // ── Auto-break bulbs & LEDs when current exceeds thresholds ──
  // During a short circuit the MNA assigns 999 A to all energized components,
  // but bulbs/LEDs on parallel branches with significant resistance don't
  // actually carry that current → skip destruction while short-circuited.
  useEffect(() => {
    if (isShortCircuit) return; // don't destroy anything during short circuit
    let changed = false;
    const next: Record<string, BulbState> = { ...bulbStates };
    for (const comp of components) {
      if (next[comp.id] === 'broken') continue; // already broken
      const I = circuitPhysics.currents.get(comp.id) ?? 0;
      if ((comp.type === 'bulb' || comp.type === 'bulb2' || comp.type === 'bulb3') && I > BULB_BRIGHT_MAX) {
        next[comp.id] = 'broken';
        changed = true;
      } else if (isLedType(comp.type) && I > LED_BURN_THRESHOLD) {
        next[comp.id] = 'broken';
        changed = true;
      }
    }
    if (changed) setBulbStates(next);
  }, [circuitPhysics, components, bulbStates, isShortCircuit]);

  // ── Short-circuit detection: totalCurrent ≥ 100 A → dramatic visual effect ���─
  // ── Identify which wires & components lie on the short-circuit path ──
  // BFS from each battery terminal through wires and near-zero-R components only.
  // A wire/component is "on the short path" if it can reach both terminals of a
  // shorted source without passing through a high-resistance component.
  const shortCircuitPathIds = useMemo(() => {
    const emptyW = new Set<string>();
    const emptyC = new Set<string>();
    if (!isShortCircuit) return { wires: emptyW, comps: emptyC };

    try {
      const npnReverse = Array.from(circuitPhysics.npnDebug.entries()).some(([, d]) => d.mode === 'REVERSED');
      if (npnReverse) {
        const rW = new Set<string>();
        const rC = new Set<string>();
        for (const w of wires) rW.add(w.id);
        const isSrcT = (t: string) => t === 'battery' || t === 'battery2' || t === 'battery3';
        for (const comp of components) {
          if (isSrcT(comp.type)) rC.add(comp.id);
          if (comp.type === 'npn' && circuitPhysics.npnDebug.get(comp.id)?.mode === 'REVERSED') rC.add(comp.id);
        }
        return { wires: rW, comps: rC };
      }

      // Determine which component types have negligible resistance (short-circuit carriers)
      const isLowR = (c: PlacedComponent): boolean => {
        if (c.type === 'switch') return !!switchStates[c.id];
        if (c.type === 'ammeter') return true;
        if ((c.type === 'resistor' || c.type === 'resistor2' || c.type === 'resistor3') && bypassedResistors[c.id]) return true;
        return false;
      };

      // Build adjacency: half-grid point → { wireIds, compIds (low-R only) }
      const adj = new Map<string, { wireIds: Set<string>; compIds: Set<string> }>();
      const ensure = (k: string) => { if (!adj.has(k)) adj.set(k, { wireIds: new Set(), compIds: new Set() }); return adj.get(k)!; };

      for (const w of wires) {
        if (w.points.length < 2) continue;
        for (const pt of w.points) {
          ensure(`${pt.hx},${pt.hy}`).wireIds.add(w.id);
        }
      }

      for (const comp of components) {
        if (comp.type === 'voltmeter') continue;
        if (!isLowR(comp)) continue;
        const [t0, t1] = getTerminalHalfGrid(comp);
        ensure(`${t0.hx},${t0.hy}`).compIds.add(comp.id);
        ensure(`${t1.hx},${t1.hy}`).compIds.add(comp.id);
      }

      const isSrc = (t: string) => t === 'battery' || t === 'battery2' || t === 'battery3';
      const rW = new Set<string>();
      const rC = new Set<string>();

      for (const comp of components) {
        if (!isSrc(comp.type)) continue;
        const [t0, t1] = getTerminalHalfGrid(comp);
        const startKey = `${t0.hx},${t0.hy}`;
        const endKey = `${t1.hx},${t1.hy}`;
        const visitedPts = new Set<string>([startKey]);
        const visitedWires = new Set<string>();
        const visitedComps = new Set<string>();
        const queue = [startKey];
        let reachesEnd = false;

        while (queue.length > 0) {
          const pt = queue.shift()!;
          if (pt === endKey) reachesEnd = true;
          const node = adj.get(pt);
          if (!node) continue;
          for (const wid of node.wireIds) {
            if (visitedWires.has(wid)) continue;
            visitedWires.add(wid);
            const w = wires.find(ww => ww.id === wid);
            if (!w) continue;
            for (const p of w.points) {
              const pk = `${p.hx},${p.hy}`;
              if (!visitedPts.has(pk)) { visitedPts.add(pk); queue.push(pk); }
            }
          }
          for (const cid of node.compIds) {
            if (visitedComps.has(cid)) continue;
            visitedComps.add(cid);
            const c = components.find(cc => cc.id === cid);
            if (!c) continue;
            const [ct0, ct1] = getTerminalHalfGrid(c);
            for (const ck of [`${ct0.hx},${ct0.hy}`, `${ct1.hx},${ct1.hy}`]) {
              if (!visitedPts.has(ck)) { visitedPts.add(ck); queue.push(ck); }
            }
          }
        }

        if (reachesEnd) {
          for (const wid of visitedWires) rW.add(wid);
          for (const cid of visitedComps) rC.add(cid);
          rC.add(comp.id);
        }
      }

      return { wires: rW, comps: rC };
    } catch {
      return { wires: new Set<string>(), comps: new Set<string>() };
    }
  }, [isShortCircuit, circuitPhysics.npnDebug, components, wires, switchStates, bypassedResistors]);

  // Spark positions along energized wires (randomised once per short-circuit onset)
  const [sparkSeed, setSparkSeed] = useState(0);
  useEffect(() => {
    if (isShortCircuit) setSparkSeed(s => s + 1);
  }, [isShortCircuit]);

  const sparkPositions = useMemo(() => {
    if (!isShortCircuit) return [];
    const sparks: { x: number; y: number; delay: number; size: number }[] = [];
    let seed = sparkSeed * 9973 + 7;
    const rand = () => { seed = (seed * 16807 + 0) % 2147483647; return (seed & 0x7fffffff) / 2147483647; };
    for (const w of wires) {
      if (w.points.length < 2) continue;
      if (!shortCircuitPathIds.wires.has(w.id)) continue; // only sparks on short-circuit path
      const nSparks = Math.max(1, Math.floor(w.points.length / 2));
      for (let s = 0; s < nSparks; s++) {
        const idx = Math.min(w.points.length - 1, Math.floor(rand() * w.points.length));
        const pt = w.points[idx];
        sparks.push({ x: pt.hx * HALF, y: pt.hy * HALF, delay: rand() * 0.6, size: 6 + rand() * 10 });
      }
    }
    for (const comp of components) {
      if (!shortCircuitPathIds.comps.has(comp.id)) continue; // only sparks on short-circuit path
      if (comp.type === 'voltmeter') continue;
      sparks.push({ x: comp.cx * GRID_SIZE + HALF, y: comp.cy * GRID_SIZE + HALF, delay: rand() * 0.5, size: 10 + rand() * 8 });
    }
    return sparks;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShortCircuit, sparkSeed, wires, components, shortCircuitPathIds]);

  // ── Electron speed: v = |I| · ELECTRON_SPEED_PER_AMP (px/s), bez horního stropu
  const currentToSpeed = useCallback((I: number): number => {
    const v = Math.abs(I) * ELECTRON_SPEED_PER_AMP;
    return v < 1e-12 ? 0 : v;
  }, []);

  // ── Per-wire current: KCL-based network flow on the wire graph ──
  // 1) Build wire-only adjacency graph (unit-step edges between half-grid nodes)
  // 2) At each node, compute net current injection from connected components
  // 3) Spanning tree + post-order DFS to solve flows via Kirchhoff's current law
  const wireVertexFlow = useMemo(() => {
    if (!showWireElectrons) return new Map<string, number>();

    const { energizedComponents } = displayAnalysis;

    const nk = (hx: number, hy: number) => `${hx},${hy}`;
    const edk = (a: string, b: string) => a < b ? `${a}|${b}` : `${b}|${a}`;

    // ── 1. Wire-only adjacency graph ──
    const wireAdj = new Map<string, Set<string>>();
    const addEdge = (a: string, b: string) => {
      if (a === b) return;
      if (!wireAdj.has(a)) wireAdj.set(a, new Set());
      if (!wireAdj.has(b)) wireAdj.set(b, new Set());
      wireAdj.get(a)!.add(b);
      wireAdj.get(b)!.add(a);
    };

    for (const wire of wires) {
      for (let i = 0; i < wire.points.length - 1; i++) {
        const a = wire.points[i], b = wire.points[i + 1];
        if (a.hx === b.hx) {
          const step = a.hy < b.hy ? 1 : -1;
          for (let hy = a.hy; hy !== b.hy; hy += step)
            addEdge(nk(a.hx, hy), nk(a.hx, hy + step));
        } else if (a.hy === b.hy) {
          const step = a.hx < b.hx ? 1 : -1;
          for (let hx = a.hx; hx !== b.hx; hx += step)
            addEdge(nk(hx, a.hy), nk(hx + step, a.hy));
        }
      }
    }

    // ── 2. Net current injection at each node from components ──
    // Convention: injection > 0 → current flows INTO the wire network at this node
    const injection = new Map<string, number>();
    const addInj = (key: string, val: number) => {
      injection.set(key, (injection.get(key) ?? 0) + val);
    };

    const isBatteryType = (t: string) =>
      t === 'battery' || t === 'battery2' || t === 'battery3';

    for (const comp of components) {
      if (comp.type === 'voltmeter') continue;
      if (!energizedComponents.has(comp.id)) continue;

      const [t0, t1] = getTerminalHalfGrid(comp);
      const k0 = nk(t0.hx, t0.hy);
      const k1 = nk(t1.hx, t1.hy);

      if (comp.type === 'potentiometer') {
        const wt = getWiperTerminalHalfGrid(comp);
        if (wt) {
          const kw = nk(wt.hx, wt.hy);
          const v0 = circuitPhysics.nodeVoltages.get(k0);
          const v1 = circuitPhysics.nodeVoltages.get(k1);
          const vw = circuitPhysics.nodeVoltages.get(kw);
          if (v0 !== undefined && v1 !== undefined && vw !== undefined) {
            const R = getComponentResistance(comp);
            const wPos = wiperPositions[comp.id] ?? 0.5;
            const Rl = Math.max(R * wPos, 0.001);
            const Rr = Math.max(R * (1 - wPos), 0.001);
            const iL = Math.abs(v0 - vw) / Rl;
            const iR = Math.abs(vw - v1) / Rr;
            if (v0 >= vw) { addInj(k0, -iL); addInj(kw, +iL); }
            else           { addInj(k0, +iL); addInj(kw, -iL); }
            if (vw >= v1) { addInj(kw, -iR); addInj(k1, +iR); }
            else           { addInj(kw, +iR); addInj(k1, -iR); }
          }
        }
        continue;
      }

      if (comp.type === 'npn') {
        const current = circuitPhysics.currents.get(comp.id) ?? 0;
        if (current < 1e-12) continue;
        const v0 = circuitPhysics.nodeVoltages.get(k0);
        const v1 = circuitPhysics.nodeVoltages.get(k1);
        if (v0 !== undefined && v1 !== undefined) {
          if (v0 >= v1) { addInj(k0, -current); addInj(k1, +current); }
          else           { addInj(k0, +current); addInj(k1, -current); }
        }
        continue;
      }

      const current = circuitPhysics.currents.get(comp.id) ?? 0;
      if (current < 1e-12) continue;

      if (isBatteryType(comp.type)) {
        // Battery: terminal 0 is positive (V_nA − V_nB = E > 0)
        // Current exits battery at terminal 0 into wire network
        addInj(k0, +current);
        addInj(k1, -current);
      } else {
        // Load (bulb, resistor, ammeter, switch, LED, …):
        // current enters component from higher-V terminal
        const v0 = circuitPhysics.nodeVoltages.get(k0);
        const v1 = circuitPhysics.nodeVoltages.get(k1);
        if (v0 !== undefined && v1 !== undefined) {
          if (v0 >= v1) { addInj(k0, -current); addInj(k1, +current); }
          else           { addInj(k0, +current); addInj(k1, -current); }
        }
      }
    }

    // ── 3. Spanning tree + post-order DFS → edge flows ──
    const visitedNodes = new Set<string>();
    const edgeFlow = new Map<string, number>();

    for (const [startNode] of wireAdj) {
      if (visitedNodes.has(startNode)) continue;

      const parent = new Map<string, string | null>();
      const order: string[] = [];
      parent.set(startNode, null);
      visitedNodes.add(startNode);
      const queue = [startNode];

      while (queue.length > 0) {
        const n = queue.shift()!;
        order.push(n);
        for (const adj of (wireAdj.get(n) ?? [])) {
          if (!visitedNodes.has(adj)) {
            visitedNodes.add(adj);
            parent.set(adj, n);
            queue.push(adj);
          }
        }
      }

      const subtreeInj = new Map<string, number>();
      for (let i = order.length - 1; i >= 0; i--) {
        const n = order[i];
        let sum = injection.get(n) ?? 0;
        for (const adj of (wireAdj.get(n) ?? [])) {
          if (parent.get(adj) === n) sum += subtreeInj.get(adj) ?? 0;
        }
        subtreeInj.set(n, sum);
      }

      for (const [node, par] of parent) {
        if (par === null) continue;
        edgeFlow.set(edk(node, par), Math.abs(subtreeInj.get(node) ?? 0));
      }
    }

    // ── 4. Lokální proud na úsecích drátu (pro animaci elektronů) ──
    const vertexFlow = new Map<string, number>();

    const firstEdgeFlow = (wire: Wire, segIdx: number): number => {
      const a = wire.points[segIdx], b = wire.points[segIdx + 1];
      if (a.hx === b.hx) {
        const step = a.hy < b.hy ? 1 : -1;
        return edgeFlow.get(edk(nk(a.hx, a.hy), nk(a.hx, a.hy + step))) ?? 0;
      } else if (a.hy === b.hy) {
        const step = a.hx < b.hx ? 1 : -1;
        return edgeFlow.get(edk(nk(a.hx, a.hy), nk(a.hx + step, a.hy))) ?? 0;
      }
      return 0;
    };

    for (const wire of wires) {
      if (wire.points.length < 2) continue;
      for (let i = 0; i < wire.points.length; i++) {
        const segIdx = i < wire.points.length - 1 ? i : i - 1;
        const vk = `${wire.id}:${i}`;
        vertexFlow.set(vk, firstEdgeFlow(wire, segIdx));
      }
    }

    return vertexFlow;
  }, [showWireElectrons, wires, components, displayAnalysis, circuitPhysics, getComponentResistance, wiperPositions]);

  // ── Voltmeter readings: compute voltage between each voltmeter's probes ──
  // Works both in closed circuits (uses MNA nodeVoltages) and open circuits
  // (falls back to static voltage propagation from sources through wires).
  const voltmeterReadings = useMemo(() => {
    const readings = new Map<string, number>();
    const nv = circuitPhysics.nodeVoltages;

    // ── Union-find jako v MNA: dráty se dotýkají jen na vrcholech / svorkách ──
    const nk = (hx: number, hy: number) => `${hx},${hy}`;
    const ufNet = buildElectricalConnectivityUnionFind(components, wires, switchStates, openCircuitIds);
    const ufNetFind = ufNet.find;

    const ufVm = createUnionFindMap();
    mergeJunctionAwareWiresIntoUF(wires, components, nk, ufVm);
    const ufF = ufVm.find;
    const ufU = ufVm.union;

    // Union through non-source, non-voltmeter components (they are conductors)
    for (const comp of components) {
      if (comp.type === 'voltmeter') continue;
      if (comp.type === 'switch' && !switchStates[comp.id]) continue;
      if (openCircuitIds?.has(comp.id)) continue; // broken bulb / blocked LED = open circuit
      const isSource = comp.type === 'battery' || comp.type === 'battery2' || comp.type === 'battery3';
      if (!isSource && comp.type !== 'npn') {
        const [t0, t1] = getTerminalHalfGrid(comp);
        if (comp.type === 'potentiometer') {
          // Union all three terminals (they're connected through the resistive element)
          const wt = getWiperTerminalHalfGrid(comp);
          if (wt) {
            ufU(nk(t0.hx, t0.hy), nk(wt.hx, wt.hy));
            ufU(nk(wt.hx, wt.hy), nk(t1.hx, t1.hy));
          } else {
            ufU(nk(t0.hx, t0.hy), nk(t1.hx, t1.hy));
          }
        } else {
          ufU(nk(t0.hx, t0.hy), nk(t1.hx, t1.hy));
        }
      }
    }

    // ── Build static voltage map from voltage sources (open-circuit fallback) ──
    const staticV = new Map<string, number>();
    const sources = components.filter(c =>
      c.type === 'battery' || c.type === 'battery2' || c.type === 'battery3'
    );

    if (sources.length > 0) {
      // Referenční uzel: t1 = záporný pól (viz MNA: nPlus=nA=t0, nMinus=nB=t1)
      const [, tNeg0] = getTerminalHalfGrid(sources[0]);
      const gndGroup = ufF(nk(tNeg0.hx, tNeg0.hy));
      staticV.set(gndGroup, 0);

      // Iteratively propagate — multiple passes to resolve chains of sources
      for (let pass = 0; pass < sources.length + 1; pass++) {
        for (const src of sources) {
          const [t0, t1] = getTerminalHalfGrid(src);
          const gPlus = ufF(nk(t0.hx, t0.hy)); // kladný pól
          const gMinus = ufF(nk(t1.hx, t1.hy)); // záporný pól
          const emf = getComponentVoltage(src);
          // V(t0) − V(t1) = E
          if (staticV.has(gMinus) && !staticV.has(gPlus)) {
            staticV.set(gPlus, staticV.get(gMinus)! + emf);
          } else if (staticV.has(gPlus) && !staticV.has(gMinus)) {
            staticV.set(gMinus, staticV.get(gPlus)! - emf);
          }
        }
      }
    }

    // Helper: find the union-find group for a half-grid point,
    // also checking if it lies on a wire segment (not just endpoints).
    const findGroup = (hx: number, hy: number): string | null => {
      const key = nk(hx, hy);
      if (ufVm.parent.has(key)) return ufF(key);
      for (const wire of wires) {
        if (pointOnWirePolyline(wire, hx, hy)) return ufF(wireScopedKey(wire.id, hx, hy));
      }
      return null;
    };

    const findNetworkGroup = (hx: number, hy: number): string | null => {
      const key = nk(hx, hy);
      if (ufNet.parent.has(key)) return ufNetFind(key);
      for (const wire of wires) {
        if (pointOnWirePolyline(wire, hx, hy)) return ufNetFind(wireScopedKey(wire.id, hx, hy));
      }
      return null;
    };

    // Helper: look up voltage at a half-grid point.
    // Prefers MNA nodeVoltages (closed circuit), falls back to static propagation.
    const voltageAt = (hx: number, hy: number): number | null => {
      // 1) Try MNA nodeVoltages (most accurate for closed circuits)
      if (nv && nv.size > 0) {
        const direct = nv.get(nk(hx, hy));
        if (direct !== undefined) return direct;
        // Check if point lies on a wire segment with known voltage
        for (const wire of wires) {
          for (let i = 0; i < wire.points.length - 1; i++) {
            const a = wire.points[i], b = wire.points[i + 1];
            if (a.hx === b.hx && a.hx === hx) {
              const minHy = Math.min(a.hy, b.hy), maxHy = Math.max(a.hy, b.hy);
              if (hy >= minHy && hy <= maxHy) {
                const va = nv.get(nk(a.hx, a.hy));
                if (va !== undefined) return va;
                const vb = nv.get(nk(b.hx, b.hy));
                if (vb !== undefined) return vb;
              }
            } else if (a.hy === b.hy && a.hy === hy) {
              const minHx = Math.min(a.hx, b.hx), maxHx = Math.max(a.hx, b.hx);
              if (hx >= minHx && hx <= maxHx) {
                const va = nv.get(nk(a.hx, a.hy));
                if (va !== undefined) return va;
                const vb = nv.get(nk(b.hx, b.hy));
                if (vb !== undefined) return vb;
              }
            }
          }
        }
      }

      // 2) Fallback: static voltage from source propagation (open circuit)
      const grp = findGroup(hx, hy);
      if (grp === null) return null; // not on any wire
      const sv = staticV.get(grp);
      return sv !== undefined ? sv : null;
    };

    for (const comp of components) {
      if (comp.type !== 'voltmeter') continue;
      const probes = voltmeterProbes[comp.id];
      if (!probes) { readings.set(comp.id, 0); continue; }
      const p1 = probes.probe1.pos;
      const p2 = probes.probe2.pos;
      if (!p1 || !p2) { readings.set(comp.id, 0); continue; }
      const v1 = voltageAt(p1.hx, p1.hy);
      const v2 = voltageAt(p2.hx, p2.hy);
      // If either probe is not connected to any wire, reading is 0
      if (v1 === null || v2 === null) { readings.set(comp.id, 0); continue; }
      const net1 = findNetworkGroup(p1.hx, p1.hy);
      const net2 = findNetworkGroup(p2.hx, p2.hy);
      // Izolované obvody: jedno globální uzemnění v MNA dává nesmyslné rozdíly potenciálů → 0 V
      if (net1 === null || net2 === null || net1 !== net2) { readings.set(comp.id, 0); continue; }
      readings.set(comp.id, v1 - v2);
    }
    return readings;
  }, [components, wires, voltmeterProbes, circuitPhysics.nodeVoltages, switchStates, openCircuitIds, getComponentVoltage]);

  const [mouseSvgPos, setMouseSvgPos] = useState<{ x: number; y: number } | null>(null);
  const [mouseCellPos, setMouseCellPos] = useState<{ cx: number; cy: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 600 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const dragRef = useRef<{
    compId: string;
    origComp: PlacedComponent;
    startClientX: number;
    startClientY: number;
    hasMoved: boolean;
  } | null>(null);
  const draggedLastRef = useRef(false);
  const [dragTarget, setDragTarget] = useState<{ id: string; cx: number; cy: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const freehandPathRef = useRef<SVGPolylineElement>(null);
  const isDrawingRef = useRef(false);
  const justFinishedDrawingRef = useRef(false);
  const freehandPtsRef = useRef<{ x: number; y: number }[]>([]);
  const panStartRef = useRef<{ cx: number; cy: number; px: number; py: number } | null>(null);

  // ── Touch / pinch refs ──
  const pinchRef = useRef<{
    dist: number; startZoom: number;
    startPx: number; startPy: number;
    midX: number; midY: number;
  } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // After a touch tap we fire a synthetic click immediately; suppress the delayed
  // ghost click that browsers emit ~300ms later on some older Android/iOS versions.
  const suppressNextClickRef = useRef(false);

  const vw = canvasSize.width / zoom;
  const vh = canvasSize.height / zoom;
  const vx = (canvasSize.width - vw) / 2 - panOffset.x;
  const vy = (canvasSize.height - vh) / 2 - panOffset.y;

  const startCol = Math.floor(vx / GRID_SIZE) - 1;
  const endCol   = Math.ceil((vx + vw) / GRID_SIZE) + 1;
  const startRow = Math.floor(vy / GRID_SIZE) - 1;
  const endRow   = Math.ceil((vy + vh) / GRID_SIZE) + 1;

  const collectWireConnPoints = useCallback((wireList: Wire[]): ConnPoint[] => {
    const out: ConnPoint[] = [];
    const seen = new Set<string>();
    const add = (hx: number, hy: number) => {
      const key = `${hx},${hy}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ x: hx * HALF, y: hy * HALF });
    };

    for (const wire of wireList) {
      if (wire.points.length === 0) continue;

      for (let i = 0; i < wire.points.length - 1; i++) {
        const a = wire.points[i];
        const b = wire.points[i + 1];
        add(a.hx, a.hy);

        if (a.hx === b.hx) {
          const step = a.hy < b.hy ? 1 : -1;
          for (let hy = a.hy + step; hy !== b.hy; hy += step) {
            // Jen středy „řádků“ buněk (liché hy), ne každý půlkrok sítě
            if (hy % 2 !== 0) add(a.hx, hy);
          }
          add(b.hx, b.hy);
        } else if (a.hy === b.hy) {
          const step = a.hx < b.hx ? 1 : -1;
          for (let hx = a.hx + step; hx !== b.hx; hx += step) {
            if (hx % 2 !== 0) add(hx, a.hy);
          }
          add(b.hx, b.hy);
        } else {
          // Should not happen after orthogonalization, but keep endpoints safe.
          add(b.hx, b.hy);
        }
      }
    }

    return out;
  }, []);

  const connPoints = useMemo(() => {
    const pts = components.filter(c => c.type !== 'voltmeter').flatMap(getConnPoints);
    // Include wiper terminals for potentiometers
    for (const c of components) {
      const wp = getWiperConnPoint(c);
      if (wp) pts.push(wp);
      // Include base terminals for NPN transistors
      const bp = getBaseConnPoint(c);
      if (bp) pts.push(bp);
    }
    return pts;
  }, [components]);

  // ── Snap při kreslení: svorky + body na drátech jen ve středech buněk (liché hx/hy podél úseku) + vrcholy polyline ──
  const wireSnapPoints = useMemo(() => {
    return collectWireConnPoints(wires);
  }, [wires, collectWireConnPoints]);

  /** Větší tolerance na dotyku (prst / interaktivní tabule). */
  const wireEndpointSnapDist = isTouch ? CONN_SNAP_DIST * 1.5 : CONN_SNAP_DIST;

  /** Nejblížší svorka / bod na drátu k dané pozici v SVG (pro začátek tahu bez „hover“ stavu). */
  const nearestConnAt = useCallback(
    (svgPos: { x: number; y: number } | null): ConnPoint | null => {
      if (!svgPos || tool !== 'wire') return null;
      let best: ConnPoint | null = null;
      let bestDist = wireEndpointSnapDist;
      for (const cp of connPoints) {
        const d = Math.hypot(cp.x - svgPos.x, cp.y - svgPos.y);
        if (d < bestDist) { bestDist = d; best = cp; }
      }
      for (const wp of wireSnapPoints) {
        const d = Math.hypot(wp.x - svgPos.x, wp.y - svgPos.y);
        if (d < bestDist) { bestDist = d; best = wp; }
      }
      return best;
    },
    [connPoints, wireSnapPoints, tool, wireEndpointSnapDist],
  );

  const nearestConn = useMemo(() => {
    if (!mouseSvgPos || tool !== 'wire') return null;
    return nearestConnAt(mouseSvgPos);
  }, [mouseSvgPos, tool, nearestConnAt]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) =>
      setCanvasSize({ width: Math.floor(e.contentRect.width), height: Math.floor(e.contentRect.height) }),
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const h = (e: WheelEvent) => {
      e.preventDefault();
      const d = e.deltaY > 0 ? -0.15 : 0.15;
      setZoom(Math.min(4.0, Math.max(0.5, +(zoom + d).toFixed(2))));
    };
    // Prevent browser pull-to-refresh and native pinch-zoom on touch devices
    const noNativePinch = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault(); };
    el.addEventListener('wheel', h, { passive: false });
    el.addEventListener('touchstart', noNativePinch, { passive: false });
    return () => {
      el.removeEventListener('wheel', h);
      el.removeEventListener('touchstart', noNativePinch);
    };
  }, [zoom, setZoom]);

  useEffect(() => {
    if (clearTrigger > 0) {
      // ── Save the current state BEFORE clearing so Ctrl+Z can restore it ──
      const snapshot = stateRef.current;
      const hasContent = snapshot.components.length > 0 || snapshot.wires.length > 0;
      const empty: Snapshot = { components: [], wires: [], switchStates: {}, bulbStates: {} };
      setComponents([]); setWires([]); setSwitchStates({}); setBulbStates({});
      setVoltmeterProbes({}); setBypassedResistors({});
      setPanOffset({ x: 0, y: 0 });
      if (hasContent) {
        // Keep history up to current index, append empty → user can undo back
        histRef.current = [...histRef.current.slice(0, histIdxRef.current + 1), empty];
        histIdxRef.current = histRef.current.length - 1;
        setHistUI({ canUndo: true, canRedo: false });
      } else {
        histRef.current = [empty];
        histIdxRef.current = 0;
        setHistUI({ canUndo: false, canRedo: false });
      }
    }
  }, [clearTrigger]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      // Don't steal keys while typing in inputs/textareas/contenteditable
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      if (el && (tag === 'input' || tag === 'textarea' || (el as any).isContentEditable)) return;

      if (e.key === 'Escape') setTool('select');
      if (e.key === 'v' || e.key === 'V') setTool('select');
      if (e.key === 'h' || e.key === 'H') setTool('pan');
      if (e.key === 'e' || e.key === 'E') setTool('eraser');
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCompId && !isViewOnly) {
        e.preventDefault();
        const cur = stateRef.current;
        const comp = cur.components.find(c => c.id === selectedCompId);
        if (!comp) {
          setSelectedCompId(null);
          return;
        }
        const newComponents = cur.components.filter(c => c.id !== comp.id);
        const newSwitch = { ...cur.switchStates }; delete newSwitch[comp.id];
        const newBulb = { ...cur.bulbStates }; delete newBulb[comp.id];
        setComponents(newComponents);
        setSwitchStates(newSwitch);
        setBulbStates(newBulb);
        setSelectedCompId(null);
        if (bulbNominalId === comp.id) setBulbNominalId(null);
        if (editingVoltageId === comp.id) setEditingVoltageId(null);
        if (editingResistanceId === comp.id) setEditingResistanceId(null);
        // Clean up voltage/resistance/real settings and probes
        setVoltageSettings(prev => { const next = { ...prev }; delete next[comp.id]; return next; });
        setResistanceSettings(prev => { const next = { ...prev }; delete next[comp.id]; return next; });
        setRealSources(prev => { const next = { ...prev }; delete next[comp.id]; return next; });
        setVoltmeterProbes(prev => { const next = { ...prev }; delete next[comp.id]; return next; });
        setWiperPositions(prev => { const next = { ...prev }; delete next[comp.id]; return next; });
        setAmmeterMilliMode(prev => { const next = { ...prev }; delete next[comp.id]; return next; });
        setBypassedResistors(prev => { const next = { ...prev }; delete next[comp.id]; return next; });
        pushHistory({ components: newComponents, wires: cur.wires, switchStates: newSwitch, bulbStates: newBulb });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [setTool, undo, redo, selectedCompId, isViewOnly, pushHistory, bulbNominalId, editingVoltageId, editingResistanceId]);

  const clientToSvg = useCallback((cx: number, cy: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = cx; pt.y = cy;
    const s = pt.matrixTransform(ctm.inverse());
    return { x: s.x, y: s.y };
  }, []);

  const snapCell = useCallback((cx: number, cy: number) => {
    const p = clientToSvg(cx, cy);
    if (!p) return null;
    return { cx: Math.floor(p.x / GRID_SIZE), cy: Math.floor(p.y / GRID_SIZE) };
  }, [clientToSvg]);

  const isCellOccupied = useCallback(
    (cx: number, cy: number, excludeId?: string) =>
      components.some(c => c.cx === cx && c.cy === cy && c.id !== excludeId),
    [components],
  );

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    // Click on empty canvas clears selection
    setSelectedCompId(null);
    if (isViewOnly) {
      panStartRef.current = { cx: e.clientX, cy: e.clientY, px: panOffset.x, py: panOffset.y };
      return;
    }
    if (tool === 'pan') {
      panStartRef.current = { cx: e.clientX, cy: e.clientY, px: panOffset.x, py: panOffset.y };
      return;
    }
    if (tool === 'wire') {
      const pos = clientToSvg(e.clientX, e.clientY);
      if (!pos) return;
      isDrawingRef.current = true;
      // ── Snap wire START to nearest terminal so topology always connects ──
      const snap0 = nearestConnAt(pos);
      const startPos = snap0 ? { x: snap0.x, y: snap0.y } : pos;
      freehandPtsRef.current = [startPos];
      freehandPathRef.current?.setAttribute('points', `${startPos.x},${startPos.y}`);
      freehandPathRef.current?.setAttribute('display', 'block');
    }
  }, [tool, clientToSvg, panOffset, nearestConnAt, isViewOnly]);

  const handleCompMouseDown = useCallback((comp: PlacedComponent, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (tool !== 'select') return;
    if (probeDragRef.current) return; // probe drag has priority
    e.stopPropagation();
    dragRef.current = {
      compId: comp.id,
      origComp: { ...comp },
      startClientX: e.clientX,
      startClientY: e.clientY,
      hasMoved: false,
    };
  }, [tool]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    // ── Wiper dragging ──
    if (wiperDragRef.current) {
      const svgPos = clientToSvg(e.clientX, e.clientY);
      if (svgPos) {
        const wd = wiperDragRef.current;
        const dx = svgPos.x - wd.startSvgX;
        const dy = svgPos.y - wd.startSvgY;
        // Project delta onto component axis; wiper slides along 28-unit range in schema coords
        const projected = dx * wd.axisX + dy * wd.axisY;
        const rawPos = wd.startWiperPos + projected / 28;
        const clamped = Math.max(0, Math.min(1, rawPos));
        // Store raw (unquantized) position → smooth visual feedback.
        // The 100 Ω quantisation is applied only inside circuit analysis (see below).
        setWiperPositions(prev => ({ ...prev, [wd.compId]: clamped }));
      }
      return;
    }

    // ── Probe dragging ──
    if (probeDragRef.current) {
      const svgPos = clientToSvg(e.clientX, e.clientY);
      if (svgPos) setProbeDragPos(svgPos);
      return;
    }

    if (panStartRef.current && (tool === 'pan' || isViewOnly)) {
      const dx = (e.clientX - panStartRef.current.cx) / zoom;
      const dy = (e.clientY - panStartRef.current.cy) / zoom;
      setPanOffset({ x: panStartRef.current.px + dx, y: panStartRef.current.py + dy });
      return;
    }

    if (dragRef.current && tool === 'select') {
      const dx = e.clientX - dragRef.current.startClientX;
      const dy = e.clientY - dragRef.current.startClientY;
      if (Math.hypot(dx, dy) > 4) {
        dragRef.current.hasMoved = true;
        const cell = snapCell(e.clientX, e.clientY);
        if (cell && !isCellOccupied(cell.cx, cell.cy, dragRef.current.compId)) {
          setDragTarget({ id: dragRef.current.compId, cx: cell.cx, cy: cell.cy });
        }
      }
    }

    const svgPos = clientToSvg(e.clientX, e.clientY);
    setMouseSvgPos(svgPos);
    setMouseCellPos(snapCell(e.clientX, e.clientY));

    if (isDrawingRef.current && svgPos) {
      freehandPtsRef.current.push(svgPos);
      freehandPathRef.current?.setAttribute('points',
        freehandPtsRef.current.map(p => `${p.x},${p.y}`).join(' '),
      );
    }
  }, [tool, zoom, snapCell, clientToSvg, isCellOccupied, isViewOnly]);

  const finishFreehand = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    justFinishedDrawingRef.current = true;
    requestAnimationFrame(() => { justFinishedDrawingRef.current = false; });
    freehandPathRef.current?.setAttribute('display', 'none');
    const pts = freehandPtsRef.current;
    freehandPtsRef.current = [];
    if (pts.length < 2) return;

    // ── Oba konce: svorka nebo libovolný kontaktní bod na drátu (včetně úseku mezi rohy) ──
    const allConns = stateRef.current.components.flatMap(getConnPoints);
    for (const c of stateRef.current.components) {
      const wp = getWiperConnPoint(c);
      if (wp) allConns.push(wp);
      const bp = getBaseConnPoint(c);
      if (bp) allConns.push(bp);
    }
    const allWirePoints = collectWireConnPoints(stateRef.current.wires);

    const snapEndpointRequired = (pt: { x: number; y: number }): ConnPoint | null => {
      let best: ConnPoint | null = null;
      let bestDist = wireEndpointSnapDist;
      for (const cp of allConns) {
        const d = Math.hypot(cp.x - pt.x, cp.y - pt.y);
        if (d < bestDist) { bestDist = d; best = cp; }
      }
      for (const wp of allWirePoints) {
        const d = Math.hypot(wp.x - pt.x, wp.y - pt.y);
        if (d < bestDist) { bestDist = d; best = wp; }
      }
      return best;
    };

    const startSnap = snapEndpointRequired(pts[0]);
    const endSnap = snapEndpointRequired(pts[pts.length - 1]);
    if (!startSnap || !endSnap) {
      toast.error('Oba konce drátu musí být u kontaktního bodu (svorka nebo bod na drátu).');
      return;
    }
    pts[0] = startSnap;
    pts[pts.length - 1] = endSnap;
    if (
      Math.round(startSnap.x / HALF) === Math.round(endSnap.x / HALF) &&
      Math.round(startSnap.y / HALF) === Math.round(endSnap.y / HALF)
    ) {
      toast.error('Začátek a konec jsou ve stejném bodě.');
      return;
    }

    const cur = stateRef.current;
    const snapped = pts.map((p, idx) => {
      if (idx === 0 || idx === pts.length - 1) {
        return { hx: Math.round(p.x / HALF), hy: Math.round(p.y / HALF) };
      }
      return {
        hx: toOdd(Math.round(p.x / HALF)),
        hy: toOdd(Math.round(p.y / HALF)),
      };
    });
    const clean = orthogonalizePath(simplifyPath(snapped));
    if (clean.length < 2) return;

    if (wirePolylinePassesUnderComponentTile(clean, cur.components)) {
      toast.error('Drát nesmí vést přes součástku. Objeď ji po obvodu mřížky.');
      return;
    }

    // Insert junction points into existing wires so Union-Find sees the T-connection.
    let updatedWires = cur.wires;
    const junctions = [clean[0], clean[clean.length - 1]];
    for (const jp of junctions) {
      updatedWires = updatedWires.map(wire => {
        for (let si = 0; si < wire.points.length - 1; si++) {
          const a = wire.points[si];
          const b = wire.points[si + 1];
          if ((jp.hx === a.hx && jp.hy === a.hy) || (jp.hx === b.hx && jp.hy === b.hy)) {
            break;
          }
          let onSeg = false;
          if (a.hx === b.hx && jp.hx === a.hx)
            onSeg = Math.min(a.hy, b.hy) < jp.hy && jp.hy < Math.max(a.hy, b.hy);
          else if (a.hy === b.hy && jp.hy === a.hy)
            onSeg = Math.min(a.hx, b.hx) < jp.hx && jp.hx < Math.max(a.hx, b.hx);
          if (onSeg) {
            const newPts = [...wire.points];
            newPts.splice(si + 1, 0, { hx: jp.hx, hy: jp.hy });
            return { ...wire, points: newPts };
          }
        }
        return wire;
      });
    }
    const newWires = [...updatedWires, { id: crypto.randomUUID(), points: clean }];
    setWires(newWires);
    pushHistory({ ...cur, wires: newWires });

    // Tablet: finger lift leaves the last touch position on the terminal → nearestConn
    // stays hot (red) and the next stroke auto-starts there. Clear pointer so the user
    // must pick a new start point explicitly.
    if (isTouch) {
      setMouseSvgPos(null);
      setMouseCellPos(null);
    }
  }, [pushHistory, collectWireConnPoints, isTouch, wireEndpointSnapDist]);

  const handleMouseUp = useCallback(() => {
    // ── Wiper drop ���─
    if (wiperDragRef.current) {
      wiperDragRef.current = null;
      return;
    }

    // ── Probe drop ──
    if (probeDragRef.current && probeDragPos) {
      const { voltmeterId, probeKey } = probeDragRef.current;
      // Snap to nearest component terminal or wire point
      const PROBE_SNAP_DIST = 40;
      const allConns = stateRef.current.components.flatMap(getConnPoints);
      // Include wiper terminals for potentiometers and base terminals for NPN
      for (const c of stateRef.current.components) {
        const wp = getWiperConnPoint(c);
        if (wp) allConns.push(wp);
        const bp = getBaseConnPoint(c);
        if (bp) allConns.push(bp);
      }
      const allWirePoints = collectWireConnPoints(stateRef.current.wires);
      let bestPt: { x: number; y: number } | null = null;
      let bestDist = PROBE_SNAP_DIST;
      for (const cp of allConns) {
        const d = Math.hypot(cp.x - probeDragPos.x, cp.y - probeDragPos.y);
        if (d < bestDist) { bestDist = d; bestPt = cp; }
      }
      if (!bestPt) {
        for (const wp of allWirePoints) {
          const d = Math.hypot(wp.x - probeDragPos.x, wp.y - probeDragPos.y);
          if (d < bestDist) { bestDist = d; bestPt = wp; }
        }
      }
      // If no snap target nearby, use raw half-grid snap
      const snapHx = bestPt ? Math.round(bestPt.x / HALF) : Math.round(probeDragPos.x / HALF);
      const snapHy = bestPt ? Math.round(bestPt.y / HALF) : Math.round(probeDragPos.y / HALF);
      setVoltmeterProbes(prev => ({
        ...prev,
        [voltmeterId]: {
          ...prev[voltmeterId],
          [probeKey]: { pos: { hx: snapHx, hy: snapHy } },
        },
      }));
      probeDragRef.current = null;
      setProbeDragPos(null);
      dragRef.current = null;   // clear any stale component drag
      setDragTarget(null);
      return;
    }
    if (probeDragRef.current) {
      probeDragRef.current = null;
      setProbeDragPos(null);
      dragRef.current = null;   // clear any stale component drag
      setDragTarget(null);
      return;
    }

    if (dragRef.current) {
      if (dragRef.current.hasMoved && dragTarget) {
        const orig = dragRef.current.origComp;
        const movedComp: PlacedComponent = { ...orig, cx: dragTarget.cx, cy: dragTarget.cy };
        const cur = stateRef.current;
        const newComponents = cur.components.map(c => c.id === movedComp.id ? movedComp : c);
        if (anyWirePassesUnderSomeComponent(cur.wires, newComponents)) {
          toast.error('Drát nesmí vést pod součástkou. Přesuň součástku jinam nebo uprav dráty.');
          dragRef.current = null;
          setDragTarget(null);
          return;
        }
        setComponents(newComponents);
        pushHistory({ ...cur, components: newComponents });
        draggedLastRef.current = true;
      }
      dragRef.current = null;
      setDragTarget(null);
      return;
    }
    if (panStartRef.current) { panStartRef.current = null; return; }
    finishFreehand();
  }, [dragTarget, finishFreehand, pushHistory, probeDragPos]);

  // ════════════════════════════════════��══════════
  // ── Touch handlers – tablet / mobile support ──
  // ═══════════════════════════════════════════════

  const handleSvgTouchStart = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    // Always prevent browser default (scroll, pinch-zoom) on the canvas
    e.preventDefault();
    // Two-finger pinch/zoom
    if (e.touches.length === 2) {
      const t0 = e.touches[0], t1 = e.touches[1];
      pinchRef.current = {
        dist: Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY),
        startZoom: zoom,
        startPx: panOffset.x,
        startPy: panOffset.y,
        midX: (t0.clientX + t1.clientX) / 2,
        midY: (t0.clientY + t1.clientY) / 2,
      };
      // Cancel any ongoing single-touch gesture
      isDrawingRef.current = false;
      freehandPathRef.current?.setAttribute('display', 'none');
      dragRef.current = null;
      return;
    }
    if (e.touches.length !== 1) return;
    const { clientX, clientY } = e.touches[0];

    if (tool === 'pan') {
      panStartRef.current = { cx: clientX, cy: clientY, px: panOffset.x, py: panOffset.y };
      return;
    }
    // On touch devices, allow one-finger pan in select mode when not on a component
    // (component drag is set in the component's onTouchStart)
    if (tool === 'select' && !dragRef.current) {
      panStartRef.current = { cx: clientX, cy: clientY, px: panOffset.x, py: panOffset.y };
      return;
    }
    if (tool === 'wire') {
      const pos = clientToSvg(clientX, clientY);
      if (!pos) return;
      isDrawingRef.current = true;
      const snap0 = nearestConnAt(pos);
      const startPos = snap0 ? { x: snap0.x, y: snap0.y } : pos;
      freehandPtsRef.current = [startPos];
      freehandPathRef.current?.setAttribute('points', `${startPos.x},${startPos.y}`);
      freehandPathRef.current?.setAttribute('display', 'block');
      setMouseSvgPos(pos);
      setMouseCellPos(snapCell(clientX, clientY));
    }
  }, [tool, clientToSvg, panOffset, nearestConnAt, zoom, snapCell]);

  const handleSvgTouchMove = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    e.preventDefault(); // block scroll / native zoom on older Android/Safari
    // Two-finger pinch: update zoom + pan simultaneously
    if (e.touches.length === 2 && pinchRef.current) {
      const t0 = e.touches[0], t1 = e.touches[1];
      const newDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const scale = newDist / pinchRef.current.dist;
      const newZoom = Math.min(4.0, Math.max(0.5, +(pinchRef.current.startZoom * scale).toFixed(2)));
      setZoom(newZoom);
      // Pan follows midpoint movement
      const midX = (t0.clientX + t1.clientX) / 2;
      const midY = (t0.clientY + t1.clientY) / 2;
      const dx = (midX - pinchRef.current.midX) / newZoom;
      const dy = (midY - pinchRef.current.midY) / newZoom;
      setPanOffset({ x: pinchRef.current.startPx + dx, y: pinchRef.current.startPy + dy });
      return;
    }
    if (e.touches.length !== 1) return;
    const { clientX, clientY } = e.touches[0];

    // Wiper drag
    if (wiperDragRef.current) {
      const svgPos = clientToSvg(clientX, clientY);
      if (svgPos) {
        const wd = wiperDragRef.current;
        const projected = (svgPos.x - wd.startSvgX) * wd.axisX + (svgPos.y - wd.startSvgY) * wd.axisY;
        setWiperPositions(prev => ({ ...prev, [wd.compId]: Math.max(0, Math.min(1, wd.startWiperPos + projected / 28)) }));
      }
      return;
    }

    // Probe drag
    if (probeDragRef.current) {
      const svgPos = clientToSvg(clientX, clientY);
      if (svgPos) setProbeDragPos(svgPos);
      return;
    }

    // Pan mode (pan tool OR select-without-component on touch)
    if (panStartRef.current && (tool === 'pan' || (tool === 'select' && !dragRef.current))) {
      const rawDx = clientX - panStartRef.current.cx;
      const rawDy = clientY - panStartRef.current.cy;
      // Only pan after minimum movement (avoids blocking tap clicks in select mode)
      if (Math.hypot(rawDx, rawDy) > 6) {
        const dx = rawDx / zoom;
        const dy = rawDy / zoom;
        setPanOffset({ x: panStartRef.current.px + dx, y: panStartRef.current.py + dy });
      }
      return;
    }

    // Component drag
    if (dragRef.current && tool === 'select') {
      const dx = clientX - dragRef.current.startClientX;
      const dy = clientY - dragRef.current.startClientY;
      if (Math.hypot(dx, dy) > 8) {
        // Cancel long press when movement detected
        if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
        dragRef.current.hasMoved = true;
        const cell = snapCell(clientX, clientY);
        if (cell && !isCellOccupied(cell.cx, cell.cy, dragRef.current.compId)) {
          setDragTarget({ id: dragRef.current.compId, cx: cell.cx, cy: cell.cy });
        }
      }
    }

    // Update cursor/wire preview
    const svgPos = clientToSvg(clientX, clientY);
    setMouseSvgPos(svgPos);
    setMouseCellPos(snapCell(clientX, clientY));
    if (isDrawingRef.current && svgPos) {
      freehandPtsRef.current.push(svgPos);
      freehandPathRef.current?.setAttribute('points',
        freehandPtsRef.current.map(p => `${p.x},${p.y}`).join(' '),
      );
    }
  }, [tool, zoom, snapCell, clientToSvg, isCellOccupied, setZoom, setPanOffset]);

  const isComponentTool = !['wire', 'eraser', 'select', 'pan'].includes(tool);

  const handleSvgTouchEnd = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    pinchRef.current = null;
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }

    // Reuse mouse-up logic for drag drop, probe snap, wire finish
    handleMouseUp();

    // For component / eraser / select taps: dispatch synthetic click immediately.
    // Then suppress the delayed ghost-click that some browsers fire ~300ms later.
    const touch = e.changedTouches[0];
    if (!touch) return;
    const needsSyntheticClick = isComponentTool || tool === 'eraser' || tool === 'select';
    if (needsSyntheticClick) {
      suppressNextClickRef.current = true;
      // Allow the ghost-click window (400ms) before re-enabling
      setTimeout(() => { suppressNextClickRef.current = false; }, 400);
      const svgEl = svgRef.current;
      if (svgEl) {
        const evt = new MouseEvent('click', {
          bubbles: true, cancelable: true, view: window,
          clientX: touch.clientX, clientY: touch.clientY, button: 0,
        });
        // Mark as synthetic so handlers can distinguish
        (evt as MouseEvent & { _synthetic?: boolean })._synthetic = true;
        svgEl.dispatchEvent(evt);
      }
    }
  }, [handleMouseUp, isComponentTool, tool, snapCell, stateRef]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    // Suppress ghost clicks that follow a touch-tap on older Android/iOS
    const isSynthetic = (e.nativeEvent as MouseEvent & { _synthetic?: boolean })._synthetic;
    if (suppressNextClickRef.current && !isSynthetic) return;
    if (isComponentTool) {
      const cell = snapCell(e.clientX, e.clientY);
      if (!cell) return;
      const cur = stateRef.current;
      const occupied = cur.components.some(c => c.cx === cell.cx && c.cy === cell.cy);

      if (!occupied) {
        const rotation = 0;
        const newComp: PlacedComponent = {
          id: crypto.randomUUID(), type: tool as ComponentType,
          cx: cell.cx, cy: cell.cy, rotation,
        };

        // Voltmeter: don't split wires (infinite impedance), init probes
        if (newComp.type === 'voltmeter') {
          const newComponents = [...cur.components, newComp];
          setComponents(newComponents);
          pushHistory({ ...cur, components: newComponents });
          // Initialize probes as unplaced (pos: null) – circles only appear after first drag
          setVoltmeterProbes(prev => ({
            ...prev,
            [newComp.id]: {
              probe1: { pos: null },
              probe2: { pos: null },
            },
          }));
          setTool('select');
        } else {
          // Check if a wire passes through this cell – if so, split it
          const hit = findWireThroughCell(cell.cx, cell.cy, cur.wires);
          if (hit) {
            // Determine rotation from wire orientation
            if (hit.orientation === 'v') newComp.rotation = 90;
            const [term0, term1] = getTerminalHalfGrid(newComp);
            const wire = cur.wires[hit.wireIndex];
            const splitWires = splitWireForComponent(wire, hit.segIndex, term0, term1);
            const newWires = [
              ...cur.wires.slice(0, hit.wireIndex),
              ...splitWires,
              ...cur.wires.slice(hit.wireIndex + 1),
            ];
            const newComponents = [...cur.components, newComp];
            if (anyWirePassesUnderSomeComponent(newWires, newComponents)) {
              toast.error('Drát nesmí vést přes součástku. Objeď ji po obvodu mřížky.');
              return;
            }
            setComponents(newComponents);
            setWires(newWires);
            pushHistory({ ...cur, components: newComponents, wires: newWires });
          } else {
            // Normal placement on empty cell
            const newComponents = [...cur.components, newComp];
            setComponents(newComponents);
            pushHistory({ ...cur, components: newComponents });
          }
        }
      }
    }
  }, [tool, isComponentTool, snapCell, pushHistory, setTool]);

  const handleCompClick = useCallback((comp: PlacedComponent, e: React.MouseEvent) => {
    e.stopPropagation();
    if (draggedLastRef.current) { draggedLastRef.current = false; return; }
    const cur = stateRef.current;

    if (!isViewOnly && tool === 'select' && !isComponentTool) {
      setSelectedCompId(comp.id);
    }

    // ── Replace component when a component tool is active ──
    if (isComponentTool) {
      const newType = tool as ComponentType;
      if (newType === comp.type) return; // same type, do nothing
      const replacedComp: PlacedComponent = { ...comp, type: newType };
      const newComponents = cur.components.map(c => c.id === comp.id ? replacedComp : c);
      // Clean up old state for the replaced component
      const newSwitch = { ...cur.switchStates }; delete newSwitch[comp.id];
      const newBulb = { ...cur.bulbStates }; delete newBulb[comp.id];
      setComponents(newComponents);
      setSwitchStates(newSwitch);
      setBulbStates(newBulb);
      // Clean up voltage/resistance/real settings and probes
      setVoltageSettings(prev => { const next = { ...prev }; delete next[comp.id]; return next; });
      setResistanceSettings(prev => { const next = { ...prev }; delete next[comp.id]; return next; });
      setRealSources(prev => { const next = { ...prev }; delete next[comp.id]; return next; });
      setVoltmeterProbes(prev => { const next = { ...prev }; delete next[comp.id]; return next; });
      setWiperPositions(prev => { const next = { ...prev }; delete next[comp.id]; return next; });
      setBypassedResistors(prev => { const next = { ...prev }; delete next[comp.id]; return next; });
      // If replacing with voltmeter, init probes as unplaced
      if (newType === 'voltmeter') {
        setVoltmeterProbes(prev => ({
          ...prev,
          [comp.id]: {
            probe1: { pos: null },
            probe2: { pos: null },
          },
        }));
        setTool('select');
      }
      pushHistory({ components: newComponents, wires: cur.wires, switchStates: newSwitch, bulbStates: newBulb });
      return;
    }

    if (tool === 'eraser') {
      const newComponents = cur.components.filter(c => c.id !== comp.id);
      const newSwitch = { ...cur.switchStates }; delete newSwitch[comp.id];
      const newBulb = { ...cur.bulbStates }; delete newBulb[comp.id];
      setComponents(newComponents);
      setSwitchStates(newSwitch);
      setBulbStates(newBulb);
      // Clean up voltage/resistance/real settings and probes
      setVoltageSettings(prev => { const next = { ...prev }; delete next[comp.id]; return next; });
      setResistanceSettings(prev => { const next = { ...prev }; delete next[comp.id]; return next; });
      setRealSources(prev => { const next = { ...prev }; delete next[comp.id]; return next; });
      setVoltmeterProbes(prev => { const next = { ...prev }; delete next[comp.id]; return next; });
      setWiperPositions(prev => { const next = { ...prev }; delete next[comp.id]; return next; });
      setAmmeterMilliMode(prev => { const next = { ...prev }; delete next[comp.id]; return next; });
      setBypassedResistors(prev => { const next = { ...prev }; delete next[comp.id]; return next; });
      pushHistory({ components: newComponents, wires: cur.wires, switchStates: newSwitch, bulbStates: newBulb });
    } else if (comp.type === 'switch' && tool === 'select') {
      setSwitchStates(prev => ({ ...prev, [comp.id]: !prev[comp.id] }));
    } else if ((comp.type === 'bulb' || comp.type === 'bulb2' || comp.type === 'bulb3' || isLedType(comp.type)) && tool === 'select') {
      // Click on broken bulb/LED → "replace" it (fix). For unbroken bulbs show nominal voltage label.
      setBulbStates(prev => {
        if (prev[comp.id] === 'broken') {
          const next = { ...prev };
          delete next[comp.id];
          return next;
        }
        if (comp.type === 'bulb' || comp.type === 'bulb2' || comp.type === 'bulb3') {
          setBulbNominalId(prev => (prev === comp.id ? null : comp.id));
        }
        return prev;
      });
    } else if ((comp.type === 'battery' || comp.type === 'battery2' || comp.type === 'battery3') && tool === 'select' && !isViewOnly) {
      // Open voltage editor dialog
      setEditingVoltageId(comp.id);
    } else if ((comp.type === 'resistor' || comp.type === 'resistor2' || comp.type === 'resistor3') && tool === 'select' && !isViewOnly) {
      // Open resistance editor dialog
      setEditingResistanceId(comp.id);
    } else if (comp.type === 'potentiometer' && tool === 'select' && !isViewOnly) {
      // Open resistance editor dialog
      setEditingResistanceId(comp.id);
    } else if (comp.type === 'ammeter' && tool === 'select') {
      // Toggle A / mA display mode
      setAmmeterMilliMode(prev => {
        const next = !prev[comp.id];
        toast(next ? 'Ampérmetr: zobrazení v mA' : 'Ampérmetr: zobrazení v A', { duration: 1500 });
        return { ...prev, [comp.id]: next };
      });
    }
  }, [tool, pushHistory, isViewOnly, isComponentTool, setTool]);

  // ── Right-click to rotate component by 90° (especially useful for potentiometer wiper direction) ──
  const handleCompContextMenu = useCallback((comp: PlacedComponent, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isViewOnly) return;
    const cur = stateRef.current;
    const newRotation = (comp.rotation + 90) % 360;
    const rotatedComp: PlacedComponent = { ...comp, rotation: newRotation };
    const newComponents = cur.components.map(c => c.id === comp.id ? rotatedComp : c);
    setComponents(newComponents);
    pushHistory({ ...cur, components: newComponents });
  }, [tool, pushHistory, isViewOnly]);

  const handleWireClick = useCallback((id: string, e: React.MouseEvent) => {
    // When a component tool is active, let the click bubble up to handleCanvasClick
    // which handles wire-splitting insertion
    if (isComponentTool) return;
    e.stopPropagation();
    if (tool === 'eraser') {
      const cur = stateRef.current;
      const newWires = cur.wires.filter(w => w.id !== id);
      setWires(newWires);
      pushHistory({ ...cur, wires: newWires });
    } else if (tool === 'wire') {
      if (justFinishedDrawingRef.current) return;
      const pos = clientToSvg(e.clientX, e.clientY);
      if (!pos) return;
      
      // Find the wire being clicked
      const wire = stateRef.current.wires.find(w => w.id === id);
      if (!wire) return;
      
      // Find the closest point on the wire to snap to
      const snapPt = { hx: Math.round(pos.x / HALF), hy: Math.round(pos.y / HALF) };
      
      // Check if this point already exists in the wire
      const existsInWire = wire.points.some(p => p.hx === snapPt.hx && p.hy === snapPt.hy);
      
      if (!existsInWire) {
        // Split the wire by adding this new point
        const cur = stateRef.current;
        
        // Find which segment to split
        let segmentIndex = -1;
        for (let i = 0; i < wire.points.length - 1; i++) {
          const a = wire.points[i];
          const b = wire.points[i + 1];
          
          // Check if point lies on this segment
          if (a.hx === b.hx && a.hx === snapPt.hx) {
            // Vertical segment
            const minHy = Math.min(a.hy, b.hy);
            const maxHy = Math.max(a.hy, b.hy);
            if (snapPt.hy >= minHy && snapPt.hy <= maxHy) {
              segmentIndex = i;
              break;
            }
          } else if (a.hy === b.hy && a.hy === snapPt.hy) {
            // Horizontal segment
            const minHx = Math.min(a.hx, b.hx);
            const maxHx = Math.max(a.hx, b.hx);
            if (snapPt.hx >= minHx && snapPt.hx <= maxHx) {
              segmentIndex = i;
              break;
            }
          }
        }
        
        if (segmentIndex >= 0) {
          // Insert the new point into the wire
          const newPoints = [
            ...wire.points.slice(0, segmentIndex + 1),
            snapPt,
            ...wire.points.slice(segmentIndex + 1)
          ];
          if (wirePolylinePassesUnderComponentTile(newPoints, cur.components)) {
            toast.error('Drát nesmí vést přes součástku. Objeď ji po obvodu mřížky.');
            return;
          }
          const newWires = cur.wires.map(w => w.id === id ? { ...w, points: newPoints } : w);
          setWires(newWires);
          pushHistory({ ...cur, wires: newWires });
        }
      }
      
      // Start drawing a new wire from this point
      isDrawingRef.current = true;
      const startPos = { x: snapPt.hx * HALF, y: snapPt.hy * HALF };
      freehandPtsRef.current = [startPos];
      freehandPathRef.current?.setAttribute('points', `${startPos.x},${startPos.y}`);
      freehandPathRef.current?.setAttribute('display', 'block');
    }
  }, [tool, isComponentTool, pushHistory, clientToSvg]);

  const WIRE_R = 12;
  const wirePathD = (pts: { hx: number; hy: number }[], junctionKeys?: Set<string>) => {
    if (pts.length < 2) return '';
    const coords = pts.map(p => ({ x: p.hx * HALF, y: p.hy * HALF, key: `${p.hx},${p.hy}` }));
    if (coords.length === 2) return `M${coords[0].x},${coords[0].y} L${coords[1].x},${coords[1].y}`;
    let d = `M${coords[0].x},${coords[0].y}`;
    for (let i = 1; i < coords.length - 1; i++) {
      const prev = coords[i - 1], curr = coords[i], next = coords[i + 1];
      // If another wire's endpoint lands on this intermediate point, keep corner sharp
      const isJunction = junctionKeys?.has(curr.key) ?? false;
      if (isJunction) {
        d += ` L${curr.x},${curr.y}`;
        continue;
      }
      const dx1 = prev.x - curr.x, dy1 = prev.y - curr.y;
      const dx2 = next.x - curr.x, dy2 = next.y - curr.y;
      const len1 = Math.hypot(dx1, dy1), len2 = Math.hypot(dx2, dy2);
      const r = Math.min(WIRE_R, len1 / 2, len2 / 2);
      const sx = curr.x + (dx1 / len1) * r, sy = curr.y + (dy1 / len1) * r;
      const ex = curr.x + (dx2 / len2) * r, ey = curr.y + (dy2 / len2) * r;
      d += ` L${sx},${sy} Q${curr.x},${curr.y} ${ex},${ey}`;
    }
    d += ` L${coords[coords.length - 1].x},${coords[coords.length - 1].y}`;
    return d;
  };

  const getWireState = useCallback((wire: Wire): 'energized' | 'wired' | 'none' => {
    const n = wire.points.length;
    if (n < 2) return 'none';
    const first = `${wire.points[0].hx},${wire.points[0].hy}`;
    const last  = `${wire.points[n - 1].hx},${wire.points[n - 1].hy}`;
    if (displayAnalysis.energizedNodes.has(first) && displayAnalysis.energizedNodes.has(last)) return 'energized';
    if (displayAnalysis.wiredNodes.has(first) && displayAnalysis.wiredNodes.has(last)) return 'wired';
    return 'none';
  }, [displayAnalysis]);

  const cursor =
    wiperDragRef.current ? 'ew-resize'
    : probeDragRef.current ? 'grabbing'
    : isViewOnly ? (panStartRef.current ? 'grabbing' : 'grab')
    : tool === 'pan'    ? (panStartRef.current ? 'grabbing' : 'grab')
    : tool === 'wire'   ? 'crosshair'
    : tool === 'eraser' ? 'pointer'
    : tool === 'select' ? 'default'
    : 'copy';

  const tileSize = GRID_SIZE - TILE_INSET * 2;
  const isSchemaMode = viewMode === 'schema';

  // Dot grid – realistic mode only (schema is clean)
  const gridLines: React.ReactNode[] = [];
  if (!isSchemaMode) {
    for (let gy = startRow; gy <= endRow; gy++) {
      for (let gx = startCol; gx <= endCol; gx++) {
        gridLines.push(
          <circle key={`d${gx}_${gy}`} cx={gx * GRID_SIZE} cy={gy * GRID_SIZE} r="1.6" fill="#b8c3de" fillOpacity="0.5" />
        );
      }
    }
  }

  const displayComponents = components
    .map(comp => dragTarget?.id === comp.id ? { ...comp, cx: dragTarget.cx, cy: dragTarget.cy } : comp)
    .sort((a, b) => a.cy !== b.cy ? a.cy - b.cy : a.cx - b.cx);

  // Wire visual constants
  const WIRE_STROKE_WIDTH = 3;
  const WIRE_STROKE_COLOR_ENERGIZED = '#b91c1c';
  const WIRE_STROKE_COLOR_WIRED = '#b91c1c';
  const WIRE_STROKE_COLOR_NONE = '#9ca3af';
  const ELECTRON_R = 0.98;
  const ELECTRON_COLOR = '#fbbf24';
  // Constant visual spacing between electrons (~22 px) → same density on every wire.
  // Count = max(1, round(length / spacing)); duration = length / speed → speed stays constant.
  const ELECTRON_SPACING = 22; // px between consecutive electrons

  // Expose share URL getter to App.tsx via ref
  useEffect(() => {
    if (!shareHandlerRef) return;
    shareHandlerRef.current = () => {
      const cur = stateRef.current;
      const encoded = encodeCircuit(cur.components, cur.wires, cur.switchStates, cur.voltageSettings, cur.resistanceSettings, cur.realSources, cur.wiperPositions);
      return encoded ? buildShareUrl(encoded) : '';
    };
    return () => { if (shareHandlerRef) shareHandlerRef.current = null; };
  }, [shareHandlerRef]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-visible select-none"
      style={{ touchAction: 'none', WebkitUserSelect: 'none' }}
    >
      <div className="absolute inset-0 overflow-hidden" style={{ background: '#E2E7F8' }}>
      <svg
        ref={el => {
          svgRef.current = el;
          if (svgElementRef) svgElementRef.current = el;
        }}
        width={canvasSize.width}
        height={canvasSize.height}
        viewBox={`${vx} ${vy} ${vw} ${vh}`}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (dragRef.current?.hasMoved) { dragRef.current = null; setDragTarget(null); }
          if (probeDragRef.current) { probeDragRef.current = null; setProbeDragPos(null); }
          if (wiperDragRef.current) { wiperDragRef.current = null; }
          panStartRef.current = null;
          finishFreehand();
        }}
        onTouchStart={handleSvgTouchStart}
        onTouchMove={handleSvgTouchMove}
        onTouchEnd={handleSvgTouchEnd}
        onTouchCancel={() => {
          pinchRef.current = null;
          if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
          dragRef.current = null; setDragTarget(null);
          probeDragRef.current = null; setProbeDragPos(null);
          wiperDragRef.current = null;
          panStartRef.current = null;
          isDrawingRef.current = false;
          freehandPathRef.current?.setAttribute('display', 'none');
        }}
        style={{ cursor, userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none' }}
      >
        <defs>
          <filter id="ts" x="-10%" y="-5%" width="120%" height="130%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000" floodOpacity="0.08" />
          </filter>
          {/* Short-circuit glow filter */}
          <filter id="shortGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feFlood floodColor="#ff4400" floodOpacity="0.7" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Spark radial gradient */}
          <radialGradient id="sparkGrad">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="30%" stopColor="#ffcc00" stopOpacity="0.9" />
            <stop offset="70%" stopColor="#ff6600" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#ff2200" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Grid lines – realistic mode only */}
        {gridLines}

        {/* ── Wires ── */}
        {(() => {
          // Build a set of all wire endpoint keys so rounded corners are suppressed at T-junctions
          const wireEndpointKeys = new Set<string>();
          for (const w of wires) {
            if (w.points.length >= 2) {
              const first = w.points[0], last = w.points[w.points.length - 1];
              wireEndpointKeys.add(`${first.hx},${first.hy}`);
              wireEndpointKeys.add(`${last.hx},${last.hy}`);
            }
          }
          return wires.map(w => {
          const d = wirePathD(w.points, wireEndpointKeys);
          const state = getWireState(w);
          const isEnergized = state === 'energized';
          const isWired = state === 'wired';
          const forward = wireDirections.wireMap.get(w.id) ?? true;

          const shortCircuitWire = isShortCircuit && shortCircuitPathIds.wires.has(w.id);

          const strokeColor = isSchemaMode
            ? (shortCircuitWire ? '#f97316' : isEnergized || isWired ? '#b91c1c' : '#9ca3af')
            : (shortCircuitWire ? '#f97316' : isEnergized || isWired ? WIRE_STROKE_COLOR_ENERGIZED : WIRE_STROKE_COLOR_NONE);

          const strokeWidth = isSchemaMode ? 2
            : shortCircuitWire ? 4.5
            : WIRE_STROKE_WIDTH;

          return (
            <g key={w.id} onClick={e => handleWireClick(w.id, e)}
              style={{ cursor: tool === 'eraser' ? 'pointer' : tool === 'pan' ? (panStartRef.current ? 'grabbing' : 'grab') : 'default' }}>
              {/* Invisible wider hit target */}
              <path d={d} fill="none" stroke="transparent" strokeWidth="16" />
              {/* Short-circuit: glowing orange halo behind wire */}
              {shortCircuitWire && !isSchemaMode && (
                <path d={d} fill="none" stroke="#f97316" strokeWidth={12}
                  strokeLinecap="round" strokeLinejoin="round" opacity={0.35}
                  filter="url(#shortGlow)" style={{ pointerEvents: 'none' }}>
                  {React.createElement('animate', {
                    attributeName: 'opacity', values: '0.35;0.15;0.35', dur: '0.4s',
                    repeatCount: 'indefinite',
                  })}
                </path>
              )}
              {/* Wire body */}
              <path d={d} fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round" strokeLinejoin="round">
                {shortCircuitWire && !isSchemaMode && React.createElement('animate', {
                  attributeName: 'stroke', values: '#f97316;#fb923c;#f97316', dur: '0.3s',
                  repeatCount: 'indefinite',
                })}
              </path>
              {/* Electrons – per-segment animation so each section has its own speed */}
              {showWireElectrons && !isSchemaMode && (isEnergized || isWired) && !shortCircuitWire && (() => {
                const els: React.ReactNode[] = [];
                for (let seg = 0; seg < w.points.length - 1; seg++) {
                  const segFlow = wireVertexFlow.get(`${w.id}:${seg}`) ?? 0;
                  const speed = currentToSpeed(segFlow);
                  if (speed === 0) continue;
                  const a = w.points[seg], b = w.points[seg + 1];
                  const ax = a.hx * HALF, ay = a.hy * HALF;
                  const bx = b.hx * HALF, by = b.hy * HALF;
                  const segLen = Math.hypot(bx - ax, by - ay);
                  if (segLen < 1) continue;
                  const count = Math.max(1, Math.round(segLen / ELECTRON_SPACING));
                  const dur = segLen / speed;
                  const segPath = forward
                    ? `M${ax},${ay} L${bx},${by}`
                    : `M${bx},${by} L${ax},${ay}`;
                  for (let i = 0; i < count; i++) {
                    const begin = -(dur * i) / count;
                    els.push(
                      <circle key={`e-${w.id}-${seg}-${i}`} r={ELECTRON_R} fill={ELECTRON_COLOR}
                        opacity={0.92} style={{ pointerEvents: 'none' }}>
                        <animateMotion
                          path={segPath}
                          dur={`${dur}s`}
                          begin={`${begin}s`}
                          repeatCount="indefinite"
                          calcMode="paced"
                        />
                      </circle>
                    );
                  }
                }
                return els.length > 0 ? els : null;
              })()}
            </g>
          );
        });
        })()}

        {/* ── Junction dots where 2+ wires meet ── */}
        {(() => {
          const ptData = new Map<string, { hx: number; hy: number; wireIds: string[] }>();
          for (const w of wires) {
            for (const pt of w.points) {
              const key = `${pt.hx},${pt.hy}`;
              const existing = ptData.get(key);
              if (existing) {
                existing.wireIds.push(w.id);
              } else {
                ptData.set(key, { hx: pt.hx, hy: pt.hy, wireIds: [w.id] });
              }
            }
          }
          const junctions: { hx: number; hy: number; wireIds: string[] }[] = [];
          for (const v of ptData.values()) {
            if (v.wireIds.length >= 2) junctions.push(v);
          }
          return junctions.map(j => {
            let hasEnergized = false;
            let hasWired = false;
            let hasShortCircuit = false;
            for (const wid of j.wireIds) {
              const w = wires.find(ww => ww.id === wid);
              if (!w) continue;
              const st = getWireState(w);
              if (st === 'energized') hasEnergized = true;
              if (st === 'wired') hasWired = true;
              if (isShortCircuit && shortCircuitPathIds.wires.has(wid)) hasShortCircuit = true;
            }
            const fill = isSchemaMode
              ? (hasShortCircuit ? '#f97316' : hasEnergized || hasWired ? '#b91c1c' : '#9ca3af')
              : (hasShortCircuit ? '#f97316' : hasEnergized || hasWired ? WIRE_STROKE_COLOR_ENERGIZED : WIRE_STROKE_COLOR_NONE);
            return (
              <circle
                key={`jn-${j.hx}-${j.hy}`}
                cx={j.hx * HALF}
                cy={j.hy * HALF}
                r={isSchemaMode ? 5 : 6}
                fill={fill}
                style={{ pointerEvents: 'none' }}
              />
            );
          });
        })()}

        <polyline ref={freehandPathRef} fill="none"
          stroke={isSchemaMode ? '#b91c1c' : WIRE_STROKE_COLOR_ENERGIZED}
          strokeWidth={isSchemaMode ? 2 : WIRE_STROKE_WIDTH}
          strokeLinecap="round" strokeLinejoin="round"
          opacity="0.45" display="none" style={{ pointerEvents: 'none' }} />

        {/* ── Tiles ── */}
        {displayComponents.map(comp => {
          const px = comp.cx * GRID_SIZE + HALF;
          const py = comp.cy * GRID_SIZE + HALF;
          const isOn = switchStates[comp.id] ?? false;
          const rawBulbState = bulbStates[comp.id];
          const isEnergized = displayAnalysis.energizedComponents.has(comp.id);
          const isWired = displayAnalysis.wiredComponents.has(comp.id);
          const isDragging = dragTarget?.id === comp.id;
          const compCurrent = circuitPhysics.currents.get(comp.id) ?? 0;
          const isLedBroken = isLedType(comp.type) && rawBulbState === 'broken';
          // LED svítí, když teče dostatečný proud a není přepálená
          const effectiveIsOn = isLedType(comp.type)
            ? (isEnergized && compCurrent > LED_MIN_CURRENT && !isLedBroken)
            : isOn;
          // LED jas: 0 (pod prahovou hodnotou nebo přepálená) → 1 (plný jas při LED_MAX_CURRENT)
          const ledBrightness = isLedType(comp.type)
            ? (isLedBroken || compCurrent <= LED_MIN_CURRENT ? 0 : Math.min(1.0, compCurrent / LED_MAX_CURRENT))
            : 0;

          // ── Physics-derived bulb/LED state ──
          let effectiveBulbState: BulbState;
          if (comp.type === 'bulb' || comp.type === 'bulb2' || comp.type === 'bulb3') {
            if (rawBulbState === 'broken') {
              effectiveBulbState = 'broken';
            } else if (!isEnergized || compCurrent < BULB_OFF_MAX) {
              effectiveBulbState = 'off';
            } else if (compCurrent <= BULB_DIM_MAX) {
              effectiveBulbState = 'dim';
            } else if (compCurrent <= BULB_ON_MAX) {
              effectiveBulbState = 'on';
            } else {
              effectiveBulbState = 'bright';
            }
          } else if (isLedType(comp.type)) {
            // Pro LED: stav 'broken' = přepálená, jinak 'off' (jas řeší ledBrightness)
            effectiveBulbState = isLedBroken ? 'broken' : 'off';
          } else {
            effectiveBulbState = 'off';
          }

          const isResistorType = comp.type === 'resistor' || comp.type === 'resistor2' || comp.type === 'resistor3';
          const isBypassed = isResistorType && (bypassedResistors[comp.id] ?? false);

          return (
            <g key={comp.id}
              onClick={e => handleCompClick(comp, e)}
              onDoubleClick={e => {
                if (tool !== 'select' || isViewOnly) return;
                if (comp.type === 'resistor' || comp.type === 'resistor2' || comp.type === 'resistor3') {
                  e.stopPropagation();
                  setEditingResistanceId(comp.id);
                }
              }}
              onMouseDown={e => handleCompMouseDown(comp, e)}
              onContextMenu={e => handleCompContextMenu(comp, e)}
              onTouchStart={e => {
                if (tool !== 'select') return;
                if (probeDragRef.current) return; // probe drag has priority
                e.stopPropagation();
                const t = e.touches[0];
                dragRef.current = {
                  compId: comp.id,
                  origComp: { ...comp },
                  startClientX: t.clientX,
                  startClientY: t.clientY,
                  hasMoved: false,
                };
                // Long press (650 ms) triggers rotation instead of right-click
                if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = setTimeout(() => {
                  dragRef.current = null;
                  handleCompContextMenu(comp, { preventDefault: () => {}, stopPropagation: () => {} } as unknown as React.MouseEvent);
                }, 650);
              }}
              onTouchEnd={() => {
                if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
              }}
              style={{
                cursor: tool === 'eraser' ? 'pointer'
                  : tool === 'pan' ? (panStartRef.current ? 'grabbing' : 'grab')
                  : 'default',
                opacity: isDragging ? 0.82 : 1,
              }}>
              {/* Pod grafikou: celá dlaždice bere události (pravý klik na „díře“ ve schématu jinak propadne na drát → menu prohlížeče). */}
              <rect
                x={comp.cx * GRID_SIZE + TILE_INSET}
                y={comp.cy * GRID_SIZE + TILE_INSET}
                width={tileSize}
                height={tileSize}
                rx={TILE_RADIUS}
                ry={TILE_RADIUS}
                fill="none"
                style={{ pointerEvents: 'all' }}
              />

              {!isSchemaMode && (
                <rect
                  x={comp.cx * GRID_SIZE + TILE_INSET} y={comp.cy * GRID_SIZE + TILE_INSET}
                  width={tileSize} height={tileSize} rx={TILE_RADIUS} ry={TILE_RADIUS}
                  fill="transparent"
                  stroke={(isEnergized || isWired) ? '#b91c1c' : 'transparent'}
                  strokeWidth={2}
                  style={{ pointerEvents: 'none' }} />
              )}

              <g transform={`translate(${px},${py}) rotate(${comp.rotation})`}
                style={!isSchemaMode
                  ? { filter: (isShortCircuit && shortCircuitPathIds.comps.has(comp.id))
                      ? 'saturate(1.6) brightness(0.9) hue-rotate(-10deg)'
                      : (isWired || comp.type === 'voltmeter') ? 'none' : 'grayscale(0.88) brightness(1.06)' }
                  : undefined}>
                {/* Rezistor v bypass režimu: posunut dolů, průhledný, nahoře drát */}
                <g transform={isBypassed ? 'translate(0, 14)' : undefined}
                   style={isBypassed ? { opacity: 0.32 } : undefined}>
                  {!isSchemaMode
                    ? <RealisticTile
                        type={comp.type} isOn={effectiveIsOn} bulbState={effectiveBulbState}
                        isEnergized={isEnergized && !(isShortCircuit && shortCircuitPathIds.comps.has(comp.id))}
                        electronForward={wireDirections.compMap.get(comp.id) ?? true}
                        current={compCurrent}
                        electronSpeed={currentToSpeed(compCurrent)}
                        voltage={comp.type === 'voltmeter' ? (voltmeterReadings.get(comp.id) ?? 0) : getComponentVoltage(comp)}
                        resistance={getComponentResistance(comp)}
                        wiperPosition={comp.type === 'potentiometer' ? (wiperPositions[comp.id] ?? 0.5) : undefined}
                        milliMode={comp.type === 'ammeter' ? (ammeterMilliMode[comp.id] ?? false) : undefined}
                        ledBrightness={isLedType(comp.type) ? ledBrightness : undefined}
                        rotation={comp.rotation}
                        showBulbNominal={bulbNominalId === comp.id}
                      />
                    : <ComponentSvg type={comp.type} mode="schema" isOn={effectiveIsOn} bulbState={effectiveBulbState}
                        current={editableSchemaValueLabels && comp.type === 'ammeter' ? 0 : compCurrent}
                        voltage={comp.type === 'voltmeter' ? (editableSchemaValueLabels ? 0 : (voltmeterReadings.get(comp.id) ?? 0)) : getComponentVoltage(comp)} resistance={getComponentResistance(comp)}
                        wiperPosition={comp.type === 'potentiometer' ? (wiperPositions[comp.id] ?? 0.5) : undefined}
                        milliMode={comp.type === 'ammeter' ? (ammeterMilliMode[comp.id] ?? false) : undefined}
                        ledBrightness={isLedType(comp.type) ? ledBrightness : undefined}
                        schemaColor={isShortCircuit && shortCircuitPathIds.comps.has(comp.id) ? '#f97316' : (isEnergized || isWired) ? '#b91c1c' : '#1a1a1a'} />
                  }

                  {isSchemaMode &&
                    editableSchemaValueLabels &&
                    onSchemaValueLabelChange &&
                    (isBatteryType(comp.type) || isResistorTypeForSchemaLabel(comp.type)) && (
                      <foreignObject
                        data-export-exclude="true"
                        x={-40}
                        y={isBatteryType(comp.type) ? 16 : 12}
                        width={80}
                        height={20}
                      >
                        <div
                          xmlns="http://www.w3.org/1999/xhtml"
                          className="flex h-full w-full items-center justify-center"
                          style={{ pointerEvents: 'all' }}
                          onPointerDown={e => e.stopPropagation()}
                          onMouseDown={e => e.stopPropagation()}
                          onClick={e => e.stopPropagation()}
                          onContextMenu={e => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            aria-label={isBatteryType(comp.type) ? 'Hodnota napětí (text ve schématu)' : 'Hodnota odporu (text ve schématu)'}
                            className="w-[76px] max-w-[76px] rounded border border-zinc-400 bg-white px-0.5 py-0.5 text-center text-[10px] font-semibold leading-tight text-zinc-900 shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-indigo-400"
                            style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
                            value={
                              schemaValueLabels?.[comp.id] !== undefined
                                ? schemaValueLabels[comp.id]!
                                : isBatteryType(comp.type)
                                  ? schemaDefaultVoltageLabel(getComponentVoltage(comp))
                                  : schemaDefaultResistanceLabel(getComponentResistance(comp))
                            }
                            onChange={e => onSchemaValueLabelChange(comp.id, e.target.value)}
                          />
                        </div>
                      </foreignObject>
                    )}
                </g>
                {/* Bypass drát – přes střed dlaždice */}
                {isBypassed && (
                  <line
                    x1={-HALF} y1={0} x2={HALF} y2={0}
                    stroke={isSchemaMode
                      ? (isEnergized ? '#b91c1c' : '#1a1a1a')
                      : (isEnergized && !isShortCircuit ? '#ef4444' : isWired ? '#dc2626' : '#6b7280')}
                    strokeWidth={isSchemaMode ? 2 : 4}
                    strokeLinecap="round"
                    style={{ pointerEvents: 'none' }}
                  />
                )}
              </g>

            </g>
          );
        })}

        {/* ── Voltmeter probe lines and tips ── */}
        {displayComponents.filter(c => c.type === 'voltmeter').map(comp => {
          const probes = voltmeterProbes[comp.id];
          if (!probes) return null;
          const vmCx = comp.cx * GRID_SIZE + HALF;
          const vmCy = comp.cy * GRID_SIZE + HALF;
          const isDraggingP1 = probeDragRef.current?.voltmeterId === comp.id && probeDragRef.current?.probeKey === 'probe1';
          const isDraggingP2 = probeDragRef.current?.voltmeterId === comp.id && probeDragRef.current?.probeKey === 'probe2';

          // Anchor positions: side dots on the VoltmeterTile SVG (follow component rotation).
          const vRad = (comp.rotation * Math.PI) / 180;
          const vCos = Math.round(Math.cos(vRad));
          const vSin = Math.round(Math.sin(vRad));
          // Red dot at viewBox (-8, 58) ≈ canvas offset (-27, -3); Black dot (145,58) ≈ (+27,-3)
          const anchor1x = vmCx + (-27) * vCos - (-3) * vSin;
          const anchor1y = vmCy + (-27) * vSin + (-3) * vCos;
          const anchor2x = vmCx + (+27) * vCos - (-3) * vSin;
          const anchor2y = vmCy + (+27) * vSin + (-3) * vCos;

          // Default "parked" positions: probe circles start slightly outside tile edges
          // so they don't overlap the tile dots. Offset 18px outward from anchor.
          const park1x = anchor1x + (-18) * vCos;
          const park1y = anchor1y + (-18) * vSin;
          const park2x = anchor2x + (+18) * vCos;
          const park2y = anchor2y + (+18) * vSin;

          // Actual probe tip positions
          const p1x = isDraggingP1 && probeDragPos ? probeDragPos.x : probes.probe1.pos ? probes.probe1.pos.hx * HALF : park1x;
          const p1y = isDraggingP1 && probeDragPos ? probeDragPos.y : probes.probe1.pos ? probes.probe1.pos.hy * HALF : park1y;
          const p2x = isDraggingP2 && probeDragPos ? probeDragPos.x : probes.probe2.pos ? probes.probe2.pos.hx * HALF : park2x;
          const p2y = isDraggingP2 && probeDragPos ? probeDragPos.y : probes.probe2.pos ? probes.probe2.pos.hy * HALF : park2y;

          // Show dashed line whenever probe is away from its parked position
          const p1moved = probes.probe1.pos !== null || isDraggingP1;
          const p2moved = probes.probe2.pos !== null || isDraggingP2;

          // Shared probe drag starter factory
          const startProbeDrag = (probeKey: 'probe1' | 'probe2') => ({
            onMouseDown: isViewOnly ? undefined : (e: React.MouseEvent) => {
              e.stopPropagation();
              e.preventDefault();
              dragRef.current = null;
              setDragTarget(null);
              probeDragRef.current = { voltmeterId: comp.id, probeKey };
              const svgPos = clientToSvg(e.clientX, e.clientY);
              if (svgPos) setProbeDragPos(svgPos);
            },
            onTouchStart: isViewOnly ? undefined : (e: React.TouchEvent) => {
              e.stopPropagation();
              dragRef.current = null;
              setDragTarget(null);
              probeDragRef.current = { voltmeterId: comp.id, probeKey };
              const svgPos = clientToSvg(e.touches[0].clientX, e.touches[0].clientY);
              if (svgPos) setProbeDragPos(svgPos);
            },
          });

          return (
            <g key={`probes-${comp.id}`}>
              {/* Dashed lines from anchor to probe tip (only when probe has been placed) */}
              {p1moved && (
                <line x1={anchor1x} y1={anchor1y} x2={p1x} y2={p1y}
                  stroke="#dc2626" strokeWidth="2" strokeDasharray="5 4" opacity="0.8"
                  style={{ pointerEvents: 'none' }} />
              )}
              {p2moved && (
                <line x1={anchor2x} y1={anchor2y} x2={p2x} y2={p2y}
                  stroke="#374151" strokeWidth="2" strokeDasharray="5 4" opacity="0.8"
                  style={{ pointerEvents: 'none' }} />
              )}

              {/* ── Probe 1 – red / + ── always visible, starts parked outside tile */}
              <g {...startProbeDrag('probe1')} style={{ cursor: isViewOnly ? 'default' : 'grab' }}>
                {/* Large translucent halo = easy grab target */}
                <circle cx={p1x} cy={p1y} r={20} fill="#dc2626" opacity="0.15" style={{ pointerEvents: 'all' }} />
                <circle cx={p1x} cy={p1y} r={12} fill="#dc2626" stroke="#991b1b" strokeWidth="2" />
                <text x={p1x} y={p1y + 4} textAnchor="middle" fontSize="13" fill="#fff" fontWeight="bold" style={{ pointerEvents: 'none' }}>+</text>
              </g>

              {/* ── Probe 2 – dark / − ── always visible, starts parked outside tile */}
              <g {...startProbeDrag('probe2')} style={{ cursor: isViewOnly ? 'default' : 'grab' }}>
                <circle cx={p2x} cy={p2y} r={20} fill="#1f2937" opacity="0.15" style={{ pointerEvents: 'all' }} />
                <circle cx={p2x} cy={p2y} r={12} fill="#1f2937" stroke="#111827" strokeWidth="2" />
                <text x={p2x} y={p2y + 4} textAnchor="middle" fontSize="13" fill="#fff" fontWeight="bold" style={{ pointerEvents: 'none' }}>−</text>
              </g>
            </g>
          );
        })}

        {/* ── Potentiometer wiper drag handles ── */}
        {!isViewOnly && tool === 'select' && displayComponents.filter(c => c.type === 'potentiometer').map(comp => {
          const px = comp.cx * GRID_SIZE + HALF;
          const py = comp.cy * GRID_SIZE + HALF;
          const wp = wiperPositions[comp.id] ?? 0.5;
          const rad = (comp.rotation * Math.PI) / 180;
          const cosR = Math.round(Math.cos(rad));
          const sinR = Math.round(Math.sin(rad));
          // Wiper handle position in local coords (schema: wiperX along -14..14)
          // Realistic: three dots are at SVG cy=83–103 → canvas offset ≈ +13 from tile centre
          const localX = -14 + 28 * wp;
          // Realistic: pill center at SVG y≈60, track at y=51 → offset ≈ +3 from tile centre (55)
          const localY = isSchemaMode ? 12 : 3;
          const handleX = px + localX * cosR - localY * sinR;
          const handleY = py + localX * sinR + localY * cosR;
          return (
            <g key={`wiper-${comp.id}`}>
              {/* Invisible wide drag target */}
              <circle
                cx={handleX} cy={handleY} r={16}
                fill="transparent"
                style={{ pointerEvents: 'all', cursor: 'ew-resize' }}
                onMouseDown={e => {
                  e.stopPropagation();
                  const svgPos = clientToSvg(e.clientX, e.clientY);
                  if (!svgPos) return;
                  wiperDragRef.current = {
                    compId: comp.id,
                    startWiperPos: wp,
                    axisX: cosR,
                    axisY: sinR,
                    startSvgX: svgPos.x,
                    startSvgY: svgPos.y,
                  };
                }}
                onTouchStart={e => {
                  e.stopPropagation();
                  const t = e.touches[0];
                  const svgPos = clientToSvg(t.clientX, t.clientY);
                  if (!svgPos) return;
                  wiperDragRef.current = {
                    compId: comp.id,
                    startWiperPos: wp,
                    axisX: cosR,
                    axisY: sinR,
                    startSvgX: svgPos.x,
                    startSvgY: svgPos.y,
                  };
                }}
              />
              {/* Visual handle indicator – not needed, SVG dots serve as indicator */}
            </g>
          );
        })}

        {/* ── Short-circuit sparks ── */}
        {isShortCircuit && sparkPositions.map((sp, i) => (
          <g key={`spark-${i}`} style={{ pointerEvents: 'none' }}>
            {/* Radial flash */}
            <circle cx={sp.x} cy={sp.y} r={sp.size} fill="url(#sparkGrad)" opacity={0}>
              {React.createElement('animate', {
                attributeName: 'opacity', values: '0;0.9;0', dur: '0.25s',
                begin: `${sp.delay}s`, repeatCount: 'indefinite',
              })}
              {React.createElement('animate', {
                attributeName: 'r', values: `${sp.size * 0.3};${sp.size};${sp.size * 0.5}`, dur: '0.25s',
                begin: `${sp.delay}s`, repeatCount: 'indefinite',
              })}
            </circle>
            {/* Small white-hot core */}
            <circle cx={sp.x} cy={sp.y} r={2} fill="#fff" opacity={0}>
              {React.createElement('animate', {
                attributeName: 'opacity', values: '0;1;0', dur: '0.15s',
                begin: `${sp.delay + 0.05}s`, repeatCount: 'indefinite',
              })}
            </circle>
            {/* Spark lines radiating outward */}
            {[0, 60, 120, 200, 300].map((angle, j) => {
              const rad = (angle + i * 37) * Math.PI / 180;
              const len = sp.size * 0.7;
              return (
                <line key={j}
                  x1={sp.x} y1={sp.y}
                  x2={sp.x + Math.cos(rad) * len} y2={sp.y + Math.sin(rad) * len}
                  stroke="#ffcc00" strokeWidth="1.5" strokeLinecap="round" opacity={0}>
                  {React.createElement('animate', {
                    attributeName: 'opacity', values: '0;0.8;0', dur: '0.2s',
                    begin: `${sp.delay + j * 0.04}s`, repeatCount: 'indefinite',
                  })}
                </line>
              );
            })}
          </g>
        ))}

        {mouseCellPos && isComponentTool && (
          <rect x={mouseCellPos.cx * GRID_SIZE + TILE_INSET} y={mouseCellPos.cy * GRID_SIZE + TILE_INSET}
            width={tileSize} height={tileSize} rx={TILE_RADIUS} ry={TILE_RADIUS}
            fill={isCellOccupied(mouseCellPos.cx, mouseCellPos.cy) ? '#f59e0b' : '#3b82f6'}
            opacity={isCellOccupied(mouseCellPos.cx, mouseCellPos.cy) ? 0.15 : 0.10}
            stroke={isCellOccupied(mouseCellPos.cx, mouseCellPos.cy) ? '#f59e0b' : '#3b82f6'}
            strokeWidth="1" strokeOpacity="0.4"
            style={{ pointerEvents: 'none' }} />
        )}

        {/* Wire snap targets: terminals + all points along wire segments */}
        {tool === 'wire' && wireSnapPoints.map((pt, i) => (
          <circle key={`snap-${i}`} cx={pt.x} cy={pt.y} r={3.5}
            fill="#3b82f6" opacity="0.25" style={{ pointerEvents: 'none' }} />
        ))}

        {nearestConn && (
          <circle cx={nearestConn.x} cy={nearestConn.y} r={CONN_HIGHLIGHT_R}
            fill="#dc2626" opacity="0.18" style={{ pointerEvents: 'none' }} />
        )}
      </svg>

      {/* ── Short-circuit warning overlay ── */}
      {isShortCircuit && (
        <>
          <style>{`
            @keyframes scPulse { 0%,100% { opacity: 0.3; } 50% { opacity: 0.7; } }
            @keyframes scShake {
              0%,100% { transform: rotate(0deg); }
              15% { transform: rotate(-1.5deg) translateX(-2px); }
              30% { transform: rotate(1deg) translateX(2px); }
              45% { transform: rotate(-0.5deg); }
              60% { transform: rotate(0.5deg) translateX(1px); }
            }
            @keyframes scFlash {
              0%,100% { background: rgba(220,20,0,0.95); }
              50% { background: rgba(255,80,0,0.95); }
            }
          `}</style>
          <div className="absolute inset-0 pointer-events-none z-20" style={{ background: 'radial-gradient(ellipse at center, rgba(255,50,0,0.08) 0%, rgba(255,30,0,0.18) 100%)' }}>
            {/* Pulsing red vignette */}
            <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 120px 40px rgba(255,30,0,0.25)' }}>
              <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 80px 30px rgba(255,60,0,0.3)', animation: 'scPulse 0.5s ease-in-out infinite' }} />
            </div>
            {/* Warning banner */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto">
              <div
                className="flex items-center gap-3 rounded-2xl px-6 py-3 shadow-2xl select-none"
                style={{
                  animation: 'scShake 0.4s ease-in-out infinite, scFlash 0.3s ease-in-out infinite',
                  border: '2px solid rgba(255,200,0,0.6)',
                  color: '#fff',
                }}
              >
                <span style={{ fontSize: 28 }}>⚡</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>ZKRAT!</div>
                  <div style={{ fontSize: 11, opacity: 0.85 }}>Odpoj obvod nebo přidej odpor</div>
                </div>
                <span style={{ fontSize: 28 }}>⚡</span>
              </div>
            </div>
          </div>
        </>
      )}
      </div>

      {/* Undo / Redo (+ volitelný slot vpravo). Bez overflow:auto — ten ořezává box-shadow ve svislém směru. */}
      {!isViewOnly && (
        <div className="pointer-events-auto absolute right-2 top-2 z-10 flex max-w-[min(100%,calc(100vw-16px))] flex-nowrap items-center gap-2 overflow-visible py-2 pl-2 pr-2">
          <div
            className="flex h-[50px] shrink-0 items-center rounded-full shadow-lg overflow-hidden select-none"
            style={{ background: '#ffffff' }}
          >
            <button onClick={undo} disabled={!histUI.canUndo}
              title={isTouch ? 'Zpět' : 'Zpět (Ctrl+Z)'}
              className="flex items-center justify-center transition-all"
              style={{ width: 50, height: 50, background: 'transparent', touchAction: 'manipulation',
                color: histUI.canUndo ? '#1e1b4b' : '#b0afc4', cursor: histUI.canUndo ? 'pointer' : 'default' }}>
              <Undo2 size={16} />
            </button>
            <div style={{ width: 1, height: 20, background: 'rgba(113,113,122,0.25)' }} />
            <button onClick={redo} disabled={!histUI.canRedo}
              title={isTouch ? 'Vpřed' : 'Vpřed (Ctrl+Y)'}
              className="flex items-center justify-center transition-all"
              style={{ width: 50, height: 50, background: 'transparent', touchAction: 'manipulation',
                color: histUI.canRedo ? '#1e1b4b' : '#b0afc4', cursor: histUI.canRedo ? 'pointer' : 'default' }}>
              <Redo2 size={16} />
            </button>
          </div>
          {editChromeEndSlot ? (
            <div className="flex h-[50px] shrink-0 items-center">{editChromeEndSlot}</div>
          ) : null}
        </div>
      )}

      {tool === 'wire' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm rounded-xl px-4 py-1.5 shadow-lg border border-gray-200/60 text-[12px] text-gray-400 pointer-events-none select-none">
          {isTouch
            ? 'Táhni prstem pro kreslení drátu · Klepni na kabel pro větvení'
            : 'Nakresli drát tažením · Klikni na kabel pro větvení'}
        </div>
      )}

      {tool === 'select' && components.length > 0 && !dragTarget && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm rounded-xl px-4 py-1.5 shadow-lg border border-gray-200/60 text-[12px] text-gray-400 pointer-events-none select-none">
          {isTouch
            ? 'Táhni součástku pro přesunutí · Podržet prst = otočení o 90°'
            : 'Táhni součástku pro přesunutí · Pravý klik = otočení o 90°'}
        </div>
      )}

      {tool === 'select' && components.length === 0 && wires.length === 0 && !isViewOnly && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-zinc-600 text-center pointer-events-none select-none">
          <div className="text-[40px] mb-2">⚡</div>
          <div className="text-[15px] font-medium">Vyber součástku z panelu vlevo</div>
          <div className="text-[13px] mt-1 text-zinc-500">{isTouch ? 'a klepni na mřížku' : 'a klikni na mřížku'}</div>
        </div>
      )}

      {/* Voltage Editor – draggable floating panel */}
      {editingVoltageId && (() => {
        const comp = components.find(c => c.id === editingVoltageId);
        if (!comp) return null;

        const currentVoltage = voltageSettings[comp.id] ?? getComponentVoltage(comp);
        const isRealSource = realSources[comp.id] ?? false;
        const minV = 1.0;
        const maxV = comp.type === 'battery2' || comp.type === 'battery3' ? 30.0 : 24.0;
        const step = 0.5;

        const handleVoltageChange = (newVoltage: number) => {
          const clamped = Math.max(minV, Math.min(maxV, newVoltage));
          setVoltageSettings(prev => ({ ...prev, [comp.id]: clamped }));
        };

        const handleToggleRealSource = () => {
          setRealSources(prev => ({ ...prev, [comp.id]: !isRealSource }));
        };

        const closePanel = () => setEditingVoltageId(null);

        return (
          <DraggablePanel title="Nastavení napětí" onClose={closePanel} accentColor="#4f46e5">
            {/* Voltage Display */}
            <div className="text-center mb-5">
              <div className="text-[52px] font-bold leading-none" style={{ color: '#4f46e5' }}>
                {currentVoltage.toFixed(1).replace('.', ',')}
              </div>
              <div className="text-[13px] text-gray-400 mt-1">voltů (V)</div>
            </div>

            {/* Range Slider */}
            <div className="mb-5">
              <input
                type="range"
                min={minV}
                max={maxV}
                step={step}
                value={currentVoltage}
                onChange={(e) => handleVoltageChange(parseFloat(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #4f46e5 0%, #4f46e5 ${((currentVoltage - minV) / (maxV - minV)) * 100}%, #e5e7eb ${((currentVoltage - minV) / (maxV - minV)) * 100}%, #e5e7eb 100%)`
                }}
              />
              <div className="flex justify-between text-[11px] text-gray-400 mt-1 px-0.5">
                <span>{minV} V</span>
                <span>{maxV} V</span>
              </div>
            </div>

            {/* Quick Adjustment Buttons */}
            <div className="flex items-center justify-center gap-3 mb-5">
              <button
                onClick={() => handleVoltageChange(currentVoltage - step)}
                disabled={currentVoltage <= minV}
                className="w-11 h-11 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-30 text-gray-700 font-bold text-[22px] transition-colors flex items-center justify-center"
              >
                −
              </button>
              <div className="text-[12px] text-gray-400 font-medium min-w-[60px] text-center">
                krok {step} V
              </div>
              <button
                onClick={() => handleVoltageChange(currentVoltage + step)}
                disabled={currentVoltage >= maxV}
                className="w-11 h-11 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-30 text-gray-700 font-bold text-[22px] transition-colors flex items-center justify-center"
              >
                +
              </button>
            </div>

            {/* Real / Ideal toggle */}
            <div className="mb-5 p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-gray-800">
                    {isRealSource ? 'Reálný zdroj' : 'Ideální zdroj'}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5 truncate">
                    {isRealSource
                      ? `Vnitřní odpor: ${getSourceInternalResistance(comp).toFixed(1).replace('.', ',')} Ω`
                      : 'Vnitřní odpor: 0 Ω'}
                  </div>
                </div>
                <button
                  onClick={handleToggleRealSource}
                  className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none"
                  style={{ backgroundColor: isRealSource ? '#4f46e5' : '#d1d5db' }}
                >
                  <span
                    className="inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
                    style={{ transform: isRealSource ? 'translateX(26px)' : 'translateX(3px)' }}
                  />
                </button>
              </div>
            </div>

            {/* Done button */}
            <button
              onClick={closePanel}
              className="w-full py-2.5 rounded-xl font-medium text-[13px] text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: '#4f46e5' }}
            >
              Hotovo
            </button>
          </DraggablePanel>
        );
      })()}

      {/* Resistance Editor – draggable floating panel */}
      {editingResistanceId && (() => {
        const comp = components.find(c => c.id === editingResistanceId);
        if (!comp) return null;

        const currentResistance = resistanceSettings[comp.id] ?? getComponentResistance(comp);
        const wiper = comp.type === 'potentiometer' ? (wiperPositions[comp.id] ?? 0.5) : 0.5;
        const wiperLeftR = comp.type === 'potentiometer' ? currentResistance * wiper : 0;
        const wiperRightR = comp.type === 'potentiometer' ? currentResistance * (1 - wiper) : 0;

        // Determine range and step based on resistor type
        let minR: number, maxR: number, step: number;
        if (comp.type === 'resistor') {
          minR = 1; maxR = 100; step = 1;
        } else if (comp.type === 'resistor2') {
          minR = 100; maxR = 1000; step = 10;
        } else if (comp.type === 'potentiometer') {
          minR = 0; maxR = 10000; step = 100;
        } else { // resistor3
          minR = 1000; maxR = 10000; step = 100;
        }

        const handleResistanceChange = (newResistance: number) => {
          const clamped = Math.max(minR, Math.min(maxR, newResistance));
          setResistanceSettings(prev => ({ ...prev, [comp.id]: clamped }));
        };

        const closePanel = () => setEditingResistanceId(null);

        const formatResistance = (r: number): string => {
          if (r >= 1000) {
            const kOhms = r / 1000;
            return kOhms.toFixed(kOhms % 1 === 0 ? 0 : 1).replace('.', ',');
          }
          return r.toFixed(r % 1 === 0 ? 0 : 1).replace('.', ',');
        };

        const getDisplayUnit = (r: number): string => r >= 1000 ? 'kΩ' : 'Ω';

        return (
          <DraggablePanel title="Nastavení odporu" onClose={closePanel} accentColor="#d97706">
            {/* Resistance Display */}
            <div className="text-center mb-5">
              <div className="text-[52px] font-bold leading-none" style={{ color: '#d97706' }}>
                {formatResistance(currentResistance)}
              </div>
              <div className="text-[13px] text-gray-400 mt-1">{getDisplayUnit(currentResistance)}</div>
            </div>

            {/* Potentiometer wiper current resistance */}
            {comp.type === 'potentiometer' && (
              <div className="mb-5 rounded-xl bg-gray-50 px-4 py-3 text-[12px] text-gray-600">
                <div className="font-medium text-gray-500 mb-1">Jezdec (aktuálně)</div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-gray-500">levá → jezdec</span>
                  <span className="font-semibold text-gray-800">
                    {formatResistance(wiperLeftR)} {getDisplayUnit(wiperLeftR)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-gray-500">jezdec → pravá</span>
                  <span className="font-semibold text-gray-800">
                    {formatResistance(wiperRightR)} {getDisplayUnit(wiperRightR)}
                  </span>
                </div>
              </div>
            )}

            {/* Range Slider */}
            <div className="mb-5">
              <input
                type="range"
                min={minR}
                max={maxR}
                step={step}
                value={currentResistance}
                onChange={(e) => handleResistanceChange(parseFloat(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #d97706 0%, #d97706 ${((currentResistance - minR) / (maxR - minR)) * 100}%, #e5e7eb ${((currentResistance - minR) / (maxR - minR)) * 100}%, #e5e7eb 100%)`
                }}
              />
              <div className="flex justify-between text-[11px] text-gray-400 mt-1 px-0.5">
                <span>{formatResistance(minR)} {getDisplayUnit(minR)}</span>
                <span>{formatResistance(maxR)} {getDisplayUnit(maxR)}</span>
              </div>
            </div>

            {/* Quick Adjustment Buttons */}
            <div className="flex items-center justify-center gap-3 mb-5">
              <button
                onClick={() => handleResistanceChange(currentResistance - step)}
                disabled={currentResistance <= minR}
                className="w-11 h-11 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-30 text-gray-700 font-bold text-[22px] transition-colors flex items-center justify-center"
              >
                −
              </button>
              <div className="text-[12px] text-gray-400 font-medium min-w-[70px] text-center">
                krok {step >= 1000 ? `${step / 1000} kΩ` : `${step} Ω`}
              </div>
              <button
                onClick={() => handleResistanceChange(currentResistance + step)}
                disabled={currentResistance >= maxR}
                className="w-11 h-11 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-30 text-gray-700 font-bold text-[22px] transition-colors flex items-center justify-center"
              >
                +
              </button>
            </div>

            {/* Done button */}
            <button
              onClick={closePanel}
              className="w-full py-2.5 rounded-xl font-medium text-[13px] text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: '#d97706' }}
            >
              Hotovo
            </button>
          </DraggablePanel>
        );
      })()}
    </div>
  );
}