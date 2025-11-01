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
