const fs = require("fs");
const { normalizeLeague } = require("./dist/parsers.js");

console.log("\n=== Robust Parser Test Suite ===\n");

// Test 1: Standard sample file
console.log("Test 1: Standard sample league data");
const raw = JSON.parse(fs.readFileSync("sample-league-object.json", "utf8"));
const result = normalizeLeague(raw);

console.log(`✓ League name: ${result.name}`);
console.log(`✓ League ID: ${result.id}`);
console.log(`✓ Total teams: ${result.teams.length}`);

// Validate team count matches
const expectedTeamCount = 12;
if (result.teams.length === expectedTeamCount) {
  console.log(`✓ Team count matches expected (${expectedTeamCount})`);
} else {
  console.error(
    `✗ Team count mismatch! Expected ${expectedTeamCount}, got ${result.teams.length}`
  );
}

// Validate numeric fields
let allTeamsValid = true;
for (const team of result.teams) {
  if (typeof team.seasonTotal !== "number" || isNaN(team.seasonTotal)) {
    console.error(
      `✗ Team ${team.name} has invalid seasonTotal: ${team.seasonTotal}`
    );
    allTeamsValid = false;
  }
  if (typeof team.rank !== "number" || isNaN(team.rank)) {
    console.error(`✗ Team ${team.name} has invalid rank: ${team.rank}`);
    allTeamsValid = false;
  }
  if (typeof team.wins !== "number" || isNaN(team.wins)) {
    console.error(`✗ Team ${team.name} has invalid wins: ${team.wins}`);
    allTeamsValid = false;
  }
  if (typeof team.losses !== "number" || isNaN(team.losses)) {
    console.error(`✗ Team ${team.name} has invalid losses: ${team.losses}`);
    allTeamsValid = false;
  }
  if (typeof team.ties !== "number" || isNaN(team.ties)) {
    console.error(`✗ Team ${team.name} has invalid ties: ${team.ties}`);
    allTeamsValid = false;
  }
}

if (allTeamsValid) {
  console.log("✓ All teams have valid numeric fields");
}

// Validate teams are sorted by rank
let sortedByRank = true;
for (let i = 1; i < result.teams.length; i++) {
  if (result.teams[i].rank < result.teams[i - 1].rank) {
    sortedByRank = false;
    break;
  }
}

if (sortedByRank) {
  console.log("✓ Teams are sorted by rank");
} else {
  console.error("✗ Teams are not sorted by rank");
}

// Validate weekly points
const endWeek = 17;
const expectedPointsCount = result.teams.length * endWeek;
if (result.points.length === expectedPointsCount) {
  console.log(`✓ Weekly points count matches (${expectedPointsCount})`);
} else {
  console.error(
    `✗ Weekly points count mismatch! Expected ${expectedPointsCount}, got ${result.points.length}`
  );
}

// Validate week numbers are in range
let allWeeksValid = true;
for (const point of result.points) {
  if (point.week < 1 || point.week > endWeek) {
    console.error(`✗ Invalid week number: ${point.week}`);
    allWeeksValid = false;
    break;
  }
  if (
    typeof point.score !== "number" ||
    isNaN(point.score) ||
    point.score < 0
  ) {
    console.error(
      `✗ Invalid score: ${point.score} for ${point.teamName} week ${point.week}`
    );
    allWeeksValid = false;
    break;
  }
}

if (allWeeksValid) {
  console.log("✓ All weekly points have valid week numbers and scores");
}

console.log("\nTop 3 Teams:");
result.teams.slice(0, 3).forEach((t) => {
  console.log(
    `  ${t.rank}. ${t.name} - ${t.wins}-${t.losses}-${
      t.ties
    } - ${t.seasonTotal.toFixed(2)} pts`
  );
});

// Test 2: Deterministic random scores
console.log("\nTest 2: Deterministic score generation");
const result1 = normalizeLeague(raw, {
  useDeterministicScores: true,
  seed: 12345,
});
const result2 = normalizeLeague(raw, {
  useDeterministicScores: true,
  seed: 12345,
});

const scoresMatch = result1.points.every(
  (p, i) => p.score === result2.points[i].score
);
if (scoresMatch) {
  console.log("✓ Deterministic scores are reproducible with same seed");
} else {
  console.error("✗ Deterministic scores do not match!");
}

// Test 3: Edge cases
console.log("\nTest 3: Edge cases and malformed data");

// Test with missing fantasy_content
const noFantasyContent = { some: "data" };
const result3 = normalizeLeague(noFantasyContent);
if (result3.id === "unknown" && result3.teams.length === 0) {
  console.log("✓ Handles missing fantasy_content gracefully");
} else {
  console.error("✗ Failed to handle missing fantasy_content");
}

// Test with empty league array
const emptyLeague = { fantasy_content: { league: [] } };
const result4 = normalizeLeague(emptyLeague);
if (result4.id === "unknown" && result4.teams.length === 0) {
  console.log("✓ Handles empty league array gracefully");
} else {
  console.error("✗ Failed to handle empty league array");
}

// Test with null/undefined
const result5 = normalizeLeague(null);
const result6 = normalizeLeague(undefined);
if (result5.id === "unknown" && result6.id === "unknown") {
  console.log("✓ Handles null/undefined input gracefully");
} else {
  console.error("✗ Failed to handle null/undefined input");
}

console.log("\n=== All Tests Complete ===\n");
