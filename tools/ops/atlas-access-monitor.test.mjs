import assert from 'node:assert/strict';
import { buildDailyReport, buildHumanPageEvents, classifyService } from './atlas-access-monitor.mjs';

const salt = Buffer.from('archiveos-monitor-regression-salt');
const timestamp = Date.parse('2026-08-31T03:00:00+09:00');
const events = [
  { ip: '203.0.113.10', timestamp, method: 'GET', path: '/travel/', status: 200, referrer: null },
  { ip: '203.0.113.10', timestamp: timestamp + 1, method: 'GET', path: '/api/geocode', status: 503, referrer: 'https://example.test/travel/' },
  { ip: '203.0.113.10', timestamp: timestamp + 2, method: 'GET', path: '/.env', status: 404, referrer: null },
];

assert.equal(classifyService('/api/geocode'), 'Travel Atlas');
assert.equal(classifyService('/api/unknown', 'https://example.test/sketchfy/'), 'Sketchfy Atlas');
assert.equal(classifyService('/api/live-flow/summary', null, 'ArchiveOS'), 'ArchiveOS');

const report = buildDailyReport({
  events,
  baselineIdentities: new Set(),
  cohort: {},
  salt,
  targetDate: '2026-08-31',
  startDate: '2026-08-27',
});

assert.deepEqual(report.statusCounts, { '2xx': 1, '3xx': 0, '4xx': 1, '5xx': 1, other: 0 });
assert.deepEqual(report.serviceStatusCounts['Travel Atlas'], { '2xx': 1, '3xx': 0, '4xx': 0, '5xx': 1 });
assert.deepEqual(report.serviceStatusCounts['Atlas Home/Other'], { '2xx': 0, '3xx': 0, '4xx': 1, '5xx': 0 });

const humanEvents = buildHumanPageEvents({
  events: [
    { ...events[0], userAgent: 'Mozilla/5.0' },
    { ...events[1], status: 200, userAgent: 'Mozilla/5.0' },
    { ...events[2], status: 200, userAgent: 'Mozilla/5.0' },
  ],
  targetDate: '2026-08-31',
});
assert.equal(humanEvents.length, 1);
assert.deepEqual(humanEvents.map(event => event.route), ['/travel/']);

console.log('atlas-access-monitor regression: PASS');
