import React from 'react';

// battery  = 4.5 V  – logo.svg
// battery2 = 9 V    – icon-2.svg
// battery3 = 12 V   – icon-3.svg
// bulb     = slabá  4,5 V  – šedá základna
// bulb2    = střední 9 V   – modrá základna
// bulb3    = silná  12 V   – červená základna
export type ComponentType = 'battery' | 'battery2' | 'battery3' | 'bulb' | 'bulb2' | 'bulb3' | 'resistor' | 'resistor2' | 'resistor3' | 'switch' | 'ammeter' | 'voltmeter' | 'potentiometer' | 'led' | 'led2' | 'led3' | 'npn';
export type ViewMode = 'schema' | 'realistic';
// Stav žárovky: off → dim → on → bright → broken (cykluje kliknutím)
export type BulbState = 'off' | 'dim' | 'on' | 'bright' | 'broken';
export const BULB_CYCLE: BulbState[] = ['off', 'dim', 'on', 'bright', 'broken'];

// ── Electron animation constants (used inside component SVGs) ──
// viewBox is always 170×170 units mapped to 60px tile → scale = 60/170
// To appear as ~0.98px on screen: r_vb = 0.98 × (170/60) ≈ 2.8
const ELEC_R       = 2.8;
const ELEC_CLR     = '#fbbf24';
const ELEC_SPACING = 22; // px between electrons – same constant as external wires
const ELEC_SPEED   = 60; // px/s – same constant as external wires

/** Format voltage with Czech decimal comma (e.g. "4,5" instead of "4.5") */
const formatVoltage = (v: number): string => {
  const formatted = v % 1 === 0 ? v.toString() : v.toFixed(1);
  return formatted.replace('.', ',');
};

/** Výchozí štítek zdroje ve schématu (např. „4,5 V“) – editor kreslení / export. */
export function schemaDefaultVoltageLabel(v: number): string {
  return `${formatVoltage(v)} V`;
}

/** Výchozí štítek rezistoru ve schématu (např. „100 Ω“ / „1,5 kΩ“). */
export function schemaDefaultResistanceLabel(r: number): string {
  if (r >= 1000) {
    const kOhms = r / 1000;
    return `${kOhms.toFixed(kOhms % 1 === 0 ? 0 : 1).replace('.', ',')} kΩ`;
  }
  return `${r} Ω`;
}

/**
 * Approximate pixel lengths of each component's wire-stub paths.
 * Computed as chord-length × (60/170) scale factor.
 * All stubs are ≤ 35 px → each path always gets exactly 1 electron,
 * which matches the density of a ~50 px external wire segment.
 */
const COMP_PATH_LENGTHS: Partial<Record<ComponentType, { left: number; right: number }>> = {
  bulb:     { left: 20.1, right: 21.5 },
  bulb2:    { left: 20.1, right: 21.5 },
  bulb3:    { left: 20.1, right: 21.5 },
  battery:  { left: 32,   right: 38   },
  battery2: { left: 28,   right: 23   },
  battery3: { left: 26,   right: 25   },
  resistor: { left: 13.7, right: 12.4 },
  resistor2:{ left: 13.7, right: 12.4 },
  resistor3:{ left: 13.7, right: 12.4 },
  potentiometer: { left: 13.7, right: 12.4 },
  led:      { left: 20.6, right: 20.6 },
  led2:     { left: 20.6, right: 20.6 },
  led3:     { left: 20.6, right: 20.6 },
  npn:      { left: 13.7, right: 12.4 },
  switch:   { left: 12.7, right:  7.5 },
  ammeter:  { left: 13.6, right: 22.5 },
  voltmeter:{ left: 13.6, right: 22.5 },
};

/**
 * Red-wire (přívod) paths per component, in viewBox coordinates.
 * leftPath  – from outer terminal-0 (left) toward inner connection
 * rightPath – from inner connection toward outer terminal-1 (right)
 * keyPoints "0;1" = forward (t0→t1),  "1;0" = reverse
 */
const COMP_WIRE_PATHS: Partial<Record<ComponentType, { left: string; right: string }>> = {
  bulb: {
    left:  'M -15.9959,84.1296 L 41.0041,84.1296',
    right: 'M 92.0041,84.1296 L 153.0041,84.1296',
  },
  bulb2: {
    left:  'M -15.9959,84.1296 L 41.0041,84.1296',
    right: 'M 92.0041,84.1296 L 153.0041,84.1296',
  },
  bulb3: {
    left:  'M -15.9959,84.1296 L 41.0041,84.1296',
    right: 'M 92.0041,84.1296 L 153.0041,84.1296',
  },
  battery: {
    left:  'M -48.643,50.5701 C -48.643,50.5701 -15.643,31.9644 .357,-24.0356',
    right: 'M 69.357,-51.0356 C 97.357,-37.0356 87.357,50.5701 120.357,50.5701',
  },
  battery2: {
    left:  'M -23.4959,51.346 C -23.4959,51.346 11.0041,37.2404 44.5041,3.7404',
    right: 'M 107.5041,-13.2597 C 127.5041,-13.654 126.5041,51.346 145.5041,51.346',
  },
  battery3: {
    left:  'M -20,52 C -20,52 15,38 48,5',
    right: 'M 110,-12 C 130,-12 128,52 148,52',
  },
  resistor: {
    left:  'M -15.9959,51.1703 L 22.7996,51.1703',
    right: 'M 118.0041,51.1703 L 153.0041,51.1703',
  },
  resistor2: {
    left:  'M -15.9959,51.1703 L 22.7996,51.1703',
    right: 'M 118.0041,51.1703 L 153.0041,51.1703',
  },
  resistor3: {
    left:  'M -15.9959,51.1703 L 22.7996,51.1703',
    right: 'M 118.0041,51.1703 L 153.0041,51.1703',
  },
  potentiometer: {
    left:  'M -15.9959,51.1703 L 22.7996,51.1703',
    right: 'M 118.0041,51.1703 L 153.0041,51.1703',
  },
  led: {
    left:  'M -15.9959,51.1703 L 42.5,51.1703',
    right: 'M 94.5,51.1703 L 153.0041,51.1703',
  },
  led2: {
    left:  'M -15.9959,51.1703 L 42.5,51.1703',
    right: 'M 94.5,51.1703 L 153.0041,51.1703',
  },
  led3: {
    left:  'M -15.9959,51.1703 L 42.5,51.1703',
    right: 'M 94.5,51.1703 L 153.0041,51.1703',
  },
  npn: {
    left:  'M -15.9959,51.1703 L 22.7996,51.1703',
    right: 'M 118.0041,51.1703 L 153.0041,51.1703',
  },
  switch: {
    left:  'M -114.3074,-10.0235 C -102.3074,-10.0235 -108.3074,15.3708 -80.3074,1.3708',
    right: 'M 42.343,-25.5627 C 52.343,-26.5627 46.0337,-8.7459 55.0278,-8.4209',
  },
  ammeter: {
    left:  'M -15.9959,62.7972 L 18.0041,44.7972',
    right: 'M 92.0041,44.7972 L 153.0041,62.7972',
  },
  voltmeter: {
    left:  'M -15.9959,62.7972 L 18.0041,44.7972',
    right: 'M 92.0041,44.7972 L 153.0041,62.7972',
  },
};

/** Renders staggered electrons along a single SVG path (viewBox coords).
 *  count and duration are derived from pathLengthPx using the same
 *  ELEC_SPACING / ELEC_SPEED constants as external wires → uniform density & speed. */
function ElectronsOnPath({
  path, forward, pathLengthPx, speed,
}: { path: string; forward: boolean; pathLengthPx: number; speed?: number }) {
  const count = Math.max(1, Math.round(pathLengthPx / ELEC_SPACING));
  const durS  = Math.max(0.05, pathLengthPx / (speed ?? ELEC_SPEED));
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <circle key={i} r={ELEC_R} fill={ELEC_CLR} style={{ pointerEvents: 'none' }}>
          {React.createElement('animateMotion', {
            dur: `${durS}s`,
            repeatCount: 'indefinite',
            begin: `${-(i / count) * durS}s`,
            keyPoints: forward ? '0;1' : '1;0',
            keyTimes: '0;1',
            calcMode: 'linear',
            path,
          })}
        </circle>
      ))}
    </>
  );
}

interface Props {
  type: ComponentType;
  mode: ViewMode;
  isOn?: boolean;
  bulbState?: BulbState;
  size?: number;
  current?: number;
  voltage?: number; // Custom voltage for voltage sources
  resistance?: number; // Custom resistance for resistors
  schemaColor?: string; // Wire-state color for schema mode (red/blue/black)
  wiperPosition?: number; // 0..1 – potentiometer wiper position (0=left, 1=right)
  milliMode?: boolean; // ammeter: display current in mA instead of A
  ledBrightness?: number; // 0..1 – jas LED proporcionální proudu (0=off, 1=plný jas)
}

export function ComponentSvg({ type, mode, isOn = false, bulbState, size = 1, current = 0, voltage, resistance, schemaColor = '#1a1a1a', wiperPosition, milliMode, ledBrightness }: Props) {
  const isBulbType = type === 'bulb' || type === 'bulb2' || type === 'bulb3';
  const schemaOn = isBulbType
    ? (bulbState === 'dim' || bulbState === 'on' || bulbState === 'bright')
    : isOn;
  return (
    <g transform={`scale(${size})`}>
      {mode === 'schema'
        ? <SchemaSymbol type={type} isOn={schemaOn} bulbState={bulbState} current={current} voltage={voltage} resistance={resistance} color={schemaColor} wiperPosition={wiperPosition} milliMode={milliMode} ledBrightness={ledBrightness} />
        : <RealisticSymbol type={type} isOn={schemaOn} />
      }
    </g>
  );
}

/*
 * RealisticTile – celá dlaždice (karta + součástka) v realistickém režimu.
 * Každá součástka má svůj viewBox odvozený z pozice spojovacích vývodů v SVG.
 *
 * Výpočet viewBox: karta je vždy 170×170 px v souřadnicích SVG.
 * Vývody mají souřadnici y = středu karty, aby se přesně kryla s y=0 dlaždice.
 *   Rezistor: vývody y=51.17 → karta y od -30 do +140  → viewBox "-17 -30 170 170"
 *   Žárovka:  vývody y=84.13 → karta y od   3 do +173  → viewBox "-17  3  170 170"
 */
// Centre of each tile's viewBox (cx = vbX + vbW/2, cy = vbY + vbH/2).
// Used to counter-rotate the ledge so it always points downward.
const LEDGE_CENTERS: Record<ComponentType, [number, number]> = {
  resistor:     [68, 55], resistor2:    [68, 55], resistor3:    [68, 55],
  potentiometer:[68, 55],
  led:          [68, 55], led2:         [68, 55], led3:         [68, 55],
  npn:          [68, 55],
  bulb:         [68, 88], bulb2:        [68, 88], bulb3:        [68, 88],
  battery:      [36, 54], battery2:     [61, 55], battery3:     [65, 56],
  switch:       [-30, -9],
  ammeter:      [68, 67], voltmeter:    [68, 67],
};

const TILE_VIEWBOXES: Record<ComponentType, string> = {
  resistor:  '-17 -30 170 170',
  resistor2: '-17 -30 170 170',
  resistor3: '-17 -30 170 170',
  potentiometer: '-17 -30 170 170',
  led:       '-17 -30 170 170',
  led2:      '-17 -30 170 170',
  led3:      '-17 -30 170 170',
  npn:       '-17 -30 170 170',
  bulb:     '-17 3 170 170',
  bulb2:    '-17 3 170 170',
  bulb3:    '-17 3 170 170',
  battery:  '-49 -31 170 170',   // 4.5 V – karta x od -49, vývody y≈50.6
  battery2: '-24 -30 170 170',   // 9 V – karta x od -24, vývody y≈51.3
  battery3: '-20 -29 170 170',   // 12 V – karta x od -20, vývody y≈52
  switch:   '-115 -94 170 170', // vývody x�����114/+55, y≈−9
  ammeter:  '-17 -18 170 170',
  voltmeter:'-17 -18 170 170',
};

export function RealisticTile({
  type, isOn = false, bulbState,
  isEnergized = false, electronForward = true,
  current = 0, electronSpeed = 60, voltage, resistance, wiperPosition, milliMode, ledBrightness,
  showBulbNominal = false,
  rotation = 0,
}: {
  type: ComponentType; isOn?: boolean; bulbState?: BulbState;
  isEnergized?: boolean; electronForward?: boolean;
  current?: number; electronSpeed?: number; voltage?: number; resistance?: number; wiperPosition?: number; milliMode?: boolean; ledBrightness?: number;
  showBulbNominal?: boolean;
  rotation?: number;
}) {
  // Ampérmetr má vlastní komponent kvůli clipPath (potřebuje unikátní ID)
  if (type === 'ammeter') return <AmmeterTile isEnergized={isEnergized} electronForward={electronForward} current={current} electronSpeed={electronSpeed} milliMode={milliMode} rotation={rotation} />;
  if (type === 'voltmeter') return <VoltmeterTile voltage={voltage} rotation={rotation} />;

  const wirePaths = COMP_WIRE_PATHS[type];
  const pathLens  = COMP_PATH_LENGTHS[type];
  return (
    <svg
      x={-30} y={-30}
      width={60} height={60}
      viewBox={TILE_VIEWBOXES[type]}
      style={{ overflow: 'visible' }}
    >
      <RealisticContent type={type} isOn={isOn} bulbState={bulbState} voltage={voltage} resistance={resistance} wiperPosition={wiperPosition} ledBrightness={ledBrightness} rotation={rotation} showBulbNominal={showBulbNominal} />
      {/* Electrons in components – disabled */}
    </svg>
  );
}

/* ══ AMPÉRMETR – samostatný komponent kvůli unikátním clipPath ID ══ */
function AmmeterTile({ isEnergized = false, electronForward = true, current = 0, electronSpeed = 60, milliMode = false, rotation = 0 }: { isEnergized?: boolean; electronForward?: boolean; current?: number; electronSpeed?: number; milliMode?: boolean; rotation?: number }) {
  const uid = React.useId().replace(/:/g, '');
  const cp1 = `cp1_${uid}`;
  const cp2 = `cp2_${uid}`;
  return (
    <svg x={-30} y={-30} width={60} height={60} viewBox="-17 -18 170 170" style={{ overflow: 'visible' }}>
      <defs>
        <clipPath id={cp1}>
          <path d="M86.2604,60.7347c-11.1616,3.8433-20.1921,18.6306-20.1593,33.0086.0329,14.3963,9.1166,22.9455,20.2782,19.1022,11.1616-3.8433,20.1921-18.6297,20.1592-33.026-.0328-14.3781-9.1166-22.9281-20.2782-19.0849"/>
        </clipPath>
        <clipPath id={cp2}>
          <polygon points="88.793 34.3795 88.7904 21.0443 78.512 24.3353 78.5145 37.6705"/>
        </clipPath>
      </defs>

      {/* Modrý ledge (stín) – counter-rotated so it always points down */}
      <g transform={rotation ? `rotate(${-rotation}, 68, 67)` : undefined}>
        <path fill="#59a2ff" d="M-1.2212-3.3086h139.4502c8.4304,0,15.2749,6.8445,15.2749,15.2749v139.4507c0,8.4302-6.8442,15.2744-15.2744,15.2744H-1.2217c-8.4302,0-15.2744-6.8442-15.2744-15.2744V11.9663C-16.4961,3.5359-9.6516-3.3086-1.2212-3.3086Z"/>
        <path fill="#216de8" d="M138.2294-1.8084c7.5954,0,13.7747,6.1793,13.7747,13.7747v139.4505c0,7.5954-6.1793,13.7747-13.7747,13.7747H-1.2212c-7.5954,0-13.7747-6.1793-13.7747-13.7747V11.9663C-14.9959,4.3709-8.8166-1.8084-1.2212-1.8084h139.4506M138.2294-4.8084H-1.2212c-9.2644,0-16.7747,7.5103-16.7747,16.7747v139.4505c0,9.2644,7.5103,16.7747,16.7747,16.7747h139.4506c9.2644,0,16.7747-7.5103,16.7747-16.7747V11.9663c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"/>
      </g>

      {/* Bílá karta */}
      <path fill="#fff" d="M-1.2212-18.3086h139.4502c8.4304,0,15.2749,6.8445,15.2749,15.2749v139.4507c0,8.4302-6.8442,15.2744-15.2744,15.2744H-1.2217c-8.4302,0-15.2744-6.8442-15.2744-15.2744V-3.0337c0-8.4304,6.8445-15.2749,15.2749-15.2749Z"/>
      <path fill="#216de8" d="M138.2294-16.8084c7.5954,0,13.7747,6.1793,13.7747,13.7747v139.4505c0,7.5954-6.1793,13.7747-13.7747,13.7747H-1.2212c-7.5954,0-13.7747-6.1793-13.7747-13.7747V-3.0337c0-7.5954,6.1793-13.7747,13.7747-13.7747h139.4506M138.2294-19.8084H-1.2212c-9.2644,0-16.7747,7.5103-16.7747,16.7747v139.4505c0,9.2644,7.5103,16.7747,16.7747,16.7747h139.4506c9.2644,0,16.7747-7.5103,16.7747-16.7747V-3.0337c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"/>

      {/* Přívody – šikmé od vnějšího terminálu k posunutému tělu */}
      <line fill="none" stroke="#ad0404" strokeLinecap="round" strokeLinejoin="round" strokeWidth="8" x1="153.0041" y1="62.7972" x2="92.0041" y2="44.7972"/>
      <line fill="none" stroke="#ad0404" strokeLinecap="round" strokeLinejoin="round" strokeWidth="8" x1="18.0041" y1="44.7972" x2="-15.9959" y2="62.7972"/>

      {/* ── Tělo ampérmetru posunuto o -18 nahoru ── */}
      <g transform="translate(0,-18)">
        {/* Šedý stín základny (st12) */}
        <path fill="#ccc" d="M-3.6624,129.1403l35.4176,13.1176c8.6023,3.186,18.0528,3.2347,26.6875.1375l78.4715-28.1474c4.6291-1.6604,4.4671-8.262-.2378-9.6935l-49.3135-15.0036L-3.4876,119.5004c-4.589,1.5128-4.7059,7.9617-.1748,9.6398Z"/>

        {/* Tělo přístroje (st20 + st18) */}
        <path fill="#216de8" d="M27.1771-23.1804l56.5247-18.7386c3.3107-1.1434,6.6663-.9695,9.6092.1581l.0067-.0145,25.2338,8.7064-28.5241,61.9755-36.072,78.3776-12.3437,26.8203-25.4537-8.7827.0121-.0248c-5.4605-1.8438-9.6268-6.9589-9.6268-13.3526V5.7752c0-13.0648,8.2853-24.6917,20.6339-28.9555Z"/>
        <path fill="#59a2ff" d="M51.0372,134.1776l56.5247-18.7386c12.3488-4.2643,20.6343-15.8911,20.6343-28.9555V-19.6861c0-9.686-9.5432-16.4867-18.6987-13.3251L52.9728-14.2726c-12.3488,4.2643-20.6343,15.8911-20.6343,28.9555v106.1696c0,9.686,9.5432,16.4867,18.6987,13.3251Z"/>

        {/* Světlá plocha displeje (st10) */}
        <path fill="#f6f6f6" d="M105.151,45.3667c6.3027-2.2104,10.5308-8.1702,10.5308-14.8546V-8.1896c0-5.1179-5.0096-8.7348-9.8675-7.1244L60.1363-.1714c-6.3027,2.2104-10.5308,8.1702-10.5308,14.8546v38.7017c0,5.1179,5.0096,8.7348,9.8675,7.1244l45.6781-15.1426Z"/>

        {/* Ciferník – vnější (st8) */}
        <path fill="#3c3c3b" d="M86.2604,60.7347c-11.1616,3.8433-20.1921,18.6306-20.1593,33.0086.0329,14.3963,9.1166,22.9455,20.2782,19.1022,11.1616-3.8433,20.1921-18.6297,20.1592-33.026-.0328-14.3781-9.1166-22.9281-20.2782-19.0849"/>

        {/* Ciferník vnitřek s clipPath */}
        <g clipPath={`url(#${cp1})`}>
          <path fill="#575756" d="M80.7902,58.5237c-11.1616,3.8433-20.1921,18.6306-20.1593,33.0086.0329,14.3963,9.1166,22.9455,20.2782,19.1022,11.1616-3.8433,20.1921-18.6297,20.1592-33.026-.0328-14.3781-9.1166-22.9281-20.2782-19.0849"/>
          {/* ═══ Přepínátko – dlouhá čára v oválu (otáčí se pouze když teče proud) ═══ */}
          <g>
            {isEnergized && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 84.586 84.967"
                to="360 84.586 84.967"
                dur={`${Math.max(0.5, 4 / Math.max(0.1, current))}s`}
                repeatCount="indefinite"
              />
            )}
            <line fill="#fd0" stroke="#2b2b2b" strokeWidth="11.9618" strokeLinecap="round" strokeLinejoin="round" x1="84.586" y1="63.1432" x2="84.586" y2="106.7911"/>
          </g>
        </g>

        {/* Vstupní kolečko – celé statické (tělo konektoru kabelu) */}
        <path fill="none" stroke="#575756" strokeWidth="6.8992" strokeMiterlimit="10"
          d="M21.5083,69.5434c-.6383.1398-1.3427.0967-2.0827-.1581-2.8717-.9888-5.1951-4.7931-5.1866-8.497.0027-1.1898.2463-2.2244.6711-3.0478"/>
        <path fill="#3c3c3b"
          d="M19.5963,57.5187c1.8348.7339,3.3192,3.5578,3.3138,6.3036-.0054,2.7492-1.4986,4.3818-3.3333,3.6479s-3.3192-3.5577-3.3138-6.3069c.0054-2.7457,1.4986-4.3785,3.3333-3.6446"/>
        <path fill="none" stroke="#575756" strokeWidth="6.8992" strokeLinecap="round" strokeLinejoin="round"
          d="M14.9101,57.8413c.896-1.7366,2.598-2.5332,4.5461-1.8624"/>
        <path fill="none" stroke="#575756" strokeWidth="6.8992" strokeLinecap="round" strokeLinejoin="round"
          d="M19.4562,55.9781c2.8717.9888,5.1951,4.7933,5.1866,8.4925-.0063,2.7495-1.2957,4.67-3.1345,5.0727"/>
        <path fill="none" opacity="0.45" stroke="#fff" strokeWidth="3.7227" strokeLinecap="round" strokeLinejoin="round"
          d="M24.5572,63.2075c-.4374-3.4802-2.88-6.7881-5.5685-7.3969-.6091-.0691-1.9975-.31-3.1974.8488"/>

        {/* Šipka displeje (st6) */}
        <path fill="none" stroke="#1d1d1b" strokeWidth="2.4818" strokeLinecap="round" strokeLinejoin="round"
          d="M107.8153,13.5219l2.4011-4.2081c-6.6683-7.9044-15.8125-11.1173-24.2154-10.3199C75.6304-.0223,63.3417,7.6798,54.9779,24.2772l4.4222,2.9295"/>
        <line fill="none" stroke="#1d1d1b" strokeWidth="2.4818" strokeLinecap="round" strokeLinejoin="round"
          x1="82.3739" y1="-.3981" x2="82.3739" y2="6.2282"/>

        {/* Písmeno A s clipPath */}
        <g clipPath={`url(#${cp2})`}>
          <path fill="#1d1d1b" d="M85.2423,30.1818l-3.037.9724,1.5057-5.4779.0552-.0177,1.4761,4.5232M82.5666,23.0371l-4.052,14.6334,2.0982-.6718.9933-3.6205,4.2361-1.3563.963,2.9941,1.9878-.6365-4.0256-12.0471-2.2008.7047"/>
        </g>

        {/* ═══ Ukazovátko – ručička – úhel dle proudu (0 A = −20°, 3 A = +20°) ═══ */}
        <g transform={`rotate(${-20 + Math.min(1, current / 3) * 40} 83.854 52.4269)`}>
          <line fill="none" stroke="#f03b50" strokeWidth="2.4818" strokeLinecap="round" strokeLinejoin="round"
            x1="83.854" y1="52.4269" x2="93.1752" y2="12.4678"/>
          <path fill="#2b2b2b"
            d="M83.8198,44.6376c3.441-1.1848,6.2413,1.451,6.2515,5.8836l-12.4663,4.2925c-.0101-4.4325,2.7738-8.9912,6.2148-10.1761"/>
        </g>

        {/* Drobné čárky stupnice (st5) */}
        <line fill="none" stroke="#1d1d1b" strokeWidth="1.2409" strokeLinecap="round" strokeLinejoin="round"
          x1="99.4106" y1="1.1721" x2="97.5349" y2="7.4761"/>
        <line fill="none" stroke="#1d1d1b" strokeWidth="1.2409" strokeLinecap="round" strokeLinejoin="round"
          x1="64.6293" y1="10.3604" x2="66.8551" y2="15.3821"/>
      </g>

      {/* ═══ Digitální displej proudu – mimo translate, ve spodní části karty ═══ */}
      <text fill="#216de8" textAnchor="middle" x="68" y="140">
        <tspan fontFamily="'Fenomen Sans', Arial, sans-serif" fontSize="36" fontWeight="500">
          {milliMode
            ? (current > 0.0001 ? `${(current * 1000).toFixed(1).replace('.', ',')} ` : '0 ')
            : (current > 0.001  ? `${current.toFixed(2).replace('.', ',')} `           : '0 ')}
        </tspan>
        <tspan fontFamily="'Fenomen Sans', Arial, sans-serif" fontSize={milliMode ? "24" : "32"} fontWeight="700">{milliMode ? 'mA' : 'A'}</tspan>
      </text>
      {/* Electrons in ammeter – disabled */}
    </svg>
  );
}

/** Formát napětí na displeji voltmetru (čárka jako desetinný separátor), včetně záporných hodnot. */
function formatVoltmeterReading(v: number): string {
  if (Math.abs(v) <= 0.001) return '0';
  const sign = v < 0 ? '-' : '';
  return `${sign}${Math.abs(v).toFixed(2).replace('.', ',')}`;
}

/* ══ VOLTMETR – samostatný komponent s unikátními clipPath ID ══ */
function VoltmeterTile({ voltage = 0, rotation = 0 }: { voltage?: number; rotation?: number }) {
  // 0…24 V → ručička −20°…+20°; záporná napětí symetricky doleva (do −60° při −24 V)
  const needleDeg = Math.max(-60, Math.min(60, -20 + (voltage / 24) * 40));
  const uid = React.useId().replace(/:/g, '');
  const cp1 = `vcp1_${uid}`;
  const cp2 = `vcp2_${uid}`;
  return (
    <svg x={-30} y={-30} width={60} height={60} viewBox="-17 -18 170 170" style={{ overflow: 'visible' }}>
      <defs>
        <clipPath id={cp1}>
          <path d="M86.2604,60.7347c-11.1616,3.8433-20.1921,18.6306-20.1593,33.0086.0329,14.3963,9.1166,22.9455,20.2782,19.1022,11.1616-3.8433,20.1921-18.6297,20.1592-33.026-.0328-14.3781-9.1166-22.9281-20.2782-19.0849"/>
        </clipPath>
        <clipPath id={cp2}>
          <polygon points="88.793 34.3795 88.7904 21.0443 78.512 24.3353 78.5145 37.6705"/>
        </clipPath>
      </defs>

      {/* Teal ledge (stín) – counter-rotated so it always points down */}
      <g transform={rotation ? `rotate(${-rotation}, 68, 67)` : undefined}>
        <path fill="#5eead4" d="M-1.2212-3.3086h139.4502c8.4304,0,15.2749,6.8445,15.2749,15.2749v139.4507c0,8.4302-6.8442,15.2744-15.2744,15.2744H-1.2217c-8.4302,0-15.2744-6.8442-15.2744-15.2744V11.9663C-16.4961,3.5359-9.6516-3.3086-1.2212-3.3086Z"/>
        <path fill="#0d9488" d="M138.2294-1.8084c7.5954,0,13.7747,6.1793,13.7747,13.7747v139.4505c0,7.5954-6.1793,13.7747-13.7747,13.7747H-1.2212c-7.5954,0-13.7747-6.1793-13.7747-13.7747V11.9663C-14.9959,4.3709-8.8166-1.8084-1.2212-1.8084h139.4506M138.2294-4.8084H-1.2212c-9.2644,0-16.7747,7.5103-16.7747,16.7747v139.4505c0,9.2644,7.5103,16.7747,16.7747,16.7747h139.4506c9.2644,0,16.7747-7.5103,16.7747-16.7747V11.9663c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"/>
      </g>

      {/* Bílá karta */}
      <path fill="#fff" d="M-1.2212-18.3086h139.4502c8.4304,0,15.2749,6.8445,15.2749,15.2749v139.4507c0,8.4302-6.8442,15.2744-15.2744,15.2744H-1.2217c-8.4302,0-15.2744-6.8442-15.2744-15.2744V-3.0337c0-8.4304,6.8445-15.2749,15.2749-15.2749Z"/>
      <path fill="#0d9488" d="M138.2294-16.8084c7.5954,0,13.7747,6.1793,13.7747,13.7747v139.4505c0,7.5954-6.1793,13.7747-13.7747,13.7747H-1.2212c-7.5954,0-13.7747-6.1793-13.7747-13.7747V-3.0337c0-7.5954,6.1793-13.7747,13.7747-13.7747h139.4506M138.2294-19.8084H-1.2212c-9.2644,0-16.7747,7.5103-16.7747,16.7747v139.4505c0,9.2644,7.5103,16.7747,16.7747,16.7747h139.4506c9.2644,0,16.7747-7.5103,16.7747-16.7747V-3.0337c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"/>

      {/* ── Tělo voltmetru posunuto o -18 nahoru ── */}
      <g transform="translate(0,-18)">
        {/* Šedý stín základny */}
        <path fill="#ccc" d="M-3.6624,129.1403l35.4176,13.1176c8.6023,3.186,18.0528,3.2347,26.6875.1375l78.4715-28.1474c4.6291-1.6604,4.4671-8.262-.2378-9.6935l-49.3135-15.0036L-3.4876,119.5004c-4.589,1.5128-4.7059,7.9617-.1748,9.6398Z"/>

        {/* Tělo přístroje – zelený */}
        <path fill="#0d9488" d="M27.1771-23.1804l56.5247-18.7386c3.3107-1.1434,6.6663-.9695,9.6092.1581l.0067-.0145,25.2338,8.7064-28.5241,61.9755-36.072,78.3776-12.3437,26.8203-25.4537-8.7827.0121-.0248c-5.4605-1.8438-9.6268-6.9589-9.6268-13.3526V5.7752c0-13.0648,8.2853-24.6917,20.6339-28.9555Z"/>
        <path fill="#5eead4" d="M51.0372,134.1776l56.5247-18.7386c12.3488-4.2643,20.6343-15.8911,20.6343-28.9555V-19.6861c0-9.686-9.5432-16.4867-18.6987-13.3251L52.9728-14.2726c-12.3488,4.2643-20.6343,15.8911-20.6343,28.9555v106.1696c0,9.686,9.5432,16.4867,18.6987,13.3251Z"/>

        {/* Světlá plocha displeje */}
        <path fill="#f6f6f6" d="M105.151,45.3667c6.3027-2.2104,10.5308-8.1702,10.5308-14.8546V-8.1896c0-5.1179-5.0096-8.7348-9.8675-7.1244L60.1363-.1714c-6.3027,2.2104-10.5308,8.1702-10.5308,14.8546v38.7017c0,5.1179,5.0096,8.7348,9.8675,7.1244l45.6781-15.1426Z"/>

        {/* Ciferník – vnější */}
        <path fill="#3c3c3b" d="M86.2604,60.7347c-11.1616,3.8433-20.1921,18.6306-20.1593,33.0086.0329,14.3963,9.1166,22.9455,20.2782,19.1022,11.1616-3.8433,20.1921-18.6297,20.1592-33.026-.0328-14.3781-9.1166-22.9281-20.2782-19.0849"/>

        {/* Ciferník vnitřek */}
        <g clipPath={`url(#${cp1})`}>
          <path fill="#575756" d="M80.7902,58.5237c-11.1616,3.8433-20.1921,18.6306-20.1593,33.0086.0329,14.3963,9.1166,22.9455,20.2782,19.1022,11.1616-3.8433,20.1921-18.6297,20.1592-33.026-.0328-14.3781-9.1166-22.9281-20.2782-19.0849"/>
          {/* Statická čára ciferníku */}
          <line fill="#fd0" stroke="#2b2b2b" strokeWidth="11.9618" strokeLinecap="round" strokeLinejoin="round" x1="84.586" y1="63.1432" x2="84.586" y2="106.7911"/>
        </g>

        {/* Vstupní kolečko */}
        <path fill="none" stroke="#575756" strokeWidth="6.8992" strokeMiterlimit="10"
          d="M21.5083,69.5434c-.6383.1398-1.3427.0967-2.0827-.1581-2.8717-.9888-5.1951-4.7931-5.1866-8.497.0027-1.1898.2463-2.2244.6711-3.0478"/>
        <path fill="#3c3c3b"
          d="M19.5963,57.5187c1.8348.7339,3.3192,3.5578,3.3138,6.3036-.0054,2.7492-1.4986,4.3818-3.3333,3.6479s-3.3192-3.5577-3.3138-6.3069c.0054-2.7457,1.4986-4.3785,3.3333-3.6446"/>
        <path fill="none" stroke="#575756" strokeWidth="6.8992" strokeLinecap="round" strokeLinejoin="round"
          d="M14.9101,57.8413c.896-1.7366,2.598-2.5332,4.5461-1.8624"/>
        <path fill="none" stroke="#575756" strokeWidth="6.8992" strokeLinecap="round" strokeLinejoin="round"
          d="M19.4562,55.9781c2.8717.9888,5.1951,4.7933,5.1866,8.4925-.0063,2.7495-1.2957,4.67-3.1345,5.0727"/>
        <path fill="none" opacity="0.45" stroke="#fff" strokeWidth="3.7227" strokeLinecap="round" strokeLinejoin="round"
          d="M24.5572,63.2075c-.4374-3.4802-2.88-6.7881-5.5685-7.3969-.6091-.0691-1.9975-.31-3.1974.8488"/>

        {/* Šipka displeje */}
        <path fill="none" stroke="#1d1d1b" strokeWidth="2.4818" strokeLinecap="round" strokeLinejoin="round"
          d="M107.8153,13.5219l2.4011-4.2081c-6.6683-7.9044-15.8125-11.1173-24.2154-10.3199C75.6304-.0223,63.3417,7.6798,54.9779,24.2772l4.4222,2.9295"/>
        <line fill="none" stroke="#1d1d1b" strokeWidth="2.4818" strokeLinecap="round" strokeLinejoin="round"
          x1="82.3739" y1="-.3981" x2="82.3739" y2="6.2282"/>

        {/* Písmeno V */}
        {/* Písmeno V – bez clipPath, posunut aby byl viditelný */}
        <text fill="#1d1d1b" fontFamily="'Fenomen Sans', Arial, sans-serif" fontSize="16" fontWeight="700"
          x="84" y="38" textAnchor="middle">V</text>

        {/* Ukazovátko – ručička – úhel dle napětí včetně záporného (±24 V plná výchylka) */}
        <g transform={`rotate(${needleDeg} 83.854 52.4269)`}>
          <line fill="none" stroke="#0d9488" strokeWidth="2.4818" strokeLinecap="round" strokeLinejoin="round"
            x1="83.854" y1="52.4269" x2="93.1752" y2="12.4678"/>
          <path fill="#2b2b2b"
            d="M83.8198,44.6376c3.441-1.1848,6.2413,1.451,6.2515,5.8836l-12.4663,4.2925c-.0101-4.4325,2.7738-8.9912,6.2148-10.1761"/>
        </g>

        {/* Drobné čárky stupnice */}
        <line fill="none" stroke="#1d1d1b" strokeWidth="1.2409" strokeLinecap="round" strokeLinejoin="round"
          x1="99.4106" y1="1.1721" x2="97.5349" y2="7.4761"/>
        <line fill="none" stroke="#1d1d1b" strokeWidth="1.2409" strokeLinecap="round" strokeLinejoin="round"
          x1="64.6293" y1="10.3604" x2="66.8551" y2="15.3821"/>
      </g>

      {/* Digitální displej napětí (+ u červené sondy, − u černé → záporný údaj při prohození polarit) */}
      <text fill="#0d9488" textAnchor="middle" x="68" y="140">
        <tspan fontFamily="'Fenomen Sans', Arial, sans-serif" fontSize="36" fontWeight="500">{`${formatVoltmeterReading(voltage)} `}</tspan>
        <tspan fontFamily="'Fenomen Sans', Arial, sans-serif" fontSize="32" fontWeight="700">V</tspan>
      </text>

      {/* Tečky sond na bočnicích – jen barevné kruhy bez popisků */}
      <g transform="translate(-8, 58)">
        <circle r="10" fill="#dc2626" stroke="#991b1b" strokeWidth="1.5"/>
      </g>
      <g transform="translate(145, 58)">
        <circle r="10" fill="#1f2937" stroke="#111827" strokeWidth="1.5"/>
      </g>
    </svg>
  );
}

/* ─── Úplný obsah každé dlaždice (karta + součástka) ─── */
function RealisticContent({ type, isOn, bulbState, voltage, resistance, wiperPosition, ledBrightness, rotation = 0, showBulbNominal = false }: { type: ComponentType; isOn: boolean; bulbState?: BulbState; voltage?: number; resistance?: number; wiperPosition?: number; ledBrightness?: number; rotation?: number; showBulbNominal?: boolean }) {
  const [lcx, lcy] = LEDGE_CENTERS[type] ?? [68, 55];
  const ledgeT = rotation ? `rotate(${-rotation}, ${lcx}, ${lcy})` : undefined;
  
  // Format resistance for display on realistic tiles
  const formatResistanceDisplay = (r?: number): { value: string; unit: string } => {
    if (r === undefined) return { value: '', unit: '' };
    if (r >= 1000) {
      const kOhms = r / 1000;
      return {
        value: kOhms.toFixed(kOhms % 1 === 0 ? 0 : 1).replace('.', ','),
        unit: 'kΩ'
      };
    }
    return { value: r.toString(), unit: 'Ω' };
  };

  switch (type) {

    /* ═��� REZISTOR ══ */
    case 'resistor':
      return (
        <>
          {/* Modrý ledge (stín) */}
          <g transform={ledgeT}>
            <path fill="#59a2ff" d="M-1.2212-14.9355h139.4502c8.4304,0,15.2749,6.8445,15.2749,15.2749v139.4507c0,8.4302-6.8442,15.2744-15.2744,15.2744H-1.2217c-8.4302,0-15.2744-6.8442-15.2744-15.2744V.3394c0-8.4304,6.8445-15.2749,15.2749-15.2749Z"/>
            <path fill="#216de8" d="M138.2294-13.4354c7.5954,0,13.7747,6.1793,13.7747,13.7747v139.4506c0,7.5954-6.1793,13.7747-13.7747,13.7747H-1.2212c-7.5954,0-13.7747-6.1793-13.7747-13.7747V.3394c0-7.5954,6.1793-13.7747,13.7747-13.7747h139.4506M138.2294-16.4354H-1.2212c-9.2644,0-16.7747,7.5103-16.7747,16.7747v139.4506c0,9.2644,7.5103,16.7747,16.7747,16.7747h139.4506c9.2644,0,16.7747-7.5103,16.7747-16.7747V.3394c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"/>
          </g>
          {/* Bílá karta */}
          <path fill="#fff" d="M-1.2212-29.9355h139.4502c8.4304,0,15.2749,6.8445,15.2749,15.2749V124.79c0,8.4302-6.8442,15.2744-15.2744,15.2744H-1.2217c-8.4302,0-15.2744-6.8442-15.2744-15.2744V-14.6606c0-8.4304,6.8445-15.2749,15.2749-15.2749Z"/>
          <path fill="#216de8" d="M138.2294-28.4354c7.5954,0,13.7747,6.1793,13.7747,13.7747V124.7899c0,7.5954-6.1793,13.7747-13.7747,13.7747H-1.2212c-7.5954,0-13.7747-6.1793-13.7747-13.7747V-14.6606c0-7.5954,6.1793-13.7747,13.7747-13.7747h139.4506M138.2294-31.4354H-1.2212c-9.2644,0-16.7747,7.5103-16.7747,16.7747V124.7899c0,9.2644,7.5103,16.7747,16.7747,16.7747h139.4506c9.2644,0,16.7747-7.5103,16.7747-16.7747V-14.6606c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"/>
          {/* Přívody */}
          <line fill="none" stroke="#ad0404" strokeLinecap="round" strokeLinejoin="round" strokeWidth="8" x1="22.7996" y1="51.1703" x2="-15.9959" y2="51.1703"/>
          <line fill="none" stroke="#ad0404" strokeLinecap="round" strokeLinejoin="round" strokeWidth="8" x1="153.0041" y1="51.1703" x2="118.0041" y2="51.1703"/>
          {/* Šedý stín pod tělem */}
          <rect fill="#cccccc" x="20.8962" y="54.5647" width="99.1079" height="19.1835" rx="7.1065" ry="7.1065"/>
          {/* Modrý korpus */}
          <rect fill="#59a2ff" x="28.0076" y="38.5037" width="84.8853" height="25.3053" rx="7.1065" ry="7.1065"/>
          <rect fill="#59a2ff" x="22.7996" y="36.5646" width="19.5577" height="29.2113" rx="7.315" ry="7.315"/>
          <rect fill="#59a2ff" x="98.2474" y="36.5647" width="19.5577" height="29.2113" rx="7.315" ry="7.315"/>
          {/* Pásky */}
          <rect fill="#1d1d1b" x="68.2265" y="38.5037" width="4.4132" height="25.3053"/>
          <rect fill="#1d1d1b" x="55.7681" y="38.5037" width="4.4132" height="25.3053"/>
          <rect fill="#813b50" x="43.3098" y="38.5037" width="4.4132" height="25.3053"/>
          <rect fill="#813b50" x="93.1431" y="38.5037" width="4.4132" height="25.3053"/>
          <rect fill="#cccccc" x="80.6848" y="38.5037" width="4.4132" height="25.3053"/>
          {/* Popisek */}
          <text fill="#216de8" textAnchor="middle" x="68.5" y="112">
            <tspan fontFamily="'Fenomen Sans', Arial, sans-serif" fontSize="38" fontWeight="500">{resistance !== undefined ? formatResistanceDisplay(resistance).value : '1'} </tspan>
            <tspan fontFamily="'Fenomen Sans', Arial, sans-serif" fontSize="33.5" fontWeight="700">{resistance !== undefined ? formatResistanceDisplay(resistance).unit : 'Ω'}</tspan>
          </text>
        </>
      );

    /* ══ REZISTOR 2 Ω ══ */
    case 'resistor2':
      return (
        <>
          {/* Modrý ledge (stín) */}
          <g transform={ledgeT}>
            <path fill="#59a2ff" d="M-1.2212-14.9355h139.4502c8.4304,0,15.2749,6.8445,15.2749,15.2749v139.4507c0,8.4302-6.8442,15.2744-15.2744,15.2744H-1.2217c-8.4302,0-15.2744-6.8442-15.2744-15.2744V.3394c0-8.4304,6.8445-15.2749,15.2749-15.2749Z"/>
            <path fill="#216de8" d="M138.2294-13.4354c7.5954,0,13.7747,6.1793,13.7747,13.7747v139.4506c0,7.5954-6.1793,13.7747-13.7747,13.7747H-1.2212c-7.5954,0-13.7747-6.1793-13.7747-13.7747V.3394c0-7.5954,6.1793-13.7747,13.7747-13.7747h139.4506M138.2294-16.4354H-1.2212c-9.2644,0-16.7747,7.5103-16.7747,16.7747v139.4506c0,9.2644,7.5103,16.7747,16.7747,16.7747h139.4506c9.2644,0,16.7747-7.5103,16.7747-16.7747V.3394c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"/>
          </g>
          {/* Bílá karta */}
          <path fill="#fff" d="M-1.2212-29.9355h139.4502c8.4304,0,15.2749,6.8445,15.2749,15.2749V124.79c0,8.4302-6.8442,15.2744-15.2744,15.2744H-1.2217c-8.4302,0-15.2744-6.8442-15.2744-15.2744V-14.6606c0-8.4304,6.8445-15.2749,15.2749-15.2749Z"/>
          <path fill="#216de8" d="M138.2294-28.4354c7.5954,0,13.7747,6.1793,13.7747,13.7747V124.7899c0,7.5954-6.1793,13.7747-13.7747,13.7747H-1.2212c-7.5954,0-13.7747-6.1793-13.7747-13.7747V-14.6606c0-7.5954,6.1793-13.7747,13.7747-13.7747h139.4506M138.2294-31.4354H-1.2212c-9.2644,0-16.7747,7.5103-16.7747,16.7747V124.7899c0,9.2644,7.5103,16.7747,16.7747,16.7747h139.4506c9.2644,0,16.7747-7.5103,16.7747-16.7747V-14.6606c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"/>
          {/* Přívody */}
          <line fill="none" stroke="#ad0404" strokeLinecap="round" strokeLinejoin="round" strokeWidth="8" x1="22.7996" y1="51.1703" x2="-15.9959" y2="51.1703"/>
          <line fill="none" stroke="#ad0404" strokeLinecap="round" strokeLinejoin="round" strokeWidth="8" x1="153.0041" y1="51.1703" x2="118.0041" y2="51.1703"/>
          {/* Šedý stín pod tělem */}
          <rect fill="#cccccc" x="20.8962" y="54.5647" width="99.1079" height="19.1835" rx="7.1065" ry="7.1065"/>
          {/* Zelený korpus */}
          <rect fill="#22c55e" x="28.0076" y="38.5037" width="84.8853" height="25.3053" rx="7.1065" ry="7.1065"/>
          <rect fill="#22c55e" x="22.7996" y="36.5646" width="19.5577" height="29.2113" rx="7.315" ry="7.315"/>
          <rect fill="#22c55e" x="98.2474" y="36.5647" width="19.5577" height="29.2113" rx="7.315" ry="7.315"/>
          {/* Pásky */}
          <rect fill="#dc2626" x="55.7681" y="38.5037" width="4.4132" height="25.3053"/>
          <rect fill="#1d1d1b" x="68.2265" y="38.5037" width="4.4132" height="25.3053"/>
          <rect fill="#1d1d1b" x="43.3098" y="38.5037" width="4.4132" height="25.3053"/>
          <rect fill="#813b50" x="93.1431" y="38.5037" width="4.4132" height="25.3053"/>
          <rect fill="#d4af37" x="80.6848" y="38.5037" width="4.4132" height="25.3053"/>
          {/* Popisek */}
          <text fill="#15803d" textAnchor="middle" x="68.5" y="112">
            <tspan fontFamily="'Fenomen Sans', Arial, sans-serif" fontSize="38" fontWeight="500">{resistance !== undefined ? formatResistanceDisplay(resistance).value : '100'} </tspan>
            <tspan fontFamily="'Fenomen Sans', Arial, sans-serif" fontSize="33.5" fontWeight="700">{resistance !== undefined ? formatResistanceDisplay(resistance).unit : 'Ω'}</tspan>
          </text>
        </>
      );

    /* ══ REZISTOR 1 kΩ ══ */
    case 'resistor3':
      return (
        <>
          {/* Modrý ledge (stín) */}
          <g transform={ledgeT}>
            <path fill="#59a2ff" d="M-1.2212-14.9355h139.4502c8.4304,0,15.2749,6.8445,15.2749,15.2749v139.4507c0,8.4302-6.8442,15.2744-15.2744,15.2744H-1.2217c-8.4302,0-15.2744-6.8442-15.2744-15.2744V.3394c0-8.4304,6.8445-15.2749,15.2749-15.2749Z"/>
            <path fill="#216de8" d="M138.2294-13.4354c7.5954,0,13.7747,6.1793,13.7747,13.7747v139.4506c0,7.5954-6.1793,13.7747-13.7747,13.7747H-1.2212c-7.5954,0-13.7747-6.1793-13.7747-13.7747V.3394c0-7.5954,6.1793-13.7747,13.7747-13.7747h139.4506M138.2294-16.4354H-1.2212c-9.2644,0-16.7747,7.5103-16.7747,16.7747v139.4506c0,9.2644,7.5103,16.7747,16.7747,16.7747h139.4506c9.2644,0,16.7747-7.5103,16.7747-16.7747V.3394c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"/>
          </g>
          {/* Bílá karta */}
          <path fill="#fff" d="M-1.2212-29.9355h139.4502c8.4304,0,15.2749,6.8445,15.2749,15.2749V124.79c0,8.4302-6.8442,15.2744-15.2744,15.2744H-1.2217c-8.4302,0-15.2744-6.8442-15.2744-15.2744V-14.6606c0-8.4304,6.8445-15.2749,15.2749-15.2749Z"/>
          <path fill="#216de8" d="M138.2294-28.4354c7.5954,0,13.7747,6.1793,13.7747,13.7747V124.7899c0,7.5954-6.1793,13.7747-13.7747,13.7747H-1.2212c-7.5954,0-13.7747-6.1793-13.7747-13.7747V-14.6606c0-7.5954,6.1793-13.7747,13.7747-13.7747h139.4506M138.2294-31.4354H-1.2212c-9.2644,0-16.7747,7.5103-16.7747,16.7747V124.7899c0,9.2644,7.5103,16.7747,16.7747,16.7747h139.4506c9.2644,0,16.7747-7.5103,16.7747-16.7747V-14.6606c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"/>
          {/* Přívody */}
          <line fill="none" stroke="#ad0404" strokeLinecap="round" strokeLinejoin="round" strokeWidth="8" x1="22.7996" y1="51.1703" x2="-15.9959" y2="51.1703"/>
          <line fill="none" stroke="#ad0404" strokeLinecap="round" strokeLinejoin="round" strokeWidth="8" x1="153.0041" y1="51.1703" x2="118.0041" y2="51.1703"/>
          {/* Šedý stín pod tělem */}
          <rect fill="#cccccc" x="20.8962" y="54.5647" width="99.1079" height="19.1835" rx="7.1065" ry="7.1065"/>
          {/* Oranžový korpus */}
          <rect fill="#f97316" x="28.0076" y="38.5037" width="84.8853" height="25.3053" rx="7.1065" ry="7.1065"/>
          <rect fill="#f97316" x="22.7996" y="36.5646" width="19.5577" height="29.2113" rx="7.315" ry="7.315"/>
          <rect fill="#f97316" x="98.2474" y="36.5647" width="19.5577" height="29.2113" rx="7.315" ry="7.315"/>
          {/* Pásky */}
          <rect fill="#22c55e" x="55.7681" y="38.5037" width="4.4132" height="25.3053"/>
          <rect fill="#1d1d1b" x="68.2265" y="38.5037" width="4.4132" height="25.3053"/>
          <rect fill="#1d1d1b" x="43.3098" y="38.5037" width="4.4132" height="25.3053"/>
          <rect fill="#dc2626" x="93.1431" y="38.5037" width="4.4132" height="25.3053"/>
          <rect fill="#d4af37" x="80.6848" y="38.5037" width="4.4132" height="25.3053"/>
          {/* Popisek */}
          <text fill="#c2410c" textAnchor="middle" x="68.5" y="112">
            <tspan fontFamily="'Fenomen Sans', Arial, sans-serif" fontSize="35" fontWeight="500">{resistance !== undefined ? formatResistanceDisplay(resistance).value : '1'} </tspan>
            <tspan fontFamily="'Fenomen Sans', Arial, sans-serif" fontSize="31" fontWeight="700">{resistance !== undefined ? formatResistanceDisplay(resistance).unit : 'kΩ'}</tspan>
          </text>
        </>
      );

    /* ══ POTENCIOMETR ══ */
    case 'potentiometer': {
      const wp = wiperPosition ?? 0.5;
      // Wiper X position along resistor track (viewBox coords) – wider body
      const trackLeft = 28.5;
      const trackRight = 109.5;
      const wiperVbX = trackLeft + (trackRight - trackLeft) * wp;
      return (
        <>
          {/* Modrý ledge (stín) */}
          <g transform={ledgeT}>
            <path fill="#59a2ff" d="M-1.2212-14.9355h139.4502c8.4304,0,15.2749,6.8445,15.2749,15.2749v139.4507c0,8.4302-6.8442,15.2744-15.2744,15.2744H-1.2217c-8.4302,0-15.2744-6.8442-15.2744-15.2744V.3394c0-8.4304,6.8445-15.2749,15.2749-15.2749Z"/>
            <path fill="#216de8" d="M138.2294-13.4354c7.5954,0,13.7747,6.1793,13.7747,13.7747v139.4506c0,7.5954-6.1793,13.7747-13.7747,13.7747H-1.2212c-7.5954,0-13.7747-6.1793-13.7747-13.7747V.3394c0-7.5954,6.1793-13.7747,13.7747-13.7747h139.4506M138.2294-16.4354H-1.2212c-9.2644,0-16.7747,7.5103-16.7747,16.7747v139.4506c0,9.2644,7.5103,16.7747,16.7747,16.7747h139.4506c9.2644,0,16.7747-7.5103,16.7747-16.7747V.3394c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"/>
          </g>
          {/* Bílá karta */}
          <path fill="#fff" d="M-1.2212-29.9355h139.4502c8.4304,0,15.2749,6.8445,15.2749,15.2749V124.79c0,8.4302-6.8442,15.2744-15.2744,15.2744H-1.2217c-8.4302,0-15.2744-6.8442-15.2744-15.2744V-14.6606c0-8.4304,6.8445-15.2749,15.2749-15.2749Z"/>
          <path fill="#216de8" d="M138.2294-28.4354c7.5954,0,13.7747,6.1793,13.7747,13.7747V124.7899c0,7.5954-6.1793,13.7747-13.7747,13.7747H-1.2212c-7.5954,0-13.7747-6.1793-13.7747-13.7747V-14.6606c0-7.5954,6.1793-13.7747,13.7747-13.7747h139.4506M138.2294-31.4354H-1.2212c-9.2644,0-16.7747,7.5103-16.7747,16.7747V124.7899c0,9.2644,7.5103,16.7747,16.7747,16.7747h139.4506c9.2644,0,16.7747-7.5103,16.7747-16.7747V-14.6606c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"/>
          {/* Přívody – kratší, napojené na čepičky */}
          <line fill="none" stroke="#ad0404" strokeLinecap="round" strokeLinejoin="round" strokeWidth="8" x1="17" y1="51.1703" x2="-15.9959" y2="51.1703"/>
          <line fill="none" stroke="#ad0404" strokeLinecap="round" strokeLinejoin="round" strokeWidth="8" x1="153.0041" y1="51.1703" x2="121" y2="51.1703"/>
          {/* Šedý stín pod tělem */}
          <rect fill="#cccccc" x="14" y="54.5" width="110" height="19" rx="7" ry="7"/>
          {/* Světle modrý korpus – širší */}
          <rect fill="#E8F6FE" x="20" y="36.5" width="98" height="29.2" rx="7" ry="7"/>
          {/* Levá tmavá čepička */}
          <rect fill="#041423" x="14" y="36.5" width="14" height="29.2" rx="7" ry="7"/>
          {/* Pravá tmavá čepička */}
          <rect fill="#041423" x="110" y="36.5" width="14" height="29.2" rx="7" ry="7"/>
          {/* Bílý odlesk nahoře */}
          <rect fill="#fff" opacity="0.7" x="14" y="37.9" width="110" height="5.9" rx="3" ry="3"/>
          {/* Odporová dráha */}
          <line fill="none" stroke="#041423" strokeMiterlimit="10" strokeWidth="2.1" x1="28.5" y1="51" x2="109.5" y2="51"/>
          {/* Vodič stírače – od slideru diagonálně dolů do středu spodní hrany */}
          <line stroke="#ad0404" strokeWidth="7" strokeLinecap="round"
            x1={wiperVbX} y1="84" x2="68.5" y2="140"/>
          {/* Pill slider – tmavý obrys/stín */}
          <rect x={wiperVbX - 14} y="38" width="28" height="47" rx="14" ry="14" fill="#312e81"/>
          {/* Pill slider – hlavní modrá ploška */}
          <rect x={wiperVbX - 13} y="37" width="26" height="46" rx="13" ry="13" fill="#4f46e5"/>
          {/* Pill slider – světlý horní highlight */}
          <rect x={wiperVbX - 13} y="37" width="26" height="16" rx="13" ry="13" fill="#6366f1"/>
          {/* Bílé tečky – grip */}
          <circle fill="white" cx={wiperVbX} cy="52" r="3.5"/>
          <circle fill="white" cx={wiperVbX} cy="62" r="3.5"/>
          <circle fill="white" cx={wiperVbX} cy="72" r="3.5"/>
          {/* Popisek – nad tělem */}
          <text fill="#041423" textAnchor="middle" x="68.5" y="12">
            <tspan fontFamily="'Fenomen Sans', Arial, sans-serif" fontSize="38" fontWeight="500">{resistance !== undefined ? formatResistanceDisplay(resistance).value : '1'} </tspan>
            <tspan fontFamily="'Fenomen Sans', Arial, sans-serif" fontSize="33.5" fontWeight="700">{resistance !== undefined ? formatResistanceDisplay(resistance).unit : 'kΩ'}</tspan>
          </text>
        </>
      );
    }

    /* ══ LED (červená / zelená / modrá) ══ */
    case 'led':
    case 'led2':
    case 'led3': {
      const isBroken = bulbState === 'broken';
      const b = isBroken ? 0 : (ledBrightness ?? (isOn ? 1 : 0));
      const isLit = b > 0;

      // Per-type color palette
      const ledColors = type === 'led3'
        ? { border: '#2563eb', borderLight: '#93c5fd', offOuter: '#3b82f6', offInner: '#93c5fd',
            onOuterRGB: [59,130,246], litOuterRGB: [96,165,250], onInnerRGB: [147,197,253], litInnerRGB: [219,234,254],
            glowRGBA: '96,165,250', textColor: '#2563eb' }
        : type === 'led2'
        ? { border: '#16a34a', borderLight: '#86efac', offOuter: '#22c55e', offInner: '#bbf7d0',
            onOuterRGB: [34,197,94], litOuterRGB: [74,222,128], onInnerRGB: [187,247,208], litInnerRGB: [220,252,231],
            glowRGBA: '74,222,128', textColor: '#16a34a' }
        : { border: '#dc2626', borderLight: '#fca5a5', offOuter: '#ef4444', offInner: '#fca5a5',
            onOuterRGB: [239,68,68], litOuterRGB: [251,146,60], onInnerRGB: [252,165,165], litInnerRGB: [253,230,138],
            glowRGBA: '251,146,60', textColor: '#dc2626' };

      const oR = Math.round(ledColors.onOuterRGB[0] + (ledColors.litOuterRGB[0] - ledColors.onOuterRGB[0]) * b);
      const oG = Math.round(ledColors.onOuterRGB[1] + (ledColors.litOuterRGB[1] - ledColors.onOuterRGB[1]) * b);
      const oB2 = Math.round(ledColors.onOuterRGB[2] + (ledColors.litOuterRGB[2] - ledColors.onOuterRGB[2]) * b);
      const glowOuter = isBroken ? '#6b7280' : isLit ? `rgb(${oR},${oG},${oB2})` : ledColors.offOuter;
      const iR = Math.round(ledColors.onInnerRGB[0] + (ledColors.litInnerRGB[0] - ledColors.onInnerRGB[0]) * b);
      const iG = Math.round(ledColors.onInnerRGB[1] + (ledColors.litInnerRGB[1] - ledColors.onInnerRGB[1]) * b);
      const iB2 = Math.round(ledColors.onInnerRGB[2] + (ledColors.litInnerRGB[2] - ledColors.onInnerRGB[2]) * b);
      const glowInner = isBroken ? '#374151' : isLit ? `rgb(${iR},${iG},${iB2})` : ledColors.offInner;
      const glowOpacity = 0.10 + 0.30 * b;
      const glowRx = 28 + 14 * b;
      const glowRy = 22 + 12 * b;
      return (
        <>
          {/* Barevný ledge (stín) */}
          <g transform={ledgeT}>
            <path fill={isBroken ? '#9ca3af' : ledColors.borderLight} d="M-1.2212-14.9355h139.4502c8.4304,0,15.2749,6.8445,15.2749,15.2749v139.4507c0,8.4302-6.8442,15.2744-15.2744,15.2744H-1.2217c-8.4302,0-15.2744-6.8442-15.2744-15.2744V.3394c0-8.4304,6.8445-15.2749,15.2749-15.2749Z"/>
            <path fill={isBroken ? '#6b7280' : ledColors.border} d="M138.2294-13.4354c7.5954,0,13.7747,6.1793,13.7747,13.7747v139.4506c0,7.5954-6.1793,13.7747-13.7747,13.7747H-1.2212c-7.5954,0-13.7747-6.1793-13.7747-13.7747V.3394c0-7.5954,6.1793-13.7747,13.7747-13.7747h139.4506M138.2294-16.4354H-1.2212c-9.2644,0-16.7747,7.5103-16.7747,16.7747v139.4506c0,9.2644,7.5103,16.7747,16.7747,16.7747h139.4506c9.2644,0,16.7747-7.5103,16.7747-16.7747V.3394c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"/>
          </g>
          {/* Bílá karta */}
          <path fill="#fff" d="M-1.2212-29.9355h139.4502c8.4304,0,15.2749,6.8445,15.2749,15.2749V124.79c0,8.4302-6.8442,15.2744-15.2744,15.2744H-1.2217c-8.4302,0-15.2744-6.8442-15.2744-15.2744V-14.6606c0-8.4304,6.8445-15.2749,15.2749-15.2749Z"/>
          <path fill={isBroken ? '#6b7280' : ledColors.border} d="M138.2294-28.4354c7.5954,0,13.7747,6.1793,13.7747,13.7747V124.7899c0,7.5954-6.1793,13.7747-13.7747,13.7747H-1.2212c-7.5954,0-13.7747-6.1793-13.7747-13.7747V-14.6606c0-7.5954,6.1793-13.7747,13.7747-13.7747h139.4506M138.2294-31.4354H-1.2212c-9.2644,0-16.7747,7.5103-16.7747,16.7747V124.7899c0,9.2644,7.5103,16.7747,16.7747,16.7747h139.4506c9.2644,0,16.7747-7.5103,16.7747-16.7747V-14.6606c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"/>
          {/* Přívody – protažené až k tělu LED */}
          <line fill="none" stroke={isBroken ? '#6b7280' : '#ad0404'} strokeLinecap="round" strokeLinejoin="round" strokeWidth="8" x1="42.5" y1="51.1703" x2="-15.9959" y2="51.1703"/>
          <line fill="none" stroke={isBroken ? '#6b7280' : '#ad0404'} strokeLinecap="round" strokeLinejoin="round" strokeWidth="8" x1="153.0041" y1="51.1703" x2="94.5" y2="51.1703"/>
          {/* Záře – intenzita proporcionální jasu */}
          {isLit && (
            <ellipse cx="68.5" cy="51.1703" rx={glowRx} ry={glowRy}
              fill={`rgba(${ledColors.glowRGBA},${glowOpacity})`}
              style={{ filter: `blur(${8 + 6 * b}px)` }}/>
          )}
          {/* Stín – kolečko posunuté vpravo-dolů */}
          <circle cx="72" cy="55" r="26" fill="rgba(0,0,0,0.18)"/>
          {/* Kolečko LED – vnější barva */}
          <circle fill={isBroken ? '#6b7280' : glowOuter} cx="68.5" cy="51.1703" r="26"/>
          {/* Kolečko LED – vnitřní světlo */}
          <circle fill={isBroken ? '#374151' : glowInner} cx="68.5" cy="51.1703" r="16"/>
          {/* Odlesk (skryt pokud přepálená) */}
          {!isBroken && <ellipse fill="rgba(255,255,255,0.55)" cx="60" cy="43" rx="7" ry="5" transform="rotate(-25 60 43)"/>}
          {/* Přepálení: X přes kolečko */}
          {isBroken && (
            <>
              <line stroke="#9ca3af" strokeWidth="3.5" strokeLinecap="round" x1="49" y1="33" x2="88" y2="70"/>
              <line stroke="#9ca3af" strokeWidth="3.5" strokeLinecap="round" x1="88" y1="33" x2="49" y2="70"/>
            </>
          )}
          {/* Malá schematická značka LED v rohu karty */}
          <g transform="translate(68.5, 105) scale(-0.7, 0.7)" opacity="0.6">
            <line x1="-18" y1="0" x2="-10" y2="0" stroke={isBroken ? '#6b7280' : ledColors.border} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <line x1="-10" y1="-10" x2="-10" y2="10" stroke={isBroken ? '#6b7280' : ledColors.border} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <polygon points="-10,-10 -10,10 10,0" fill="none" stroke={isBroken ? '#6b7280' : ledColors.border} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <line x1="10" y1="-10" x2="10" y2="10" stroke={isBroken ? '#6b7280' : ledColors.border} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <line x1="10" y1="0" x2="18" y2="0" stroke={isBroken ? '#6b7280' : ledColors.border} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            {!isBroken && (
              <>
                <line x1="3" y1="-13" x2="11" y2="-23" stroke={ledColors.border} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
                <polyline points="7,-22 11,-23 11,-18" fill="none" stroke={ledColors.border} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
                <line x1="9" y1="-8" x2="17" y2="-18" stroke={ledColors.border} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
                <polyline points="13,-17 17,-18 17,-13" fill="none" stroke={ledColors.border} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
              </>
            )}
          </g>
        </>
      );
    }

    /* ══ NPN TRANZISTOR (realistická dlaždice) ══ */
    case 'npn': {
      return (
        <>
          {/* Fialový ledge (stín) */}
          <g transform={ledgeT}>
            <path fill="#c4b5fd" d="M-1.2212-14.9355h139.4502c8.4304,0,15.2749,6.8445,15.2749,15.2749v139.4507c0,8.4302-6.8442,15.2744-15.2744,15.2744H-1.2217c-8.4302,0-15.2744-6.8442-15.2744-15.2744V.3394c0-8.4304,6.8445-15.2749,15.2749-15.2749Z"/>
            <path fill="#7c3aed" d="M138.2294-13.4354c7.5954,0,13.7747,6.1793,13.7747,13.7747v139.4506c0,7.5954-6.1793,13.7747-13.7747,13.7747H-1.2212c-7.5954,0-13.7747-6.1793-13.7747-13.7747V.3394c0-7.5954,6.1793-13.7747,13.7747-13.7747h139.4506M138.2294-16.4354H-1.2212c-9.2644,0-16.7747,7.5103-16.7747,16.7747v139.4506c0,9.2644,7.5103,16.7747,16.7747,16.7747h139.4506c9.2644,0,16.7747-7.5103,16.7747-16.7747V.3394c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"/>
          </g>
          {/* Bílá karta */}
          <path fill="#fff" d="M-1.2212-29.9355h139.4502c8.4304,0,15.2749,6.8445,15.2749,15.2749V124.79c0,8.4302-6.8442,15.2744-15.2744,15.2744H-1.2217c-8.4302,0-15.2744-6.8442-15.2744-15.2744V-14.6606c0-8.4304,6.8445-15.2749,15.2749-15.2749Z"/>
          <path fill="#7c3aed" d="M138.2294-28.4354c7.5954,0,13.7747,6.1793,13.7747,13.7747V124.7899c0,7.5954-6.1793,13.7747-13.7747,13.7747H-1.2212c-7.5954,0-13.7747-6.1793-13.7747-13.7747V-14.6606c0-7.5954,6.1793-13.7747,13.7747-13.7747h139.4506M138.2294-31.4354H-1.2212c-9.2644,0-16.7747,7.5103-16.7747,16.7747V124.7899c0,9.2644,7.5103,16.7747,16.7747,16.7747h139.4506c9.2644,0,16.7747-7.5103,16.7747-16.7747V-14.6606c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"/>
          {/* Přívody – C (vlevo) a E (vpravo) – přímo z těla */}
          <line fill="none" stroke="#ad0404" strokeLinecap="round" strokeLinejoin="round" strokeWidth="8" x1="45.5" y1="51.1703" x2="-15.9959" y2="51.1703"/>
          <line fill="none" stroke="#ad0404" strokeLinecap="round" strokeLinejoin="round" strokeWidth="8" x1="153.0041" y1="51.1703" x2="91.5" y2="51.1703"/>
          {/* Přívod base – dolů ze středu */}
          <line fill="none" stroke="#ad0404" strokeLinecap="round" strokeLinejoin="round" strokeWidth="6" x1="68.5" y1="90" x2="68.5" y2="140"/>
          {/* Tělo tranzistoru – plochý tmavý obdélník */}
          <rect fill="#1e1e1e" x="30" y="26" width="77" height="46" rx="8" ry="8"/>
          {/* Světlý odlesk nahoře */}
          <rect fill="#ffffff" opacity="0.10" x="34" y="28" width="69" height="8" rx="4" ry="4"/>
          {/* Nožička base */}
          <line stroke="#9ca3af" strokeWidth="5" strokeLinecap="round" x1="68.5" y1="72" x2="68.5" y2="88"/>
          <circle fill="#6b7280" cx="68.5" cy="72" r="4"/>
          {/* NPN nápis na těle */}
          <text x="68.5" y="55" textAnchor="middle" fontSize="16" fontFamily="'Fenomen Sans', sans-serif" fontWeight="bold" fill="#fff">NPN</text>
          {/* Popisek vývodu B */}
          <text x="80" y="118" textAnchor="start" fontSize="11" fontFamily="'Fenomen Sans', sans-serif" fontWeight="bold" fill="#7c3aed">B</text>
          {/* Popisky C/E u drátů */}
          <text x="-8" y="46" textAnchor="middle" fontSize="12" fontFamily="'Fenomen Sans', sans-serif" fontWeight="bold" fill="#7c3aed">C</text>
          <text x="145" y="46" textAnchor="middle" fontSize="12" fontFamily="'Fenomen Sans', sans-serif" fontWeight="bold" fill="#7c3aed">E</text>
        </>
      );
    }

    /* ══ ŽÁROVKY (slabá / střední / silná) ══
     *  Sdílená vizuální logika, pouze barvy základny se liší:
     *    bulb  (slabá,  4,5 V) – šedá základna
     *    bulb2 (střední, 9 V) – modrá základna
     *    bulb3 (silná,  12 V) – červená základna              */
    case 'bulb':
    case 'bulb2':
    case 'bulb3': {
      const bs: BulbState = bulbState ?? 'off';
      const isBroken = bs === 'broken';
      const isLit = bs === 'dim' || bs === 'on' || bs === 'bright';

      // Size scale: slabá=smallest, střední=medium, silná=largest (current size)
      const bulbScale = type === 'bulb' ? 0.7 : type === 'bulb2' ? 0.85 : 1;
      // Scale around the lead connection point so wires stay aligned
      const bsCx = 68;
      const bsCy = 84.13;

      // Per-type base colors (patice)
      const baseDark  = type === 'bulb3' ? '#7c2d12' : type === 'bulb2' ? '#1e4070' : '#575756';
      const baseMid   = type === 'bulb3' ? '#c07050' : type === 'bulb2' ? '#6090c0' : '#b2b2b2';
      const baseShadow= type === 'bulb3' ? '#b06048' : type === 'bulb2' ? '#4878a8' : '#cccccc';
      // Per-type glow tint
      const glowR = type === 'bulb3' ? '255,220,120' : type === 'bulb2' ? '253,230,80' : '253,213,0';

      // Barvy skla dle intenzity
      const glassColor =
        isBroken ? '#b8b0a0' :
        bs === 'off'    ? '#e0dfd0' :
        bs === 'dim'    ? '#fde8a0' :
        bs === 'on'     ? '#f6cf34' : '#fff176';
      const glassStroke =
        isBroken ? '#8a8070' :
        bs === 'off'    ? '#b0a878' :
        bs === 'dim'    ? '#d4aa50' :
        bs === 'on'     ? '#f6af34' : '#ffd700';
      const glowRadius  = bs === 'dim' ? 44 : bs === 'on' ? 56 : 72;
      const glowOpacity = bs === 'dim' ? 0.10 : bs === 'on' ? 0.20 : bs === 'bright' ? 0.35 : 0;
      const filColor = isLit && !isBroken ? '#ffcc44' : '#878787';

      return (
        <>
          {/* Modrý ledge (stín) */}
          <g transform={ledgeT}>
            <path fill="#59a2ff" d="M-1.2212,18.0239h139.4502c8.4304,0,15.2749,6.8445,15.2749,15.2749v139.4512c0,8.4302-6.8442,15.2744-15.2744,15.2744H-1.2207c-8.4307,0-15.2754-6.8447-15.2754-15.2754V33.2988c0-8.4304,6.8445-15.2749,15.2749-15.2749Z"/>
            <path fill="#216de8" d="M138.2294,19.524c7.5954,0,13.7747,6.1793,13.7747,13.7747v139.4505c0,7.5954-6.1793,13.7747-13.7747,13.7747H-1.2212c-7.5954,0-13.7747-6.1793-13.7747-13.7747V33.2987c0-7.5954,6.1793-13.7747,13.7747-13.7747h139.4506M138.2294,16.524H-1.2212c-9.2644,0-16.7747,7.5103-16.7747,16.7747v139.4505c0,9.2644,7.5103,16.7747,16.7747,16.7747h139.4506c9.2644,0,16.7747-7.5103,16.7747-16.7747V33.2987c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"/>
          </g>
          {/* Bílá karta */}
          <rect fill="#fff" x="-16.4961" y="3.0239" width="170" height="170.0005" rx="15.2749" ry="15.2749"/>
          <path fill="#216de8" d="M138.2294,4.524c7.5954,0,13.7747,6.1793,13.7747,13.7747v139.4505c0,7.5954-6.1793,13.7747-13.7747,13.7747H-1.2212c-7.5954,0-13.7747-6.1793-13.7747-13.7747V18.2987c0-7.5954,6.1793-13.7747,13.7747-13.7747h139.4506M138.2294,1.524H-1.2212c-9.2644,0-16.7747,7.5103-16.7747,16.7747v139.4505c0,9.2644,7.5103,16.7747,16.7747,16.7747h139.4506c9.2644,0,16.7747-7.5103,16.7747-16.7747V18.2987c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"/>
          {/* Přívody */}
          <line fill="none" stroke="#ad0404" strokeLinecap="round" strokeLinejoin="round" strokeWidth="8" x1="41.0041" y1="84.1296" x2="-15.9959" y2="84.1296"/>
          <line fill="none" stroke="#ad0404" strokeLinecap="round" strokeLinejoin="round" strokeWidth="8" x1="153.0041" y1="84.1296" x2="92.0041" y2="84.1296"/>
          {/* Scaled bulb body group */}
          <g transform={`translate(${bsCx},${bsCy}) scale(${bulbScale}) translate(${-bsCx},${-bsCy})`}>
          {/* Stín základny */}
          <ellipse fill={baseShadow} cx="67.8572" cy="96.9015" rx="31.8531" ry="14.3401"/>
          {/* ═══ Záře ═══ */}
          {isLit && !isBroken && (
            <>
              <ellipse cx="67.8572" cy="10" rx={glowRadius + 14} ry={glowRadius + 14}
                fill={`rgba(${glowR},0)`} style={{ filter: 'blur(18px)' }} opacity={glowOpacity * 0.6}/>
              <ellipse cx="67.8572" cy="10" rx={glowRadius} ry={glowRadius}
                fill={`rgba(${glowR},${glowOpacity})`}/>
              {bs === 'bright' && (
                <ellipse cx="67.8572" cy="0" rx="30" ry="30" fill="rgba(255,255,200,0.22)"/>
              )}
            </>
          )}
          {/* Skleněné tělo */}
          <path fill={glassColor} stroke={glassStroke} strokeWidth="7.7574" strokeLinecap="round" strokeLinejoin="round"
            d="M117.4356-11.0902c0-27.2971-22.1284-49.4258-49.4255-49.4258S18.5841-38.3874,18.5841-11.0902c0,.8614.0231,1.7177.0665,2.568,1.3634,30.0455,26.285,43.8227,26.285,70.9505h46.1486c0-27.1278,24.9216-40.905,26.2854-70.9505.0434-.8503.066-1.7066.066-2.568Z"/>
          {/* Světlý vnitřek patice */}
          <path fill={baseMid}
            d="M97.0796,47.9783c-1.2383,4.3038-13.015,8.5387-29.0695,8.5387s-27.1618-4.227-29.07-8.5387l4.3581,47.6594h0c0,4.9631,11.0641,8.9859,24.7119,8.9859s24.7109-4.0228,24.7109-8.9859v-.0011l4.3587-47.6584Z"/>
          {/* Odlesk */}
          <path fill="none" stroke="#fff" strokeLinecap="round" strokeMiterlimit="10"
            opacity={isBroken ? 0.15 : 0.8} strokeWidth="22.2839"
            d="M35.1811-10.4018c0-19.5577,15.8549-35.4126,35.4124-35.4126"/>
          {/* Horní elipsa patice */}
          <ellipse fill={baseMid} cx="68.0482" cy="96.0817" rx="23.5676" ry="7.9899"/>
          {/* Elipsa hrdla – barví se dle stavu */}
          <ellipse fill={isLit && !isBroken ? '#f6af34' : isBroken ? '#7a7060' : '#aaa890'} cx="68.0482" cy="46.6063" rx="29.2334" ry="9.9107"/>
          {/* Obrys skleněného těla */}
          <path fill="none" stroke={glassStroke} strokeWidth="7.7574" strokeLinecap="round" strokeLinejoin="round"
            d="M117.4356-11.0902c0-27.2971-22.1284-49.4258-49.4255-49.4258S18.5841-38.3874,18.5841-11.0902c0,.8614.0231,1.7177.0665,2.568,1.3634,30.0455,26.285,43.8227,26.285,70.9505h46.1486c0-27.1278,24.9216-40.905,26.2854-70.9505.0434-.8503.066-1.7066.066-2.568Z"/>
          {/* Tmavá patice */}
          <path fill={baseDark}
            d="M97.0796,47.9783c-1.2383,4.3038-13.015,8.5387-29.0695,8.5387s-27.1618-4.227-29.07-8.5387l4.3581,47.6594h0c0,4.9631,11.0641,8.9859,24.7119,8.9859s24.7109-4.0228,24.7109-8.9859v-.0011l4.3587-47.6584Z"/>

          {/* ═══ Vlákno – normální ═══ */}
          {!isBroken && (
            <>
              <polyline fill="none" stroke={filColor} strokeLinecap="round" strokeMiterlimit="10" strokeWidth="1.9394"
                points="76.0516 45.776 75.057 14.6831 85.3768 -22.0358"/>
              <polyline fill="none" stroke={filColor} strokeLinecap="round" strokeMiterlimit="10" strokeWidth="1.9394"
                points="61.5571 45.776 62.5518 14.6831 52.2319 -22.0358"/>
              <path fill="none" stroke={isLit ? '#fff' : '#aaa'} strokeLinecap="round" strokeMiterlimit="10" strokeWidth="1.9394"
                d="M72.1683,8.3695c3.3068,1.2049,5.7068,4.3173,5.8443,8.031l1.088,29.3755"/>
              <path fill="none" stroke={isLit ? '#fff' : '#aaa'} strokeLinecap="round" strokeMiterlimit="10" strokeWidth="1.9394"
                d="M58.8249,45.776l1.4132-29.4723c.1792-3.7365,2.6455-6.8433,6.006-7.9926"/>
              <path fill="none" stroke={isLit ? '#fff' : '#aaa'} strokeLinecap="round" strokeMiterlimit="10" strokeWidth="1.9394"
                d="M66.2442,9.3622V-7.6823c0-1.6359,1.3261-2.962,2.962-2.962h0c1.6359,0,2.962,1.3261,2.962,2.962V9.3622"/>
              <line fill="none" stroke={isLit ? '#fff' : '#aaa'} opacity="0.6" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="3.8787"
                x1="68.5518" y1="9.3622" x2="68.5518" y2="-7.382"/>
              <line fill="none" stroke={isLit ? '#fff' : '#aaa'} opacity="0.6" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="7.7574"
                x1="62.3777" y1="43.6397" x2="63.7029" y2="16.1559"/>
              <path fill="none" stroke={isLit ? '#fff' : '#aaa'} strokeLinecap="round" strokeMiterlimit="10" strokeWidth="1.9394"
                d="M52.2319-23.2003s8.9056,2.6898,14.0123.6725c0,0,7.2735,3.4497,12.2049.492,0,0,3.2007,1.9836,6.7749.5436"/>
              <line fill="none" stroke={isLit ? '#fff' : '#aaa'} strokeLinecap="round" strokeMiterlimit="10" strokeWidth="1.9394"
                x1="67.0871" y1="-9.7483" x2="66.2442" y2="-22.5278"/>
              <line fill="none" stroke={isLit ? '#fff' : '#aaa'} strokeLinecap="round" strokeMiterlimit="10" strokeWidth="1.9394"
                x1="71.5912" y1="-9.4335" x2="78.4491" y2="-22.0358"/>
            </>
          )}

          {/* ═══ Vlákno ROZBITÁ ═══ */}
          {isBroken && (
            <>
              {/* Saze / spálenina uvnitř baňky */}
              <ellipse cx="68" cy="5" rx="38" ry="36" fill="rgba(60,40,20,0.18)"/>
              <ellipse cx="68" cy="15" rx="28" ry="22" fill="rgba(80,50,20,0.12)"/>
              {/* Oranžový záblesk v místě přerušení */}
              <ellipse cx="68" cy="13" rx="18" ry="16" fill="rgba(255,120,30,0.22)" style={{ filter: 'blur(6px)' }}/>
              <ellipse cx="68" cy="13" rx="10" ry="9" fill="rgba(255,80,20,0.18)" style={{ filter: 'blur(3px)' }}/>
              {/* Zbytky vláken – dolní pahýly */}
              <polyline fill="none" stroke="#666" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="2.2"
                points="61.5571 45.776 62.5518 28"/>
              <polyline fill="none" stroke="#666" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="2.2"
                points="76.0516 45.776 75.057 28"/>
              {/* Zbytky vláken – horní pahýly */}
              <polyline fill="none" stroke="#666" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="2.2"
                points="52.2319 -22.0358 57 -5 62 -1"/>
              <polyline fill="none" stroke="#666" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="2.2"
                points="85.3768 -22.0358 81 -5 76 -1"/>
              {/* Přerušené vlákno – roztřepené konce (zvětšené, výraznější) */}
              <polyline fill="none" stroke="#dc2626" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5"
                points="62 -1 66 6 63 12 67 18 64 24 65 28"/>
              <polyline fill="none" stroke="#dc2626" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5"
                points="76 -1 72 6 75 12 71 18 74 24 73 28"/>
              {/* Jiskřící žhavé body */}
              <circle cx="65" cy="6" r="3" fill="rgba(255,160,40,0.55)"/>
              <circle cx="73" cy="6" r="3" fill="rgba(255,160,40,0.55)"/>
              <circle cx="68" cy="13" r="4" fill="rgba(255,80,20,0.4)"/>
              <circle cx="66" cy="20" r="2.5" fill="rgba(255,120,30,0.35)"/>
              <circle cx="72" cy="20" r="2.5" fill="rgba(255,120,30,0.35)"/>
              {/* Velký křížek – přerušení */}
              <line x1="60" y1="5" x2="76" y2="21" stroke="#dc2626" strokeWidth="3.5" strokeLinecap="round" opacity="0.7"/>
              <line x1="76" y1="5" x2="60" y2="21" stroke="#dc2626" strokeWidth="3.5" strokeLinecap="round" opacity="0.7"/>
              {/* Praskliny na skle */}
              <path fill="none" stroke="rgba(100,80,60,0.5)" strokeWidth="1.8" strokeLinecap="round"
                d="M48,-30 l8,16 -3,12 6,8"/>
              <path fill="none" stroke="rgba(100,80,60,0.5)" strokeWidth="1.8" strokeLinecap="round"
                d="M90,-25 l-6,14 4,10 -5,9"/>
              <path fill="none" stroke="rgba(100,80,60,0.4)" strokeWidth="1.4" strokeLinecap="round"
                d="M40,-10 l12,8 -2,14"/>
              <path fill="none" stroke="rgba(100,80,60,0.4)" strokeWidth="1.4" strokeLinecap="round"
                d="M96,-8 l-10,10 3,12"/>
              {/* Kouřové stopy nad baňkou */}
              <path fill="none" stroke="rgba(80,80,80,0.25)" strokeWidth="2.5" strokeLinecap="round"
                d="M60,-48 c-2,-8 3,-14 -1,-22"/>
              <path fill="none" stroke="rgba(80,80,80,0.2)" strokeWidth="2" strokeLinecap="round"
                d="M68,-50 c2,-7 -2,-12 1,-20"/>
              <path fill="none" stroke="rgba(80,80,80,0.2)" strokeWidth="2" strokeLinecap="round"
                d="M76,-47 c3,-6 -1,-13 2,-19"/>
            </>
          )}

          {/* Stín */}
          <line fill="none" stroke="#000" opacity="0.5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="12.2663"
            x1="85.6229" y1="63.8562" x2="83.3669" y2="93.5064"/>
          </g>{/* end scaled bulb body */}

          {/* ═══ Popisek (nom. napětí) / štítek stavu ═══ */}
          {!isBroken && showBulbNominal ? (
            <text fill="#6b7280" textAnchor="middle" x="68" y="150">
              <tspan fontFamily="'Fenomen Sans', Arial, sans-serif" fontSize="36" fontWeight="500">
                {type === 'bulb' ? '4,5' : type === 'bulb2' ? '9' : '12'}{' '}
              </tspan>
              <tspan fontFamily="'Fenomen Sans', Arial, sans-serif" fontSize="32" fontWeight="700">
                V
              </tspan>
            </text>
          ) : (
            bs !== 'off' && !isBroken && (
              <text
                x="68"
                y="145"
                textAnchor="middle"
                fill={bs === 'dim' ? '#d4aa50' : bs === 'bright' ? '#f59e0b' : '#216de8'}
                fontSize="18"
                fontFamily="'Fenomen Sans', Arial, sans-serif"
                fontWeight="700"
                opacity="0.75"
              >
                {bs === 'dim' ? '○' : bs === 'on' ? '◑' : '●'}
              </text>
            )
          )}
          {/* ═══ Štítek ROZBITÁ – velký a výrazný ═══ */}
          {isBroken && (
            <>
              <circle cx="68" cy="140" r="14" fill="rgba(220,38,38,0.15)" stroke="#dc2626" strokeWidth="2"/>
              <text x="68" y="147" textAnchor="middle"
                fill="#dc2626" fontSize="24" fontFamily="'Fenomen Sans', Arial, sans-serif" fontWeight="900"
              >✕</text>
            </>
          )}
        </>
      );
    }

    /* ══ BATERIE 4.5 V ��═ */
    case 'battery':
      return (
        <>
          {/* Modrý ledge (stín) */}
          <g transform={ledgeT}>
            <rect fill="#59a2ff" x="-49.1431" y="-15.5356" width="170.0005" height="170.0005" rx="15.2749" ry="15.2749"/>
            <path fill="#216de8" d="M105.5823-14.0356c7.5954,0,13.7747,6.1793,13.7747,13.7747v139.4505c0,7.5954-6.1793,13.7747-13.7747,13.7747H-33.8682c-7.5954,0-13.7747-6.1793-13.7747-13.7747V-.2608c0-7.5954,6.1793-13.7747,13.7747-13.7747H105.5823M105.5823-17.0356H-33.8682c-9.2644,0-16.7747,7.5103-16.7747,16.7747v139.4505c0,9.2644,7.5103,16.7747,16.7747,16.7747H105.5823c9.2644,0,16.7747-7.5103,16.7747-16.7747V-.2608c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"/>
          </g>
          {/* Bílá karta */}
          <rect fill="#fff" x="-49.1431" y="-30.5356" width="170.0005" height="170.0005" rx="15.2749" ry="15.2749"/>
          <path fill="#216de8" d="M105.5823-29.0356c7.5954,0,13.7747,6.1793,13.7747,13.7747V124.1897c0,7.5954-6.1793,13.7747-13.7747,13.7747H-33.8682c-7.5954,0-13.7747-6.1793-13.7747-13.7747V-15.2608c0-7.5954,6.1793-13.7747,13.7747-13.7747H105.5823M105.5823-32.0356H-33.8682c-9.2644,0-16.7747,7.5103-16.7747,16.7747V124.1897c0,9.2644,7.5103,16.7747,16.7747,16.7747H105.5823c9.2644,0,16.7747-7.5103,16.7747-16.7747V-15.2608c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"/>
          {/* Přívody – křivky od vnějšího terminálu k posunutému tělu */}
          <path fill="none" stroke="#ad0404" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" d="M120.357,50.5701c-33,0,-23,-87.6057,-51,-101.6057"/>
          <path fill="none" stroke="#ad0404" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" d="M.357,-24.0356C-15.643,31.9644-48.643,50.5701-48.643,50.5701"/>
          {/* ── Tělo baterie posunuto o -24 nahoru ── */}
          <g transform="translate(0,-24)">
            {/* Šedý stín základny */}
            <path fill="#ccc" d="M-24.8657,114.2794l15.1763,5.6209c15.5907,5.7743,32.7188,5.8626,48.3682.2492l57.0785-20.4738c7.9885-2.8654,7.709-14.258-.4103-16.7283l-38.6087-11.7467-81.3089,26.8041c-7.7474,2.554-7.9448,13.4414-.2951,16.2746Z"/>
            {/* Tělo baterie – žlutá vrstva (st0) */}
            <path fill="#fd0" stroke="#fd0" strokeWidth="3.3493" strokeLinecap="round" strokeLinejoin="round"
              d="M-19.8198,12.7605l.1063,91.9589h0c.3582,1.9269,1.6511,3.6926,3.8844,4.4471l5.4184,1.8304c12.8604,4.3445,26.7969,4.3122,39.637-.0923l61.6969-21.1631c2.3226-.7966,3.7275-2.5705,4.2255-4.5526l.2084-.0354V-8.2841L-19.8198,12.7605Z"/>
            {/* Šedá vrstva (st2) */}
            <path fill="#575756" stroke="#575756" strokeWidth="3.3493" strokeLinecap="round" strokeLinejoin="round"
              d="M-19.8198,13.1745v26.7861l.1063-.0181c.3582,1.9269,1.6511,3.6926,3.8844,4.4471l5.4184,1.8304c12.8604,4.3445,26.7969,4.3122,39.637-.0923l61.6969-21.1631c2.3226-.7966,3.7275-2.5705,4.2255-4.5526l.2084-.0354V-7.8702L-19.8198,13.1745Z"/>
            {/* Horní pásek – oranžový (st4) */}
            <path fill="#f6af34" stroke="#fd0" strokeWidth="3.3493" strokeLinecap="round" strokeLinejoin="round"
              d="M48.7216-7.2003c12.2246-4.1932,25.4931-4.2241,37.7372-.0878l4.4366,1.4987c1.1969.4044,2.1488,1.0709,2.8644,1.8899,2.8429-3.2519,1.8859-8.9422-2.8644-10.5468l-4.4366-1.4989c-12.2441-4.1364-25.5126-4.1054-37.7372.0878L-15.8538,6.2931c-4.4625,1.5306-5.1541,7.0907-2.0922,9.8797.5682-.5171,1.2654-.9391,2.0922-1.2227L48.7216-7.2003Z"/>
            {/* Horní pásek – lososový (st9) */}
            <path fill="#ff8158" stroke="#f03b50" strokeWidth="3.3493" strokeLinecap="round" strokeLinejoin="round"
              d="M-10.4096,19.2355c12.8605,4.3445,26.7969,4.3122,39.6371-.0923L90.9243-2.0198c1.1836-.406,2.126-1.0681,2.8355-1.8796-.7156-.8189-1.6676-1.4855-2.8644-1.8899l-4.4366-1.4987c-12.2441-4.1364-25.5126-4.1054-37.7372.0878L-15.8538,14.9501c-.8268.2836-1.5241.7057-2.0922,1.2227.5743.5231,1.2798.9491,2.1181,1.2323l5.4183,1.8304Z"/>
            {/* Elipsa – lem pláště (st7 fd0) */}
            <path fill="none" stroke="#fd0" strokeWidth="3.3493" strokeLinecap="round" strokeLinejoin="round"
              d="M-15.8292,17.405l5.4184,1.8305c12.8605,4.3446,26.797,4.3121,39.6371-.0922L90.9231-2.0197c5.9264-2.0328,5.9069-10.4213-.0289-12.4266l-4.4366-1.4988c-12.244-4.1363-25.5126-4.1054-37.7372.0878L-15.855,6.2931c-5.2994,1.8178-5.282,9.3188.0259,11.1119Z"/>
            {/* Odlesk (st8 f6f6f6 op.7) */}
            <line fill="none" opacity="0.7" stroke="#f6f6f6" strokeWidth="15.072" strokeLinecap="round" strokeLinejoin="round"
              x1="-10.2219" y1="30.3949" x2="-10.2219" y2="100.3653"/>
            {/* Červený blesk (st5) */}
            <polygon fill="#f03b50" stroke="#f03b50" strokeWidth="3.3493" strokeLinecap="round" strokeLinejoin="round"
              points=".2851 14.5593 9.8375 17.7863 15.8684 -23.6907 6.3952 -26.3472 .2851 14.5593"/>
            <polygon fill="#f03b50" stroke="#f03b50" strokeWidth="3.3493" strokeLinecap="round" strokeLinejoin="round"
              points="61.7282 -4.4268 71.2807 -1.1997 63.5377 -40.5212 54.0645 -43.1777 61.7282 -4.4268"/>
            {/* Přívod lososový detail (st10) */}
            <path fill="none" stroke="#ff8158" strokeWidth="4.3073" strokeLinecap="round" strokeMiterlimit="10"
              d="M52.2257-31.9013c-.4552.8379,5.5815,3.5792,14.2654,3.1911"/>
            {/* Přívod detail vlevo (st10) */}
            <path fill="none" stroke="#ff8158" strokeWidth="4.3073" strokeLinecap="round" strokeMiterlimit="10"
              d="M2.0992-1.1997s7.2805-1.0791,13.7692-8.4575"/>
            <path fill="none" stroke="#ff8158" strokeWidth="4.3073" strokeLinecap="round" strokeMiterlimit="10"
              d="M-.643-3.0356s-2.5157-6.4414,2.7421-10.2207"/>
          </g>
          {/* Popisek napětí */}
          <text fill="#216de8" textAnchor="middle" x="35.857" y="128">
            <tspan fontFamily="'Fenomen Sans', Arial, sans-serif" fontSize="36" fontWeight="500">{voltage !== undefined ? formatVoltage(voltage) : '4,5'} </tspan>
            <tspan fontFamily="'Fenomen Sans', Arial, sans-serif" fontSize="32" fontWeight="700">V</tspan>
          </text>
        </>
      );

    /* ══ BATERIE 9 V ══ */
    case 'battery2':
      return (
        <>
          {/* Modrý ledge (stín) */}
          <g transform={ledgeT}>
            <path fill="#59a2ff" d="M-8.7212-14.7598h139.4502c8.4304,0,15.2749,6.8445,15.2749,15.2749v139.4507c0,8.4302-6.8442,15.2744-15.2744,15.2744H-8.7217c-8.4302,0-15.2744-6.8442-15.2744-15.2744V.5151c0-8.4304,6.8445-15.2749,15.2749-15.2749Z"/>
            <path fill="#216de8" d="M130.7294-13.2596c7.5954,0,13.7747,6.1793,13.7747,13.7747v139.4505c0,7.5954-6.1793,13.7747-13.7747,13.7747H-8.7212c-7.5954,0-13.7747-6.1793-13.7747-13.7747V.5151c0-7.5954,6.1793-13.7747,13.7747-13.7747h139.4505M130.7294-16.2596H-8.7212c-9.2644,0-16.7747,7.5103-16.7747,16.7747v139.4505c0,9.2644,7.5103,16.7747,16.7747,16.7747h139.4505c9.2645,0,16.7747-7.5103,16.7747-16.7747V.5151c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"/>
          </g>
          {/* Bílá karta */}
          <path fill="#fff" d="M-8.7212-29.7598h139.4502c8.4304,0,15.2749,6.8445,15.2749,15.2749V124.9658c0,8.4302-6.8442,15.2744-15.2744,15.2744H-8.7217c-8.4302,0-15.2744-6.8442-15.2744-15.2744V-14.4849c0-8.4304,6.8445-15.2749,15.2749-15.2749Z"/>
          <path fill="#216de8" d="M130.7294-28.2596c7.5954,0,13.7747,6.1793,13.7747,13.7747V124.9656c0,7.5954-6.1793,13.7747-13.7747,13.7747H-8.7212c-7.5954,0-13.7747-6.1793-13.7747-13.7747V-14.4849c0-7.5954,6.1793-13.7747,13.7747-13.7747h139.4505M130.7294-31.2596H-8.7212c-9.2644,0-16.7747,7.5103-16.7747,16.7747V124.9656c0,9.2644,7.5103,16.7747,16.7747,16.7747h139.4505c9.2645,0,16.7747-7.5103,16.7747-16.7747V-14.4849c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"/>
          {/* Přívody – křivky od vnějšího terminálu k posunutému tělu */}
          <path fill="none" stroke="#ad0404" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" d="M145.5041,51.346c-19,0,-18,-65,-38,-64.6057"/>
          <path fill="none" stroke="#ad0404" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" d="M44.5041,3.7404C11.0041,37.2404-23.4959,51.346-23.4959,51.346"/>
          {/* ── Tělo baterie posunuto o -18 nahoru ── */}
          <g transform="translate(0,-18)">
            {/* Šedý stín základny */}
            <path fill="#ccc" d="M-16.1624,100.6891l49.4176,19.1176c8.6023,3.186,18.0528,3.2347,26.6875.1375l79.4715-28.1474c4.6291-1.6604,4.4671-8.262-.2378-9.6935l-64.3135-21.0036L-15.9876,91.0492c-4.589,1.5128-4.7059,7.9617-.1748,9.6398Z"/>
            {/* Spodní lem (st0) */}
            <path fill="#3c3c3b" d="M130.1092,76.7973c.0474,2.3935-1.2832,4.8144-4.0215,5.7569l-56.5976,19.4806c-10.9783,3.7787-22.8859,3.8956-33.9363.3331l-42.9076-14.6482c-2.7295-.88-4.1115-3.2439-4.1335-5.6204v8.0767c.022,2.3765,1.4039,4.7405,4.1335,5.6204l42.9076,14.6482c11.0504,3.5625,22.958,3.4456,33.9363-.3331l56.5976-19.4806c2.7383-.9425,4.0689-3.3633,4.0215-5.7569v-8.0767Z"/>
            {/* Tmavý pásek (st11) */}
            <path fill="#575756" d="M-7.4489,76.4286l56.8288-19.3799c10.5933-3.6126,22.051-3.8231,32.7698-.602l43.7133,14.7866c5.5469,1.6669,5.7013,9.4651.2246,11.3501l-56.5976,19.4806c-10.9783,3.7787-22.8859,3.8956-33.9363.3331l-42.9076-14.6482c-5.4632-1.7612-5.5279-9.4675-.095-11.3202Z"/>
            {/* Střední pásek (st0) */}
            <path fill="#3c3c3b" d="M-3.9692,73.1688l53.8178-18.3531c10.032-3.4212,20.8826-3.6205,31.0336-.5701l41.3972,14.0031c5.253,1.5785,5.3992,8.9636.2127,10.7488l-53.5988,18.4485c-10.3966,3.5785-21.6733,3.6892-32.1382.3154L-3.8792,83.8893c-5.1737-1.6679-5.235-8.9659-.09-10.7205Z"/>
            {/* Tělo baterie �� hlavní tmavá plocha (st0 polyline) */}
            <polyline fill="#3c3c3b" stroke="#3c3c3b" strokeWidth="8.6294" strokeLinecap="round" strokeLinejoin="round"
              points="-7.7939 78.436 -7.7939 15.9689 126.268 10.0572 126.268 74.166 -7.7939 79.9093"/>
            {/* Odlesk (st2) */}
            <line fill="none" opacity="0.25" stroke="#f6f6f6" strokeWidth="17.2587" strokeLinecap="round" strokeLinejoin="round"
              x1="53.1383" y1="48.8557" x2="53.1383" y2="90.1241"/>
            {/* Horní lem (st16) */}
            <path fill="#216de8" d="M126.3005,5.3019c.0449,2.2667-1.2152,4.5593-3.8084,5.4519l-53.5988,18.4485c-10.3966,3.5785-21.6733,3.6892-32.1382.3154L-3.8792,15.6456c-2.5849-.8333-3.8936-3.0721-3.9145-5.3226v7.6488c.0208,2.2506,1.3296,4.4893,3.9145,5.3226l40.6342,13.8721c10.4649,3.3737,21.7416,3.263,32.1382-.3154l53.5988-18.4485c2.5932-.8926,3.8533-3.1851,3.8084-5.4519v-7.6488Z"/>
            {/* Horní plocha (st14) */}
            <path fill="#59a2ff" d="M-3.9692,4.9528L49.8486-13.4003c10.032-3.4212,20.8826-3.6205,31.0336-.5701L122.2793.0327c5.253,1.5785,5.3992,8.9636.2127,10.7488l-53.5988,18.4485c-10.3966,3.5785-21.6733,3.6892-32.1382.3154L-3.8792,15.6733c-5.1737-1.6679-5.235-8.9659-.09-10.7205Z"/>
            {/* Pruhy (st7) */}
            <path fill="none" stroke="#216de8" strokeWidth="8.6294" strokeLinecap="round" strokeLinejoin="round"
              d="M35.3498,17.9388l-21.6188-7.3801c-1.3306-.4542-1.3303-2.3361.0004-2.7899L52.6624-5.5079c3.8939-1.3276,7.9544-2.0008,12.0687-2.0008,3.6153,0,7.2044.5224,10.669,1.5542l11.5418,3.9043"/>
            <line fill="none" stroke="#216de8" strokeWidth="8.6294" strokeLinecap="round" strokeLinejoin="round" x1="81.0315" y1=".0102" x2="90.0603" y2="-3.0689"/>
            <line fill="none" stroke="#216de8" strokeWidth="8.6294" strokeLinecap="round" strokeLinejoin="round" x1="29.9797" y1="19.7701" x2="39.0085" y2="16.6911"/>
            {/* Blesk (st15) */}
            <polygon fill="#fd0" points="104.5042 46.9206 95.1648 50.6231 102.4385 31.9971 92.0627 36.1108 83.7833 62.1681 90.6671 59.4392 82.6138 84.8681 104.5042 46.9206"/>
            {/* Oblouk krytu (st1) */}
            <path fill="none" stroke="#ccc" strokeWidth="8.6294" strokeLinecap="round" strokeLinejoin="round"
              d="M35.2415,22.5128V-4.7113c0-4.4249,2.8103-8.3614,6.9953-9.7986l36.2066-12.4336c4.1643-1.4301,8.4985,1.6642,8.4985,6.0672V1.408"/>
            {/* Modré trojúhelníky (st14) */}
            <polygon fill="#59a2ff" points="27.6454 24.1758 44.221 18.4612 43.2765 27.9209 30.4866 27.1198 27.6454 24.1758"/>
            <polygon fill="#59a2ff" points="79.0772 4.2526 97.0328 -1.8583 97.0328 6.8709 80.0441 11.0979 79.0772 4.2526"/>
            {/* Detail (st6) */}
            <path fill="none" stroke="#813b50" strokeWidth="8.6294" strokeLinecap="round" strokeLinejoin="round"
              d="M58.9433,16.7925c-8.5447-.5827-12.4758.1779-17.0894,3.6315l-31.809,5.8857"/>
            <path fill="none" stroke="#fd0" strokeWidth="5.7529" strokeLinecap="round" strokeLinejoin="round"
              d="M59.3116,16.1296c-7.6012-.5184-9.9002-.8249-14.0043,2.2473"/>
            {/* ��edý článek (st11 + st0 outline) */}
            <ellipse fill="#575756" cx="53.1383" cy="25.6664" rx="9.5027" ry="3.2216"/>
            <path fill="none" stroke="#3c3c3b" strokeWidth="8.6294" strokeLinecap="round" strokeLinejoin="round"
              d="M60.2843,24.8674c0,1.338-3.1994,2.4226-7.146,2.4226s-7.146-1.0847-7.146-2.4226v-12.1782c0-1.338,3.1994-2.4226,7.146-2.4226s7.146,1.0847,7.146,2.4226v12.1782Z"/>
            <ellipse fill="#575756" cx="53.1383" cy="12.6893" rx="7.146" ry="2.4226"/>
            <path fill="none" stroke="#fd0" strokeWidth="5.7529" strokeLinecap="round" strokeLinejoin="round"
              d="M60.7625,17.9456c-4.8066,3.0939-11.9336,1.9623-15.4553,1.6451"/>
            {/* Červený článek detail (st6 línky) */}
            <line fill="none" stroke="#813b50" strokeWidth="8.6294" strokeLinecap="round" strokeLinejoin="round" x1="137.0041" y1="-15.7596" x2="116.9456" y2="-1.1518"/>
            <path fill="none" stroke="#813b50" strokeWidth="8.6294" strokeLinecap="round" strokeLinejoin="round"
              d="M99.2508-.3348c6.3932-2.8652,10.485-3.4225,17.6948-.817"/>
            <path fill="none" stroke="#fd0" strokeWidth="5.7529" strokeLinecap="round" strokeLinejoin="round"
              d="M99.8396-.8156c5.3479-3.1,9.5385-3.431,14.3957-1.4886"/>
            {/* Červený článek (st9 + st13) */}
            <ellipse fill="#f03b50" cx="107.2082" cy="7.045" rx="9.5027" ry="3.2216"/>
            <path fill="#813b50" d="M114.3542,6.2461c0,1.338-3.1994,2.4226-7.146,2.4226s-7.146-1.0847-7.146-2.4226V-5.9321c0-1.338,3.1994-2.4226,7.146-2.4226s7.146,1.0847,7.146,2.4226V6.2461Z"/>
            <ellipse fill="#f03b50" cx="107.2082" cy="-5.9321" rx="7.146" ry="2.4226"/>
            <path fill="none" stroke="#fd0" strokeWidth="5.7529" strokeLinecap="round" strokeLinejoin="round"
              d="M114.9295-1.079c-2.9753,2.8094-10.4415,2.6196-15.5304.6145"/>
            {/* Oranžov�� výstup (st4) */}
            <path fill="none" stroke="#ff8158" strokeWidth="8.6294" strokeLinecap="round" strokeLinejoin="round"
              d="M116.8378.4657c-4.8329,3.1394-10.8893,3.3136-17.557.8461"/>
            <line fill="none" stroke="#ff8158" strokeWidth="8.6294" strokeLinecap="round" strokeLinejoin="round" x1="116.3743" y1=".6094" x2="139.0041" y2="-1.7596"/>
            {/* Vlevo oranžový výstup (st4) */}
            <path fill="none" stroke="#ff8158" strokeWidth="8.6294" strokeLinecap="round" strokeLinejoin="round"
              d="M61.683,19.3601c-4.6136,3.4536-8.9173,2.5936-17.462,2.0109l-23.5686,15.9114"/>
          </g>
          {/* Popisek napětí */}
          <text fill="#216de8" textAnchor="middle" x="61" y="128">
            <tspan fontFamily="'Fenomen Sans', Arial, sans-serif" fontSize="36" fontWeight="500">{voltage !== undefined ? formatVoltage(voltage) : '9'} </tspan>
            <tspan fontFamily="'Fenomen Sans', Arial, sans-serif" fontSize="32" fontWeight="700">V</tspan>
          </text>
        </>
      );

    /* ══ BATERIE 12 V ══ */
    case 'battery3':
      return (
        <>
          {/* Modrý ledge (stín) */}
          <g transform={ledgeT}>
            <path fill="#59a2ff" d="M-8.7212-14.7598h139.4502c8.4304,0,15.2749,6.8445,15.2749,15.2749v139.4507c0,8.4302-6.8442,15.2744-15.2744,15.2744H-8.7217c-8.4302,0-15.2744-6.8442-15.2744-15.2744V.5151c0-8.4304,6.8445-15.2749,15.2749-15.2749Z"/>
            <path fill="#216de8" d="M130.7294-13.2596c7.5954,0,13.7747,6.1793,13.7747,13.7747v139.4505c0,7.5954-6.1793,13.7747-13.7747,13.7747H-8.7212c-7.5954,0-13.7747-6.1793-13.7747-13.7747V.5151c0-7.5954,6.1793-13.7747,13.7747-13.7747h139.4505M130.7294-16.2596H-8.7212c-9.2644,0-16.7747,7.5103-16.7747,16.7747v139.4505c0,9.2644,7.5103,16.7747,16.7747,16.7747h139.4505c9.2645,0,16.7747-7.5103,16.7747-16.7747V.5151c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"/>
          </g>
          {/* Bílá karta */}
          <path fill="#fff" d="M-8.7212-29.7598h139.4502c8.4304,0,15.2749,6.8445,15.2749,15.2749V124.9658c0,8.4302-6.8442,15.2744-15.2744,15.2744H-8.7217c-8.4302,0-15.2744-6.8442-15.2744-15.2744V-14.4849c0-8.4304,6.8445-15.2749,15.2749-15.2749Z"/>
          <path fill="#216de8" d="M130.7294-28.2596c7.5954,0,13.7747,6.1793,13.7747,13.7747V124.9656c0,7.5954-6.1793,13.7747-13.7747,13.7747H-8.7212c-7.5954,0-13.7747-6.1793-13.7747-13.7747V-14.4849c0-7.5954,6.1793-13.7747,13.7747-13.7747h139.4505M130.7294-31.2596H-8.7212c-9.2644,0-16.7747,7.5103-16.7747,16.7747V124.9656c0,9.2644,7.5103,16.7747,16.7747,16.7747h139.4505c9.2645,0,16.7747-7.5103,16.7747-16.7747V-14.4849c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"/>
          {/* Přívody */}
          <path fill="none" stroke="#ad0404" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" d="M148,52c-20,0,-18,-64,-38,-64"/>
          <path fill="none" stroke="#ad0404" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" d="M48,5C15,38,-20,52,-20,52"/>
          {/* Tělo baterie – stejný styl jako 9V */}
          <g transform="translate(0,-18)">
            {/* Šedý stín základny */}
            <path fill="#ccc" d="M-16.1624,100.6891l49.4176,19.1176c8.6023,3.186,18.0528,3.2347,26.6875.1375l79.4715-28.1474c4.6291-1.6604,4.4671-8.262-.2378-9.6935l-64.3135-21.0036L-15.9876,91.0492c-4.589,1.5128-4.7059,7.9617-.1748,9.6398Z"/>
            {/* Spodní lem */}
            <path fill="#3c3c3b" d="M130.1092,76.7973c.0474,2.3935-1.2832,4.8144-4.0215,5.7569l-56.5976,19.4806c-10.9783,3.7787-22.8859,3.8956-33.9363.3331l-42.9076-14.6482c-2.7295-.88-4.1115-3.2439-4.1335-5.6204v8.0767c.022,2.3765,1.4039,4.7405,4.1335,5.6204l42.9076,14.6482c11.0504,3.5625,22.958,3.4456,33.9363-.3331l56.5976-19.4806c2.7383-.9425,4.0689-3.3633,4.0215-5.7569v-8.0767Z"/>
            {/* Tmavý pásek */}
            <path fill="#575756" d="M-7.4489,76.4286l56.8288-19.3799c10.5933-3.6126,22.051-3.8231,32.7698-.602l43.7133,14.7866c5.5469,1.6669,5.7013,9.4651.2246,11.3501l-56.5976,19.4806c-10.9783,3.7787-22.8859,3.8956-33.9363.3331l-42.9076-14.6482c-5.4632-1.7612-5.5279-9.4675-.095-11.3202Z"/>
            {/* Střední pásek */}
            <path fill="#3c3c3b" d="M-3.9692,73.1688l53.8178-18.3531c10.032-3.4212,20.8826-3.6205,31.0336-.5701l41.3972,14.0031c5.253,1.5785,5.3992,8.9636.2127,10.7488l-53.5988,18.4485c-10.3966,3.5785-21.6733,3.6892-32.1382.3154L-3.8792,83.8893c-5.1737-1.6679-5.235-8.9659-.09-10.7205Z"/>
            {/* Tělo baterie – hlavní tmavá plocha */}
            <polyline fill="#3c3c3b" stroke="#3c3c3b" strokeWidth="8.6294" strokeLinecap="round" strokeLinejoin="round"
              points="-7.7939 78.436 -7.7939 15.9689 126.268 10.0572 126.268 74.166 -7.7939 79.9093"/>
            {/* Odlesk */}
            <line fill="none" opacity="0.25" stroke="#f6f6f6" strokeWidth="17.2587" strokeLinecap="round" strokeLinejoin="round"
              x1="53.1383" y1="48.8557" x2="53.1383" y2="90.1241"/>
            {/* Horní lem */}
            <path fill="#216de8" d="M126.3005,5.3019c.0449,2.2667-1.2152,4.5593-3.8084,5.4519l-53.5988,18.4485c-10.3966,3.5785-21.6733,3.6892-32.1382.3154L-3.8792,15.6456c-2.5849-.8333-3.8936-3.0721-3.9145-5.3226v7.6488c.0208,2.2506,1.3296,4.4893,3.9145,5.3226l40.6342,13.8721c10.4649,3.3737,21.7416,3.263,32.1382-.3154l53.5988-18.4485c2.5932-.8926,3.8533-3.1851,3.8084-5.4519v-7.6488Z"/>
            {/* Horní plocha */}
            <path fill="#59a2ff" d="M-3.9692,4.9528L49.8486-13.4003c10.032-3.4212,20.8826-3.6205,31.0336-.5701L122.2793.0327c5.253,1.5785,5.3992,8.9636.2127,10.7488l-53.5988,18.4485c-10.3966,3.5785-21.6733,3.6892-32.1382.3154L-3.8792,15.6733c-5.1737-1.6679-5.235-8.9659-.09-10.7205Z"/>
            {/* Pruhy */}
            <path fill="none" stroke="#216de8" strokeWidth="8.6294" strokeLinecap="round" strokeLinejoin="round"
              d="M35.3498,17.9388l-21.6188-7.3801c-1.3306-.4542-1.3303-2.3361.0004-2.7899L52.6624-5.5079c3.8939-1.3276,7.9544-2.0008,12.0687-2.0008,3.6153,0,7.2044.5224,10.669,1.5542l11.5418,3.9043"/>
            <line fill="none" stroke="#216de8" strokeWidth="8.6294" strokeLinecap="round" strokeLinejoin="round" x1="81.0315" y1=".0102" x2="90.0603" y2="-3.0689"/>
            <line fill="none" stroke="#216de8" strokeWidth="8.6294" strokeLinecap="round" strokeLinejoin="round" x1="29.9797" y1="19.7701" x2="39.0085" y2="16.6911"/>
            {/* Blesk */}
            <polygon fill="#fd0" points="104.5042 46.9206 95.1648 50.6231 102.4385 31.9971 92.0627 36.1108 83.7833 62.1681 90.6671 59.4392 82.6138 84.8681 104.5042 46.9206"/>
            {/* Oblouk krytu */}
            <path fill="none" stroke="#ccc" strokeWidth="8.6294" strokeLinecap="round" strokeLinejoin="round"
              d="M35.2415,22.5128V-4.7113c0-4.4249,2.8103-8.3614,6.9953-9.7986l36.2066-12.4336c4.1643-1.4301,8.4985,1.6642,8.4985,6.0672V1.408"/>
            {/* Modré trojúhelníky */}
            <polygon fill="#59a2ff" points="27.6454 24.1758 44.221 18.4612 43.2765 27.9209 30.4866 27.1198 27.6454 24.1758"/>
            <polygon fill="#59a2ff" points="79.0772 4.2526 97.0328 -1.8583 97.0328 6.8709 80.0441 11.0979 79.0772 4.2526"/>
            {/* Detail */}
            <path fill="none" stroke="#813b50" strokeWidth="8.6294" strokeLinecap="round" strokeLinejoin="round"
              d="M58.9433,16.7925c-8.5447-.5827-12.4758.1779-17.0894,3.6315l-31.809,5.8857"/>
            <path fill="none" stroke="#fd0" strokeWidth="5.7529" strokeLinecap="round" strokeLinejoin="round"
              d="M59.3116,16.1296c-7.6012-.5184-9.9002-.8249-14.0043,2.2473"/>
            {/* Šedý článek */}
            <ellipse fill="#575756" cx="53.1383" cy="25.6664" rx="9.5027" ry="3.2216"/>
            <path fill="none" stroke="#3c3c3b" strokeWidth="8.6294" strokeLinecap="round" strokeLinejoin="round"
              d="M60.2843,24.8674c0,1.338-3.1994,2.4226-7.146,2.4226s-7.146-1.0847-7.146-2.4226v-12.1782c0-1.338,3.1994-2.4226,7.146-2.4226s7.146,1.0847,7.146,2.4226v12.1782Z"/>
            <ellipse fill="#575756" cx="53.1383" cy="12.6893" rx="7.146" ry="2.4226"/>
            <path fill="none" stroke="#fd0" strokeWidth="5.7529" strokeLinecap="round" strokeLinejoin="round"
              d="M60.7625,17.9456c-4.8066,3.0939-11.9336,1.9623-15.4553,1.6451"/>
            {/* Červený článek detail */}
            <line fill="none" stroke="#813b50" strokeWidth="8.6294" strokeLinecap="round" strokeLinejoin="round" x1="137.0041" y1="-15.7596" x2="116.9456" y2="-1.1518"/>
            <path fill="none" stroke="#813b50" strokeWidth="8.6294" strokeLinecap="round" strokeLinejoin="round"
              d="M99.2508-.3348c6.3932-2.8652,10.485-3.4225,17.6948-.817"/>
            <path fill="none" stroke="#fd0" strokeWidth="5.7529" strokeLinecap="round" strokeLinejoin="round"
              d="M99.8396-.8156c5.3479-3.1,9.5385-3.431,14.3957-1.4886"/>
            {/* Červený článek */}
            <ellipse fill="#f03b50" cx="107.2082" cy="7.045" rx="9.5027" ry="3.2216"/>
            <path fill="#813b50" d="M114.3542,6.2461c0,1.338-3.1994,2.4226-7.146,2.4226s-7.146-1.0847-7.146-2.4226V-5.9321c0-1.338,3.1994-2.4226,7.146-2.4226s7.146,1.0847,7.146,2.4226V6.2461Z"/>
            <ellipse fill="#f03b50" cx="107.2082" cy="-5.9321" rx="7.146" ry="2.4226"/>
            <path fill="none" stroke="#fd0" strokeWidth="5.7529" strokeLinecap="round" strokeLinejoin="round"
              d="M114.9295-1.079c-2.9753,2.8094-10.4415,2.6196-15.5304.6145"/>
            {/* Oranžový výstup */}
            <path fill="none" stroke="#ff8158" strokeWidth="8.6294" strokeLinecap="round" strokeLinejoin="round"
              d="M116.8378.4657c-4.8329,3.1394-10.8893,3.3136-17.557.8461"/>
            <line fill="none" stroke="#ff8158" strokeWidth="8.6294" strokeLinecap="round" strokeLinejoin="round" x1="116.3743" y1=".6094" x2="139.0041" y2="-1.7596"/>
            {/* Vlevo oranžový výstup */}
            <path fill="none" stroke="#ff8158" strokeWidth="8.6294" strokeLinecap="round" strokeLinejoin="round"
              d="M61.683,19.3601c-4.6136,3.4536-8.9173,2.5936-17.462,2.0109l-23.5686,15.9114"/>
          </g>
          {/* Popisek napětí */}
          <text fill="#216de8" textAnchor="middle" x="61" y="128">
            <tspan fontFamily="'Fenomen Sans', Arial, sans-serif" fontSize="36" fontWeight="500">{voltage !== undefined ? formatVoltage(voltage) : '12'} </tspan>
            <tspan fontFamily="'Fenomen Sans', Arial, sans-serif" fontSize="32" fontWeight="700">V</tspan>
          </text>
        </>
      );

    /* ══ PŘEPÍNAČ ══ */
    case 'switch': {
      // ON: zelená karta+slider | OFF: červená karta+slider
      const swAccent  = isOn ? '#00e358' : '#f03b50';
      const swDark    = isOn ? '#008457' : '#f03b50';
      const swArrow   = isOn ? '#008457' : '#ef7b10';
      return (
        <>
          {/* Ledge (barevný stín) – counter-rotated so it always points down */}
          <g transform={ledgeT}>
            {isOn
              ? <path fill={swAccent} d="M-99.5327-76.1294H39.9175c8.4304,0,15.2749,6.8445,15.2749,15.2749V78.5967c0,8.4302-6.8442,15.2744-15.2744,15.2744H-99.5322c-8.4307,0-15.2754-6.8447-15.2754-15.2754V-60.8545c0-8.4304,6.8445-15.2749,15.2749-15.2749Z"/>
              : <rect fill={swAccent} x="-114.4819" y="-76.1294" width="169.9995" height="170.0005" rx="15.2744" ry="15.2744"/>
            }
            <path fill={swDark} d={isOn
              ? "M39.9179-74.6292c7.5954,0,13.7747,6.1793,13.7747,13.7747V78.596c0,7.5954-6.1793,13.7747-13.7747,13.7747H-99.5326c-7.5954,0-13.7747-6.1793-13.7747-13.7747V-60.8545c0-7.5954,6.1793-13.7747,13.7747-13.7747H39.9179M39.9179-77.6292H-99.5326c-9.2644,0-16.7747,7.5103-16.7747,16.7747V78.596c0,9.2644,7.5103,16.7747,16.7747,16.7747H39.9179c9.2644,0,16.7747-7.5103,16.7747-16.7747V-60.8545c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"
              : "M40.2431-74.6292c7.5954,0,13.7747,6.1793,13.7747,13.7747V78.596c0,7.5954-6.1793,13.7747-13.7747,13.7747H-99.2074c-7.5954,0-13.7747-6.1793-13.7747-13.7747V-60.8545c0-7.5954,6.1793-13.7747,13.7747-13.7747H40.2431M40.2431-77.6292H-99.2074c-9.2644,0-16.7747,7.5103-16.7747,16.7747V78.596c0,9.2644,7.5103,16.7747,16.7747,16.7747H40.2431c9.2644,0,16.7747-7.5103,16.7747-16.7747V-60.8545c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"
            }/>
          </g>

          {/* Bílá karta */}
          {isOn
            ? <path fill="#fff" d="M-99.5322-91.1294H39.9175c8.4304,0,15.2749,6.8445,15.2749,15.2749V63.5967c0,8.4302-6.8442,15.2744-15.2744,15.2744H-99.5322c-8.4307,0-15.2754-6.8447-15.2754-15.2754V-75.854c0-8.4307,6.8447-15.2754,15.2754-15.2754Z"/>
            : <rect fill="#fff" x="-114.4819" y="-91.1294" width="169.9995" height="170.0005" rx="15.2744" ry="15.2744"/>
          }
          <path fill={swDark} d={isOn
            ? "M39.9179-89.6292c7.5954,0,13.7747,6.1793,13.7747,13.7747V63.596c0,7.5954-6.1793,13.7747-13.7747,13.7747H-99.5326c-7.5954,0-13.7747-6.1793-13.7747-13.7747V-75.8545c0-7.5954,6.1793-13.7747,13.7747-13.7747H39.9179M39.9179-92.6292H-99.5326c-9.2644,0-16.7747,7.5103-16.7747,16.7747V63.596c0,9.2644,7.5103,16.7747,16.7747,16.7747H39.9179c9.2644,0,16.7747-7.5103,16.7747-16.7747V-75.8545c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"
            : "M40.2431-89.6292c7.5954,0,13.7747,6.1793,13.7747,13.7747V63.596c0,7.5954-6.1793,13.7747-13.7747,13.7747H-99.2074c-7.5954,0-13.7747-6.1793-13.7747-13.7747V-75.8545c0-7.5954,6.1793-13.7747,13.7747-13.7747H40.2431M40.2431-92.6292H-99.2074c-9.2644,0-16.7747,7.5103-16.7747,16.7747V63.596c0,9.2644,7.5103,16.7747,16.7747,16.7747H40.2431c9.2644,0,16.7747-7.5103,16.7747-16.7747V-75.8545c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"
          }/>

          {/* Šedý stín tělesa */}
          <path fill="#ccc" d={isOn
            ? "M-99.19,7.1223L-6.1115-24.5441c7.4437-2.5385,15.4948-2.6864,23.0267-.423l30.7164,10.3902c3.8977,1.1713,4.0062,6.6509.1578,7.9755L-45.1265,25.1358c-7.7142,2.6552-16.0815,2.7373-23.8463.2341l-30.1503-10.293c-3.8389-1.2376-3.8843-6.6526-.0668-7.9545Z"
            : "M-101.1443,6.7422L-8.0658-24.9242c7.4437-2.5385,15.4948-2.6864,23.0267-.423l30.7164,10.3902c3.8977,1.1713,4.0062,6.6509.1578,7.9755L-47.0808,24.7557c-7.7142,2.6552-16.0815,2.7373-23.8463.2341l-30.1503-10.293c-3.8389-1.2376-3.8843-6.6526-.0668-7.9545Z"
          }/>
          {/* Tmavé těleso */}
          <path fill="#3c3c3b" d={isOn
            ? "M-94.1096-.1801L-10.3535-28.675c6.6982-2.2842,13.9429-2.4173,20.7205-.3807l27.64,9.3496c3.5073,1.054,3.6049,5.9848.142,7.1767L-45.461,16.0292c-6.9416,2.3893-14.4708,2.4632-21.458.2106l-27.1306-9.2621c-3.4544-1.1136-3.4953-5.9863-.0601-7.1578Z"
            : "M-93.7844-.1801L-10.0283-28.675c6.6982-2.2842,13.9429-2.4173,20.7205-.3807l27.64,9.3496c3.5073,1.054,3.6049,5.9848.142,7.1767L-45.1358,16.0292c-6.9416,2.3893-14.4708,2.4632-21.458.2106l-27.1306-9.2621c-3.4544-1.1136-3.4953-5.9863-.0601-7.1578Z"
          }/>
          {/* Obrys (vyplněná polyline) */}
          <polyline fill="#3c3c3b" stroke="none"
            points={isOn
              ? "-96.6633 3.3367 -96.6633 -18.8376 40.6702 -38.2365 40.6702 -15.7552 -96.6633 3.4566"
              : "-96.3381 3.3367 -96.3381 -18.8376 40.9954 -38.2365 40.9954 -15.7552 -96.3381 3.4566"}
          />
          {/* Světlý povrch */}
          <path fill="#d9d9d9" d={isOn
            ? "M-94.1096-21.9398L-10.3535-50.4346c6.6982-2.2842,13.9429-2.4173,20.7205-.3807l27.64,9.3496c3.5073,1.054,3.6049,5.9848.142,7.1767L-45.461-5.7305c-6.9416,2.3893-14.4708,2.4632-21.458.2106l-27.1306-9.2621c-3.4544-1.1136-3.4953-5.9863-.0601-7.1578Z"
            : "M-93.7844-21.9398L-10.0283-50.4346c6.6982-2.2842,13.9429-2.4173,20.7205-.3807l27.64,9.3496c3.5073,1.054,3.6049,5.9848.142,7.1767L-45.1358-5.7305c-6.9416,2.3893-14.4708,2.4632-21.458.2106l-27.1306-9.2621c-3.4544-1.1136-3.4953-5.9863-.0601-7.1578Z"
          }/>
          {/* Otvor knoflíku */}
          <ellipse fill="none" stroke="#3c3c3b" strokeWidth="1.7167" strokeMiterlimit="10"
            cx={isOn ? 12.0695 : 12.3947} cy="-42.3001" rx="10.7506" ry="3.5539"/>
          {/* Detailní linka */}
          <path fill="none" stroke="#3c3c3b" strokeWidth="1.7167" strokeLinecap="round" strokeMiterlimit="10"
            d={isOn ? "M-69.5817-13.8688c.5331-.1777,11.9056-3.9093,11.9056-3.9093"
                    : "M-69.2565-13.8688c.5331-.1777,11.9056-3.9093,11.9056-3.9093"}/>
          {/* Tmavý oblouk */}
          <path fill="none" stroke="#1d1d1b" strokeWidth="5.1502" strokeLinecap="round" strokeMiterlimit="10"
            d={isOn ? "M-80.2949,6.9807c-1.9505-.9305-3.5317-4.2927-3.5317-7.5097s1.5812-5.0707,3.5317-4.1403"
                    : "M-79.9697,6.9807c-1.9505-.9305-3.5317-4.2927-3.5317-7.5097s1.5812-5.0707,3.5317-4.1403"}/>
          {/* Šedý oblouk */}
          <path fill="none" stroke="#575756" strokeWidth="5.1502" strokeLinecap="round" strokeMiterlimit="10"
            d={isOn ? "M-80.2949-4.6693c1.9505.9305,3.5317,4.2927,3.5317,7.5097s-1.5812,5.0707-3.5317,4.1403"
                    : "M-79.9697-4.6693c1.9505.9305,3.5317,4.2927,3.5317,7.5097s-1.5812,5.0707-3.5317,4.1403"}/>
          {/* Pouzdro slideru */}
          <path fill="#3c3c3b" d={isOn
            ? "M-35.2102-19.4451c-3.0398,1.0463-6.3369,1.0786-9.3966.0922l-11.8807-4.0559c-1.5127-.4877-1.5306-2.6215-.0263-3.1345l38.0243-12.8746c2.9332-1.0003,6.1057-1.0586,9.0736-.1667l12.1038,4.0942c1.5359.4615,1.5786,2.6208.0622,3.1427"
            : "M-34.885-19.4451c-3.0398,1.0463-6.3369,1.0786-9.3966.0922l-11.8807-4.0559c-1.5127-.4877-1.5306-2.6215-.0263-3.1345l38.0243-12.8746c2.9332-1.0003,6.1057-1.0586,9.0736-.1667l12.1038,4.0942c1.5359.4615,1.5786,2.6208.0622,3.1427"
          }/>
          {/* Slider – barva dle stavu */}
          {isOn ? (
            <>
              <path fill="#00e358" d="M-53.2829-25.8045l34.107-23.7631,14.454,4.7017-33.794,24.4326c-.2647.196-.6065.2552-.9216.1595l-13.666-4.3956c-.5103-.155-.6171-.8302-.1795-1.1351Z"/>
              <path fill="#008457" d="M-4.7219-44.8659l-34.2147,24.7442L-2.7918-33.0013c.9857-.3592,1.5671-1.3894,1.3512-2.4161-1.4066-6.6898-3.2813-9.4486-3.2813-9.4486Z"/>
            </>
          ) : (
            <>
              <path fill="#f03b50" d="M-52.9577-42.8045l36.107,5.2369,14.454,4.7017-35.794-4.5674c-.7916-.1959-.4764-.1002-.7916-.1959l-13.796-4.0402c-.5103-.155-.6171-.8302-.1795-1.1351Z"/>
              <path fill="#ef7b10" d="M-52.9577-42.8045s-3.0245,8.1752-1.0245,17.1752l15,5L-2.3966-32.8659l-34.6946-4.9693-15.8664-4.9693Z"/>
            </>
          )}

          {/* Přívody */}
          <path fill="none" stroke="#ad0404" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"
            d={isOn ? "M-80.3074,1.3708c-28,14-22-11.3943-34-11.3943"
                    : "M-79.9822,1.3708c-28,14-22-11.3943-34-11.3943"}/>
          <path fill="none" stroke="#ad0404" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"
            d={isOn ? "M55.0278,-8.4209c-8.9941,-.325-2.6848-18.1418-12.6848-17.1418"
                    : "M54.7026,-9.4875c-8.9941,-.325-2.6848-18.1418-12.6848-17.1418"}/>
        </>
      );
    }

    /* ══ Ostatní – placeholder (SVG přijdou postupně) ══ */
    default:
      return (
        <>
          {/* Rezistor karta jako fallback */}
          <path fill="#59a2ff" d="M-1.2212-14.9355h139.4502c8.4304,0,15.2749,6.8445,15.2749,15.2749v139.4507c0,8.4302-6.8442,15.2744-15.2744,15.2744H-1.2217c-8.4302,0-15.2744-6.8442-15.2744-15.2744V.3394c0-8.4304,6.8445-15.2749,15.2749-15.2749Z"/>
          <path fill="#fff" d="M-1.2212-29.9355h139.4502c8.4304,0,15.2749,6.8445,15.2749,15.2749V124.79c0,8.4302-6.8442,15.2744-15.2744,15.2744H-1.2217c-8.4302,0-15.2744-6.8442-15.2744-15.2744V-14.6606c0-8.4304,6.8445-15.2749,15.2749-15.2749Z"/>
          <path fill="#216de8" d="M138.2294-28.4354c7.5954,0,13.7747,6.1793,13.7747,13.7747V124.7899c0,7.5954-6.1793,13.7747-13.7747,13.7747H-1.2212c-7.5954,0-13.7747-6.1793-13.7747-13.7747V-14.6606c0-7.5954,6.1793-13.7747,13.7747-13.7747h139.4506M138.2294-31.4354H-1.2212c-9.2644,0-16.7747,7.5103-16.7747,16.7747V124.7899c0,9.2644,7.5103,16.7747,16.7747,16.7747h139.4506c9.2644,0,16.7747-7.5103,16.7747-16.7747V-14.6606c0-9.2644-7.5103-16.7747-16.7747-16.7747h0Z"/>
          <line fill="none" stroke="#ad0404" strokeLinecap="round" strokeLinejoin="round" strokeWidth="8"
            x1="22.7996" y1="51.1703" x2="-15.9959" y2="51.1703"/>
          <line fill="none" stroke="#ad0404" strokeLinecap="round" strokeLinejoin="round" strokeWidth="8"
            x1="153.0041" y1="51.1703" x2="118.0041" y2="51.1703"/>
          <text fill="#216de8" textAnchor="middle" fontFamily="'Fenomen Sans', Arial, sans-serif" fontSize="30" fontWeight="700" x="68.5" y="62">
            {'?'}
          </text>
        </>
      );
  }
}

/* ─── Schema (elektrotechnické značky) ─── */
function SchemaSymbol({ type, isOn, bulbState, current = 0, voltage, resistance, color: C = '#1a1a1a', wiperPosition, milliMode, ledBrightness }: { type: ComponentType; isOn: boolean; bulbState?: BulbState; current?: number; voltage?: number; resistance?: number; color?: string; wiperPosition?: number; milliMode?: boolean; ledBrightness?: number }) {
  const L = 30;
  
  // Format voltage display
  const getVoltageText = (v?: number) => {
    if (v === undefined) return '';
    return schemaDefaultVoltageLabel(v);
  };

  // Format resistance display
  const getResistanceText = (r?: number) => {
    if (r === undefined) return '';
    return schemaDefaultResistanceLabel(r);
  };
  
  switch (type) {
    case 'battery':
      return (
        <g>
          <line x1={-L} y1="0" x2="-4" y2="0" stroke={C} strokeWidth="2" />
          <line x1="-4" y1="-14" x2="-4" y2="14" stroke={C} strokeWidth="2" />
          <line x1="4" y1="-8" x2="4" y2="8" stroke={C} strokeWidth="2" />
          <line x1="4" y1="0" x2={L} y2="0" stroke={C} strokeWidth="2" />
          <text x="-8" y="-17" textAnchor="middle" fontSize="12" fill={C}>+</text>
          <text x="8" y="-12" textAnchor="middle" fontSize="12" fill={C}>−</text>
        </g>
      );
    case 'battery2':
      return (
        <g>
          <line x1={-L} y1="0" x2="-10" y2="0" stroke={C} strokeWidth="2" />
          <line x1="-10" y1="-14" x2="-10" y2="14" stroke={C} strokeWidth="2" />
          <line x1="-3" y1="-8" x2="-3" y2="8" stroke={C} strokeWidth="2" />
          <line x1="3" y1="-14" x2="3" y2="14" stroke={C} strokeWidth="2" />
          <line x1="10" y1="-8" x2="10" y2="8" stroke={C} strokeWidth="2" />
          <line x1="10" y1="0" x2={L} y2="0" stroke={C} strokeWidth="2" />
          <text x="-14" y="-17" textAnchor="middle" fontSize="12" fill={C}>+</text>
          <text x="14" y="-12" textAnchor="middle" fontSize="12" fill={C}>−</text>
        </g>
      );
    case 'battery3':
      return (
        <g>
          <line x1={-L} y1="0" x2="-14" y2="0" stroke={C} strokeWidth="2" />
          {/* Tři články: 3 tenké + 3 tlustá čára */}
          <line x1="-14" y1="-14" x2="-14" y2="14" stroke={C} strokeWidth="2" />
          <line x1="-7" y1="-8" x2="-7" y2="8" stroke={C} strokeWidth="2" />
          <line x1="0" y1="-14" x2="0" y2="14" stroke={C} strokeWidth="2" />
          <line x1="7" y1="-8" x2="7" y2="8" stroke={C} strokeWidth="2" />
          <line x1="14" y1="-14" x2="14" y2="14" stroke={C} strokeWidth="2" />
          <line x1="21" y1="-8" x2="21" y2="8" stroke={C} strokeWidth="2" />
          <line x1="21" y1="0" x2={L} y2="0" stroke={C} strokeWidth="2" />
          <text x="-18" y="-17" textAnchor="middle" fontSize="12" fill={C}>+</text>
          <text x="25" y="-12" textAnchor="middle" fontSize="12" fill={C}>−</text>
        </g>
      );
    case 'bulb':
      return (
        <g>
          <line x1={-L} y1="0" x2="-9" y2="0" stroke={C} strokeWidth="2" />
          <circle cx="0" cy="0" r="9" fill="none" stroke={C} strokeWidth="2" />
          <line x1="-5.5" y1="-5.5" x2="5.5" y2="5.5" stroke={C} strokeWidth="2" />
          <line x1="-5.5" y1="5.5" x2="5.5" y2="-5.5" stroke={C} strokeWidth="2" />
          <line x1="9" y1="0" x2={L} y2="0" stroke={C} strokeWidth="2" />
        </g>
      );
    case 'bulb2':
      return (
        <g>
          <line x1={-L} y1="0" x2="-12" y2="0" stroke={C} strokeWidth="2" />
          <circle cx="0" cy="0" r="12" fill="none" stroke={C} strokeWidth="2" />
          <line x1="-8" y1="-8" x2="8" y2="8" stroke={C} strokeWidth="2" />
          <line x1="-8" y1="8" x2="8" y2="-8" stroke={C} strokeWidth="2" />
          <line x1="12" y1="0" x2={L} y2="0" stroke={C} strokeWidth="2" />
        </g>
      );
    case 'bulb3':
      return (
        <g>
          <line x1={-L} y1="0" x2="-15" y2="0" stroke={C} strokeWidth="2" />
          <circle cx="0" cy="0" r="15" fill="none" stroke={C} strokeWidth="2" />
          <line x1="-10" y1="-10" x2="10" y2="10" stroke={C} strokeWidth="2" />
          <line x1="-10" y1="10" x2="10" y2="-10" stroke={C} strokeWidth="2" />
          <line x1="15" y1="0" x2={L} y2="0" stroke={C} strokeWidth="2" />
        </g>
      );
    case 'switch':
      return (
        <g>
          <line x1={-L} y1="0" x2="-10" y2="0" stroke={C} strokeWidth="2" />
          <circle cx="-10" cy="0" r="3" fill={C} />
          <circle cx="10" cy="0" r="3" fill={C} />
          {isOn ? (
            <line x1="-10" y1="0" x2="10" y2="0" stroke={C} strokeWidth="2" />
          ) : (
            <line x1="-10" y1="0" x2="8" y2="-16" stroke={C} strokeWidth="2" />
          )}
          <line x1="10" y1="0" x2={L} y2="0" stroke={C} strokeWidth="2" />
        </g>
      );
    case 'resistor':
      return (
        <g>
          <line x1={-L} y1="0" x2="-14" y2="0" stroke={C} strokeWidth="2" />
          <rect x="-14" y="-7" width="28" height="14" fill="none" stroke={C} strokeWidth="2" rx="1" />
          <line x1="14" y1="0" x2={L} y2="0" stroke={C} strokeWidth="2" />
        </g>
      );
    case 'resistor2':
      return (
        <g>
          <line x1={-L} y1="0" x2="-14" y2="0" stroke={C} strokeWidth="2" />
          <rect x="-14" y="-7" width="28" height="14" fill="none" stroke={C} strokeWidth="2" rx="1" />
          <line x1="14" y1="0" x2={L} y2="0" stroke={C} strokeWidth="2" />
        </g>
      );
    case 'resistor3':
      return (
        <g>
          <line x1={-L} y1="0" x2="-14" y2="0" stroke={C} strokeWidth="2" />
          <rect x="-14" y="-7" width="28" height="14" fill="none" stroke={C} strokeWidth="2" rx="1" />
          <line x1="14" y1="0" x2={L} y2="0" stroke={C} strokeWidth="2" />
        </g>
      );
    case 'ammeter':
      return (
        <g>
          <line x1={-L} y1="0" x2="-12" y2="0" stroke={C} strokeWidth="2" />
          <circle cx="0" cy="0" r="12" fill="none" stroke={C} strokeWidth="2" />
          <text x="0" y={milliMode ? "4" : "5"} textAnchor="middle" fontSize={milliMode ? "9" : "14"} fill={C} fontWeight="bold">{milliMode ? 'mA' : 'A'}</text>
          <line x1="12" y1="0" x2={L} y2="0" stroke={C} strokeWidth="2" />
          {current > 0.0001 && (
            <text x="0" y="20" textAnchor="middle" fontSize="8" fill="#216de8" fontFamily="monospace" fontWeight="bold">
              {milliMode ? `${(current * 1000).toFixed(1).replace('.', ',')} mA` : `${current.toFixed(2).replace('.', ',')} A`}
            </text>
          )}
        </g>
      );
    case 'voltmeter':
      return (
        <g>
          <line x1={-L} y1="0" x2="-12" y2="0" stroke={C} strokeWidth="2" />
          <circle cx="0" cy="0" r="12" fill="none" stroke={C} strokeWidth="2" />
          <text x="0" y="5" textAnchor="middle" fontSize="14" fill={C} fontWeight="bold">V</text>
          <line x1="12" y1="0" x2={L} y2="0" stroke={C} strokeWidth="2" />
          {voltage !== undefined && Math.abs(voltage) > 0.001 && (
            <text x="0" y="20" textAnchor="middle" fontSize="8" fill="#216de8" fontFamily="monospace" fontWeight="bold">
              {formatVoltmeterReading(voltage)} V
            </text>
          )}
        </g>
      );
    case 'potentiometer': {
      const wp = wiperPosition ?? 0.5;
      const wiperX = -14 + 28 * wp;
      return (
        <g>
          {/* Levý vodič */}
          <line x1={-L} y1="0" x2="-14" y2="0" stroke={C} strokeWidth="2" />
          {/* Tělo rezistoru (obdélník) */}
          <rect x="-14" y="-7" width="28" height="14" fill="none" stroke={C} strokeWidth="2" rx="1" />
          {/* Pravý vodič */}
          <line x1="14" y1="0" x2={L} y2="0" stroke={C} strokeWidth="2" />
          {/* Vodič stírače – prodloužen přes spodní hranu dlaždice */}
          <line x1={wiperX} y1="7" x2="0" y2={L + 15} stroke={C} strokeWidth="2" />
          {/* Stírač (wiper) – šipka dolů (od těla směrem k terminálu) */}
          <line x1={wiperX} y1="7" x2={wiperX} y2="18" stroke={C} strokeWidth="2" />
          <polyline points={`${wiperX - 3.5},12 ${wiperX},7 ${wiperX + 3.5},12`} fill="none" stroke={C} strokeWidth="2" strokeLinejoin="round" />
        </g>
      );
    }
    case 'led':
    case 'led2':
    case 'led3': {
      const isBroken = bulbState === 'broken';
      const b = isBroken ? 0 : (ledBrightness ?? (isOn ? 1 : 0));
      const isLit = b > 0;
      // Per-type color: red / green / blue
      const ledSchemaClr = type === 'led3'
        ? { fillRGB: [59,130,246], litRGB: [96,165,250], glowRGBA: '96,165,250' }
        : type === 'led2'
        ? { fillRGB: [34,197,94], litRGB: [74,222,128], glowRGBA: '74,222,128' }
        : { fillRGB: [248,71,71], litRGB: [251,150,36], glowRGBA: '248,113,113' };

      const fillColor = isLit
        ? `rgba(${Math.round(ledSchemaClr.fillRGB[0] + (ledSchemaClr.litRGB[0] - ledSchemaClr.fillRGB[0]) * b)}, ${Math.round(ledSchemaClr.fillRGB[1] + (ledSchemaClr.litRGB[1] - ledSchemaClr.fillRGB[1]) * b)}, ${Math.round(ledSchemaClr.fillRGB[2] + (ledSchemaClr.litRGB[2] - ledSchemaClr.fillRGB[2]) * b)}, ${0.4 + 0.6 * b})`
        : 'none';
      const arrowC = isLit
        ? `rgb(${ledSchemaClr.litRGB[0]}, ${ledSchemaClr.litRGB[1]}, ${ledSchemaClr.litRGB[2]})`
        : C;
      const glowR = 14 + 6 * b;
      const glowOp = 0.08 + 0.25 * b;
      const brokenC = '#9ca3af';
      return (
        <g transform="scale(-1, 1)">
          {/* Záře při sv��cení – intenzita podle jasu */}
          {isLit && <circle cx="0" cy="0" r={glowR} fill={`rgba(${ledSchemaClr.glowRGBA},${glowOp})`} />}
          {/* Levý vodič */}
          <line x1={-L} y1="0" x2="-10" y2="0" stroke={isBroken ? brokenC : C} strokeWidth="2" />
          {/* Anodová čára */}
          <line x1="-10" y1="-10" x2="-10" y2="10" stroke={isBroken ? brokenC : C} strokeWidth="2" />
          {/* Tělo diody – trojúhelník */}
          <polygon points="-10,-10 -10,10 10,0" fill={isBroken ? 'rgba(156,163,175,0.3)' : fillColor} stroke={isBroken ? brokenC : C} strokeWidth="2" />
          {/* Katodová čára */}
          <line x1="10" y1="-10" x2="10" y2="10" stroke={isBroken ? brokenC : C} strokeWidth="2" />
          {/* Pravý vodič */}
          <line x1="10" y1="0" x2={L} y2="0" stroke={isBroken ? brokenC : C} strokeWidth="2" />
          {/* Šipky vyzářeného světla – skryty pokud přepálená */}
          {!isBroken && (
            <>
              <line x1="3" y1="-13" x2="11" y2="-23" stroke={arrowC} strokeWidth="2" strokeLinecap="round" />
              <polyline points="7,-22 11,-23 11,-18" fill="none" stroke={arrowC} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              <line x1="9" y1="-8" x2="17" y2="-18" stroke={arrowC} strokeWidth="2" strokeLinecap="round" />
              <polyline points="13,-17 17,-18 17,-13" fill="none" stroke={arrowC} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </>
          )}
          {/* Přepálení: X přes symbol diody */}
          {isBroken && (
            <>
              <line x1="-12" y1="-12" x2="13" y2="12" stroke={brokenC} strokeWidth="2" strokeLinecap="round" />
              <line x1="13" y1="-12" x2="-12" y2="12" stroke={brokenC} strokeWidth="2" strokeLinecap="round" />
            </>
          )}
        </g>
      );
    }
    case 'npn': {
      // NPN_s.svg — viewBox 0 0 58 48
      // Posunuto níž (centerY=9.3) aby C/E dráty byly vodorovné
      const npnS = 0.556;
      const npnCenterY = 9.3;
      // Collector outer end in scaled coords
      const npnCX = (10.145 - 29) * npnS;   // ≈ -10.48
      const npnCY = (9.6587 - npnCenterY) * npnS;  // ≈ 0.2
      // Emitter arrow tip in scaled coords
      const npnEX = (48.7013 - 29) * npnS;   // ≈ 10.95
      const npnEY = (9.00013 - npnCenterY) * npnS;  // ≈ -0.17
      const npnBY = (43.4005 - npnCenterY) * npnS; // ≈ 18.96
      return (
        <g>
          <g transform={`scale(${npnS}) translate(-29, ${-npnCenterY})`}>
            {/* Základní lišta */}
            <line x1="50.1856" y1="24.4005" x2="7" y2="24.4005" stroke={C} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            {/* Emitor – linka */}
            <line x1="33.7" y1="24.4005" x2="48.7013" y2="9.00013" stroke={C} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            {/* Emitor – šipka */}
            <polygon points="48.7013,9.00013 45.24,16.81 40.96,12.61" fill={C} />
            {/* Kolektor */}
            <line x1="24.9942" y1="24.5079" x2="10.145" y2="9.6587" stroke={C} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            {/* Bázový vývod */}
            <line x1="28.5919" y1="25.4005" x2="28.5919" y2="43.4005" stroke={C} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </g>
          {/* Drát C – od levého okraje přímo ke kolektoru */}
          <line x1={-L} y1="0" x2={npnCX} y2={npnCY} stroke={C} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {/* Drát E – od emitoru přímo k pravému okraji */}
          <line x1={npnEX} y1={npnEY} x2={L} y2="0" stroke={C} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1={npnBY} x2="0" y2={L} stroke={C} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {/* Popisky vývodů C, B, E */}
          <text x={npnCX - 2} y={npnCY - 3} textAnchor="end" fontSize="7" fontFamily="'Fenomen Sans', sans-serif" fontWeight="bold" fill={C}>C</text>
          <text x={npnEX + 2} y={npnEY - 3} textAnchor="start" fontSize="7" fontFamily="'Fenomen Sans', sans-serif" fontWeight="bold" fill={C}>E</text>
          <text x="5" y={L - 1} textAnchor="start" fontSize="7" fontFamily="'Fenomen Sans', sans-serif" fontWeight="bold" fill={C}>B</text>
        </g>
      );
    }
  }
}

/* ─── Realistický starý styl (záložní, pokud not RealisticTile) ─── */
function RealisticSymbol({ type, isOn }: { type: ComponentType; isOn: boolean }) {
  const L = 30;
  switch (type) {
    case 'battery':
    case 'battery2':
    case 'battery3':
      return (
        <g>
          <line x1={-L} y1="0" x2="-16" y2="0" stroke="#666" strokeWidth="2" />
          <rect x="-16" y="-11" width="28" height="22" rx="2" fill="#2d2d2d" stroke="#444" strokeWidth="1" />
          <rect x="12" y="-6" width="5" height="12" rx="1.5" fill="#777" />
          <rect x="-14" y="-9" width="7" height="18" rx="1" fill="#dc2626" opacity="0.9" />
          <text x="1" y="3" textAnchor="middle" fontSize="7" fill="#bbb" fontFamily="'Fenomen Sans', sans-serif" fontWeight="bold">{type === 'battery3' ? '12V' : type === 'battery2' ? '9V' : '4.5V'}</text>
          <line x1="17" y1="0" x2={L} y2="0" stroke="#666" strokeWidth="2" />
        </g>
      );
    case 'bulb':
    case 'bulb2':
    case 'bulb3': {
      const baseClr = type === 'bulb3' ? '#9b4020' : type === 'bulb2' ? '#2a5a96' : '#999';
      const rs = type === 'bulb' ? 0.7 : type === 'bulb2' ? 0.85 : 1;
      const bodyR = 10 * rs; // connection point x
      return (
        <g>
          <line x1={-L} y1="0" x2={-bodyR} y2="0" stroke="#666" strokeWidth="2" />
          <g transform={`scale(${rs})`}>
            <rect x="-5" y="10" width="10" height="7" rx="1" fill={baseClr} stroke="#777" strokeWidth="0.8" />
            <ellipse cx="0" cy="1" rx="10" ry="13" fill={isOn ? '#fef9c3' : '#eaeae2'} stroke="#aaa" strokeWidth="1" />
            <path d="M-3,7 L-3,1 Q-3,-3 0,-3 Q3,-3 3,1 L3,7" fill="none" stroke={isOn ? '#f59e0b' : '#aaa'} strokeWidth="1.5" />
            {isOn && <ellipse cx="0" cy="1" rx="16" ry="18" fill="rgba(250,204,21,0.12)" />}
          </g>
          <line x1={bodyR} y1="0" x2={L} y2="0" stroke="#666" strokeWidth="2" />
        </g>
      );
    }
    case 'switch':
      return (
        <g>
          <line x1={-L} y1="0" x2="-13" y2="0" stroke="#666" strokeWidth="2" />
          <rect x="-13" y="-3" width="26" height="14" rx="2" fill="#d4d4d8" stroke="#a1a1aa" strokeWidth="1" />
          <circle cx="-8" cy="4" r="3" fill="#555" />
          {isOn ? (
            <rect x="-9" y="1" width="19" height="5" rx="1.5" fill="#ef4444" stroke="#b91c1c" strokeWidth="0.5" />
          ) : (
            <line x1="-8" y1="4" x2="6" y2="-12" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" />
          )}
          <circle cx="10" cy="4" r="2.5" fill="#eab308" />
          <line x1="13" y1="0" x2={L} y2="0" stroke="#666" strokeWidth="2" />
        </g>
      );
    case 'resistor':
      return (
        <g>
          <line x1={-L} y1="0" x2="-15" y2="0" stroke="#666" strokeWidth="2" />
          <rect x="-15" y="-8" width="30" height="16" rx="3" fill="#d2b48c" stroke="#8b7355" strokeWidth="1" />
          <rect x="-11" y="-8" width="3" height="16" fill="#dc2626" rx="0.5" />
          <rect x="-5" y="-8" width="3" height="16" fill="#7c3aed" rx="0.5" />
          <rect x="1" y="-8" width="3" height="16" fill="#ca8a04" rx="0.5" />
          <rect x="9" y="-8" width="3" height="16" fill="#d4af37" rx="0.5" />
          <line x1="15" y1="0" x2={L} y2="0" stroke="#666" strokeWidth="2" />
        </g>
      );
    case 'resistor2':
      return (
        <g>
          <line x1={-L} y1="0" x2="-15" y2="0" stroke="#666" strokeWidth="2" />
          <rect x="-15" y="-8" width="30" height="16" rx="3" fill="#86efac" stroke="#16a34a" strokeWidth="1" />
          <rect x="-11" y="-8" width="3" height="16" fill="#dc2626" rx="0.5" />
          <rect x="-5" y="-8" width="3" height="16" fill="#1d1d1b" rx="0.5" />
          <rect x="1" y="-8" width="3" height="16" fill="#ca8a04" rx="0.5" />
          <rect x="9" y="-8" width="3" height="16" fill="#d4af37" rx="0.5" />
          <line x1="15" y1="0" x2={L} y2="0" stroke="#666" strokeWidth="2" />
        </g>
      );
    case 'resistor3':
      return (
        <g>
          <line x1={-L} y1="0" x2="-15" y2="0" stroke="#666" strokeWidth="2" />
          <rect x="-15" y="-8" width="30" height="16" rx="3" fill="#fdba74" stroke="#ea580c" strokeWidth="1" />
          <rect x="-11" y="-8" width="3" height="16" fill="#22c55e" rx="0.5" />
          <rect x="-5" y="-8" width="3" height="16" fill="#1d1d1b" rx="0.5" />
          <rect x="1" y="-8" width="3" height="16" fill="#ca8a04" rx="0.5" />
          <rect x="9" y="-8" width="3" height="16" fill="#dc2626" rx="0.5" />
          <line x1="15" y1="0" x2={L} y2="0" stroke="#666" strokeWidth="2" />
        </g>
      );
    case 'ammeter':
      return (
        <g>
          <line x1={-L} y1="0" x2="-15" y2="0" stroke="#666" strokeWidth="2" />
          <rect x="-15" y="-15" width="30" height="30" rx="3" fill="#fafaf8" stroke="#666" strokeWidth="1.5" />
          <rect x="-11" y="-11" width="22" height="16" rx="1" fill="#dcfce7" stroke="#bbb" strokeWidth="0.5" />
          <text x="0" y="1" textAnchor="middle" fontSize="11" fill="#166534" fontFamily="monospace" fontWeight="bold">A</text>
          <text x="0" y="12" textAnchor="middle" fontSize="9" fill="#555" fontFamily="'Fenomen Sans', sans-serif" fontWeight="bold">A</text>
          <line x1="15" y1="0" x2={L} y2="0" stroke="#666" strokeWidth="2" />
        </g>
      );
    case 'voltmeter':
      return (
        <g>
          <line x1={-L} y1="0" x2="-15" y2="0" stroke="#666" strokeWidth="2" />
          <rect x="-15" y="-15" width="30" height="30" rx="3" fill="#fafaf8" stroke="#666" strokeWidth="1.5" />
          <rect x="-11" y="-11" width="22" height="16" rx="1" fill="#dcfce7" stroke="#bbb" strokeWidth="0.5" />
          <text x="0" y="1" textAnchor="middle" fontSize="11" fill="#166534" fontFamily="monospace" fontWeight="bold">V</text>
          <text x="0" y="12" textAnchor="middle" fontSize="9" fill="#555" fontFamily="'Fenomen Sans', sans-serif" fontWeight="bold">V</text>
          <line x1="15" y1="0" x2={L} y2="0" stroke="#666" strokeWidth="2" />
        </g>
      );
    case 'potentiometer':
      return (
        <g>
          <line x1={-L} y1="0" x2="-15" y2="0" stroke="#666" strokeWidth="2" />
          <rect x="-15" y="-12" width="30" height="24" rx="3" fill="#fafaf8" stroke="#666" strokeWidth="1.5" />
          <rect x="-11" y="-8" width="22" height="13" rx="2" fill="#E8F6FE" stroke="#bbb" strokeWidth="0.5" />
          {/* Vodič k 3. terminálu – prodloužen přes spodní hranu */}
          <line x1="0" y1="12" x2="0" y2={L + 15} stroke="#666" strokeWidth="2" />
          {/* Stírač – šipka dolů */}
          <line x1="0" y1="12" x2="0" y2="20" stroke="#041423" strokeWidth="1.5" />
          <polyline points="-3,16 0,12 3,16" fill="none" stroke="#041423" strokeWidth="1.2" strokeLinejoin="round" />
          <line x1="15" y1="0" x2={L} y2="0" stroke="#666" strokeWidth="2" />
        </g>
      );
    case 'led':
    case 'led2':
    case 'led3': {
      const ledFill = type === 'led3'
        ? (isOn ? '#60a5fa' : '#3b82f6')
        : type === 'led2'
        ? (isOn ? '#4ade80' : '#22c55e')
        : (isOn ? '#f97316' : '#ef4444');
      const ledArrow = type === 'led3'
        ? (isOn ? '#93c5fd' : '#aaa')
        : type === 'led2'
        ? (isOn ? '#86efac' : '#aaa')
        : (isOn ? '#fbbf24' : '#aaa');
      return (
        <g transform="scale(-1, 1)">
          <line x1={-L} y1="0" x2="-10" y2="0" stroke="#666" strokeWidth="2" />
          <line x1="-10" y1="-10" x2="-10" y2="10" stroke="#666" strokeWidth="2" />
          <polygon points="-10,-10 -10,10 10,0" fill={ledFill} stroke="#999" strokeWidth="1" />
          <line x1="10" y1="-10" x2="10" y2="10" stroke="#666" strokeWidth="2" />
          <line x1="10" y1="0" x2={L} y2="0" stroke="#666" strokeWidth="2" />
          <line x1="2" y1="-11" x2="9" y2="-19" stroke={ledArrow} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="7" y1="-7" x2="14" y2="-15" stroke={ledArrow} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      );
    }
    case 'npn': {
      const s = 0.556;
      const bL = (7 - 29) * s;
      const bR = (50.1856 - 29) * s;
      const bY = (43.4005 - 24.4005) * s;
      return (
        <g>
          <g transform={`scale(${s}) translate(-29, -24.4)`}>
            <line x1="50.1856" y1="24.4005" x2="7" y2="24.4005" stroke="#555" strokeWidth="2" vectorEffect="non-scaling-stroke" fill="none" />
            <path d="M48.7013 9.00013L43.1245 10.4944L47.207 14.5769L48.7013 9.00013ZM45.5193 12.1821L45.1657 11.8286L33.1449 23.8494L33.4985 24.2029L33.852 24.5565L45.8728 12.5357L45.5193 12.1821Z" fill="#555" stroke="none" />
            <path d="M24.9942 24.5079L10.145 9.6587" stroke="#555" strokeWidth="2" vectorEffect="non-scaling-stroke" fill="none" />
            <line x1="28.5919" y1="25.4005" x2="28.5919" y2="43.4005" stroke="#555" strokeWidth="2" vectorEffect="non-scaling-stroke" fill="none" />
          </g>
          <line x1={-L} y1="0" x2={bL} y2="0" stroke="#666" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <line x1={bR} y1="0" x2={L}  y2="0" stroke="#666" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1={bY} x2="0"  y2={L} stroke="#666" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </g>
      );
    }
  }
}

/* ─── Malá ikona pro paletu ─── */
export function PaletteIcon({ type, mode }: { type: ComponentType; mode: ViewMode }) {
  if (type === 'npn') {
    // Exact copy of NPN_s-2.svg (viewBox 0 0 58 48) scaled to palette size
    return (
      <svg width="48" height="40" viewBox="0 0 58 48" fill="none">
        {/* Horizontal base bar */}
        <line x1="50.1856" y1="24.4005" x2="7" y2="24.4005" stroke="black" strokeWidth="2" />
        {/* Emitter – arrow + diagonal line (combined path) */}
        <path d="M48.7013 9.00013L43.1245 10.4944L47.207 14.5769L48.7013 9.00013ZM45.5193 12.1821L45.1657 11.8286L33.1449 23.8494L33.4985 24.2029L33.852 24.5565L45.8728 12.5357L45.5193 12.1821Z" fill="black" />
        {/* Collector – diagonal line */}
        <path d="M24.9942 24.5079L10.145 9.6587" stroke="black" strokeWidth="2" />
        {/* Base lead – vertical */}
        <line x1="28.5919" y1="25.4005" x2="28.5919" y2="43.4005" stroke="black" strokeWidth="2" />
      </svg>
    );
  }
  return (
    <svg width="48" height="32" viewBox="-32 -18 64 36">
      <ComponentSvg type={type} mode={mode} size={0.75} />
    </svg>
  );
}
