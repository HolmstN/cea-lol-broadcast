import { useState } from "react";
import LiveView from "./views/LiveView";
import TeamsView from "./views/TeamsView";
import StreamerView from "./views/StreamerView";
import StatsView from "./views/StatsView";
import MatchView from "./views/MatchView";
import "./App.css";

type Tab = "live" | "teams" | "stats" | "match" | "streamer";

export default function App() {
  const [tab, setTab] = useState<Tab>("live");

  return (
    <main>
      <header>
        <h1>CEA LoL Broadcast</h1>
        <nav className="tabs">
          <button className={`tab ${tab === "live"     ? "active" : ""}`} onClick={() => setTab("live")}>Live</button>
          <button className={`tab ${tab === "teams"    ? "active" : ""}`} onClick={() => setTab("teams")}>Teams</button>
          <button className={`tab ${tab === "stats"    ? "active" : ""}`} onClick={() => setTab("stats")}>Stats</button>
          <button className={`tab ${tab === "match"    ? "active" : ""}`} onClick={() => setTab("match")}>Match</button>
          <button className={`tab ${tab === "streamer" ? "active" : ""}`} onClick={() => setTab("streamer")}>Streamer</button>
        </nav>
      </header>

      <div className="view">
        {tab === "live"     && <LiveView />}
        {tab === "teams"    && <TeamsView />}
        {tab === "stats"    && <StatsView />}
        {tab === "match"    && <MatchView />}
        {tab === "streamer" && <StreamerView />}
      </div>
    </main>
  );
}
