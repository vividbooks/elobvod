import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ZoomIn, ZoomOut, Maximize, Eye, Info, X } from 'lucide-react';
import type { ViewMode } from './ComponentSvg';

const BG = '#ffffff';
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4.0;
/** Vnitřní zoom při startu / „výchozí“ – v UI se zobrazí jako 100 %. */
const DEFAULT_ZOOM = 2;

interface Props {
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  zoom: number;
  onZoomChange: (z: number) => void;
  isViewOnly?: boolean;
}

export function TopBar({ viewMode, onViewModeChange, zoom, onZoomChange, isViewOnly }: Props) {
  const isSchema = viewMode === 'schema';
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="flex shrink-0 flex-nowrap items-center gap-1">
      {/* View-only badge */}
      {isViewOnly && (
        <div
          className="flex items-center gap-1.5 rounded-full shadow-lg px-3 select-none mr-1"
          style={{ background: BG, height: 50, color: '#6366f1' }}
        >
          <Eye size={14} />
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.01em' }}>
            Náhled
          </span>
        </div>
      )}

      <div
        className="flex items-center gap-0.5 rounded-full shadow-lg px-1.5 select-none"
        style={{ background: BG, height: 50 }}
      >
        {/* Zoom out */}
        <button
          onClick={() => onZoomChange(Math.max(MIN_ZOOM, +(zoom - 0.2).toFixed(1)))}
          title="Oddálit"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-500 hover:bg-zinc-100 transition-colors cursor-pointer"
        >
          <ZoomOut size={16} />
        </button>

        {/* Schéma ON/OFF toggle */}
        <button
          onClick={() => onViewModeChange(isSchema ? 'realistic' : 'schema')}
          title={isSchema ? 'Přepnout na realistický pohled' : 'Přepnout na schéma'}
          className="flex items-center gap-2 h-9 px-3 rounded-xl transition-all cursor-pointer hover:bg-zinc-100"
          style={{ background: 'transparent' }}
        >
          <span style={{ fontSize: 12, fontWeight: 500, color: isSchema ? '#1e1b4b' : '#9ca3af', letterSpacing: '0.01em' }}>
            Schéma
          </span>
          {/* Toggle pill */}
          <div
            className="relative flex-shrink-0 rounded-full transition-all duration-200"
            style={{
              width: 36,
              height: 20,
              background: isSchema ? '#22c55e' : '#d1d5db',
            }}
          >
            {/* Knob */}
            <div
              className="absolute top-0.5 rounded-full bg-white shadow-sm transition-all duration-200"
              style={{
                width: 16,
                height: 16,
                left: isSchema ? 18 : 2,
              }}
            />
          </div>
        </button>

        {/* Zoom in */}
        <button
          onClick={() => onZoomChange(Math.min(MAX_ZOOM, +(zoom + 0.2).toFixed(1)))}
          title="Přiblížit"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-500 hover:bg-zinc-100 transition-colors cursor-pointer"
        >
          <ZoomIn size={16} />
        </button>

        {/* Separator */}
        <div className="w-px h-5 bg-zinc-400/30 mx-1" />

        {/* Fit view */}
        <button
          onClick={() => onZoomChange(DEFAULT_ZOOM)}
          title="Výchozí zoom"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-500 hover:bg-zinc-100 transition-colors cursor-pointer"
        >
          <Maximize size={15} />
        </button>

        {/* Zoom label */}
        <div className="text-[11px] text-zinc-400 min-w-[42px] text-center tabular-nums">
          {Math.round((zoom / DEFAULT_ZOOM) * 100)} %
        </div>
      </div>

      {/* Info button */}
      <button
        onClick={() => setShowInfo(true)}
        title="Nápověda"
        className="w-[50px] h-[50px] rounded-full shadow-lg flex items-center justify-center text-zinc-500 hover:bg-zinc-100 transition-colors cursor-pointer"
        style={{ background: BG }}
      >
        <Info size={18} />
      </button>

      {/* Info modal */}
      {showInfo && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-start justify-center pt-20"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowInfo(false)}
        >
          <div
            className="relative rounded-2xl shadow-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
            style={{ background: BG }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowInfo(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-200 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
            <h2 className="text-zinc-800 mb-4" style={{ fontSize: 18, fontWeight: 700 }}>Nápověda</h2>
            <div className="space-y-3 text-zinc-600" style={{ fontSize: 13, lineHeight: 1.6 }}>
              <Section title="Umisťování součástek">
                Vyberte součástku z levého panelu a klikněte na plátno pro její umístění. Součástku lze přetáhnout na jinou pozici nástrojem <b>Výběr</b>.
              </Section>
              <Section title="Otáčení součástek">
                <b>Pravé kliknutí</b> na součástku ji otočí o 90° (funguje s jakýmkoliv nástrojem). Na dotykových zařízeních použijte <b>dlouhý stisk</b> (650 ms).
              </Section>
              <Section title="Kreslení drátů">
                Zvolte nástroj <b>Drát</b> a kliknutím spojujte body na mřížce. Dráty se automaticky přichytávají k terminálům součástek.
              </Section>
              <Section title="Mazání">
                Nástrojem <b>Guma</b> klikněte na součástku nebo drát pro smazání. Tlačítkem <b>Smazat vše</b> vyčistíte celé plátno.
              </Section>
              <Section title="Nastavení baterie">
                Kliknutím na baterii otevřete panel pro změnu napětí. K dispozici jsou baterie <b>4,5 V</b>, <b>9 V</b> a <b>12 V</b>.
              </Section>
              <Section title="Nastavení odporu rezistoru">
                Kliknutím na rezistor otevřete panel, kde lze nastavit odpor pomocí posuvníku nebo přímým zadáním hodnoty.
              </Section>
              <Section title="Žárovky">
                K dispozici jsou tři velikosti žárovek (<b>4,5 V</b>, <b>9 V</b>, <b>12 V</b>). Žárovka svítí, pokud jí protéká proud.
              </Section>
              <Section title="LED">
                Tři barvy s různým prahovým napětím: <b>červená</b> (1,8 V), <b>zelená</b> (2,2 V), <b>modrá</b> (3,0 V). LED svítí jen při správné polaritě.
              </Section>
              <Section title="Vypínač">
                Kliknutím na vypínač ho zapnete/vypnete – přerušuje nebo spojuje obvod.
              </Section>
              <Section title="Ampérmetr">
                Měří proud procházející obvodem. Kliknutím na ampérmetr přepnete zobrazení mezi <b>A</b> a <b>mA</b>.
              </Section>
              <Section title="Voltmetr">
                Má přetahovatelné <b>+</b> a <b>−</b> sondy, které přiložíte k různým bodům obvodu pro měření napětí.
              </Section>
              <Section title="Potenciometr">
                Proměnný rezistor s třetím vývodem (wiper). Kliknutím otevřete posuvník pro nastavení poměru odporu.
              </Section>
              <Section title="NPN tranzistor">
                Tříterminálová součástka s vývody <b>C</b> (kolektor), <b>B</b> (báze) a <b>E</b> (emitor). Řídí proud mezi kolektorem a emitorem pomocí proudu do báze.
              </Section>
              <Section title="Zobrazení">
                Přepněte mezi <b>realistickým</b> a <b>schématickým</b> pohledem pomocí přepínače „Schéma“ v horním panelu.
              </Section>
              <Section title="Zoom a posun">
                Kolečkem myši nebo tlačítky <b>+/−</b> přibližujte/oddalujte. Plátno posunete tažením se stisknutým <b>prostředním tlačítkem</b> nebo na dotykovém zařízení dvěma prsty (pinch-to-zoom).
              </Section>
              <Section title="Sdílení">
                Tlačítkem <b>Sdílet</b> vygenerujete odkaz na aktuální obvod, který si může kdokoliv prohlédnout.
              </Section>
              <Section title="Zkratový obvod">
                Při zkratu (≥ 10 A) se postižená část obvodu zvýrazní <b style={{ color: '#f97316' }}>oranžově</b>.
              </Section>
              <p className="pt-4 mt-2 border-t border-zinc-200/80 text-zinc-500 text-center" style={{ fontSize: 12 }}>
                Version 1.01
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-zinc-800" style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{title}</div>
      <div>{children}</div>
    </div>
  );
}