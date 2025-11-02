/**
 * Response models for Fantasy Viz API
 */

export interface TeamStanding {
  teamKey: string;
  teamName: string;
  managerName: string;
  rank: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface WeeklyTeamScore {
  week: number;
  teamName: string;
  score: number;
}

export interface LeagueResponse {
  leagueKey: string;
  name: string;
  season: number;
  teams: TeamStanding[];
  points: WeeklyTeamScore[];
}

export interface WeeklyPlayerData {
  week: number;
  projectedPoints: number;
  actualPoints: number;
  difference: number;
  status: string;
  breakdown?: Array<{ stat: string; value: number; points: number }>;
}

export interface PlayerSummary {
  totalWeeks: number; // Deprecated: use weeksPlayed instead
  weeksPlayed: number;
  averageProjected: number;
  averageActual: number;
  totalProjected: number;
  totalActual: number;
  totalDifference: number;
  accuracyRate: number;
}

export interface PlayerStats {
  playerKey: string;
  name: string;
  position: string;
  team: string;
  weeklyData: WeeklyPlayerData[];
  summary: PlayerSummary;
}

export interface PlayerStatsResponse {
  teamKey: string;
  weekRange: {
    start: number;
    end: number;
  };
  weeksRetrieved: number;
  players: PlayerStats[];
  summary: {
    totalPlayers: number;
    averageAccuracy: number;
  };
}

export interface ErrorResponse {
  error: string;
  details?: string;
}

export interface PlayerSearchResult {
  playerKey: string;
  playerId: string;
  name: string;
  position: string;
  team: string;
  imageUrl?: string;
  status?: string;
}

export interface PlayerSearchResponse {
  gameKey: string;
  totalResults: number;
  start: number;
  count: number;
  players: PlayerSearchResult[];
}

export interface PlayerCompareResponse {
  weekRange: {
    start: number;
    end: number;
  };
  players: PlayerStats[];
  comparison: {
    player1Better: number; // Number of weeks player 1 scored more
    player2Better: number; // Number of weeks player 2 scored more
    ties: number;
  };
}
