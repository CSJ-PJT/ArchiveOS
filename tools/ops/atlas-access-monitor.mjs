import { createHash, createHmac, randomBytes } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { chmod, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';
import { basename, join } from 'node:path';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const DEFAULT_START_DATE = '2026-08-27';
const DAY_MS = 86_400_000;
const LOG_STREAM_HIGH_WATER_MARK = 4 * 1024 * 1024;
const MAX_REQUEST_PATH_LENGTH = 2048;
const MAX_REFERRER_LENGTH = 2048;
const MAX_USER_AGENT_LENGTH = 512;
const MONTHS = new Map(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((month, index) => [month, index]));
const STATIC_ASSET = /\.(?:avif|css|gif|ico|jpe?g|js|map|png|svg|webmanifest|webp|woff2?|ttf)(?:$|\?)/i;

function requiredDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || Number.isNaN(Date.parse(`${value}T00:00:00+09:00`))) {
    throw new Error(`${label} must be YYYY-MM-DD.`);
  }
  return value;
}

export function kstDate(value) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  const part = type => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function dateBefore(value) {
  return kstDate(Date.parse(`${value}T00:00:00+09:00`) - DAY_MS);
}

function parseNginxTime(value) {
  const match = /^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/.exec(value);
  if (!match || !MONTHS.has(match[2])) return Number.NaN;
  const utc = Date.UTC(Number(match[3]), MONTHS.get(match[2]), Number(match[1]), Number(match[4]), Number(match[5]), Number(match[6]));
  const offset = (Number(match[8]) * 60 + Number(match[9])) * 60_000 * (match[7] === '+' ? 1 : -1);
  return utc - offset;
}

export function parseNginxLine(line) {
  const match = /^(\S+) \S+ \S+ \[([^\]]+)] "([^"]*)" (\d{3}) (\S+) "([^"]*)" "([^"]*)"/.exec(line);
  if (!match) return null;
  const timestamp = parseNginxTime(match[2]);
  if (!Number.isFinite(timestamp)) return null;
  const request = match[3].trim().split(/\s+/);
  return {
    ip: match[1],
    timestamp,
    method: request[0] || 'UNKNOWN',
    path: request[1]?.startsWith('/') ? request[1].slice(0, MAX_REQUEST_PATH_LENGTH) : '/__unparsed-request__',
      status: Number(match[4]),
      referrer: match[6] && match[6] !== '-' ? match[6].slice(0, MAX_REFERRER_LENGTH) : null,
      userAgent: match[7] && match[7] !== '-' ? match[7].slice(0, MAX_USER_AGENT_LENGTH) : null,
  };
}

function mappedIpv4(ip) {
  return ip.toLowerCase().startsWith('::ffff:') ? ip.slice(7) : ip;
}

export function isPublicAddress(value) {
  const ip = mappedIpv4(String(value || ''));
  const version = isIP(ip);
  if (version === 4) {
    const [a, b] = ip.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a === 172 || (a === 169 && b === 254)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
      || (a === 106 && b === 101) || a >= 224);
  }
  if (version === 6) {
    const normalized = ip.toLowerCase();
    return !(normalized === '::' || normalized === '::1' || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb') || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('ff'));
  }
  return false;
}

export function classifyService(pathname, referrer = null, defaultProject = 'Atlas Home/Other') {
  let path = String(pathname || '').split('?')[0].toLowerCase();
  if (defaultProject === 'ArchiveOS' && path.startsWith('/api/')) return 'ArchiveOS';
  if (path === '/api/geocode' || path === '/api/google-maps-config') return 'Travel Atlas';
  if (path === '/api/mcp') return 'Learn Atlas';
  if (path === '/api/health') return 'Health Atlas';
  if (path.startsWith('/api/') && referrer) {
    try { path = new URL(referrer).pathname.toLowerCase(); }
    catch { }
  }
  if (path === '/archiveos' || path.startsWith('/archiveos/')) return 'ArchiveOS';
  if (path === '/market' || path.startsWith('/market/')) return 'Archive-Market';
  if (path === '/nexus' || path.startsWith('/nexus/')) return 'Archive-Nexus';
  if (path === '/logistics' || path.startsWith('/logistics/')) return 'Archive-Logistics';
  if (path === '/ledger' || path.startsWith('/ledger/')) return 'Archive-Ledger';
  if (path === '/archive-world' || path.startsWith('/archive-world/') || path === '/archive-world-mini' || path.startsWith('/archive-world-mini/')) return 'Archive-World';
  if (path === '/run' || path.startsWith('/learn')) return 'Learn Atlas';
  if (path.startsWith('/sketchfy')) return 'Sketchfy Atlas';
  if (path.startsWith('/jobs')) return 'Incruit Atlas';
  if (path.startsWith('/health')) return 'Health Atlas';
  if (path.startsWith('/travel')) return 'Travel Atlas';
  if (path.startsWith('/world')) return 'World Atlas';
  return defaultProject;
}

const AUTOMATED_AGENT = /bot|crawler|spider|curl|wget|python|uptime|healthcheck|monitor|zgrab|masscan|go-http-client|java\//i;
const SENSITIVE_PROBE_PATH = /(?:^|\/)(?:\.env|\.git|wp-admin|wp-login\.php|xmlrpc\.php|phpmyadmin|actuator\/env|swagger(?:-ui)?|v\d+\/api-docs)(?:\/|$)/i;

export function buildHumanPageEvents({ events, targetDate }) {
  requiredDate(targetDate, 'targetDate');
  const start = Date.parse(`${targetDate}T00:00:00+09:00`);
  const end = start + DAY_MS;
  return events.filter(event => {
    const path = String(event.path || '').split('?')[0];
    return event.timestamp >= start && event.timestamp < end
      && isPublicAddress(event.ip)
      && (event.method === 'GET' || event.method === 'HEAD')
      && event.status >= 200 && event.status < 400
      && path !== '/__unparsed-request__'
      && !STATIC_ASSET.test(path)
      && !path.startsWith('/api/')
      && !path.startsWith('/actuator/')
      && path !== '/health'
      && path !== '/edge-healthz'
      && !path.startsWith('/.well-known/')
      && !SENSITIVE_PROBE_PATH.test(path)
      && event.userAgent
      && !AUTOMATED_AGENT.test(event.userAgent);
  }).map(event => {
    const route = String(event.path).split('?')[0].slice(0, 512) || '/';
    const identityParts = [
      event.ip, event.timestamp, event.method, route, event.status, event.userAgent,
    ].join('\n');
    const sourceInput = event.sourceOccurrence > 0 ? `${identityParts}\n#${event.sourceOccurrence}` : identityParts;
    const sourceId = createHash('sha256').update(sourceInput).digest('hex');
    return {
      sourceId,
      occurredAt: new Date(event.timestamp).toISOString(),
      project: classifyService(route, event.referrer),
      route,
      method: event.method,
      status: event.status,
      clientIp: event.ip,
      userAgent: String(event.userAgent).slice(0, 512),
    };
  });
}

function statusBucket(status) {
  if (status >= 500) return '5xx';
  if (status >= 400) return '4xx';
  if (status >= 300) return '3xx';
  if (status >= 200) return '2xx';
  return 'other';
}

function identity(ip, salt) {
  return createHmac('sha256', salt).update(mappedIpv4(ip)).digest('hex');
}

export function buildBaseline({ events, previousBaseline = null, salt, startDate = DEFAULT_START_DATE }) {
  requiredDate(startDate, 'startDate');
  const cutoff = Date.parse(`${startDate}T00:00:00+09:00`);
  const previousCutoff = previousBaseline?.cutoff ? Date.parse(previousBaseline.cutoff) : Number.NaN;
  if (Number.isFinite(previousCutoff) && previousCutoff > cutoff) {
    throw new Error('Existing baseline cutoff is later than the requested cutoff.');
  }
  const previousIdentities = Array.isArray(previousBaseline?.identities)
    ? previousBaseline.identities.filter(value => /^[a-f0-9]{64}$/i.test(value))
    : [];
  const identities = new Set(previousIdentities);
  for (const event of events) {
    if (event.timestamp < cutoff && isPublicAddress(event.ip)) identities.add(identity(event.ip, salt));
  }
  return {
    cutoff: `${startDate}T00:00:00+09:00`,
    previousIdentityCount: previousIdentities.length,
    identities: [...identities].sort(),
  };
}

export function buildDailyReport({ events, baselineIdentities, cohort = {}, salt, targetDate, startDate = DEFAULT_START_DATE, defaultProject = 'Atlas Home/Other' }) {
  requiredDate(targetDate, 'targetDate');
  requiredDate(startDate, 'startDate');
  const targetStart = Date.parse(`${targetDate}T00:00:00+09:00`);
  const targetEnd = targetStart + DAY_MS;
  const cutoff = Date.parse(`${startDate}T00:00:00+09:00`);
  const baseline = baselineIdentities instanceof Set ? baselineIdentities : new Set(baselineIdentities || []);
  const priorPostStart = new Set(Object.keys(cohort || {}));
  const target = [];
  let ignoredPrivateRequests = 0;
  for (const event of events) {
    if (!isPublicAddress(event.ip)) {
      if (event.timestamp >= targetStart && event.timestamp < targetEnd) ignoredPrivateRequests += 1;
      continue;
    }
    const digest = identity(event.ip, salt);
    if (event.timestamp >= cutoff && event.timestamp < targetStart && !baseline.has(digest)) priorPostStart.add(digest);
    if (event.timestamp >= targetStart && event.timestamp < targetEnd) target.push({ ...event, digest });
  }
  const baselineRequests = target.filter(event => baseline.has(event.digest)).length;
  const newCohortEvents = target.filter(event => !baseline.has(event.digest));
  const grouped = new Map();
  for (const event of newCohortEvents) {
    const item = grouped.get(event.digest) || {
      requests: 0,
      pageRequests: 0,
      statuses: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, other: 0 },
      services: {},
      serviceStatuses: {},
    };
    item.requests += 1;
    if ((event.method === 'GET' || event.method === 'HEAD') && !STATIC_ASSET.test(event.path)) item.pageRequests += 1;
    const bucket = statusBucket(event.status);
    item.statuses[bucket] += 1;
    const service = classifyService(event.path, event.referrer, defaultProject);
    item.services[service] = (item.services[service] || 0) + 1;
    const projectStatuses = item.serviceStatuses[service]
      || { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, other: 0 };
    projectStatuses[bucket] += 1;
    item.serviceStatuses[service] = projectStatuses;
    grouped.set(event.digest, item);
  }
  const firstSeenToday = [...grouped.keys()].filter(digest => !priorPostStart.has(digest));
  const returning = [...grouped.keys()].filter(digest => priorPostStart.has(digest));
  const statusCounts = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, other: 0 };
  const serviceCounts = {};
  const serviceStatusCounts = {};
  let pageRequests = 0;
  for (const item of grouped.values()) {
    pageRequests += item.pageRequests;
    for (const [key, count] of Object.entries(item.statuses)) statusCounts[key] += count;
    for (const [key, count] of Object.entries(item.services)) serviceCounts[key] = (serviceCounts[key] || 0) + count;
    for (const [service, statuses] of Object.entries(item.serviceStatuses)) {
      const current = serviceStatusCounts[service] || { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
      for (const bucket of ['2xx', '3xx', '4xx', '5xx']) current[bucket] += statuses[bucket] || 0;
      serviceStatusCounts[service] = current;
    }
  }
  return {
    schemaVersion: 1,
    targetDate,
    baselineCutoff: `${startDate}T00:00:00+09:00`,
    baselineIdentityCount: baseline.size,
    externalRequests: target.length,
    baselineRequests,
    monitoredRequests: newCohortEvents.length,
    monitoredPageRequests: pageRequests,
    monitoredUniqueIdentities: grouped.size,
    firstSeenToday: firstSeenToday.length,
    returningPostStart: returning.length,
    ignoredPrivateRequests,
    statusCounts,
    serviceCounts: Object.fromEntries(Object.entries(serviceCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
    serviceStatusCounts: Object.fromEntries(Object.entries(serviceStatusCounts).sort((a, b) => a[0].localeCompare(b[0]))),
    identityDigests: [...grouped.keys()].sort(),
  };
}

export function buildSlackMessage(report) {
  const services = Object.entries(report.serviceCounts).map(([name, count]) => `${name} ${count}건`).join(' · ') || '기준 외 접속 없음';
  return [
    '🛡️ [Archive Alert] Atlas 비식별 접속 일일 모니터링',
    `기준일: ${report.targetDate} KST`,
    `기준: ${report.baselineCutoff} 이전 관측 IP 제외`,
    `고유 비식별 접속: ${report.monitoredUniqueIdentities}개`,
    `요청: ${report.monitoredRequests}건`,
    `응답: 2xx ${report.statusCounts['2xx']} · 3xx ${report.statusCounts['3xx']} · 4xx ${report.statusCounts['4xx']} · 5xx ${report.statusCounts['5xx']}`,
    `서비스: ${services}`,
    '개인정보 보호: 원 IP와 비식별 식별값은 Slack·일일 보고서에 저장하거나 전송하지 않습니다.',
  ].join('\n');
}

function publicDailyReport(report, { delivered, deliveredAt = null, generatedAt = new Date().toISOString(), reportSource = 'atlas' }) {
  return {
    schemaVersion: report.schemaVersion,
    reportSource,
    targetDate: report.targetDate,
    baselineCutoff: report.baselineCutoff,
    monitoredUniqueIdentities: report.monitoredUniqueIdentities,
    monitoredRequests: report.monitoredRequests,
    serviceCounts: report.serviceCounts,
    serviceStatusCounts: report.serviceStatusCounts,
    statusCounts: {
      '2xx': report.statusCounts['2xx'],
      '3xx': report.statusCounts['3xx'],
      '4xx': report.statusCounts['4xx'],
      '5xx': report.statusCounts['5xx'],
    },
    delivered,
    deliveredAt,
    generatedAt,
  };
}

async function atomicJson(path, value) {
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await chmod(temporary, 0o600);
  await rename(temporary, path);
}

async function loadJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error?.code === 'ENOENT') return fallback; throw error; }
}

async function logFiles(logDir, { beforeDate = null, targetDate = null } = {}) {
  const names = await readdir(logDir);
  const beforeCompact = beforeDate?.replaceAll('-', '') || null;
  const targetCompact = targetDate?.replaceAll('-', '') || null;
  return names.filter(name => {
    if (!/^access\.log(?:-|$)/.test(name)) return false;
    const dated = /^access\.log-(\d{8})(?:\.gz)?$/.exec(name)?.[1] || null;
    if (beforeCompact) {
      if (name === 'access.log') return false;
      return dated ? dated < beforeCompact : true;
    }
    if (targetCompact) {
      if (name === 'access.log') return targetDate === kstDate(Date.now());
      return dated === targetCompact;
    }
    return true;
  }).sort().map(name => join(logDir, name));
}

async function readEvents(logDir, selection = {}) {
  const events = [];
  let malformedLines = 0;
  const occurrences = new Map();
  for (const path of await logFiles(logDir, selection)) {
    // OCI block volumes can amplify the default 64 KiB reads heavily while a
    // rotated log is being scanned. Larger sequential reads keep the daily
    // monitor bounded without changing the source logs or report semantics.
    const source = createReadStream(path, { highWaterMark: LOG_STREAM_HIGH_WATER_MARK });
    const input = path.endsWith('.gz') ? source.pipe(createGunzip()) : source;
    const lines = createInterface({ input, crlfDelay: Infinity });
    for await (const line of lines) {
      const event = parseNginxLine(line);
      if (event) {
        const identityParts = [event.ip, event.timestamp, event.method, String(event.path).split('?')[0].slice(0, 512) || '/', event.status, event.userAgent].join('\n');
        const occurrenceKey = createHash('sha256').update(identityParts).digest('base64url');
        const occurrence = occurrences.get(occurrenceKey) || 0;
        occurrences.set(occurrenceKey, occurrence + 1);
        events.push({ ...event, sourceOccurrence: occurrence });
      } else malformedLines += 1;
    }
  }
  return { events, malformedLines };
}

async function loadOrCreateSalt(path, persist) {
  if (existsSync(path)) return (await readFile(path, 'utf8')).trim();
  const salt = randomBytes(32).toString('hex');
  if (persist) {
    await writeFile(path, `${salt}\n`, { mode: 0o600 });
    await chmod(path, 0o600);
  }
  return salt;
}

function postJson(url, headers, body) {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const request = httpsRequest(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(payload) },
    }, response => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { raw += chunk; });
      response.on('end', () => {
        let data = {};
        try { data = raw ? JSON.parse(raw) : {}; }
        catch { data = {}; }
        resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode || 0, data });
      });
    });
    request.setTimeout(20_000, () => request.destroy(new Error('HTTPS request timed out.')));
    request.on('error', reject);
    request.end(payload);
  });
}

async function sendSlack(text, env = process.env) {
  const token = String(env.SLACK_BOT_TOKEN || '').trim();
  const channel = String(env.SLACK_CHANNEL || '').trim();
  if (!token || !channel) throw new Error('Archive Alert Slack configuration is missing.');
  const response = await postJson('https://slack.com/api/chat.postMessage',
    { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
    { channel, text, unfurl_links: false, unfurl_media: false });
  if (!response.ok) throw new Error(`Archive Alert HTTP ${response.status}.`);
  const body = response.data;
  if (!body?.ok) throw new Error(`Archive Alert rejected: ${body?.error || 'unknown_error'}.`);
}

async function postArchiveOs(path, body, env = process.env) {
  const baseUrl = String(env.ARCHIVEOS_USAGE_IMPORT_BASE_URL || 'https://archiveos.kr/api/audit/usage').replace(/\/$/, '');
  const token = String(env.ARCHIVEOS_ADMIN_OPERATOR_TOKEN || '').trim();
  if (!token) throw new Error('ArchiveOS usage import credential is missing.');
  const response = await postJson(`${baseUrl}/${path}`, {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Archive-Source-System': 'archive-os',
      'X-Archive-Service-Scope': 'admin:operate',
    }, body);
  const payload = response.data;
  if (!response.ok) throw new Error(`ArchiveOS usage import failed with HTTP ${response.status}.`);
  return payload?.data || {};
}

async function importArchiveOsUsage(report, events, env = process.env) {
  const reportResult = await postArchiveOs('atlas-report', report, env);
  let imported = 0;
  let duplicates = 0;
  for (let index = 0; index < events.length; index += 100) {
    const result = await postArchiveOs('atlas-events', {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      events: events.slice(index, index + 100),
    }, env);
    imported += Number(result.imported || 0);
    duplicates += Number(result.duplicates || 0);
  }
  return { reportImported: Boolean(reportResult.imported), eventsAccepted: events.length, eventsImported: imported, duplicates };
}

function flags(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    if (!argv[index].startsWith('--')) continue;
    const key = argv[index].slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) { values.set(key, next); index += 1; }
    else values.set(key, true);
  }
  return values;
}

async function main() {
  const command = process.argv[2] || 'report';
  const options = flags(process.argv.slice(3));
  const dryRun = options.has('dry-run');
  const send = options.has('send');
  const importUsage = options.has('import-archiveos');
  const reportSource = String(options.get('source') || process.env.ACCESS_REPORT_SOURCE || 'atlas').trim().toLowerCase();
  if (!['atlas', 'archiveos'].includes(reportSource)) throw new Error('--source must be atlas or archiveos.');
  const defaultProject = reportSource === 'archiveos' ? 'ArchiveOS' : 'Atlas Home/Other';
  const stateDir = process.env.ATLAS_ACCESS_STATE_DIR || '/var/lib/atlas-access-monitor';
  const logDir = process.env.ATLAS_NGINX_LOG_DIR || '/var/log/nginx';
  const startDate = requiredDate(process.env.ATLAS_ACCESS_START_DATE || DEFAULT_START_DATE, 'ATLAS_ACCESS_START_DATE');
  const baselinePath = join(stateDir, 'baseline.json');
  const saltPath = join(stateDir, 'identity.key');
  const cohortPath = join(stateDir, 'post-start-identities.json');
  const reportsDir = join(stateDir, 'reports');
  if (!dryRun) { await mkdir(reportsDir, { recursive: true, mode: 0o700 }); await chmod(stateDir, 0o700); await chmod(reportsDir, 0o700); }
  const salt = await loadOrCreateSalt(saltPath, !dryRun);
  if (command === 'baseline') {
    const { events, malformedLines } = await readEvents(logDir, { beforeDate: startDate });
    const previousBaseline = await loadJson(baselinePath, null);
    const next = buildBaseline({ events, previousBaseline, salt, startDate });
    const baseline = {
      schemaVersion: 1,
      cutoff: next.cutoff,
      identityCount: next.identities.length,
      identities: next.identities,
      source: previousBaseline ? 'previous baseline union retained nginx access logs' : 'retained nginx access logs',
      previousIdentityCount: next.previousIdentityCount,
      malformedLines,
      createdAt: new Date().toISOString(),
    };
    if (!dryRun) await atomicJson(baselinePath, baseline);
    console.log(JSON.stringify({ mode: 'baseline', dryRun, cutoff: baseline.cutoff, previousIdentityCount: baseline.previousIdentityCount, identityCount: baseline.identityCount, malformedLines }, null, 2));
    return;
  }
  if (command !== 'report') throw new Error(`Unknown command: ${command}`);
  const defaultDate = options.has('current') ? kstDate(Date.now()) : dateBefore(kstDate(Date.now()));
  const targetDate = requiredDate(String(options.get('date') || defaultDate), '--date');
  if (targetDate < startDate) {
    console.log(JSON.stringify({ mode: 'report', skipped: true, reason: 'before monitoring start', targetDate, startDate }, null, 2));
    return;
  }
  const reportPath = join(reportsDir, `${targetDate}.json`);
  const existing = await loadJson(reportPath, null);
  if (existing?.delivered && !options.has('force')) {
    console.log(JSON.stringify({ mode: 'report', skipped: true, reason: 'already delivered', targetDate }, null, 2));
    return;
  }
  const baseline = await loadJson(baselinePath, null);
  if (!baseline || baseline.cutoff !== `${startDate}T00:00:00+09:00`) throw new Error('Finalized baseline is missing or has the wrong cutoff.');
  const { events, malformedLines } = await readEvents(logDir, { targetDate });
  const cohortState = await loadJson(cohortPath, { schemaVersion: 1, identities: {} });
  const report = buildDailyReport({ events, baselineIdentities: new Set(baseline.identities), cohort: cohortState.identities, salt, targetDate, startDate, defaultProject });
  const humanPageEvents = buildHumanPageEvents({ events, targetDate });
  const message = buildSlackMessage(report);
  const publicReport = publicDailyReport(report, { delivered: false, reportSource });
  if (dryRun) {
    console.log(JSON.stringify({ mode: 'report', dryRun: true, report: publicReport, message }, null, 2));
    return;
  }
  const importResult = importUsage ? await importArchiveOsUsage(publicReport, humanPageEvents) : null;
  if (send) await sendSlack(message);
  const nextCohort = { ...cohortState.identities };
  for (const digest of report.identityDigests) if (!nextCohort[digest]) nextCohort[digest] = { firstSeenDate: targetDate };
  await atomicJson(cohortPath, { schemaVersion: 1, updatedAt: new Date().toISOString(), identities: nextCohort });
  publicReport.delivered = send;
  publicReport.deliveredAt = send ? new Date().toISOString() : null;
  await atomicJson(reportPath, publicReport);
  console.log(JSON.stringify({ mode: 'report', targetDate, delivered: send, monitoredUniqueIdentities: report.monitoredUniqueIdentities, monitoredRequests: report.monitoredRequests, humanPageEvents: humanPageEvents.length, archiveOsImported: Boolean(importResult), importedEvents: importResult?.eventsImported || 0, duplicateEvents: importResult?.duplicates || 0, malformedLines }, null, 2));
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) main().catch(error => { console.error(`atlas-access-monitor: ${error.message}`); process.exitCode = 1; });
