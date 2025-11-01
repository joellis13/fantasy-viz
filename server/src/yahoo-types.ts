/**
 * TypeScript interfaces for Yahoo Fantasy Sports API responses
 * Based on the league standings endpoint structure
 *
 * Yahoo API Structure:
 * All responses are wrapped in a `fantasy_content` object that contains:
 * - Common metadata (time, copyright, etc.)
 * - A single resource type (league, team, player, etc.)
 * - Resources can include sub-resources as additional array elements
 */

/**
 * Base fantasy_content wrapper that contains metadata common to all responses
 */
export interface YahooFantasyContentBase {
  "xml:lang": string;
  "yahoo:uri": string;
  time: string;
  copyright: string;
  refresh_rate: string;
}

/**
 * Generic Yahoo Fantasy API response wrapper
 * All API responses follow this pattern with different resource types
 */
export interface YahooFantasyResponse<T> {
  fantasy_content: YahooFantasyContentBase & T;
}

/**
 * Type helper for resources that include sub-resources
 * Yahoo returns these as arrays where:
 * - First element(s): Resource metadata
 * - Last element(s): Sub-resource data
 */
export type YahooResourceWithSubResources<TMetadata, TSubResources> = [
  TMetadata,
  TSubResources
];

/**
 * Type for the league array which contains metadata and sub-resources
 * Yahoo returns this as an array where elements can be:
 * - League metadata objects (with league_id)
 * - Sub-resource objects (with standings, teams, etc.)
 */
export type YahooLeagueArray = Array<YahooLeagueInfo | YahooStandingsWrapper>;

/**
 * Specific response type for league standings endpoint
 */
export type LeagueStandingsResponse = YahooFantasyResponse<{
  league: YahooResourceWithSubResources<YahooLeagueInfo, YahooStandingsWrapper>;
}>;

export interface YahooLeagueInfo {
  league_key: string;
  league_id: string;
  name: string;
  url: string;
  logo_url?: string;
  draft_status: string;
  num_teams: number;
  edit_key: string;
  weekly_deadline: string;
  roster_type: string;
  league_update_timestamp: string;
  scoring_type: string;
  league_type: string;
  renew?: string;
  renewed: string;
  felo_tier?: string;
  is_highscore: boolean;
  matchup_week: number;
  iris_group_chat_id: string;
  short_invitation_url: string;
  allow_add_to_dl_extra_pos: number;
  is_pro_league: string;
  is_cash_league: string;
  current_week: number;
  start_week: string;
  start_date: string;
  end_week: string;
  end_date: string;
  is_plus_league: string;
  game_code: string;
  season: string;
}

/**
 * Teams data structure from Yahoo API
 * Keys are string indices ("0", "1", "2", etc.) or "count"
 */
export interface YahooTeamsData {
  [index: string]: YahooTeamWrapper | number;
  count: number;
}

export interface YahooStandingsWrapper {
  standings: [
    {
      teams: YahooTeamsData;
    }
  ];
}

export interface YahooTeamWrapper {
  team: [YahooTeamInfo[], YahooTeamPoints, YahooTeamStandings];
}

export interface YahooTeamInfo {
  team_key?: string;
  team_id?: string;
  name?: string;
  is_owned_by_current_login?: number;
  url?: string;
  team_logos?: Array<{ team_logo: { size: string; url: string } }>;
  previous_season_team_rank?: number;
  waiver_priority?: number;
  faab_balance?: string;
  number_of_moves?: number;
  number_of_trades?: number;
  roster_adds?: {
    coverage_type: string;
    coverage_value: number;
    value: string;
  };
  league_scoring_type?: string;
  draft_position?: number;
  has_draft_grade?: number;
  draft_grade?: string;
  draft_recap_url?: string;
  managers?: Array<{
    manager: {
      manager_id: string;
      nickname: string;
      guid: string;
      is_commissioner?: string;
      image_url: string;
      felo_score?: string;
      felo_tier?: string;
    };
  }>;
}

export interface YahooTeamPoints {
  team_points: {
    coverage_type: string;
    season: string;
    total: string;
  };
}

export interface YahooTeamStandings {
  team_standings: {
    rank: string;
    playoff_seed: string;
    outcome_totals: {
      wins: string;
      losses: string;
      ties: number;
      percentage: string;
    };
    streak: {
      type: string;
      value: string;
    };
    points_for: string;
    points_against: number | string;
  };
}

/**
 * Player-related types for stats and projections
 */

export interface YahooPlayerName {
  full: string;
  first: string;
  last: string;
  ascii_first?: string;
  ascii_last?: string;
}

export interface YahooPlayerPoints {
  coverage_type: string;
  week?: number;
  season?: string;
  total: string | number;
}

export interface YahooPlayerStat {
  stat_id: number;
  value: string | number;
}

export interface YahooPlayerStats {
  coverage_type: string;
  week?: number;
  season?: string;
  stats?: YahooPlayerStat[];
}

export interface YahooPlayerInfo {
  player_key: string;
  player_id: string;
  name: YahooPlayerName;
  status?: string;
  status_full?: string;
  editorial_team_abbr?: string;
  display_position?: string;
  position_type?: string;
  primary_position?: string;
  eligible_positions?: string[];
  selected_position?: {
    coverage_type: string;
    week?: number;
    position: string;
  };
  bye_weeks?: {
    week: string | number;
  };
  image_url?: string;
  is_undroppable?: boolean;
  player_points?: YahooPlayerPoints;
  player_projected_points?: YahooPlayerPoints;
  player_stats?: YahooPlayerStats;
}

/**
 * Response type for team roster endpoint
 * /team/{team_key}/roster?week={week}
 */
export interface YahooRosterPlayer {
  player: [
    YahooPlayerInfo[],
    YahooPlayerPoints?,
    YahooPlayerPoints?,
    YahooPlayerStats?
  ];
}

export interface YahooRoster {
  coverage_type: string;
  week: number;
  is_editable: number;
  players: {
    count: number;
    [key: string]: YahooRosterPlayer | number;
  };
}

export interface YahooTeamRosterWrapper {
  team: [
    YahooTeamInfo[],
    {
      roster: YahooRoster;
    }
  ];
}

export type TeamRosterResponse = YahooFantasyResponse<{
  team: [
    YahooTeamInfo[],
    {
      roster: YahooRoster;
    }
  ];
}>;

/**
 * Response type for player stats endpoint
 * /player/{player_key}/stats?type=week&week={week}
 */
export type PlayerStatsResponse = YahooFantasyResponse<{
  player: [YahooPlayerInfo[]];
}>;

/**
 * Normalized types for internal use
 */
export interface NormalizedLeague {
  id: string;
  name: string;
  teams: NormalizedTeam[];
  points: WeeklyTeamScore[];
}

export interface NormalizedTeam {
  id: string;
  teamKey: string;
  name: string;
  seasonTotal: number;
  rank: number;
  wins: number;
  losses: number;
  ties: number;
}

export interface WeeklyTeamScore {
  week: number;
  teamName: string;
  score: number;
}

/**
 * Normalized player statistics data
 */
export interface PlayerWeeklyStats {
  week: number;
  projectedPoints: number;
  actualPoints: number;
  difference: number;
  percentDifference: number;
}

export interface NormalizedPlayerStats {
  playerKey: string;
  playerId: string;
  name: string;
  position: string;
  team: string;
  weeklyData: PlayerWeeklyStats[];
  summary: {
    totalProjected: number;
    totalActual: number;
    totalDifference: number;
    averageProjected: number;
    averageActual: number;
    weeksPlayed: number;
    accuracyRate: number; // Percentage of weeks where projection was within 20% of actual
  };
}
