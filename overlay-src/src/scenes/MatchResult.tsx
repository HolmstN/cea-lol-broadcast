import { p } from './types';
import type { Params } from './types';

export default function MatchResult({ params }: { params: Params }) {
  return (
    <div className="w-full h-full bg-lol-bg flex items-center justify-center">
      <div className="font-cinzel text-[3.33vw] text-gold-light tracking-[0.1em]">
        {p(params, 'winner', '—')}
      </div>
    </div>
  );
}
