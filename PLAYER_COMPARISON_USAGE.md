# Player Comparison Feature - Quick Start Guide

## Overview

The Player Comparison feature allows you to visualize and analyze how players on your fantasy team performed compared to their pre-game projections throughout the season.

## How to Use

### 1. Connect Your Yahoo Account

- Click the **"Connect Yahoo"** button in the top navigation
- Complete the OAuth flow to authorize the app
- You'll be redirected back to the app

### 2. Get Your Team Key

Your team key follows this format: `{game_key}.l.{league_id}.t.{team_id}`

Example: `423.l.123456.t.1`

To find your team key:

1. Go to your Yahoo Fantasy league page
2. Look at the URL - it contains your league and team IDs
3. For 2022 NFL, the game key is `423`

### 3. Load Player Data

1. Click **"Player Comparison"** in the navigation
2. Enter your team key
3. Set week range (default: weeks 1-17)
4. Click **"Load Player Data"**

The app will fetch roster data for all requested weeks in parallel (may take 5-10 seconds for a full season).

## Features

### 📊 Interactive Chart View

- **Select any player** from your roster to see their weekly performance
- **Projected vs Actual**: Dashed orange line shows projections, solid green line shows actual points
- **Visual difference**: Green/red bars show over/under performance each week
- **Summary stats**: Total points, difference, and accuracy rate below the chart

### 📋 Table View

- See all players at once in a sortable table
- Compare stats across your entire roster
- Click any row to view that player's chart

### 🔍 Filtering & Sorting

**Position Filter**

- Filter by position (QB, RB, WR, TE, K, DEF)
- Or view all positions together

**Sort Options**

- **Total Points**: See your highest scorers
- **+/- vs Projection**: Find biggest over/underperformers
- **Accuracy Rate**: See which players are most predictable
- **Name**: Alphabetical order

## Understanding the Metrics

### Weekly Metrics

- **Projected Points**: Yahoo's pre-game projection
- **Actual Points**: Points actually scored
- **Difference**: Actual - Projected (positive is good!)
- **Percent Difference**: How far off the projection was

### Summary Metrics

- **Total Projected/Actual**: Season totals
- **Average Projected/Actual**: Per-week averages
- **Weeks Played**: Number of weeks with data
- **Accuracy Rate**: % of weeks where actual was within 20% of projection

## Use Cases

### 🎯 Identify Consistent Performers

Look for players with high accuracy rates - they're reliable and easy to project.

### 📈 Spot Trends

- Is a player trending up (recent weeks > early weeks)?
- Is someone consistently outperforming projections?
- Which players are boom-or-bust?

### 🔄 Make Better Roster Decisions

- **Start/Sit**: Trust players who consistently hit projections
- **Trade Targets**: Look for undervalued players (outperforming projections)
- **Drops**: Consider dropping consistent underperformers

### 🏆 League Analysis

Load data for multiple teams to:

- Find league-wide trends
- Identify undervalued players across all teams
- Compare your roster's accuracy to opponents

## Tips

1. **Start with a smaller week range** (4-6 weeks) for faster loading, then expand
2. **Week 1-3 projections are often less accurate** as the season gets underway
3. **Compare recent weeks vs season average** to spot hot/cold streaks
4. **High accuracy rate ≠ high points** - a consistent low scorer has high accuracy but isn't valuable
5. **Use table view** for quick roster-wide comparisons
6. **Use chart view** for detailed player analysis

## Example Workflow

### Finding a Trade Target

1. Load your team's data for weeks 1-8
2. Sort by "+/- vs Projection"
3. Look for players with negative differences (underperforming)
4. Load opponent teams to find players with positive differences
5. Propose trades for overperformers

### Setting Your Lineup

1. Load data for the past 4 weeks
2. Filter by position (e.g., RB)
3. Compare recent averages to decide between similar options
4. Check accuracy rate - trust the consistent player in a close call

### Waiver Wire Pickups

1. Load league-wide free agent data (if available)
2. Sort by "+/- vs Projection"
3. Find players consistently beating projections
4. They may be undervalued and available

## Technical Notes

- Data is fetched from Yahoo Fantasy Sports API
- Each week is a separate API call (done in parallel)
- Completed weeks' data won't change, so consider caching
- Yahoo API has rate limits - avoid rapid repeated requests
- The endpoint handles failed weeks gracefully

## Troubleshooting

**"not authenticated" error**

- Click "Connect Yahoo" and complete OAuth flow

**No data showing**

- Verify your team key format is correct
- Ensure you've authenticated with Yahoo
- Check that weeks are in valid range (1-18)

**Slow loading**

- Reduce week range for faster results
- Full season (17 weeks) takes 5-10 seconds

**Missing weeks**

- Some weeks may fail to load - this is normal
- The app continues with available data
- Check console for specific error messages

## Future Enhancements

Planned features:

- Compare multiple players side-by-side
- League-wide player comparison (not just one team)
- Export data to CSV
- Historical season comparison
- Mobile-responsive design improvements
- Dark mode

---

Enjoy analyzing your fantasy team! 🏈📊
