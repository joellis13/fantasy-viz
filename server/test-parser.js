const fs = require('fs');
const { normalizeLeague } = require('./dist/parsers.js');

const raw = JSON.parse(fs.readFileSync('sample-league-object.json', 'utf8'));
const result = normalizeLeague(raw);

console.log('\n=== Parser Test Results ===\n');
console.log('League:', result.name);
console.log('League ID:', result.id);
console.log('Total Teams:', result.teams.length);
console.log('\nTop 5 Teams:');

result.teams
  .sort((a, b) => a.rank - b.rank)
  .slice(0, 5)
  .forEach(t => {
    console.log(`  ${t.rank}. ${t.name}`);
    console.log(`     Record: ${t.wins}-${t.losses}-${t.ties} (${((t.wins / (t.wins + t.losses + t.ties)) * 100).toFixed(1)}%)`);
    console.log(`     Season Total: ${t.seasonTotal} pts`);
  });

console.log('\nWeekly Scores Sample (Week 1, first 3 teams):');
result.points
  .filter(p => p.week === 1)
  .slice(0, 3)
  .forEach(p => {
    console.log(`  ${p.teamName}: ${p.score} pts`);
  });

console.log('\n=== Test Complete ===\n');
