import { p } from "./types";
import type { Params } from "./types";

function fmtG(g: number) {
  return g >= 1000 ? `${(g / 1000).toFixed(1)}k` : String(g);
}

function PlayerRow(
  { side, idx, params }: { side: "b" | "r"; idx: number; params: Params },
) {
  const q = (k: string) => p(params, `${side}${idx}_${k}`, "");
  const name = q("name");
  const champ = q("champ");
  const k = q("k") || "0";
  const d = q("d") || "0";
  const a = q("a") || "0";
  const cs = q("cs") || "0";
  const gold = fmtG(parseInt(q("gold") || "0"));

  if (!name) return null;

  const isRed = side === "r";

  return (
    <div
      className={`flex items-center gap-[0.52vw] px-[0.73vw] py-[0.37vh] border-b border-gold-mid/[5%] ${
        isRed ? "flex-row-reverse" : ""
      }`}
      style={{
        background: isRed ? "rgba(229,115,115,0.03)" : "rgba(11,196,227,0.03)",
      }}
    >
      <div
        className={`w-1/3 font-cinzel text-[0.68vw] font-bold text-gold-light truncate min-w-0 flex-1 ${
          isRed ? "text-right" : ""
        }`}
      >
        {name}
      </div>
      <div className="w-1/3">Items Go Here</div>
      <div className="w-1/12 text-[0.47vw] text-gold-mid/45 truncate">
        {champ}
      </div>
      <div className="w-1/12 text-[0.57vw] font-mono leading-none">
        <span className="text-win">{k}</span>
        <span className="text-gold-mid/25">/</span>
        <span className="text-loss">{d}</span>
        <span className="text-gold-mid/25">/</span>
        <span className="text-gold-mid">{a}</span>
      </div>
      <div className="w-1/12 text-[0.47vw] text-gold-mid/35 shrink-0 font-mono">
        {cs}cs
      </div>
      <div
        className={`w-1/12 text-[0.47vw] font-mono font-bold shrink-0 ${
          isRed ? "text-loss/60" : "text-blue-bright/60"
        }`}
      >
        {gold}
      </div>
    </div>
  );
}

export default function LiveHUD({ params }: { params: Params }) {
  const q = (k: string, fb = "") => p(params, k, fb);

  const timer = q("timer", "0:00");
  const team1 = q("team1", "Blue");
  const team2 = q("team2", "Red");
  const blueKills = q("blue_kills", "0");
  const redKills = q("red_kills", "0");
  const blueGold = parseInt(q("blue_gold", "0"));
  const redGold = parseInt(q("red_gold", "0"));

  const totalGold = blueGold + redGold || 1;
  const blueGoldPct = (blueGold / totalGold) * 100;
  const goldDiff = blueGold - redGold;
  const goldDiffAbs = Math.abs(goldDiff);

  return (
    <div className="w-full h-full relative pointer-events-none">
      {/* HUD panel anchored to top */}
      <div className="h-full flex flex-col border-b border-gold-mid/20">
        {/* Bottom shimmer line */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(200,170,110,0.25), transparent)",
          }}
        />

        {/* ── Score row ── */}
        <div
          className="flex flex-col flex-1 items-start pt-8"
          style={{
            minHeight: "5vh",
            background:
              "linear-gradient(180deg, rgba(1,10,19,0.97) 0%, rgba(1,10,19,0.93) 10%, rgba(1,10,19,0.0) 20%)",
          }}
        >
          <div className="flex items-center w-full">
            {/* Blue team */}
            <div className="flex items-center gap-[0.73vw] px-[1.25vw] flex-1 min-w-0">
              <div className="font-cinzel text-[1.04vw] font-black tracking-[0.06em] text-blue-bright truncate">
                {team1}
              </div>
              <div className="flex items-baseline gap-[0.26vw]">
                <span className="font-cinzel text-[1.56vw] font-black text-gold-light leading-none">
                  {blueKills}
                </span>
                <span className="text-[0.42vw] font-bold tracking-[0.2em] text-gold-mid/35 uppercase">
                  kills
                </span>
              </div>
            </div>

            {/* Center: timer */}
            <div className="flex flex-col items-center shrink-0 px-[2.6vw]">
              <div className="font-cinzel text-[1.46vw] font-black text-gold-light tracking-[0.08em] leading-none">
                {timer}
              </div>
              <div className="text-[0.36vw] font-bold tracking-[0.4em] text-gold-mid/35 uppercase mt-[0.19vh]">
                Game Time
              </div>
            </div>

            {/* Red team */}
            <div className="flex items-center justify-end gap-[0.73vw] px-[1.25vw] flex-1 min-w-0">
              <div className="flex items-baseline gap-[0.26vw]">
                <span className="text-[0.42vw] font-bold tracking-[0.2em] text-gold-mid/35 uppercase">
                  kills
                </span>
                <span className="font-cinzel text-[1.56vw] font-black text-gold-light leading-none">
                  {redKills}
                </span>
              </div>
              <div className="font-cinzel text-[1.04vw] font-black tracking-[0.06em] text-loss truncate">
                {team2}
              </div>
            </div>
          </div>

          {/* ── Gold bar ── */}
          <div className="w-full flex items-center gap-[0.52vw] px-[1.25vw] pb-[0.56vh]">
            <span className="font-cinzel text-[0.52vw] font-bold text-blue-bright/65 w-[3.75vw] text-right tabular-nums">
              {fmtG(blueGold)}g
            </span>
            <div className="flex-1 relative" style={{ height: "0.46vh" }}>
              <div className="absolute inset-0 rounded-full bg-gold-mid/[8%]" />
              <div
                className="absolute left-0 top-0 bottom-0 rounded-full transition-all duration-700"
                style={{
                  width: `${blueGoldPct}%`,
                  background: "rgba(11,196,227,0.55)",
                }}
              />
            </div>
            {goldDiffAbs > 0 && (
              <span
                className="text-[0.42vw] font-bold tabular-nums shrink-0"
                style={{
                  color: goldDiff > 0
                    ? "rgba(11,196,227,0.7)"
                    : "rgba(229,115,115,0.7)",
                }}
              >
                {goldDiff > 0 ? "+" : "−"}
                {fmtG(goldDiffAbs)}
              </span>
            )}
            <span className="font-cinzel text-[0.52vw] font-bold text-loss/65 w-[3.75vw] tabular-nums">
              {fmtG(redGold)}g
            </span>
          </div>
        </div>

        {/* ── Player rows ── */}
        <div
          className="flex border-t border-gold-mid/[6%] w-2/3 justify-center mx-auto"
          style={{ background: "rgba(1,10,19,0.93) " }}
        >
          {/* Blue side */}
          <div className="flex-1 min-w-0">
            {[0, 1, 2, 3, 4].map((i) => (
              <PlayerRow key={i} side="b" idx={i} params={params} />
            ))}
          </div>

          {/* Centre divider */}
          <div className="w-px shrink-0 bg-gold-mid/[8%]" />

          {/* Red side */}
          <div className="flex-1 min-w-0">
            {[0, 1, 2, 3, 4].map((i) => (
              <PlayerRow key={i} side="r" idx={i} params={params} />
            ))}
          </div>
        </div>

        {/* CEA brand line */}
        <div
          className="flex items-center justify-center py-[0.28vh]"
          style={{ borderTop: "1px solid rgba(200,170,110,0.06)" }}
        >
          <span className="text-[0.36vw] font-bold tracking-[0.4em] text-gold-mid/20 uppercase font-cinzel">
            Corporate Esports Association
          </span>
        </div>
      </div>
    </div>
  );
}
