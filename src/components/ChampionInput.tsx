import { useState, useRef, useEffect, useCallback } from "react";

const MAX_SUGGESTIONS = 8;

function filter(champions: string[], query: string): string[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const starts = champions.filter((c) => c.toLowerCase().startsWith(q));
  const contains = champions.filter(
    (c) => !c.toLowerCase().startsWith(q) && c.toLowerCase().includes(q)
  );
  return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  champions: string[];
  className?: string;
  placeholder?: string;
}

export default function ChampionInput({ value, onChange, champions, className, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = filter(champions, value);
  const showDropdown = open && suggestions.length > 0;

  const select = useCallback((name: string) => {
    onChange(name);
    setOpen(false);
    setHighlighted(0);
  }, [onChange]);

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(suggestions[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="champion-input-wrap">
      <input
        ref={inputRef}
        className={className}
        placeholder={placeholder ?? "Champion"}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlighted(0); }}
        onFocus={() => { if (value) setOpen(true); }}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {showDropdown && (
        <ul className="champion-dropdown">
          {suggestions.map((name, i) => (
            <li
              key={name}
              className={i === highlighted ? "champion-option highlighted" : "champion-option"}
              onMouseDown={(e) => { e.preventDefault(); select(name); }}
              onMouseEnter={() => setHighlighted(i)}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
