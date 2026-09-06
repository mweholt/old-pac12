'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import Image from 'next/image';
import { SiteHeader } from '@/components/site-header';

type Era = 'old' | 'new';
type Result = { date: string; pointsFor: number; pointsAgainst: number; outcome: 'W' | 'L' | 'T' };
type Standing = {
  id: string;
  name: string;
  abbreviation: string;
  logo: string;
  color: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  streak: string;
  lastFive: Array<'W' | 'L' | 'T'>;
};
type EspnScore = string | number | { value?: string | number; displayValue?: string | number };
type EspnCompetitor = { team?: { id?: string }; score?: EspnScore; winner?: boolean };
type EspnEvent = {
  date?: string;
  competitions?: Array<{ status?: { type?: { completed?: boolean } }; competitors?: EspnCompetitor[] }>;
};
type EspnSchedule = {
  team?: { displayName?: string; abbreviation?: string; logo?: string; color?: string };
  events?: EspnEvent[];
};

const TEAM_GROUPS: Record<Era, Array<[string, string]>> = {
  old: [
    ['12', 'Arizona'], ['9', 'Arizona State'], ['25', 'California'], ['38', 'Colorado'],
    ['2483', 'Oregon'], ['204', 'Oregon State'], ['24', 'Stanford'], ['26', 'UCLA'],
    ['30', 'USC'], ['254', 'Utah'], ['264', 'Washington'], ['265', 'Washington State'],
  ],
  new: [
    ['68', 'Boise State'], ['36', 'Colorado State'], ['278', 'Fresno State'], ['204', 'Oregon State'],
    ['21', 'San Diego State'], ['326', 'Texas State'], ['328', 'Utah State'], ['265', 'Washington State'],
  ],
};

function currentSeason() {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

function numberScore(value: unknown) {
  if (typeof value === 'object' && value !== null) {
    const score = value as { value?: unknown; displayValue?: unknown };
    return Number(score.value ?? score.displayValue ?? 0);
  }
  return Number(value ?? 0);
}

function summarizeTeam(payload: EspnSchedule, id: string, fallbackName: string): Standing {
  const results: Result[] = (payload.events ?? []).flatMap((event) => {
    const competition = event.competitions?.[0];
    if (!competition?.status?.type?.completed) return [];
    const mine = competition.competitors?.find((competitor) => String(competitor.team?.id) === id);
    const opponent = competition.competitors?.find((competitor) => String(competitor.team?.id) !== id);
    if (!mine || !opponent) return [];
    const pointsFor = numberScore(mine.score);
    const pointsAgainst = numberScore(opponent.score);
    return [{
      date: event.date ?? '', pointsFor, pointsAgainst,
      outcome: pointsFor === pointsAgainst ? 'T' : mine.winner ? 'W' : 'L',
    } as Result];
  }).sort((a: Result, b: Result) => new Date(a.date).valueOf() - new Date(b.date).valueOf());

  const lastOutcome = results.at(-1)?.outcome;
  let streakCount = 0;
  for (let index = results.length - 1; index >= 0 && results[index].outcome === lastOutcome; index -= 1) streakCount += 1;

  return {
    id,
    name: payload.team?.displayName ?? fallbackName,
    abbreviation: payload.team?.abbreviation ?? '',
    logo: payload.team?.logo ?? '',
    color: payload.team?.color ?? '',
    wins: results.filter((result) => result.outcome === 'W').length,
    losses: results.filter((result) => result.outcome === 'L').length,
    ties: results.filter((result) => result.outcome === 'T').length,
    pointsFor: results.reduce((total, result) => total + result.pointsFor, 0),
    pointsAgainst: results.reduce((total, result) => total + result.pointsAgainst, 0),
    streak: lastOutcome ? `${lastOutcome}${streakCount}` : '—',
    lastFive: results.slice(-5).map((result) => result.outcome),
  };
}

function TeamMark({ team }: { team: Standing }) {
  if (team.logo) return <Image src={team.logo} alt="" width={36} height={36} unoptimized />;
  return <span style={{ backgroundColor: team.color ? `#${team.color}` : '#0072bc' }}>{team.abbreviation.slice(0, 1)}</span>;
}

export default function StandingsPage() {
  const [era, setEra] = useState<Era>('old');
  const [standings, setStandings] = useState<Record<Era, Standing[]>>({ old: [], new: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const season = currentSeason();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const uniqueTeams = new Map([...TEAM_GROUPS.old, ...TEAM_GROUPS.new]);
      const settled = await Promise.allSettled([...uniqueTeams].map(async ([id, fallbackName]) => {
        const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/${id}/schedule?season=${season}&seasontype=2`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`ESPN returned ${response.status}`);
        return summarizeTeam(await response.json() as EspnSchedule, id, fallbackName);
      }));
      const teams = settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
      if (!teams.length) throw new Error('Live ESPN standings could not be loaded.');
      const byId = new Map(teams.map((team) => [team.id, team]));
      setStandings({
        old: TEAM_GROUPS.old.flatMap(([id]) => byId.has(id) ? [byId.get(id)!] : []),
        new: TEAM_GROUPS.new.flatMap(([id]) => byId.has(id) ? [byId.get(id)!] : []),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Live ESPN standings could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [season]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const ranked = useMemo(() => [...standings[era]].sort((a, b) =>
    b.wins - a.wins || a.losses - b.losses ||
    (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst) || a.name.localeCompare(b.name),
  ), [era, standings]);

  return (
    <main className="min-h-screen">
      <SiteHeader active="standings" season={season} />

      <div className="era-filter-bar standings-filter">
        <div>
          <p className="standings-kicker">{season} season</p>
          <h1>Standings</h1>
        </div>
        <div className="era-switch" aria-label="Choose Pac-12 era">
          <button className={era === 'old' ? 'active' : ''} onClick={() => setEra('old')}>Old Pac-12</button>
          <button className={era === 'new' ? 'active' : ''} onClick={() => setEra('new')}>New Pac-12</button>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-5 py-6 sm:px-8 sm:py-8">
        <div className="standings-shell">
          <div className="standings-heading">
            <div>
              <h2>{era === 'old' ? 'Former Pac-12 teams' : 'New Pac-12 teams'}</h2>
              <p>Overall regular-season records</p>
            </div>
            <button className="icon-button" aria-label="Refresh standings" disabled={loading} onClick={() => void load()}>
              <RefreshCw className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {error ? (
            <div className="error-state standings-error"><p>{error}</p><button className="retry-button" onClick={() => void load()}><RefreshCw />Try again</button></div>
          ) : loading && !ranked.length ? (
            <div className="standings-loading">{TEAM_GROUPS[era].map(([id]) => <div key={id} className="loading-block" />)}</div>
          ) : (
            <div className="standings-table-wrap">
              <table className="standings-table">
                <thead><tr><th>Rank</th><th>Team</th><th>W</th><th>L</th><th>T</th><th>PF</th><th>PA</th><th>Diff</th><th>Streak</th><th>Last 5</th></tr></thead>
                <tbody>{ranked.map((team, index) => {
                  const differential = team.pointsFor - team.pointsAgainst;
                  return <tr key={team.id}>
                    <td className="standing-rank">{index + 1}</td>
                    <th><TeamMark team={team} /><span><strong>{team.name}</strong><small>{team.abbreviation}</small></span></th>
                    <td className="standing-win">{team.wins}</td><td>{team.losses}</td><td>{team.ties}</td>
                    <td>{team.pointsFor}</td><td>{team.pointsAgainst}</td>
                    <td className={differential > 0 ? 'positive' : differential < 0 ? 'negative' : ''}>{differential > 0 ? '+' : ''}{differential}</td>
                    <td><span className={`streak-badge ${team.streak.startsWith('W') ? 'win' : team.streak.startsWith('L') ? 'loss' : ''}`}>{team.streak}</span></td>
                    <td><div className="form-dots">{team.lastFive.length ? team.lastFive.map((result, resultIndex) => <span key={resultIndex} className={result.toLowerCase()}>{result}</span>) : <em>—</em>}</div></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          )}
        </div>
        <p className="standings-note">Teams are ranked by wins, then losses and point differential. The former Pac-12 teams compete in different conferences, so conference records are not combined.</p>
      </section>

      <footer className="mx-auto max-w-7xl px-5 pb-10 text-xs text-slate-600 sm:px-8">
        Schedule and score data provided by ESPN. This site is not affiliated with ESPN or the Pac-12 Conference.
      </footer>
    </main>
  );
}
