import { p } from './types';
import type { Params } from './types';

const HEX_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='115'%3E%3Cpolygon points='50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5' stroke='%23C8AA6E' stroke-width='1' fill='none'/%3E%3C/svg%3E")`;

const ROLE_ICON_MAP: Record<string, string> = { top:'Top', jg:'Jungle', mid:'Mid', adc:'Bot', sup:'Support' };
const ROLE_LABEL:    Record<string, string> = { top:'Top', jg:'Jungle', mid:'Mid', adc:'ADC', sup:'Support' };
const ICON_BASE = 'http://localhost:7234/icons';

function SepV() {
  return <div className="w-px shrink-0 self-stretch bg-gold-mid/[7%]" />;
}

function WrBlock({ prefix, params }: { prefix: string; params: Record<string,string> }) {
  const q = (k: string) => p(params, `${prefix}_${k}`, '—');
  return (
    <div className="w-[6.25vw] shrink-0 flex flex-col items-center justify-center gap-[0.19vh] px-[0.31vw]">
      <div className="text-[0.42vw] font-bold tracking-[0.3em] text-gold-mid/40 uppercase">Game / Match WR</div>
      <div className="flex flex-col gap-[0.37vh] items-center">
        {(['game','match'] as const).map(type => (
          <div key={type} className="flex flex-col items-center gap-[0.09vh]">
            <div className="text-[0.36vw] text-gold-mid/30 tracking-[0.2em] uppercase">{type}</div>
            <div className="flex items-baseline gap-[0.16vw]">
              <span className="font-cinzel text-[0.68vw] font-bold text-win">{q(`${type}_wins`)}W</span>
              <span className="text-[0.57vw] text-gold-mid/30">–</span>
              <span className="font-cinzel text-[0.68vw] font-bold text-loss">{q(`${type}_losses`)}L</span>
            </div>
            <div className="text-[0.47vw] text-gold-mid/50">{q(`${type}_wr`)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KdaBlock({ prefix, params }: { prefix: string; params: Record<string,string> }) {
  const q = (k: string) => p(params, `${prefix}_${k}`, '—');
  return (
    <div className="w-[8.59vw] shrink-0 flex flex-col items-center justify-center gap-[0.19vh] px-[0.42vw]">
      <div className="text-[0.42vw] font-bold tracking-[0.3em] text-gold-mid/40 uppercase">Avg K / D / A</div>
      <div className="flex items-baseline gap-[0.21vw]">
        <span className="font-cinzel text-[0.99vw] font-bold text-win">{q('avg_k')}</span>
        <span className="text-[0.73vw] text-gold-mid/30">/</span>
        <span className="font-cinzel text-[0.99vw] font-bold text-loss">{q('avg_d')}</span>
        <span className="text-[0.73vw] text-gold-mid/30">/</span>
        <span className="font-cinzel text-[0.99vw] font-bold text-gold-mid">{q('avg_a')}</span>
      </div>
      <div className="text-[0.52vw] text-gold-mid/50" dangerouslySetInnerHTML={{ __html:`<em style="font-style:normal;color:#C89B3C;font-size:0.63vw;font-weight:700">${q('kda')}</em> KDA` }} />
    </div>
  );
}

function RateBlock({ prefix, params }: { prefix: string; params: Record<string,string> }) {
  const q = (k: string) => p(params, `${prefix}_${k}`, '—');
  return (
    <div className="w-[5.47vw] shrink-0 flex flex-col items-center justify-center gap-[0.56vh] px-[0.31vw]">
      {(['cs_min','gold_min'] as const).map((k, i) => (
        <div key={k} className="flex flex-col items-center gap-[0.09vh]">
          <div className="text-[0.42vw] font-bold tracking-[0.3em] text-gold-mid/40 uppercase">{i === 0 ? 'CS/min' : 'Gold/min'}</div>
          <div className="text-[0.73vw] font-bold text-gold-light">{q(k)}</div>
        </div>
      ))}
    </div>
  );
}

function MatchupRow({ role, params, delay }: { role: string; params: Record<string,string>; delay: number }) {
  return (
    <div
      className="flex-1 flex items-stretch overflow-hidden opacity-0 border border-gold-mid/10"
      style={{ background:'linear-gradient(90deg, rgba(10,20,40,0.82) 0%, rgba(5,12,24,0.62) 50%)', animation:`psRowIn 0.55s cubic-bezier(0.25,0.46,0.45,0.94) ${delay}s both` }}
    >
      <div className="w-1 shrink-0 bg-blue-bright" style={{ boxShadow:'0 0 8px rgba(11,196,227,0.33)' }} />
      <div className="flex-1 min-w-0 flex items-center px-[0.83vw]">
        <div className="font-cinzel text-[1.04vw] font-bold text-gold-light truncate tracking-[0.04em]">
          {p(params, `b_${role}_name`, '—')}
        </div>
      </div>
      <SepV />
      <WrBlock prefix={`b_${role}`} params={params} />
      <SepV />
      <KdaBlock prefix={`b_${role}`} params={params} />
      <SepV />
      <RateBlock prefix={`b_${role}`} params={params} />
      <SepV />
      {/* VS center */}
      <div className="w-[5vw] shrink-0 flex flex-col items-center justify-center gap-[0.28vh] border-x border-gold-mid/10">
        <img src={`${ICON_BASE}/Position_Challenger-${ROLE_ICON_MAP[role]}.png`} alt={ROLE_LABEL[role]} className="w-[1.67vw] h-[1.67vw] object-contain" />
        <div className="text-[0.52vw] font-bold tracking-[0.2em] text-gold-mid uppercase">VS</div>
      </div>
      <SepV />
      <RateBlock prefix={`r_${role}`} params={params} />
      <SepV />
      <KdaBlock prefix={`r_${role}`} params={params} />
      <SepV />
      <WrBlock prefix={`r_${role}`} params={params} />
      <SepV />
      <div className="flex-1 min-w-0 flex items-center justify-end px-[0.83vw]">
        <div className="font-cinzel text-[1.04vw] font-bold text-gold-light truncate tracking-[0.04em] text-right">
          {p(params, `r_${role}_name`, '—')}
        </div>
      </div>
      <div className="w-1 shrink-0 bg-loss" style={{ boxShadow:'0 0 8px rgba(229,115,115,0.33)' }} />
    </div>
  );
}

export default function MatchupStats({ params }: { params: Params }) {
  return (
    <div className="w-full h-full bg-lol-bg relative">
      <div className="absolute -inset-[100px] opacity-5" style={{ backgroundSize:'100px 115px', animation:'hexDrift 25s linear infinite', backgroundImage:HEX_BG }} />
      <div className="absolute inset-0" style={{ background:'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(3,38,64,0.5) 0%, transparent 70%), radial-gradient(ellipse 110% 40% at 50% 100%, rgba(1,10,19,0.9) 0%, transparent 55%)' }} />
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 h-[5.93vh] bg-lol-bg/[96%] border-b border-gold-mid/25 flex items-center justify-center gap-[0.83vw] z-10">
        <span className="font-cinzel text-[1.15vw] font-bold text-blue-bright tracking-[0.08em]">{p(params,'team1','Team Alpha')}</span>
        <span className="font-cinzel text-[0.94vw] font-bold text-gold-mid tracking-[0.2em]">VS</span>
        <span className="font-cinzel text-[1.15vw] font-bold text-loss tracking-[0.08em]">{p(params,'team2','Team Bravo')}</span>
        {/* <div className="w-1 h-1 bg-gold-bright rotate-45" style={{ boxShadow:'0 0 5px #C89B3C' }} /> */}
        {/* <span className="font-cinzel text-[0.68vw] text-gold-mid tracking-[0.2em] uppercase">{p(params,'event','Spring Season 2026')}</span> */}
      </div>
      {/* Rows */}
      <div className="absolute top-[5.93vh] bottom-[4.63vh] left-0 right-0 flex flex-col p-[0vh_2.6vw] gap-[0.74vh] z-10 h-[80%]">
        {(['top','jg','mid','adc','sup'] as const).map((role, i) => (
          <MatchupRow key={role} role={role} params={params} delay={0.08 + i * 0.1} />
        ))}
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
