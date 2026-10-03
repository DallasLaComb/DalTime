/**
 * Supplemental seed: edge-case scheduling scenarios for morgan.manager@sunsetcafe.dev
 *
 * Requires seed-dev.mjs to have been run first (all employees must exist).
 *
 * Creates three distinct scenarios for the current week (Jun 2–8 2026):
 *
 *   A) The Sole Opener — Saturday Jun 7 04:30-10:00 @ Main Street
 *      Phoenix Ford is the ONLY person available (04:00 slot, nobody else starts that early).
 *      Phoenix already has 36h this week → assigning the 5.5h shift hits 41.5h → OT risk.
 *
 *   B) The Late-Night Squeeze — Fri/Sat Jun 6 & 7 21:00-23:30 @ Main Street
 *      Sage Shaw is the only closer and already has 35h → each 2.5h closing shift pushes
 *      Sage toward and then past 39h. Friday is fine (37.5h); Saturday tips to 40h → OT.
 *
 *   C) The Nobody Slot — Sunday Jun 8 05:00-13:00 @ Main Street (2 needed)
 *      No employee has Sunday availability before 06:00, so both slots go unfilled
 *      regardless of how many employees exist or how many hours they have.
 *
 * Usage (run from project root, after seed-dev.mjs):
 *   node backend/scripts/seed-unfilled-scenario.mjs
 */

import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { fromIni } from '@aws-sdk/credential-provider-ini';

// ── Config ────────────────────────────────────────────────────────────────────

const REGION      = 'us-east-1';
const PROFILE     = 'daltime-dev';
const USER_POOL_ID = 'us-east-1_kzQ806uSv';
const TABLE_NAME  = 'daltime-daltime-backend-dev';

const ORG_ID      = 'seed-org-sunsetcafe-001';
const MANAGER_ID  = '84a84418-40c1-7045-379d-f227e67bb0ed'; // morgan.manager

const LOC_MAIN      = 'seed-loc-main-001';
const LOC_RIVERSIDE = 'seed-loc-riverside-001';

// Known subs for the existing Tier 4/5 employees (from seed-users.md)
const KNOWN = {
  parker:  { id: 'd4a8a448-4041-70a5-0e6b-0462c893a1fe', name: 'Parker Powell' },
  sam:     { id: '346854d8-6001-70a3-d37f-cb059a4d9146', name: 'Sam Smith' },
  taylor:  { id: '6478a4b8-5071-7036-c032-fce7e1add3de', name: 'Taylor Torres' },
};

// ── AWS clients ───────────────────────────────────────────────────────────────

const creds   = fromIni({ profile: PROFILE });
const cognito = new CognitoIdentityProviderClient({ region: REGION, credentials: creds });
const dynamo  = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION, credentials: creds }));

async function put(item) {
  await dynamo.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
}

/** Look up the Cognito sub (= employee_id) by email. */
async function subByEmail(email) {
  const res = await cognito.send(new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: email }));
  return res.UserAttributes.find((a) => a.Name === 'sub').Value;
}

function toMins(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function writeDraftShift({ id, date, start, end, type, loc, locName, emp }) {
  await put({
    PK:            `ORG#${ORG_ID}`,
    SK:            `SHIFT#${id}`,
    GSI1PK:        `MANAGER#${MANAGER_ID}`,
    GSI1SK:        date,
    shift_id:      id,
    org_id:        ORG_ID,
    manager_id:    MANAGER_ID,
    employee_id:   emp.id,
    employee_name: emp.name,
    location_id:   loc,
    location_name: locName,
    date,
    start_time:    start,
    end_time:      end,
    type,
    status:        'draft',
    created_at:    new Date().toISOString(),
    updated_at:    new Date().toISOString(),
  });
  const h = (toMins(end) - toMins(start)) / 60;
  console.log(`  [Shift] ${date} ${start}-${end} → ${emp.name} (${h}h)`);
}

async function writeShiftNeeded({ id, date, start, end, count, loc, locName, note }) {
  await put({
    PK:             `ORG#${ORG_ID}`,
    SK:             `SHIFT_NEEDED#${id}`,
    GSI1PK:         `MANAGER#${MANAGER_ID}`,
    GSI1SK:         date,
    shift_id:       id,
    org_id:         ORG_ID,
    manager_id:     MANAGER_ID,
    date,
    start_time:     start,
    end_time:       end,
    employee_count: count,
    location_id:    loc,
    location_name:  locName,
    notes:          note ?? '',
    created_at:     new Date().toISOString(),
    updated_at:     new Date().toISOString(),
  });
  console.log(`  [SN] ${date} ${start}-${end} @ ${locName} × ${count}${note ? '  ← ' + note : ''}`);
}

// ── Scenario A: The Sole Opener (Phoenix Ford) ────────────────────────────────
//
// Phoenix is available Sat/Sun 04:00-10:00 — pre-dawn window nobody else has.
// Pre-seeded Mon-Fri shifts give Phoenix 36h heading into Saturday.
// Saturday 04:30-10:00 (5.5h) would push Phoenix to 41.5h → OT risk.
// Phoenix is the only available candidate in the fill-shift tab.

async function scenarioSoleOpener(phoenix) {
  console.log('\n── Scenario A: The Sole Opener (Phoenix Ford) ───────────────────');

  // Mon-Fri: 8h shifts each day (4 days × 8h = 32h, plus one 4h early = 36h)
  const phoenixShifts = [
    { id: 'sce-a-01', date: '2026-06-01', start: '07:00', end: '15:00', type: 'morning',   loc: LOC_MAIN,      locName: 'Main Street' },
    { id: 'sce-a-02', date: '2026-06-02', start: '07:00', end: '15:00', type: 'morning',   loc: LOC_MAIN,      locName: 'Main Street' },
    { id: 'sce-a-03', date: '2026-06-03', start: '07:00', end: '15:00', type: 'morning',   loc: LOC_MAIN,      locName: 'Main Street' },
    { id: 'sce-a-04', date: '2026-06-04', start: '07:00', end: '15:00', type: 'morning',   loc: LOC_MAIN,      locName: 'Main Street' },
    { id: 'sce-a-05', date: '2026-06-05', start: '04:30', end: '08:30', type: 'morning',   loc: LOC_MAIN,      locName: 'Main Street' },
  ];
  // 4 × 8h + 1 × 4h = 36h
  for (const s of phoenixShifts) await writeDraftShift({ ...s, emp: phoenix });
  const total = phoenixShifts.reduce((sum, s) => sum + (toMins(s.end) - toMins(s.start)) / 60, 0);
  console.log(`  Phoenix week total so far: ${total}h`);

  // Unfilled Saturday shift only Phoenix can cover
  await writeShiftNeeded({
    id: 'sce-a-sn-01', date: '2026-06-07', start: '04:30', end: '10:00',
    count: 1, loc: LOC_MAIN, locName: 'Main Street',
    note: 'pre-dawn — only Phoenix can fill (04:00 slot); would push to 41.5h OT',
  });
}

// ── Scenario B: The Late-Night Squeeze (Sage Shaw) ────────────────────────────
//
// Sage is the only closer (21:00-23:59 every day).
// Pre-seeded Mon-Thu shifts give Sage 35h before Friday.
// Fri closing (2.5h) → 37.5h (fine).
// Sat closing (2.5h) → 40h → OT risk. Sage is still the only available person.

async function scenarioLateNightSqueeze(sage) {
  console.log('\n── Scenario B: The Late-Night Squeeze (Sage Shaw) ────────────────');

  // Mon-Thu: 8h evening blocks (Sage's slot is 21:00-23:59, so we use wide shifts
  // that fall within that window to rack up hours)
  const sageShifts = [
    { id: 'sce-b-01', date: '2026-06-01', start: '15:00', end: '23:00', type: 'afternoon', loc: LOC_RIVERSIDE, locName: 'Riverside' },
    { id: 'sce-b-02', date: '2026-06-02', start: '15:00', end: '23:00', type: 'afternoon', loc: LOC_RIVERSIDE, locName: 'Riverside' },
    { id: 'sce-b-03', date: '2026-06-03', start: '15:00', end: '23:00', type: 'afternoon', loc: LOC_RIVERSIDE, locName: 'Riverside' },
    { id: 'sce-b-04', date: '2026-06-04', start: '15:00', end: '22:00', type: 'night',     loc: LOC_MAIN,      locName: 'Main Street' },
  ];
  // 3 × 8h + 1 × 7h = 31h … let's add a Tue 4h block to reach 35h
  // Actually: 3×8 + 7 = 31 + extra Wed 4h shift
  sageShifts.push({ id: 'sce-b-05', date: '2026-06-03', start: '10:00', end: '14:00', type: 'morning', loc: LOC_MAIN, locName: 'Main Street' });
  // 3×8 + 7 + 4 = 35h
  for (const s of sageShifts) await writeDraftShift({ ...s, emp: sage });
  const total = sageShifts.reduce((sum, s) => sum + (toMins(s.end) - toMins(s.start)) / 60, 0);
  console.log(`  Sage week total so far: ${total}h`);

  // Friday closing: 2.5h → 37.5h (ok, no OT badge)
  await writeDraftShift({ id: 'sce-b-filled-fri', date: '2026-06-06', start: '21:00', end: '23:30', type: 'night', loc: LOC_MAIN, locName: 'Main Street', emp: sage });
  console.log(`  Friday close assigned → ${total + 2.5}h (under 39 — no OT)`);

  // Saturday closing: needs filling — Sage would be the only person available but 40h OT
  await writeShiftNeeded({
    id: 'sce-b-sn-01', date: '2026-06-07', start: '21:00', end: '23:30',
    count: 1, loc: LOC_MAIN, locName: 'Main Street',
    note: 'closing shift — only Sage available; would be 40h OT for Sage',
  });
}

// ── Scenario C: The Nobody Slot (Sunday dead zone) ────────────────────────────
//
// Sunday Jun 8 05:00-13:00 — no employee has Sunday availability before 06:00.
// Even the most flexible (Parker, Reese, Lane) start at 06:00. These two slots
// will always show as unfilled regardless of hours.
// Also seed Mon-Fri shifts for Parker/Sam/Taylor to populate the hours columns.

async function scenarioNobodySlot() {
  console.log('\n── Scenario C: Nobody Slot + Populated Hours (existing employees) ─');

  // Parker Powell: 4 shifts × 8h = 32h → OT risk on any more
  const parkerShifts = [
    { id: 'sce-c-01', date: '2026-06-01', start: '07:00', end: '15:00', type: 'morning',   loc: LOC_MAIN,      locName: 'Main Street' },
    { id: 'sce-c-02', date: '2026-06-02', start: '07:00', end: '15:00', type: 'morning',   loc: LOC_MAIN,      locName: 'Main Street' },
    { id: 'sce-c-03', date: '2026-06-04', start: '07:00', end: '15:00', type: 'morning',   loc: LOC_MAIN,      locName: 'Main Street' },
    { id: 'sce-c-04', date: '2026-06-05', start: '07:00', end: '15:00', type: 'morning',   loc: LOC_MAIN,      locName: 'Main Street' },
  ];
  for (const s of parkerShifts) await writeDraftShift({ ...s, emp: KNOWN.parker });
  console.log(`  Parker week total: ${parkerShifts.length * 8}h — OT risk on any Sunday shift`);

  // Sam Smith: 3 shifts × 8h = 24h → safe
  const samShifts = [
    { id: 'sce-c-05', date: '2026-06-01', start: '13:00', end: '21:00', type: 'afternoon', loc: LOC_RIVERSIDE, locName: 'Riverside' },
    { id: 'sce-c-06', date: '2026-06-03', start: '13:00', end: '21:00', type: 'afternoon', loc: LOC_RIVERSIDE, locName: 'Riverside' },
    { id: 'sce-c-07', date: '2026-06-05', start: '07:00', end: '15:00', type: 'morning',   loc: LOC_MAIN,      locName: 'Main Street' },
  ];
  for (const s of samShifts) await writeDraftShift({ ...s, emp: KNOWN.sam });
  console.log(`  Sam week total: ${samShifts.length * 8}h`);

  // Taylor Torres: 3 shifts × 8h = 24h → safe
  const taylorShifts = [
    { id: 'sce-c-08', date: '2026-06-02', start: '13:00', end: '21:00', type: 'afternoon', loc: LOC_RIVERSIDE, locName: 'Riverside' },
    { id: 'sce-c-09', date: '2026-06-04', start: '13:00', end: '21:00', type: 'afternoon', loc: LOC_RIVERSIDE, locName: 'Riverside' },
    { id: 'sce-c-10', date: '2026-06-06', start: '13:00', end: '21:00', type: 'afternoon', loc: LOC_RIVERSIDE, locName: 'Riverside' },
  ];
  for (const s of taylorShifts) await writeDraftShift({ ...s, emp: KNOWN.taylor });
  console.log(`  Taylor week total: ${taylorShifts.length * 8}h`);

  // The unfillable Sunday slot
  await writeShiftNeeded({
    id: 'sce-c-sn-01', date: '2026-06-08', start: '05:00', end: '13:00',
    count: 2, loc: LOC_MAIN, locName: 'Main Street',
    note: 'unfillable — nobody has Sun availability before 06:00',
  });
  await writeShiftNeeded({
    id: 'sce-c-sn-02', date: '2026-06-08', start: '13:00', end: '21:00',
    count: 1, loc: LOC_RIVERSIDE, locName: 'Riverside',
    note: 'Sunday afternoon — limited coverage (Indigo has Sun afternoons)',
  });
}

// ── Summary ───────────────────────────────────────────────────────────────────

function printSummary(phoenix, sage) {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Scenarios seeded for week of Jun 1–8 2026');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('  A) Sat Jun 7 04:30-10:00  [1 unfilled]');
  console.log(`     Phoenix (${phoenix.id.slice(0, 8)}…): 36h → would hit 41.5h`);
  console.log('     Only available person — manager must choose: assign OT or leave unfilled.');
  console.log('');
  console.log('  B) Sat Jun 7 21:00-23:30  [1 unfilled]');
  console.log(`     Sage (${sage.id.slice(0, 8)}…): 37.5h → would hit 40h`);
  console.log('     Only closer available — Friday shift was fine (37.5h < 39h).');
  console.log('');
  console.log('  C) Sun Jun 8 05:00-13:00  [2 unfilled]');
  console.log('     No employee has Sunday availability before 06:00.');
  console.log('     Parker: 32h, Sam: 24h, Taylor: 24h visible in candidates tab.');
  console.log('');
  console.log('  How to demo:');
  console.log('  1. Log in as morgan.manager@sunsetcafe.dev');
  console.log('  2. Schedule → June 2026');
  console.log('  3. Sat Jun 7 shows two Unfilled chips (dawn + closing)');
  console.log('  4. Sun Jun 8 shows two Unfilled chips (nobody slot)');
  console.log('  5. Click any chip → Fill Shift tab opens');
  console.log('  6. ← Back to Schedule button always visible at top');
  console.log('  7. For Sat dawn: Phoenix is the only "Available" row, 36h + ⚠ OT');
  console.log('  8. For Sat close: Sage is the only "Available" row, 37.5h + ⚠ OT');
  console.log('  9. Availability tab shows the full weekly grid for all 30 employees');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\nLooking up edge-case employee subs via Cognito...');
  const phoenixId = await subByEmail('phoenix.ford@sunsetcafe.dev');
  const sageId    = await subByEmail('sage.shaw@sunsetcafe.dev');
  const phoenix   = { id: phoenixId, name: 'Phoenix Ford' };
  const sage      = { id: sageId,    name: 'Sage Shaw' };
  console.log(`  Phoenix Ford → ${phoenixId}`);
  console.log(`  Sage Shaw    → ${sageId}`);

  console.log('\nSeeding scenarios...');
  await scenarioSoleOpener(phoenix);
  await scenarioLateNightSqueeze(sage);
  await scenarioNobodySlot();

  printSummary(phoenix, sage);
  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
