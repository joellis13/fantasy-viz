# Player Comparison API

## Overview

The Player Comparison API allows you to analyze projected vs actual fantasy points for all players on a team across the entire season. This enables trend analysis and helps identify which players consistently outperform or underperform their projections.

## Endpoint

```
GET /api/team/:teamKey/player-comparison
```

### Parameters

- **teamKey** (path parameter, required): The Yahoo team key in format `{game_key}.l.{league_id}.t.{team_id}`

  - Example: `423.l.123456.t.1`

- **startWeek** (query parameter, optional): Starting week number (default: 1)
  - Range: 1-18
- **endWeek** (query parameter, optional): Ending week number (default: 17)
  - Range: 1-18

### Example Request

```bash
curl "http://localhost:5000/api/team/423.l.123456.t.1/player-comparison?startWeek=1&endWeek=10" \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
```

## Response Format

```typescript
{
  teamKey: string;           // The team key requested
  weekRange: {
    start: number;           // Starting week
    end: number;             // Ending week
  };
  weeksRetrieved: number;    // Number of weeks successfully fetched
  players: [                 // Array of player comparison data
    {
      playerKey: string;     // Unique player identifier
      playerId: string;      // Yahoo player ID
      name: string;          // Player name
      position: string;      // Player position (QB, RB, WR, etc.)
      team: string;          // NFL team abbreviation
      weeklyData: [          // Week-by-week comparison
        {
          week: number;
          projectedPoints: number;
          actualPoints: number;
          difference: number;          // actual - projected
          percentDifference: number;   // ((actual - projected) / projected) * 100
        }
      ];
      summary: {
        totalProjected: number;        // Sum of all projected points
        totalActual: number;           // Sum of all actual points
        totalDifference: number;       // total actual - total projected
        averageProjected: number;      // Average projected per week
        averageActual: number;         // Average actual per week
        weeksPlayed: number;           // Number of weeks with data
        accuracyRate: number;          // % of weeks within 20% of projection
      };
    }
  ];
  summary: {
    totalPlayers: number;              // Number of players analyzed
    averageAccuracy: number;           // Average accuracy rate across all players
  };
}
```

## Example Response

```json
{
  "teamKey": "423.l.123456.t.1",
  "weekRange": {
    "start": 1,
    "end": 8
  },
  "weeksRetrieved": 8,
  "players": [
    {
      "playerKey": "player-33536",
      "playerId": "33536",
      "name": "Patrick Mahomes",
      "position": "QB",
      "team": "KC",
      "weeklyData": [
        {
          "week": 1,
          "projectedPoints": 21.5,
          "actualPoints": 24.8,
          "difference": 3.3,
          "percentDifference": 15.35
        },
        {
          "week": 2,
          "projectedPoints": 22.0,
          "actualPoints": 18.2,
          "difference": -3.8,
          "percentDifference": -17.27
        }
      ],
      "summary": {
        "totalProjected": 172.5,
        "totalActual": 185.3,
        "totalDifference": 12.8,
        "averageProjected": 21.56,
        "averageActual": 23.16,
        "weeksPlayed": 8,
        "accuracyRate": 75.0
      }
    }
  ],
  "summary": {
    "totalPlayers": 15,
    "averageAccuracy": 68.5
  }
}
```

## Use Cases

### 1. Individual Player Trend Analysis

Track how a specific player's actual performance compares to projections over time:

- Identify consistent over/underperformers
- Spot players trending up or down
- Evaluate projection reliability

### 2. Roster Performance Dashboard

Display all players on your roster sorted by various metrics:

- Total actual points (default sort)
- Biggest over-performers (highest positive difference)
- Biggest busts (highest negative difference)
- Most consistent (highest accuracy rate)

### 3. Waiver Wire Decisions

Compare players you own vs potential pickups:

- Identify which rostered players consistently underperform
- Target free agents who outperform projections
- Make data-driven roster decisions

### 4. Trade Analysis

Evaluate trade targets by comparing:

- Projection accuracy rates
- Consistency (week-to-week variance)
- Recent trends (last 4 weeks vs season average)

### 5. League-Wide Insights

Fetch data for multiple teams to:

- Compare projection accuracy across teams
- Identify league-wide trends
- Find undervalued players

## Data Source

All data comes from Yahoo Fantasy Sports API:

- **Projected Points**: Yahoo's pre-game projections
- **Actual Points**: Yahoo's official fantasy scoring
- **Player Info**: Real-time roster data including positions, teams, and status

The endpoint fetches roster data for each requested week in parallel for optimal performance.

## Performance Considerations

- **Full Season Request**: Fetching all 17 weeks may take 5-10 seconds depending on network latency
- **Recommended Approach**: Start with a smaller range (last 4-6 weeks) for faster response
- **Caching**: Consider caching results for completed weeks since that data won't change
- **Rate Limiting**: Yahoo API has rate limits; avoid making too many requests in rapid succession

## Error Handling

The endpoint handles various error scenarios gracefully:

- If individual week requests fail, they're logged and skipped
- At least one successful week is required to return data
- Invalid week ranges return 400 Bad Request
- Missing authentication returns 401 Unauthorized

## Future Enhancements

Potential additions to this feature:

1. **League-wide comparison**: Compare all teams in a league
2. **Position filtering**: Get comparison for specific positions only
3. **Stat breakdowns**: Include individual stat projections (passing yards, TDs, etc.)
4. **Historical data**: Compare current season to past seasons
5. **Projection sources**: Compare Yahoo projections to other sources (ESPN, FantasyPros)
