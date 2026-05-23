import type { Params } from "./types";
const p = (params: Params, k: string, fb = "") => params[k] || fb;

const CornerSvg = () => (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
    <path d="M2 78 L2 2 L78 2" stroke="#C8AA6E" strokeWidth="2" />
    <path d="M2 2 L22 2 M2 2 L2 22" stroke="#C89B3C" strokeWidth="3" />
  </svg>
);

export default function StartingSoon({ params }: { params: Params }) {
  const event = p(params, "event", "Spring Season 2025");
  return (
    <div className="w-full h-full bg-lol-bg relative font-inter text-gold-light overflow-hidden">
      {/* Grid background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(12,196,227,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(12,196,227,0.04) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          animation: "gridDrift 30s linear infinite",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(3,38,64,0.9) 0%, transparent 70%), radial-gradient(ellipse 100% 80% at 50% 100%, rgba(1,10,19,1) 40%, transparent 100%)",
        }}
      />
      {/* Scan line */}
      <div
        className="absolute left-0 right-0 h-0.5 opacity-30"
        style={{
          background:
            "linear-gradient(90deg, transparent, #0BC4E3, transparent)",
          animation: "scan 6s ease-in-out infinite",
        }}
      />
      {/* Corners */}
      <div className="absolute top-[2.78vh] left-[1.56vw]">
        <CornerSvg />
      </div>
      <div className="absolute top-[2.78vh] right-[1.56vw] scale-x-[-1]">
        <CornerSvg />
      </div>
      <div className="absolute bottom-[2.78vh] left-[1.56vw] scale-y-[-1]">
        <CornerSvg />
      </div>
      <div className="absolute bottom-[2.78vh] right-[1.56vw] scale-[-1]">
        <CornerSvg />
      </div>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <svg
          className="w-[4.69vw] h-[4.69vw] mb-[2.59vh]"
          style={{ animation: "badgePulse 3s ease-in-out infinite" }}
          viewBox="0 0 90 90"
          fill="none"
        >
          <polygon
            points="45,4 86,45 45,86 4,45"
            stroke="#C8AA6E"
            strokeWidth="2"
            fill="rgba(3,38,64,0.8)"
          />
          <polygon
            points="45,14 76,45 45,76 14,45"
            stroke="#C89B3C"
            strokeWidth="1.5"
            fill="none"
          />
          <circle cx="45" cy="45" r="12" fill="#C8AA6E" opacity="0.15" />
          <polygon
            points="45,28 62,45 45,62 28,45"
            fill="#C8AA6E"
            opacity="0.3"
          />
          <circle cx="45" cy="45" r="5" fill="#C89B3C" />
        </svg>
        <div className="text-[0.83vw] font-medium tracking-[0.35em] text-blue-bright uppercase mb-[1.48vh]">
          {event}
        </div>
        <div
          className="font-cinzel text-[4.17vw] font-black tracking-[0.12em] uppercase text-gold-light text-center leading-none"
          style={{
            textShadow:
              "0 0 40px rgba(200,155,60,0.6), 0 0 80px rgba(200,155,60,0.3)",
          }}
        >
          Grand Finals
        </div>
        <div className="flex items-center gap-[0.83vw] my-[2.22vh] w-[33.33vw]">
          <div
            className="flex-1 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, #C8AA6E, transparent)",
            }}
          />
          <div
            className="w-2 h-2 bg-gold-bright rotate-45"
            style={{ boxShadow: "0 0 8px rgba(200,155,60,0.8)" }}
          />
          <div
            className="flex-1 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, #C8AA6E, transparent)",
            }}
          />
        </div>
        <div className="font-cinzel text-[1.04vw] font-semibold tracking-[0.3em] text-gold-mid uppercase">
          Corporate Esports Association
        </div>
        <div className="mt-[5.19vh] flex flex-col items-center gap-[1.11vh]">
          <div
            className="px-[2.92vw] py-[1.3vh] bg-lol-panel/80 border-t border-b border-gold-dark"
            style={{
              clipPath:
                "polygon(16px 0, 100% 0, calc(100% - 16px) 100%, 0 100%)",
            }}
          >
            <div
              className="text-[0.94vw] font-semibold tracking-[0.4em] text-gold-mid uppercase"
              style={{ animation: "statusPulse 2s ease-in-out infinite" }}
            >
              Broadcast Starting Soon
            </div>
          </div>
          <div className="flex gap-2.5">
            {[0, 0.2, 0.4].map((delay, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-blue-bright"
                style={{
                  animation: `dotPulse 1.4s ease-in-out ${delay}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
      {/* Bottom banner */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[5.19vh] border-t border-gold-mid/25 flex items-center justify-center gap-[1.67vw]"
        style={{
          background:
            "linear-gradient(90deg, #032640 0%, rgba(3,38,64,0.95) 50%, #032640 100%)",
        }}
      >
        {["Corporate Esports Association", event, "League of Legends"].map((
          t,
          i,
          a,
        ) => (
          <>
            <span
              key={t}
              className="text-[0.68vw] font-medium tracking-[0.15em] text-gold-mid/70 uppercase"
            >
              {t}
            </span>
            {i < a.length - 1 && (
              <div
                key={`sep-${i}`}
                className="w-0.75 h-0.75 bg-gold-dark rotate-45"
              />
            )}
          </>
        ))}
      </div>
    </div>
  );
}
