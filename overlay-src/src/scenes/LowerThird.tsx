import { p } from './types';
import type { Params } from './types';

const BADGE_COLORS: Record<string, string> = {
  'First Blood': '#E57373',
  'Double Kill': '#C89B3C',
  'Triple Kill': '#C89B3C',
  'Quadra Kill': '#9C78E8',
  'Penta Kill':  '#9C78E8',
  'Ace':         '#9C78E8',
};

export default function LowerThird({ params }: { params: Params }) {
  const badge       = p(params, 'badge', '');
  const killer      = p(params, 'killer', '');
  const killerChamp = p(params, 'killer_champ', '');
  const victim      = p(params, 'victim', '');
  const victimChamp = p(params, 'victim_champ', '');
  const assistStr   = p(params, 'assists', '');
  const assists     = assistStr ? assistStr.split(',').map(s => s.trim()).filter(Boolean) : [];

  const accentColor = BADGE_COLORS[badge] ?? '#0BC4E3';
  const isAce       = badge === 'Ace';
  const isMultiKill = ['Double Kill', 'Triple Kill', 'Quadra Kill', 'Penta Kill'].includes(badge);

  return (
    <div className="w-full h-full relative">
      {/* Bottom scrim */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{ height: '28%', background: 'linear-gradient(to top, rgba(1,10,19,0.82) 0%, transparent 100%)' }}
      />

      {/* Lower third panel */}
      <div
        className="absolute bottom-[4.63vh] left-[2.6vw] right-[2.6vw] bg-lol-panel/[97%] border border-gold-mid/20 overflow-hidden"
        style={{ animation: 'slideUp 0.45s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        {/* Top shimmer */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(200,170,110,0.3), transparent)' }} />
        {/* Left accent */}
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accentColor, boxShadow: `0 0 12px ${accentColor}99` }} />

        <div className="flex items-center gap-[1.04vw] px-[1.25vw] py-[1.3vh] pl-[1.77vw]">
          {/* Badge */}
          {badge && (
            <div
              className="shrink-0 px-[0.73vw] py-[0.37vh] font-cinzel text-[0.52vw] font-bold tracking-[0.3em] uppercase border"
              style={{ color: accentColor, borderColor: `${accentColor}55`, background: `${accentColor}14` }}
            >
              {badge}
            </div>
          )}

          {/* Kill info */}
          {isAce ? (
            <div className="flex-1 min-w-0 flex items-baseline gap-[0.83vw]">
              <span className="font-cinzel text-[1.25vw] font-bold leading-none truncate" style={{ color: accentColor }}>{killer}</span>
              {killerChamp && <span className="text-[0.47vw] font-bold tracking-[0.2em] text-gold-mid/50 uppercase">{killerChamp}</span>}
              <span className="text-[0.73vw] font-bold text-gold-mid/50 uppercase tracking-[0.15em]">• Aced the enemy team</span>
            </div>
          ) : isMultiKill ? (
            <div className="flex-1 min-w-0 flex items-baseline gap-[0.83vw]">
              <span className="font-cinzel text-[1.35vw] font-bold leading-none truncate" style={{ color: accentColor }}>{killer}</span>
              {killerChamp && <span className="text-[0.47vw] font-bold tracking-[0.2em] text-gold-mid/50 uppercase">{killerChamp}</span>}
            </div>
          ) : (
            <div className="flex-1 min-w-0 flex items-center gap-[0.83vw]">
              <div className="flex flex-col gap-[0.09vh] min-w-0 shrink-0">
                <div className="font-cinzel text-[1.25vw] font-bold text-gold-light leading-none">{killer}</div>
                {killerChamp && <div className="text-[0.42vw] font-bold tracking-[0.25em] text-gold-mid/50 uppercase">{killerChamp}</div>}
              </div>
              <div className="shrink-0 text-[0.94vw] font-bold text-blue-bright/60">→</div>
              <div className="flex flex-col gap-[0.09vh] min-w-0 shrink-0">
                <div className="font-cinzel text-[1.04vw] font-bold text-loss/80 leading-none">{victim}</div>
                {victimChamp && <div className="text-[0.42vw] font-bold tracking-[0.25em] text-loss/40 uppercase">{victimChamp}</div>}
              </div>
            </div>
          )}

          {/* Assists */}
          {assists.length > 0 && (
            <div className="shrink-0 border-l border-gold-mid/15 pl-[0.83vw]">
              <div className="text-[0.36vw] font-bold tracking-[0.3em] text-gold-mid/35 uppercase mb-[0.19vh]">Assisted by</div>
              <div className="text-[0.52vw] font-medium text-gold-mid/55 tracking-[0.05em]">{assists.join(' · ')}</div>
            </div>
          )}

          {/* CEA brand mark */}
          <div className="shrink-0 ml-auto pl-[0.83vw]">
            <div className="text-[0.42vw] font-bold tracking-[0.3em] text-gold-mid/20 uppercase font-cinzel">CEA</div>
          </div>
        </div>
      </div>
    </div>
  );
}
