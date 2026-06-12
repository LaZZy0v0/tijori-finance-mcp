// End-to-end tests for the screener tools against the live site.
// Run: node test/test_screener.js
import { listPopularScreens, screenCompanies, searchScreenerFields } from '../src/tools/screener.js';
import { closeBrowser } from '../src/browser.js';

let failures = 0;
function check(label, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${cond ? '' : '  — ' + detail}`);
  if (!cond) failures++;
}

try {
  // 1. list_popular_screens
  const screens = await listPopularScreens();
  check('list: returns screens', screens.length >= 10, `got ${screens.length}`);
  check('list: has categories', screens.every(s => s.category), JSON.stringify(screens[0]));
  check('list: has descriptions', screens.every(s => s.description));
  const promoter = screens.find(s => s.name === 'Promoter Increasing Stake');
  check('list: query not mangled (AND has spaces)', promoter && / AND /.test(promoter.query) && !/AND[A-Z]/.test(promoter.query), promoter?.query);
  const monopoly = screens.find(s => /monopoly/i.test(s.name));
  check('list: aq screen captured', !!monopoly?.alternate_query, JSON.stringify(monopoly));
  const whalesScreen = screens.find(s => s.whales);
  check('list: whales flag captured', !!whalesScreen, 'no screen with whales=true');
  console.log('  screens:', screens.map(s => `${s.category} / ${s.name}`).join(' | ').slice(0, 400));

  // 2. preset runs
  const p1 = await screenCompanies({ preset: 'Promoter Increasing Stake', limit: 5 });
  check('preset fq: results', p1.total_results > 10 && p1.results.length === 5, JSON.stringify(p1).slice(0, 200));
  check('preset fq: keys cleaned', Object.keys(p1.results[0]).every(k => !k.includes('<')), Object.keys(p1.results[0]).join(','));

  const p2 = await screenCompanies({ preset: 'monopoly', limit: 5 });
  check('preset aq (Monopoly): results', p2.total_results > 50, JSON.stringify(p2).slice(0, 200));

  const p3 = await screenCompanies({ preset: whalesScreen?.name ?? 'Superstar', limit: 5 });
  check('preset whales: results', p3.total_results > 50, JSON.stringify(p3).slice(0, 200));

  // 3. ad-hoc queries
  const a1 = await screenCompanies({ filters: 'ROCE > 20% AND Market Capitalization > 500 AND 3yr Avg ROCE > 20%', limit: 5 });
  check('adhoc string: results', a1.total_results > 50 && a1.results.length === 5, JSON.stringify(a1).slice(0, 200));

  const a2 = await screenCompanies({ filters: { roe: { min: 15 }, debt_to_equity: { max: 0.5 }, market_cap: { min: 1000 } }, limit: 5 });
  check('adhoc object: results', a2.total_results > 50, JSON.stringify(a2).slice(0, 200));

  const bad = await screenCompanies({ filters: 'Nonexistent Gibberish Metric > 5' }).catch(e => e);
  check('adhoc bad query: throws clear error', bad instanceof Error, JSON.stringify(bad).slice(0, 200));

  // 3b. alternate (business-data) queries
  const alt1 = await screenCompanies({ alternate: 'market share > 50', limit: 5 });
  check('alternate only: results', alt1.total_results > 100 && alt1.alternate_query === 'market share > 50', JSON.stringify(alt1).slice(0, 200));

  const alt2 = await screenCompanies({ filters: 'Market Capitalization > 1000', alternate: 'market share > 40', limit: 5 });
  check('alternate + financial: results', alt2.total_results > 50 && alt2.total_results < 1000, JSON.stringify(alt2).slice(0, 200));

  const alt3 = await screenCompanies({ alternate: 'revenue from Defence > 50', limit: 5 });
  check('alternate revenue-from: results', alt3.total_results >= 5, JSON.stringify(alt3).slice(0, 200));

  // 4. field search
  const f1 = await searchScreenerFields({ query: 'roce' });
  check('fields: roce variants', f1.total_matches >= 10 && f1.fields.some(f => f.name === '3yr Avg ROCE'), JSON.stringify(f1).slice(0, 300));

  const f2 = await searchScreenerFields({ query: 'promoter holding' });
  check('fields: promoter holding', f2.total_matches >= 3, JSON.stringify(f2).slice(0, 300));

  const f3 = await searchScreenerFields({ query: 'pharma', type: 'Products' });
  check('fields: type filter', f3.fields.every(f => f.type === 'Products') && f3.total_matches >= 1, JSON.stringify(f3).slice(0, 300));
} catch (e) {
  console.error('UNEXPECTED ERROR:', e.message);
  failures++;
} finally {
  await closeBrowser();
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
