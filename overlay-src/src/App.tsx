import { useEffect, useRef, useState } from 'react';
import { useOverlayWS } from './hooks/useOverlayWS';
import Idle from './scenes/Idle';
import StartingSoon from './scenes/StartingSoon';
import MatchIntro from './scenes/MatchIntro';
import Break from './scenes/Break';
import MatchResult from './scenes/MatchResult';
import PlayerStats from './scenes/PlayerStats';
import MatchupStats from './scenes/MatchupStats';
import PlayerSpotlight from './scenes/PlayerSpotlight';

type Params = Record<string, string>;
type SceneComp = React.ComponentType<{ params: Params }>;

const SCENES: Record<string, SceneComp> = {
  'idle':             Idle,
  'starting-soon':    StartingSoon,
  'match-intro':      MatchIntro,
  'break':            Break,
  'match-result':     MatchResult,
  'player-stats':     PlayerStats,
  'matchup-stats':    MatchupStats,
  'player-spotlight': PlayerSpotlight,
};

export default function App() {
  const { scene, params } = useOverlayWS();

  const [cur, setCur] = useState<{ scene: string; params: Params; key: number }>({
    scene, params, key: 0,
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (scene === cur.scene) {
      setCur(c => ({ ...c, params }));
      return;
    }
    setCur({ scene, params, key: cur.key + 1 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, params]);

  const SceneComp = SCENES[cur.scene] ?? Idle;

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div className="scene-wrap" key={cur.key}>
        <SceneComp params={cur.params} />
      </div>
    </div>
  );
}
