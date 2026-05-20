import { p } from "./types";
import type { Params } from "./types";

const HEX_BG =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='115'%3E%3Cpolygon points='50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5' stroke='%23C8AA6E' stroke-width='1' fill='none'/%3E%3C/svg%3E")`;

const ROLE_ICON_MAP: Record<string, string> = {
  top: "Top",
  jg: "Jungle",
  mid: "Mid",
  adc: "Bot",
  sup: "Support",
};
const ROLE_LABEL: Record<string, string> = {
  top: "Top",
  jg: "Jungle",
  mid: "Mid",
  adc: "ADC",
  sup: "Support",
};
const ROLE_COLOR: Record<string, string> = {
  top: "#C8AA6E",
  jg: "#4FC65A",
  mid: "#0BC4E3",
  adc: "#E57373",
  sup: "#9C78E8",
};
const ICON_BASE = "http://localhost:7234/icons";

function SepV() {
  return <div className="w-px shrink-0 self-stretch bg-gold-mid/[7%]" />;
}

function PlayerRow(
  { role, params, delay }: {
    role: string;
    params: Record<string, string>;
    delay: number;
  },
) {
  const color = ROLE_COLOR[role];
  const q = (k: string, fb = "—") => p(params, `${role}_${k}`, fb);

  return (
    <div
      className="flex-1 flex items-stretch relative overflow-hidden opacity-0 border border-gold-mid/10 border-l-0"
      style={{
        background:
          "linear-gradient(90deg, rgba(10,20,40,0.82) 0%, rgba(5,12,24,0.62) 100%)",
        animation:
          `psRowIn 0.55s cubic-bezier(0.25,0.46,0.45,0.94) ${delay}s both`,
      }}
    >
      {/* Accent */}
      <div
        className="w-1 shrink-0"
        style={{ background: color, boxShadow: `0 0 8px ${color}55` }}
      />
      {/* Role */}
      <div className="w-1/12 shrink-0 flex flex-col items-center justify-center gap-[0.37vh]">
        <img
          src={`${ICON_BASE}/Position_Challenger-${ROLE_ICON_MAP[role]}.png`}
          alt={ROLE_LABEL[role]}
          className="w-[1.77vw] h-[1.77vw] object-contain"
        />
        <div
          className="text-xs font-bold tracking-[0.3em] uppercase"
          style={{ color }}
        >
          {ROLE_LABEL[role]}
        </div>
      </div>
      <SepV />
      {/* Name */}
      <div className="flex flex-col w-3/12 shrink-0 justify-center items-center px-[0.94vw]">
        <div className="font-cinzel text-xl font-bold tracking-[0.05em] text-gold-light truncate mb-4">
          {q("name")}
        </div>
        <div className="text-xs font-bold tracking-[0.3em] uppercase text-gold-mid/80">
          Rank
        </div>
        <div className="text-md font-bold text-blue-bright text-center">
          {q("rank")}
        </div>
      </div>
      <SepV />
      {/* Game W/L */}
      <div className="w-1/12 shrink-0 flex flex-col items-center justify-center px-[0.31vw] gap-[0.28vh]">
        <div className="text-xs font-bold tracking-[0.3em] uppercase text-gold-mid/80">
          Game W/L
        </div>
        <div className="flex items-baseline gap-[0.21vw]">
          <span className="font-cinzel text-md font-bold text-win">
            {q("game_wins", "0")}W
          </span>
          <span className="text-md text-gold-mid/30">–</span>
          <span className="font-cinzel text-md font-bold text-loss">
            {q("game_losses", "0")}L
          </span>
        </div>
        <div className="text-sm text-gold-mid/50 tracking-[0.04em]">
          {q("game_wr")} Win Rate
        </div>
      </div>
      <SepV />
      {/* Match W/L */}
      <div className="w-1/12 shrink-0 flex flex-col items-center justify-center px-[0.31vw] gap-[0.28vh]">
        <div className="text-xs font-bold tracking-[0.3em] uppercase text-gold-mid/80">
          Match W/L
        </div>
        <div className="flex items-baseline gap-[0.21vw]">
          <span className="font-cinzel text-md font-bold text-win">
            {q("match_wins", "0")}W
          </span>
          <span className="text-md text-gold-mid/30">–</span>
          <span className="font-cinzel text-md font-bold text-loss">
            {q("match_losses", "0")}L
          </span>
        </div>
        <div className="text-sm text-gold-mid/50 tracking-[0.04em]">
          {q("match_wr")} Match Rate
        </div>
      </div>
      <SepV />
      {/* K/D/A */}
      <div className="flex w-4/12 flex-col items-center justify-center px-[0.42vw] gap-[0.28vh]">
        <div className="text-xs font-bold tracking-[0.3em] uppercase text-gold-mid/80">
          Avg K / D / A
        </div>
        <div className="flex items-center">
          {(["k", "d", "a"] as const).map((stat, i) => {
            const statColor = stat === "k"
              ? "text-win"
              : stat === "d"
              ? "text-loss"
              : "text-gold-mid";
            const statLabel = stat === "k"
              ? "Kills"
              : stat === "d"
              ? "Deaths"
              : "Assists";
            return (
              <>
                {i > 0 && (
                  <span
                    key={`sep${i}`}
                    className="text-[0.78vw] font-light text-gold-mid/20 mx-[0.21vw] pb-[0.74vh]"
                  >
                    /
                  </span>
                )}
                <div
                  key={stat}
                  className="flex flex-col items-center gap-[0.19vh] w-[2.71vw]"
                >
                  <span
                    className={`font-cinzel text-[1.15vw] font-bold leading-none ${statColor}`}
                  >
                    {q(`avg_${stat}`)}
                  </span>
                </div>
              </>
            );
          })}
        </div>
        <div className="text-md text-gold-mid/50">
          <em
            style={{
              fontStyle: "normal",
              color: "#C89B3C",
              fontWeight: 700,
            }}
          >
            {q("kda")}
          </em>{" "}
          KDA
        </div>
      </div>
      <SepV />
      {/* CS / Gold */}
      <div className="w-1/12 shrink-0 flex flex-col items-center justify-center gap-[0.74vh] px-[0.31vw]">
        {(["cs_min", "gold_min"] as const).map((k, i) => (
          <div key={k} className="flex flex-col items-center gap-[0.19vh]">
            <div className="text-xs font-bold tracking-[0.3em] uppercase text-gold-mid/80">
              {i === 0 ? "CS / min" : "Gold / min"}
            </div>
            <div className="text-[0.83vw] font-bold text-gold-light">
              {q(k)}
            </div>
          </div>
        ))}
      </div>
      <SepV />
      {/* Fav Champion */}
      <div className="w-1/12 shrink-0 flex flex-col items-center justify-center gap-[0.37vh] px-[0.42vw]">
        <div className="text-xs text-center font-bold tracking-[0.3em] uppercase text-gold-mid/80">
          Fav Champion
        </div>
        <div className="font-cinzel text-xl font-bold text-gold-bright text-center">
          {q("fav_champ")}
        </div>
        <div className="text-sm text-gold-mid/50 text-center">
          {q("champ_wins", "0")}W–{q("champ_losses", "0")}L | {q("champ_kda")}
          {" "}
          KDA
        </div>
      </div>
    </div>
  );
}

export default function PlayerStats({ params }: { params: Params }) {
  return (
    <div className="w-full h-full bg-lol-bg relative">
      <div
        className="absolute -inset-[100px] opacity-5"
        style={{
          backgroundSize: "100px 115px",
          animation: "hexDrift 25s linear infinite",
          backgroundImage: HEX_BG,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 50% at 50% 20%, rgba(3,38,64,0.55) 0%, transparent 70%), radial-gradient(ellipse 100% 40% at 50% 100%, rgba(1,10,19,0.85) 0%, transparent 60%)",
        }}
      />
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 h-[5.93vh] bg-lol-bg/[96%] border-b border-gold-mid/25 flex items-center justify-center gap-[1.25vw] z-10">
        <span
          className="font-cinzel text-[1.25vw] font-black tracking-[0.12em] text-gold-light uppercase"
          style={{ textShadow: "0 0 20px rgba(200,155,60,0.4)" }}
        >
          {p(params, "teamName", "Team Alpha")}
        </span>
        <div
          className="w-1 h-1 bg-gold-bright rotate-45"
          style={{ boxShadow: "0 0 5px #C89B3C" }}
        />
        <span className="font-cinzel text-[0.68vw] font-bold tracking-[0.3em] text-gold-mid uppercase">
          Player Statistics
        </span>
        <div
          className="w-1 h-1 bg-gold-bright rotate-45"
          style={{ boxShadow: "0 0 5px #C89B3C" }}
        />
        <span className="font-cinzel text-[0.68vw] font-bold tracking-[0.3em] text-gold-mid uppercase">
          {p(params, "event", "Spring Season 2025")}
        </span>
      </div>
      {/* Rows */}
      <div className="absolute top-[5.93vh] bottom-[4.63vh] left-0 right-0 flex flex-col p-[1.48vh_2.6vw] gap-[0.74vh] z-10">
        {(["top", "jg", "mid", "adc", "sup"] as const).map((role, i) => (
          <PlayerRow
            key={role}
            role={role}
            params={params}
            delay={0.08 + i * 0.1}
          />
        ))}
      </div>
      {/* Bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[4.63vh] bg-lol-bg/[96%] border-t border-gold-mid/20 flex items-center justify-center gap-[1.04vw] z-10">
        <span className="text-[0.63vw] font-medium tracking-[0.2em] text-gold-mid/55 uppercase">
          Corporate Esports Association
        </span>
        <div className="w-0.75 h-0.75 bg-gold-dark rotate-45" />
        <span className="text-[0.63vw] font-medium tracking-[0.2em] text-gold-mid/55 uppercase">
          League of Legends
        </span>
      </div>
    </div>
  );
}
