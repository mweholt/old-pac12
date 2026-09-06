'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SiteHeader } from '@/components/site-header';

type Era = 'old' | 'new';
type Competitor = {
  id: string;
  name: string;
  abbreviation: string;
  logo: string;
  color: string;
  homeAway: string;
  score: string;
  winner: boolean;
  record: string;
};
type Game = {
  id: string;
  date: string;
  name: string;
  shortName: string;
  week: number;
  status: { state: string; completed: boolean; detail: string };
  venue: { name: string; city: string; state: string } | null;
  broadcast: string;
  competitors: Competitor[];
};
type GameDetail = {
  linescore: Array<{ id: string; name: string; abbreviation: string; logo: string; score: string; periods: string[] }>;
  stats: { teams: Array<{ id: string; abbreviation: string }>; rows: Array<{ label: string; values: string[] }> };
  leaders: Array<{ teamId: string; team: string; logo: string; category: string; athlete: string; value: string; headshot: string }>;
  scoringPlays: Array<{ id: string; team: string; logo: string; period: number; clock: string; text: string; awayScore: string; homeScore: string }>;
};
type Team = {
  id: string;
  name: string;
  abbreviation: string;
  logo: string;
  color: string;
  events: Game[];
};
type FootballData = {
  season: number;
  groups: Record<Era, string[]>;
  teams: Team[];
  partial: boolean;
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

function displayWeek(event: Record<string, any>) {
  const espnWeek = Number(event.week?.number);
  if (!Number.isFinite(espnWeek)) return -1;
  const kickoff = new Date(event.date ?? '');
  // ESPN groups the Aug. 27–31, 2026 Week 0 slate into its broader Week 1 bucket.
  if (espnWeek === 1 && kickoff >= new Date('2026-08-27T00:00:00Z') && kickoff < new Date('2026-09-01T00:00:00Z')) return 0;
  return espnWeek;
}

function normalizeEspnEvent(event: Record<string, any>): Game {
  const competition = event.competitions?.[0] ?? {};
  const status = competition.status?.type ?? {};
  return {
    id: event.id ?? '', date: event.date ?? '', name: event.name ?? '', shortName: event.shortName ?? '',
    week: displayWeek(event),
    status: { state: status.state ?? 'pre', completed: status.completed ?? false, detail: status.shortDetail ?? status.detail ?? '' },
    venue: competition.venue ? {
      name: competition.venue.fullName ?? '', city: competition.venue.address?.city ?? '', state: competition.venue.address?.state ?? '',
    } : null,
    broadcast: competition.broadcasts?.flatMap((item: { names?: string[] }) => item.names ?? [])[0] ?? '',
    competitors: (competition.competitors ?? []).map((competitor: Record<string, any>) => {
      const rawScore = competitor.score;
      const score = typeof rawScore === 'object' && rawScore !== null
        ? String(rawScore.displayValue ?? rawScore.value ?? '')
        : String(rawScore ?? '');
      return {
        id: competitor.team?.id ?? '', name: competitor.team?.displayName ?? '', abbreviation: competitor.team?.abbreviation ?? '',
        logo: competitor.team?.logo ?? competitor.team?.logos?.[0]?.href ?? '', color: competitor.team?.color ?? '',
        homeAway: competitor.homeAway ?? '', score, winner: competitor.winner ?? false,
        record: competitor.records?.[0]?.summary ?? '',
      };
    }),
  };
}

function normalizeGameDetail(payload: Record<string, any>): GameDetail {
  const headerTeams = (payload.header?.competitions?.[0]?.competitors ?? []).map((competitor: Record<string, any>) => ({
    id: String(competitor.team?.id ?? ''),
    name: competitor.team?.displayName ?? '',
    abbreviation: competitor.team?.abbreviation ?? '',
    logo: competitor.team?.logo ?? competitor.team?.logos?.[0]?.href ?? '',
    score: String(competitor.score ?? ''),
    periods: (competitor.linescores ?? []).map((period: Record<string, any>) => String(period.displayValue ?? period.value ?? '')),
  }));
  const boxTeams = (payload.boxscore?.teams ?? []) as Array<Record<string, any>>;
  const statNames = [...new Set(boxTeams.flatMap((team) => (team.statistics ?? []).map((stat: Record<string, any>) => stat.name)))];
  const stats = {
    teams: boxTeams.map((team) => ({ id: String(team.team?.id ?? ''), abbreviation: team.team?.abbreviation ?? '' })),
    rows: statNames.map((name) => {
      const first = boxTeams.flatMap((team) => team.statistics ?? []).find((stat: Record<string, any>) => stat.name === name);
      return {
        label: first?.label ?? name,
        values: boxTeams.map((team) => {
          const stat = (team.statistics ?? []).find((item: Record<string, any>) => item.name === name);
          return String(stat?.displayValue ?? stat?.value ?? '—');
        }),
      };
    }),
  };
  const leaders = (payload.leaders ?? []).flatMap((team: Record<string, any>) =>
    (team.leaders ?? []).flatMap((category: Record<string, any>) => {
      const leader = category.leaders?.[0];
      if (!leader?.athlete) return [];
      return [{
        teamId: String(team.team?.id ?? ''), team: team.team?.abbreviation ?? '', logo: team.team?.logo ?? '',
        category: category.displayName ?? category.name ?? '', athlete: leader.athlete.displayName ?? '',
        value: leader.displayValue ?? leader.summary ?? '', headshot: leader.athlete.headshot?.href ?? '',
      }];
    }),
  );
  const scoringPlays = (payload.scoringPlays ?? []).map((play: Record<string, any>) => ({
    id: String(play.id ?? `${play.period?.number}-${play.clock?.displayValue}-${play.text}`),
    team: play.team?.abbreviation ?? '', logo: play.team?.logo ?? '', period: Number(play.period?.number ?? 0),
    clock: play.clock?.displayValue ?? '', text: play.text ?? '', awayScore: String(play.awayScore ?? ''), homeScore: String(play.homeScore ?? ''),
  }));
  return { linescore: headerTeams, stats, leaders, scoringPlays };
}

function formatGameDate(value: string, withTime = true) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(new Date(value));
}

function weekRange(games: Game[]) {
  const dates = games.map((game) => new Date(game.date)).filter((date) => !Number.isNaN(date.valueOf()));
  if (!dates.length) return '';
  const first = new Date(Math.min(...dates.map((date) => date.valueOf())));
  const last = new Date(Math.max(...dates.map((date) => date.valueOf())));
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' });
  return first.getMonth() === last.getMonth()
    ? `${month.format(first)} ${first.getDate()}–${last.getDate()}`
    : `${month.format(first)} ${first.getDate()}–${month.format(last)} ${last.getDate()}`;
}

function TeamLogo({ team, className = '' }: { team: Pick<Team, 'name' | 'logo' | 'color'>; className?: string }) {
  if (team.logo) return <img src={team.logo} alt="" className={`object-contain ${className}`} />;
  return (
    <span
      aria-hidden="true"
      className={`grid place-items-center rounded-full font-black text-white ${className}`}
      style={{ backgroundColor: team.color ? `#${team.color}` : '#6d4aff' }}
    >
      {team.name.slice(0, 1)}
    </span>
  );
}

function GameCard({ game, trackedIds, onOpen }: { game: Game; trackedIds: Set<string>; onOpen: () => void }) {
  const competitors = [...game.competitors].sort((a, b) => (a.homeAway === 'away' ? -1 : b.homeAway === 'away' ? 1 : 0));
  const completed = game.status.completed;
  const live = game.status.state === 'in';

  return (
    <button type="button" className="game-card" onClick={onOpen} aria-label={`View details for ${game.name}`}>
      <div className="game-meta">
        <span className="game-date">{formatGameDate(game.date)}</span>
        <span>{game.broadcast}</span>
      </div>
      {(live || completed) && (
        <div className={`game-status ${live ? 'status-live' : ''}`}>{game.status.detail}</div>
      )}
      <div className="space-y-3">
        {competitors.map((competitor) => (
          <div key={competitor.id} className="flex items-center gap-3">
            <TeamLogo team={{ name: competitor.name, logo: competitor.logo, color: competitor.color }} className="size-9" />
            <div className="min-w-0 flex-1">
              <div className={`truncate font-bold ${trackedIds.has(competitor.id) ? 'text-white' : 'text-slate-300'}`}>
                {competitor.name}
              </div>
              <div className="text-xs text-slate-500">{competitor.record || (competitor.homeAway === 'home' ? 'Home' : 'Away')}</div>
            </div>
            {completed || live ? (
              <div className={`text-2xl font-black tabular-nums ${competitor.winner ? 'text-white' : 'text-slate-500'}`}>
                {competitor.score || '—'}
              </div>
            ) : (
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{competitor.homeAway}</div>
            )}
          </div>
        ))}
      </div>
      {game.venue && (
        <div className="mt-4 flex items-center gap-1.5 border-t border-white/8 pt-3 text-xs text-slate-500">
          <MapPin className="size-3.5" />
          <span className="truncate">{game.venue.name || [game.venue.city, game.venue.state].filter(Boolean).join(', ')}</span>
        </div>
      )}
      <span className="game-details-link">Game details</span>
    </button>
  );
}

function GameDetails({ game, detail, loading, onTeam }: { game: Game; detail: GameDetail | null; loading: boolean; onTeam: (teamId: string) => void }) {
  const competitors = [...game.competitors].sort((a, b) => (a.homeAway === 'away' ? -1 : b.homeAway === 'away' ? 1 : 0));
  const showScore = game.status.completed || game.status.state === 'in';
  return (
    <>
      <DialogHeader className="game-dialog-header">
        <DialogDescription>{formatGameDate(game.date)}{game.broadcast ? ` · ${game.broadcast}` : ''}</DialogDescription>
        <DialogTitle>{game.shortName || game.name}</DialogTitle>
        <p className={game.status.state === 'in' ? 'status-live' : 'game-dialog-status'}>
          {game.status.detail || 'Scheduled'}
        </p>
      </DialogHeader>
      <div className="game-dialog-teams">
        {competitors.map((competitor) => (
          <button key={competitor.id} type="button" className="game-dialog-team" onClick={() => onTeam(competitor.id)}>
            <TeamLogo team={{ name: competitor.name, logo: competitor.logo, color: competitor.color }} className="size-14" />
            <span>
              <strong>{competitor.name}</strong>
              <small>{competitor.record || (competitor.homeAway === 'home' ? 'Home' : 'Away')} · View schedule</small>
            </span>
            {showScore && <b>{competitor.score || '0'}</b>}
          </button>
        ))}
      </div>
      <div className="game-dialog-facts">
        <div><CalendarDays /><span><small>Date & time</small>{formatGameDate(game.date)}</span></div>
        <div><MapPin /><span><small>Location</small>{game.venue?.name || [game.venue?.city, game.venue?.state].filter(Boolean).join(', ') || 'TBD'}</span></div>
      </div>
      {loading ? (
        <div className="boxscore-loading">
          <div className="loading-block" /><div className="loading-block" /><div className="loading-block" />
        </div>
      ) : detail && (detail.stats.rows.length > 0 || detail.linescore.some((team) => team.periods.length)) ? (
        <div className="boxscore-content">
          {detail.linescore.some((team) => team.periods.length) && (
            <section className="game-detail-section">
              <h3>Scoring by quarter</h3>
              <div className="table-scroll">
                <table className="linescore-table">
                  <thead><tr><th>Team</th>{detail.linescore[0]?.periods.map((_, index) => <th key={index}>{index < 4 ? `Q${index + 1}` : `OT${index - 3}`}</th>)}<th>T</th></tr></thead>
                  <tbody>{detail.linescore.map((team) => <tr key={team.id}><th><img src={team.logo} alt="" />{team.abbreviation}</th>{team.periods.map((score, index) => <td key={index}>{score}</td>)}<td className="total-score">{team.score}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          )}
          {detail.stats.rows.length > 0 && (
            <section className="game-detail-section">
              <h3>Team stats</h3>
              <table className="team-stats-table">
                <thead><tr><th>Stat</th>{detail.stats.teams.map((team) => <th key={team.id}>{team.abbreviation}</th>)}</tr></thead>
                <tbody>{detail.stats.rows.map((row) => <tr key={row.label}><th>{row.label}</th>{row.values.map((value, index) => <td key={index}>{value}</td>)}</tr>)}</tbody>
              </table>
            </section>
          )}
          {detail.leaders.length > 0 && (
            <section className="game-detail-section">
              <h3>Game leaders</h3>
              <div className="leaders-grid">{detail.leaders.map((leader) => (
                <div key={`${leader.teamId}-${leader.category}`} className="leader-card">
                  {leader.headshot ? <img src={leader.headshot} alt="" /> : <TeamLogo team={{ name: leader.team, logo: leader.logo, color: '' }} className="size-11" />}
                  <span><small>{leader.team} · {leader.category}</small><strong>{leader.athlete}</strong><em>{leader.value}</em></span>
                </div>
              ))}</div>
            </section>
          )}
          {detail.scoringPlays.length > 0 && (
            <section className="game-detail-section">
              <h3>Scoring plays</h3>
              <div className="scoring-plays">{detail.scoringPlays.map((play) => (
                <div key={play.id} className="scoring-play">
                  {play.logo ? <img src={play.logo} alt="" /> : <span />}
                  <div><small>Q{play.period} · {play.clock}</small><p>{play.text}</p></div>
                  <b>{play.awayScore}–{play.homeScore}</b>
                </div>
              ))}</div>
            </section>
          )}
        </div>
      ) : (
        <div className="boxscore-empty">Box score and game leaders will appear when the game begins.</div>
      )}
    </>
  );
}

function TeamSchedule({ team }: { team: Team }) {
  return (
    <div className="flex-1 overflow-y-auto px-5 pb-8">
      <div className="divide-y divide-white/8">
        {team.events.map((game) => {
          const mine = game.competitors.find((competitor) => competitor.id === team.id);
          const opponent = game.competitors.find((competitor) => competitor.id !== team.id);
          const completed = game.status.completed;
          const live = game.status.state === 'in';
          const outcome = completed && mine ? (mine.winner ? 'W' : 'L') : null;
          return (
            <div key={game.id} className="flex items-center gap-3 py-4">
              <div className="w-14 shrink-0 text-xs font-semibold uppercase text-slate-500">
                {game.week >= 0 ? `Wk ${game.week}` : 'Post'}
              </div>
              {opponent && <TeamLogo team={{ name: opponent.name, logo: opponent.logo, color: opponent.color }} className="size-9" />}
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold text-white">
                  {mine?.homeAway === 'away' ? 'at ' : 'vs '} {opponent?.name ?? game.shortName}
                </div>
                <div className={`mt-0.5 text-xs ${live ? 'status-live' : 'text-slate-500'}`}>
                  {completed || live ? game.status.detail : formatGameDate(game.date)}
                </div>
              </div>
              {completed || live ? (
                <div className="flex items-center gap-2 font-black tabular-nums">
                  {outcome && <span className={outcome === 'W' ? 'text-emerald-400' : 'text-rose-400'}>{outcome}</span>}
                  <span className="text-white">{mine?.score || '0'}–{opponent?.score || '0'}</span>
                </div>
              ) : (
                <span className="text-xs font-bold uppercase text-slate-500">{game.broadcast || 'TBD'}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Home() {
  const [era, setEra] = useState<Era>('old');
  const [data, setData] = useState<FootballData | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [gameDetails, setGameDetails] = useState<Record<string, GameDetail>>({});
  const [loadingGameId, setLoadingGameId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const season = currentSeason();
      const teamMap = new Map([...TEAM_GROUPS.old, ...TEAM_GROUPS.new]);
      const settled = await Promise.allSettled([...teamMap].map(async ([id, fallbackName]) => {
        const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/${id}/schedule?season=${season}&seasontype=2`);
        if (!response.ok) throw new Error(`ESPN returned ${response.status}`);
        const payload = await response.json() as Record<string, any>;
        return {
          id,
          name: payload.team?.displayName ?? fallbackName,
          abbreviation: payload.team?.abbreviation ?? '',
          logo: payload.team?.logo ?? '',
          color: payload.team?.color ?? '',
          events: (payload.events ?? []).map(normalizeEspnEvent),
        } as Team;
      }));
      const teams = settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
      if (!teams.length) throw new Error('Live ESPN data could not be loaded.');
      setData({
        season,
        groups: { old: TEAM_GROUPS.old.map(([id]) => id), new: TEAM_GROUPS.new.map(([id]) => id) },
        teams,
        partial: teams.length !== teamMap.size,
      });
      setLastUpdated(new Date());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Live ESPN data could not be loaded.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const refreshScores = useCallback(async (week: number) => {
    setIsRefreshing(true);
    try {
      const season = currentSeason();
      const espnWeek = week === 0 ? 1 : week;
      const response = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?season=${season}&week=${espnWeek}&seasontype=2&groups=80&limit=500`,
        { cache: 'no-store' },
      );
      if (!response.ok) throw new Error(`ESPN returned ${response.status}`);
      const payload = await response.json() as Record<string, any>;
      const liveGames = (payload.events ?? []).map(normalizeEspnEvent) as Game[];
      const byId = new Map(liveGames.map((game) => [game.id, game]));

      setData((current) => current ? {
        ...current,
        teams: current.teams.map((team) => {
          const existingIds = new Set(team.events.map((game) => game.id));
          const additions = liveGames.filter((game) =>
            !existingIds.has(game.id) && game.competitors.some((competitor) => competitor.id === team.id),
          );
          return {
            ...team,
            events: [...team.events.map((game) => byId.get(game.id) ?? game), ...additions]
              .sort((a, b) => new Date(a.date).valueOf() - new Date(b.date).valueOf()),
          };
        }),
      } : current);
      setLastUpdated(new Date());
    } catch {
      // Keep the last good scoreboard visible if a background refresh fails.
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const openTeamSchedule = useCallback(async (teamId: string) => {
    setSelectedGameId(null);
    if (data?.teams.some((team) => team.id === teamId)) {
      setSelectedTeamId(teamId);
      return;
    }
    try {
      const response = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/${teamId}/schedule?season=${currentSeason()}&seasontype=2`,
      );
      if (!response.ok) return;
      const payload = await response.json() as Record<string, any>;
      const team: Team = {
        id: teamId,
        name: payload.team?.displayName ?? 'Team',
        abbreviation: payload.team?.abbreviation ?? '',
        logo: payload.team?.logo ?? '',
        color: payload.team?.color ?? '',
        events: (payload.events ?? []).map(normalizeEspnEvent),
      };
      setData((current) => current ? { ...current, teams: [...current.teams, team] } : current);
      setSelectedTeamId(teamId);
    } catch {
      // Leave the game details visible if ESPN cannot load the opponent schedule.
    }
  }, [data?.teams]);

  const loadGameDetail = useCallback(async (gameId: string) => {
    setLoadingGameId(gameId);
    try {
      const response = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=${gameId}`,
        { cache: 'no-store' },
      );
      if (!response.ok) return;
      const payload = await response.json() as Record<string, any>;
      setGameDetails((current) => ({ ...current, [gameId]: normalizeGameDetail(payload) }));
    } catch {
      // The matchup basics remain available if ESPN has not published a box score.
    } finally {
      setLoadingGameId((current) => current === gameId ? null : current);
    }
  }, []);

  const groupIds = useMemo(() => new Set(data?.groups[era] ?? []), [data, era]);
  const groupTeams = useMemo(
    () => (data ? data.groups[era].map((id) => data.teams.find((team) => team.id === id)).filter(Boolean) as Team[] : []),
    [data, era],
  );
  const allGames = useMemo(() => {
    const unique = new Map<string, Game>();
    groupTeams.forEach((team) => team.events.forEach((game) => unique.set(game.id, game)));
    return [...unique.values()].filter((game) => game.week >= 0);
  }, [groupTeams]);
  const weeks = useMemo(() => [...new Set([0, ...allGames.map((game) => game.week)])].sort((a, b) => a - b), [allGames]);

  useEffect(() => {
    if (!allGames.length) return;
    const now = new Date();
    const weekStarts = weeks.flatMap((week) => {
      const kickoffTimes = allGames
        .filter((game) => game.week === week)
        .map((game) => new Date(game.date).valueOf())
        .filter(Number.isFinite);
      if (!kickoffTimes.length) return [];
      const start = new Date(Math.min(...kickoffTimes));
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - ((start.getDay() - 3 + 7) % 7));
      return [{ week, startsAt: start.valueOf() }];
    }).sort((a, b) => a.startsAt - b.startsAt);
    const activeWeek = weekStarts.reduce(
      (current, candidate) => candidate.startsAt <= now.valueOf() ? candidate.week : current,
      weekStarts[0]?.week ?? weeks[0],
    );
    setSelectedWeek((current) => (current !== null && weeks.includes(current) ? current : activeWeek));
  }, [allGames, weeks]);

  useEffect(() => {
    if (selectedWeek === null || !data) return;
    void refreshScores(selectedWeek);
    const interval = window.setInterval(() => void refreshScores(selectedWeek), 15_000);
    const refreshVisiblePage = () => {
      if (document.visibilityState === 'visible') void refreshScores(selectedWeek);
    };
    window.addEventListener('focus', refreshVisiblePage);
    document.addEventListener('visibilitychange', refreshVisiblePage);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshVisiblePage);
      document.removeEventListener('visibilitychange', refreshVisiblePage);
    };
  }, [data?.season, refreshScores, selectedWeek]);

  useEffect(() => {
    const modelContext = (document as Document & {
      modelContext?: { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> };
    }).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    const register = modelContext.registerTool({
      name: 'show_pac12_football_view',
      title: 'Show Pac-12 football view',
      description: 'Switch between the old and new Pac-12, select a week, and optionally open a team schedule.',
      inputSchema: {
        type: 'object',
        properties: {
          era: { type: 'string', enum: ['old', 'new'] },
          week: { type: 'integer', minimum: 0 },
          teamId: { type: 'string' },
          gameId: { type: 'string' },
        },
        required: ['era'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        const value = input as { era?: Era; week?: number; teamId?: string; gameId?: string };
        if (value.era !== 'old' && value.era !== 'new') throw new Error('era must be old or new');
        setEra(value.era);
        if (typeof value.week === 'number') setSelectedWeek(value.week);
        if (value.teamId) setSelectedTeamId(value.teamId);
        if (value.gameId) setSelectedGameId(value.gameId);
        return { era: value.era, week: value.week ?? null, teamId: value.teamId ?? null, gameId: value.gameId ?? null };
      },
    }, { signal: lifecycle.signal });
    void Promise.resolve(register).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  const weekGames = allGames
    .filter((game) => game.week === selectedWeek)
    .sort((a, b) => new Date(a.date).valueOf() - new Date(b.date).valueOf());
  const selectedTeam = data?.teams.find((team) => team.id === selectedTeamId) ?? null;
  const selectedGame = allGames.find((game) => game.id === selectedGameId) ?? null;
  const weekIndex = selectedWeek !== null ? weeks.indexOf(selectedWeek) : -1;
  const hasLiveGames = weekGames.some((game) => game.status.state === 'in');

  useEffect(() => {
    if (!selectedGameId) return;
    void loadGameDetail(selectedGameId);
    if (selectedGame?.status.state !== 'in') return;
    const interval = window.setInterval(() => void loadGameDetail(selectedGameId), 15_000);
    return () => window.clearInterval(interval);
  }, [loadGameDetail, selectedGame?.status.state, selectedGameId]);

  return (
    <main className="min-h-screen">
      <SiteHeader active="schedule" season={data?.season} />

      <section className="week-selector">
        <div className="week-selector-inner mx-auto max-w-7xl px-5 sm:px-8">
          {selectedWeek !== null && (
            <div className="week-selector-top">
              <div className="week-chip">Week {selectedWeek}<span>{weekRange(weekGames)}</span></div>
              <div className="flex items-center gap-2">
                <button className="icon-button" aria-label="Previous week" disabled={weekIndex <= 0} onClick={() => setSelectedWeek(weeks[weekIndex - 1])}>
                  <ChevronLeft />
                </button>
                <button className="icon-button" aria-label="Next week" disabled={weekIndex < 0 || weekIndex >= weeks.length - 1} onClick={() => setSelectedWeek(weeks[weekIndex + 1])}>
                  <ChevronRight />
                </button>
              </div>
            </div>
          )}
          <div className="week-rail" aria-label="Season weeks">
            {weeks.map((week) => (
              <button key={week} className={selectedWeek === week ? 'active' : ''} onClick={() => setSelectedWeek(week)}>
                {week}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="era-filter-bar">
        <div className="era-switch" aria-label="Choose Pac-12 era">
          <button className={era === 'old' ? 'active' : ''} onClick={() => setEra('old')}>Old Pac-12</button>
          <button className={era === 'new' ? 'active' : ''} onClick={() => setEra('new')}>New Pac-12</button>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-5 py-6 sm:px-8 sm:py-8">
        {error ? (
          <div className="error-state">
            <p>{error}</p>
            <button className="retry-button" onClick={() => void load()}><RefreshCw /> Try again</button>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
            <section className="scoreboard-shell">
              <div className="mb-5 flex items-center justify-between gap-4">
                <h3 className="section-title">Week {selectedWeek ?? '—'} matchups</h3>
                <div className="flex items-center gap-2">
                  <span className={`live-dot ${hasLiveGames ? 'is-live' : ''}`}>
                    {hasLiveGames
                      ? 'Live · updates every 15 sec'
                      : lastUpdated
                        ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                        : 'ESPN data'}
                  </span>
                  <button
                    className="icon-button"
                    aria-label="Refresh live scores"
                    disabled={selectedWeek === null || isRefreshing}
                    onClick={() => selectedWeek !== null && void refreshScores(selectedWeek)}
                  >
                    <RefreshCw className={isRefreshing ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
              {!data ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[0, 1, 2, 3].map((item) => <div key={item} className="loading-block h-48 rounded-2xl" />)}
                </div>
              ) : weekGames.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {weekGames.map((game) => (
                    <GameCard key={game.id} game={game} trackedIds={groupIds} onOpen={() => setSelectedGameId(game.id)} />
                  ))}
                </div>
              ) : (
                <div className="empty-state"><CalendarDays className="size-7" /><p>No games scheduled for this week.</p></div>
              )}
            </section>

            <aside className="scoreboard-shell h-fit lg:sticky lg:top-28">
              <p className="eyebrow">{era === 'old' ? 'The former twelve' : 'Eight football members'}</p>
              <h3 className="section-title mt-2">Choose a team</h3>
              <p className="mt-1 text-sm text-slate-500">Open a full-season schedule and past scores.</p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {!data
                  ? [0, 1, 2, 3, 4, 5, 6, 7].map((item) => <div key={item} className="loading-block h-16 rounded-xl" />)
                  : groupTeams.map((team) => (
                      <button key={team.id} className="team-tile flex items-center gap-2.5" onClick={() => void openTeamSchedule(team.id)}>
                        <TeamLogo team={team} className="size-8 shrink-0" />
                        <span className="leading-tight">{team.name}</span>
                      </button>
                    ))}
              </div>
              {data?.partial && <p className="mt-4 text-xs text-amber-300/80">Some ESPN schedules are temporarily unavailable.</p>}
            </aside>
          </div>
        )}
      </section>

      <footer className="mx-auto max-w-7xl px-5 pb-10 text-xs text-slate-600 sm:px-8">
        Schedule and score data provided by ESPN. This site is not affiliated with ESPN or the Pac-12 Conference.
      </footer>

      <Dialog open={Boolean(selectedGame)} onOpenChange={(open) => { if (!open) setSelectedGameId(null); }}>
        <DialogContent className="game-dialog sm:max-w-xl">
          {selectedGame && (
            <GameDetails
              game={selectedGame}
              detail={gameDetails[selectedGame.id] ?? null}
              loading={loadingGameId === selectedGame.id}
              onTeam={(teamId) => void openTeamSchedule(teamId)}
            />
          )}
        </DialogContent>
      </Dialog>

      {selectedTeam && (
        <div className="team-panel-layer" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedTeamId(null); }}>
          <aside className="team-panel" role="dialog" aria-modal="true" aria-labelledby="team-panel-title">
            <button className="panel-close" aria-label="Close team schedule" onClick={() => setSelectedTeamId(null)}>×</button>
            <div className="border-b border-white/8 px-5 py-5">
                <div className="flex items-center gap-4 pr-10">
                  <TeamLogo team={selectedTeam} className="size-14" />
                  <div>
                    <h2 id="team-panel-title" className="text-xl font-black text-white">{selectedTeam.name}</h2>
                    <p className="text-sm text-slate-500">{data?.season} schedule & scores</p>
                  </div>
                </div>
            </div>
            <TeamSchedule team={selectedTeam} />
          </aside>
        </div>
      )}
    </main>
  );
}
