import { p } from './types';
import type { Params } from './types';

export default function Break({ params }: { params: Params }) {
  return (
    <div className="w-full h-full bg-lol-bg flex items-center justify-center">
      <div className="font-cinzel text-[2.5vw] text-gold-mid tracking-[0.2em]">
        {p(params, 'sub', 'Intermission')}
      </div>
    </div>
  );
}
