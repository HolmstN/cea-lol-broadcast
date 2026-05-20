import { p } from './types';
import type { Params } from './types';

const HEX_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='115'%3E%3Cpolygon points='50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5' stroke='%23C8AA6E' stroke-width='1' fill='none'/%3E%3C/svg%3E")`;

const ROLE_ICONS:  Record<string, string> = { Top:'Top', Jungle:'Jungle', Mid:'Mid', ADC:'Bot', Support:'Support' };
const ROLE_COLORS: Record<string, string> = { Top:'#C8AA6E', Jungle:'#4FC65A', Mid:'#0BC4E3', ADC:'#E57373', Support:'#9C78E8' };
const ICON_BASE = 'http://localhost:7234/icons';

export default function PlayerSpotlight({ params }: { params: Params }) {
  const q = (k: string, fb = '—') => p(params, k, fb);
  const role = q('role', 'Top');
  const iconFile = ROLE_ICONS[role] ?? 'Top';
  const roleColor = ROLE_COLORS[role] ?? '#C8AA6E';

  const champs = [1,2,3,4,5].map(i => ({
    name:   q(`champ${i}_name`, ''),
    wins:   q(`champ${i}_wins`, '0'),
    losses: q(`champ${i}_losses`, '0'),
    kda:    q(`champ${i}_kda`, '—'),
  }));

  return (
    <div className="w-full h-full bg-lol-bg relative">
      <div className="absolute -inset-[100px] opacity-5" style={{ backgroundSize:'100px 115px', animation:'hexDrift 25s linear infinite', backgroundImage:HEX_BG }} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[57.29vw] h-[55.56vh] blur-[40px]" style={{ background:'radial-gradient(ellipse, rgba(3,38,64,0.8) 0%, transparent 70%)' }} />
      <div className="absolute inset-0" style={{ background:'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(3,38,64,0.45) 0%, transparent 70%), radial-gradient(ellipse 100% 40% at 50% 100%, rgba(1,10,19,0.95) 0%, transparent 60%)' }} />
      <div className="absolute left-0 right-0 h-0.5 opacity-20" style={{ background:'linear-gradient(90deg, transparent, #0BC4E3, transparent)', animation:'scan 7s ease-in-out infinite' }} />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 h-[5.93vh] bg-lol-bg/[96%] border-b border-gold-mid/25 flex items-center justify-center gap-[1.04vw] z-10">
        {['Player Spotlight', q('event','Spring Season 2025'), 'Corporate Esports Association'].map((t, i, a) => (
          <>
            <span key={t} className="font-cinzel text-[0.68vw] font-bold tracking-[0.3em] text-gold-mid uppercase">{t}</span>
            {i < a.length - 1 && <div key={`s${i}`} className="w-1 h-1 bg-gold-bright rotate-45" style={{ boxShadow:'0 0 5px #C89B3C' }} />}
          </>
        ))}
      </div>

      {/* Content card */}
      <div className="absolute top-[5.93vh] bottom-[4.63vh] left-0 right-0 flex items-center justify-center z-10">
        <div className="w-[72.92vw] bg-lol-panel/90 border border-gold-mid/20 relative overflow-hidden" style={{ animation:'winReveal 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.1s both' }}>
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background:'linear-gradient(90deg, transparent, rgba(200,170,110,0.4), transparent)' }} />

          {/* Header row */}
          <div className="flex items-center px-[2.5vw] pt-[2.04vh] pb-[1.67vh] gap-[1.875vw] border-b border-gold-mid/10">
            <div className="flex flex-col items-center gap-[0.56vh] shrink-0">
              <img src={`${ICON_BASE}/Position_Challenger-${iconFile}.png`} alt={role} className="w-[2.6vw] h-[2.6vw] object-contain" />
              <div className="text-[0.52vw] font-bold tracking-[0.4em] uppercase" style={{ color:roleColor }}>{role}</div>
            </div>
            <div className="w-px h-[8.33vh] shrink-0" style={{ background:'linear-gradient(180deg, transparent, rgba(200,170,110,0.3), transparent)' }} />
            <div className="flex-1 min-w-0 flex flex-col gap-[0.46vh]">
              <div className="font-cinzel text-[3.23vw] font-black tracking-[0.06em] text-gold-light leading-none truncate" style={{ textShadow:'0 0 40px rgba(200,155,60,0.5)' }}>{q('name')}</div>
              <div className="font-cinzel text-[0.83vw] font-bold tracking-[0.2em] text-gold-mid uppercase">{q('team')}</div>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-[0.56vh]">
              <div className="text-[0.47vw] font-bold tracking-[0.35em] text-gold-mid/40 uppercase">Rank</div>
              <div className="text-[1.35vw] font-bold text-blue-bright tracking-[0.04em] text-right">{q('rank')}</div>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex px-[2.5vw] py-[1.48vh] border-b border-gold-mid/[8%]">
            {/* Win Rate */}
            <div className="flex-1 flex flex-col items-center gap-[0.74vh] px-[0.83vw]">
              <div className="text-[0.42vw] font-bold tracking-[0.4em] uppercase text-gold-mid/40">Win Rate</div>
              <div className="flex flex-col gap-[0.56vh] items-center">
                {(['game','match'] as const).map(type => (
                  <div key={type} className="flex flex-col items-center gap-[0.09vh]">
                    <div className="text-[0.36vw] text-gold-mid/30 tracking-[0.2em] uppercase">{type}</div>
                    <div className="flex items-baseline gap-[0.31vw]">
                      <span className="font-cinzel text-[1.46vw] font-bold text-win">{q(`${type}_wins`,'0')}W</span>
                      <span className="font-cinzel text-[1.04vw] text-gold-mid/25">–</span>
                      <span className="font-cinzel text-[1.46vw] font-bold text-loss">{q(`${type}_losses`,'0')}L</span>
                    </div>
                    <div className="text-[0.52vw] text-gold-mid/50 tracking-[0.1em]">{q(`${type}_wr`)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="w-px self-stretch bg-gold-mid/10" />
            {/* K/D/A */}
            <div className="flex-1 flex flex-col items-center gap-[0.74vh] px-[0.83vw]">
              <div className="text-[0.42vw] font-bold tracking-[0.4em] uppercase text-gold-mid/40">Avg K / D / A</div>
              <div className="flex items-center">
                {(['k','d','a'] as const).map((stat, i) => {
                  const statColor = stat === 'k' ? 'text-win' : stat === 'd' ? 'text-loss' : 'text-gold-mid';
                  const statLabel = stat === 'k' ? 'Kills' : stat === 'd' ? 'Deaths' : 'Assists';
                  return (
                    <>
                      {i > 0 && <span key={`sep${i}`} className="text-[1.04vw] font-light text-gold-mid/20 mx-[0.21vw] pb-[1.11vh]">/</span>}
                      <div key={stat} className="flex flex-col items-center gap-[0.28vh] w-[3.75vw]">
                        <span className={`font-cinzel text-[1.875vw] font-bold leading-none ${statColor}`}>{q(`avg_${stat}`)}</span>
                        <span className="text-[0.42vw] font-bold tracking-[0.3em] uppercase opacity-50">{statLabel}</span>
                      </div>
                    </>
                  );
                })}
              </div>
            </div>
            <div className="w-px self-stretch bg-gold-mid/10" />
            {/* KDA + Rates */}
            <div className="flex-1 flex flex-col items-center gap-[0.74vh] px-[0.83vw]">
              <div className="text-[0.42vw] font-bold tracking-[0.4em] uppercase text-gold-mid/40">KDA / Rates</div>
              <div className="flex flex-col items-center gap-[0.93vh]">
                <div className="font-cinzel text-[2.5vw] font-black text-gold-bright leading-none" style={{ textShadow:'0 0 20px rgba(200,155,60,0.5)' }}>{q('kda')}</div>
                <div className="text-[0.47vw] font-bold tracking-[0.35em] uppercase text-gold-mid/50">KDA Ratio</div>
                <div className="flex gap-[0.83vw]">
                  {(['cs_min','gold_min'] as const).map((k, i) => (
                    <div key={k} className="flex flex-col items-center gap-[0.19vh]">
                      <div className="text-[0.42vw] font-bold tracking-[0.3em] uppercase text-gold-mid/40">{i === 0 ? 'CS/min' : 'Gold/min'}</div>
                      <div className="font-cinzel text-[1.15vw] font-bold text-gold-light">{q(k)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Champion cards */}
          <div className="px-[2.5vw] pt-[1.67vh] pb-[2.22vh]">
            <div className="text-[0.42vw] font-bold tracking-[0.4em] uppercase text-gold-mid/40 mb-[1.11vh] text-center">Champion History</div>
            <div className="flex gap-[0.625vw]">
              {champs.map((ch, i) => ch.name ? (
                <div key={i} className="flex-1 bg-gold-mid/[6%] border border-gold-mid/15 px-[0.94vw] py-[1.48vh] flex flex-col gap-[0.74vh]">
                  <div className="font-cinzel text-[1.04vw] font-bold text-gold-bright truncate">{ch.name}</div>
                  <div className="flex gap-[0.31vw] items-baseline">
                    <span className="font-cinzel text-[0.94vw] font-bold text-win">{ch.wins}W</span>
                    <span className="text-[0.73vw] text-gold-mid/30">–</span>
                    <span className="font-cinzel text-[0.94vw] font-bold text-loss">{ch.losses}L</span>
                  </div>
                  <div className="text-[0.68vw] text-gold-mid font-semibold">{ch.kda} KDA</div>
                </div>
              ) : null)}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[4.63vh] bg-lol-bg/[96%] border-t border-gold-mid/20 flex items-center justify-center gap-[1.04vw] z-10">
        <span className="text-[0.63vw] font-medium tracking-[0.2em] text-gold-mid/55 uppercase">Corporate Esports Association</span>
        <div className="w-0.75 h-0.75 bg-gold-dark rotate-45" />
        <span className="text-[0.63vw] font-medium tracking-[0.2em] text-gold-mid/55 uppercase">League of Legends</span>
      </div>
    </div>
  );
}
