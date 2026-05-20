import { p } from './types';
import type { Params } from './types';

export default function MatchIntro({ params }: { params: Params }) {
  return (
    <div className="relative w-full h-full font-inter">
      {/* Blue / Red split backgrounds */}
      <div className="absolute inset-0" style={{ left:0, right:'50%', background:'linear-gradient(135deg, #061825 0%, #0d2a45 60%, #1A3A5C 100%)', clipPath:'polygon(0 0, 100% 0, calc(100% - 6.25vw) 100%, 0 100%)' }} />
      <div className="absolute inset-0" style={{ left:'50%', background:'linear-gradient(225deg, #1a0808 0%, #2e0f0f 60%, #4A1A1A 100%)', clipPath:'polygon(6.25vw 0, 100% 0, 100% 100%, 0 100%)' }} />
      <div className="absolute inset-0" style={{ background:'radial-gradient(ellipse 40% 80% at 50% 50%, rgba(1,10,19,0.5) 0%, rgba(1,10,19,0.2) 100%)' }} />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 h-[5.93vh] bg-lol-bg/90 border-b border-gold-mid/30 flex items-center justify-center gap-[1.25vw]">
        {[p(params,'event','Spring Season 2025'), p(params,'round','Quarterfinals'), p(params,'format','Best of 3')].map((t, i, a) => (
          <>
            <span key={t} className="font-cinzel text-[0.78vw] font-bold tracking-[0.3em] text-gold-mid uppercase">{t}</span>
            {i < a.length - 1 && <div key={`s${i}`} className="w-1 h-1 bg-gold-bright rotate-45" style={{ boxShadow:'0 0 6px #C89B3C' }} />}
          </>
        ))}
      </div>

      {/* Center line */}
      <div className="absolute left-1/2 -translate-x-px top-[5.93vh] bottom-[5vh] w-px" style={{ background:'linear-gradient(180deg, transparent, #785A28 20%, #785A28 80%, transparent)' }} />

      {/* Blue team */}
      <div className="absolute left-0 top-[5.93vh] bottom-[5vh] w-[45.83vw] flex flex-col items-center justify-center pr-[4.17vw]" style={{ animation:'slideRight 0.7s cubic-bezier(0.25,0.46,0.45,0.94) 0.3s both' }}>
        <div className="text-[0.63vw] font-bold tracking-[0.4em] uppercase mb-[1.67vh] text-blue-bright">Blue Side</div>
        <div className="font-cinzel text-[3.75vw] font-black text-center leading-none tracking-[0.04em] uppercase text-gold-light" style={{ textShadow:'0 0 40px rgba(11,196,227,0.4), 0 0 80px rgba(11,196,227,0.2)' }}>
          {p(params,'team1','Team Alpha')}
        </div>
        <div className="w-[10.42vw] h-0.75 mt-[1.67vh] rounded-sm" style={{ background:'linear-gradient(90deg, transparent, #0BC4E3, transparent)', boxShadow:'0 0 12px #0397AB' }} />
        <div className="text-[0.83vw] font-normal tracking-[0.15em] text-gold-light/45 mt-[1.3vh] uppercase">{p(params,'record1','')}</div>
      </div>

      {/* Center VS block */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-[0.83vw]">
        <div className="relative w-[6.25vw] h-[6.25vw]">
          <svg className="absolute inset-0 w-full h-full" style={{ animation:'vsReveal 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.5s both' }} viewBox="0 0 120 120" fill="none">
            <polygon points="60,4 112,32 112,88 60,116 8,88 8,32" stroke="#C8AA6E" strokeWidth="1.5" fill="none" opacity="0.5"/>
            <polygon points="60,14 102,38 102,82 60,106 18,82 18,38" stroke="#785A28" strokeWidth="1" fill="none" opacity="0.4"/>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center font-cinzel text-[1.875vw] font-black text-gold-light tracking-[0.1em]">VS</div>
        </div>
        <div className="flex items-center gap-[0.42vw]">
          <div className="w-[2.08vw] h-px" style={{ background:'linear-gradient(90deg, transparent, #785A28)' }} />
          <div className="w-1 h-1 bg-gold-dark rotate-45" />
          <div className="w-[2.08vw] h-px" style={{ background:'linear-gradient(90deg, #785A28, transparent)' }} />
        </div>
        <div className="font-cinzel text-[0.68vw] font-semibold tracking-[0.2em] text-gold-mid/50 uppercase">{p(params,'matchnum','')}</div>
      </div>

      {/* Red team */}
      <div className="absolute right-0 top-[5.93vh] bottom-[5vh] w-[45.83vw] flex flex-col items-center justify-center pl-[4.17vw]" style={{ animation:'slideLeft 0.7s cubic-bezier(0.25,0.46,0.45,0.94) 0.3s both' }}>
        <div className="text-[0.63vw] font-bold tracking-[0.4em] uppercase mb-[1.67vh] text-loss">Red Side</div>
        <div className="font-cinzel text-[3.75vw] font-black text-center leading-none tracking-[0.04em] uppercase text-gold-light" style={{ textShadow:'0 0 40px rgba(229,115,115,0.4), 0 0 80px rgba(229,115,115,0.2)' }}>
          {p(params,'team2','Team Bravo')}
        </div>
        <div className="w-[10.42vw] h-0.75 mt-[1.67vh] rounded-sm" style={{ background:'linear-gradient(90deg, transparent, #E57373, transparent)', boxShadow:'0 0 12px rgba(229,115,115,0.7)' }} />
        <div className="text-[0.83vw] font-normal tracking-[0.15em] text-gold-light/45 mt-[1.3vh] uppercase">{p(params,'record2','')}</div>
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[5vh] bg-lol-bg/90 border-t border-gold-mid/20 flex items-center justify-center gap-[1.04vw]">
        <span className="text-[0.68vw] font-medium tracking-[0.2em] text-gold-mid/60 uppercase">Corporate Esports Association</span>
        <div className="w-1 h-1 bg-gold-mid/40 rotate-45" />
        <span className="text-[0.68vw] font-medium tracking-[0.2em] text-gold-mid/60 uppercase">League of Legends</span>
      </div>
    </div>
  );
}
