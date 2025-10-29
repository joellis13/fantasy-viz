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

export interface LeagueResponse {
  leagueKey: string;
  name: string;
  season: number;
  teams: TeamStanding[];
}

export interface WeeklyPlayerData {
  week: number;
  projectedPoints: number;
  actualPoints: number;
  difference: number;
  status: string;
}

export interface PlayerSummary {
  totalWeeks: number;
  avgProjected: number;
  avgActual: number;
  accuracyRate: number;
}

export interface PlayerComparison {
  playerKey: string;
  playerName: string;
  position: string;
  team: string;
  weeklyData: WeeklyPlayerData[];
  summary: PlayerSummary;
}

export interface PlayerComparisonResponse {
  teamKey: string;
  weekRange: {
    start: number;
    end: number;
  };
  weeksRetrieved: number;
  players: PlayerComparison[];
  summary: {
    totalPlayers: number;
    averageAccuracy: number;
  };
}

export interface ErrorResponse {
  error: string;
  details?: string;
}
