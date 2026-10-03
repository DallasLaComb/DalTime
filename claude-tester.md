# DalTime — E2E RE-TEST (prompt for the Claude app)

Paste everything below the line into a Claude session that can drive a browser.
This is a **second pass**: four bugs from the first pass were fixed, and several checks were blocked or
skipped for lack of test data. Re-test the fixes, smoke-check what they touched, and unblock the rest.

---

You are the E2E tester for **DalTime**, a shift-scheduling app (Angular + AWS API + Cognito). Test in a
real browser, as a user. **Don't read or edit source code.** Report what you see.

## Before you start

The person running this has restarted the backend (`npm start` in `backend/`, needed for fix #25) and is
signed in as the org admin at `http://localhost:4200` (API `:47200`). If you land on a login page, ask
for the org-admin login; never guess credentials. If anything below returns errors that look like
"server not ready", say so and stop — don't mark checks failed.

- **Shared DEV database.** Everything you do is real. Prefix anything you create with **"QA "**.
- **Reuse before creating.** The last pass left QA people that can't be deleted in the UI (QA Mona
  [manager], QA Phil, QA Dup, QA Eve, QA Nophone, QA Gus [employees] — all *disabled*). Create a new
  QA person only when a check needs one, and keep it to the minimum.
- **Don't touch** existing dev data: the Oct 2 open shift at Platt owned by the admin account; the
  manager "Manager-Firstname Manager-Lastname" (its phone is now `(555) 010-0199`).
- Never disable/delete the org-admin account you're signed in with. Clean up shifts, shift needs,
  templates and locations you create (those can be deleted in the UI).
- Keep going after a failure; note it. Test **desktop (~1280px)** and **phone (375px)** as marked.

## Role model

- **Org Admin** (`/org-admin/*`): oversight; the Schedule is **read-only**.
- **Manager view** (`/manager/*`): scheduling. An org admin gets there via **View as Manager** (top bar;
  **← Admin / ← Org Admin view** returns). Per browser tab.
- Times are **12-hour AM/PM** everywhere (except the browser's own time-picker inputs).

## Set-up used by Part A (do this first, ~5 minutes)

In **Manager view → Shifts needed**, add a need: **Nov 10, 9:00 AM – 1:00 PM, Platt, 1 employee**
(use whichever month is current/next if November has passed; adjust the dates below). Also add a
second need the same day, **2:00 PM – 6:00 PM, 2 employees** (two employees needed → "2 positions").
Then **Schedule → that month → Generate Draft → confirm** (this may use a monthly run; that's fine).

---

## PART A — Re-test the 4 fixed bugs

### A1. (#24) Month view printed `1:NaNa`
| # | Do | Expect |
|---|----|--------|
| A1.1 | Manager view → Schedule → **Month** (1280px) → find the Nov 10 "Not Scheduled" chips | The chips read **`9a–1p`** and **`2p–6p`**. The text **"NaN" never appears** anywhere on the page. |
| A1.2 | Hover each chip | Tooltip: "Not yet scheduled · 9:00 AM – 1:00 PM · **1 position needed**" and "… · **2 positions needed**". Never **"position(s)"**. |
| A1.3 | Same Month view on **Org Admin → Schedule** (`/org-admin/schedule`) | Same chips (`9a–1p`, `2p–6p`) and the same tooltips — no NaN. |
| A1.4 | Add a need **10:00 PM – 6:00 AM** (overnight) and look at the chip | `10p–6a (+1)`. |

### A2. (#25) "Not yet scheduled" slots missing on the Org Admin Schedule
| # | Do | Expect |
|---|----|--------|
| A2.1 | `/org-admin/schedule`, Nov 10, **Month** | Red dashed chips for the slots (not empty). |
| A2.2 | **Week** and **Day** for Nov 10 | Day shows a **"Not Yet Scheduled"** card per slot: location, **manager name**, "**N employees needed**", and "+1 day" for the overnight one. Not clickable. |
| A2.3 | Day header and footer | "· N slots not yet scheduled" (header = that day; footer = what's on screen). |
| A2.4 | Create a second slot owned by **a different manager** if one exists (you can't act as another manager; if not possible, say SKIPPED) | Shown with that manager's name. |
| A2.5 | Open the browser console / network tab on this page | **No 500** from `/org-admin/shifts-needed`. |
| A2.6 | If the page ever shows **"Couldn't load the 'not yet scheduled' slots…"**, that means the server errored | Report it as a FAIL with the time, and whether a backend restart fixes it. |

### A3. (#26) Overnight shifts in the manager form
| # | Do | Expect |
|---|----|--------|
| A3.1 | Manager view → **Add Shift** → Location: Platt → start **10:00 PM**, end **6:00 AM** | Under the times: **"10:00 PM – 6:00 AM (+1)"** and "— overnight, ends the next day". Type shows **Night**. |
| A3.2 | Change to 9:00 AM – 5:00 PM | Preview becomes "9:00 AM – 5:00 PM" with **no** "(+1)". |
| A3.3 | Set end = start (e.g. both 9:00 AM) → **Save** | Error under End: "End time must be different from the start time." and no preview. |
| A3.4 | **Without saving**, change End to 5:00 PM | The error **disappears immediately**. |
| A3.5 | Fresh Add Shift form (don't touch anything) | **No** error messages before the first Save. |
| A3.6 | Save with Location unset, then pick a location | "Location is required." appears on Save and clears the moment you choose one. Other fields also update live after the first Save. |
| A3.7 | Save the overnight shift, then **click it** (Edit) | The form preselects location, shows the same preview. |
| A3.8 | Click the saved **open** overnight shift → Fill Shift tab | Header reads **"… 10:00 PM – 6:00 AM (+1)"**. |
| A3.9 | Hover the overnight chip | Tooltip includes **"10:00 PM – 6:00 AM (+1)"** (12-hour, no `22:00`). |

### A4. (#27) Day/Week footers counted the whole month
| # | Do | Expect |
|---|----|--------|
| A4.1 | Manager view → **Day** on a day with **no shifts and no slots** (e.g. Nov 2) | Footer: **"0 shifts in view"**. **No** "slots not yet scheduled" text. Header and card say nothing is scheduled. |
| A4.2 | **Week** for a week without the Nov 10 slots (e.g. Nov 1–7) | Footer shows **0 shifts in view** and no slot count. |
| A4.3 | **Week** for the week containing Nov 10 | Footer counts only that week's shifts and slots — matches the cards. |
| A4.4 | **Month** | Footer counts the whole month's shifts and slots ("N shifts in view · M slots not yet scheduled"). |
| A4.5 | Repeat A4.1–A4.4 on **Org Admin → Schedule** | Same behaviour. |
| A4.6 | Apply a filter (e.g. a location) | Footer adds "— filtered from N total"; counts still match what's visible. |

---

## PART B — Quick smoke of what those fixes touched (all should PASS)

| # | Check | Expect |
|---|-------|--------|
| B1 | Every time on every schedule screen (cards, chips, tooltips, Fill Shift header, confirmation texts) | 12-hour AM/PM only. |
| B2 | **Generate Draft** dialog with a manual open shift and **no** shifts needed | Intro says it fills "the **shifts needed** (the slots on the Shifts needed page)"; a note says N open shifts exist and "Generate Draft doesn't fill those — … use Fill Shift"; status says "There are no shifts needed to fill… **No run will be used**"; no "uses 1 of 10 runs" line. Confirming does **not** increase the run counter. |
| B3 | No visible "null", "NaN", "undefined" or raw UUIDs anywhere you go | None. |
| B4 | Console while doing Part A | No errors (409s from deliberately blocked deletes are fine). |

---

## PART C — Checks that were blocked/skipped last time (unblock them)

These need people who can **sign in**. In a **private/incognito window** (so you stay signed in as the
admin in the main window):

1. As admin, **register a QA employee** "QA Gina" (manager = the admin, so it's on the admin's schedule)
   with email `qa.gina+1@…` (use an address the person running this tells you), phone `(555) 123-4567`,
   and a **temporary password** you note down.
2. In the incognito window sign in as QA Gina with that temp password, **set a new password** when asked,
   then open **Availability** and mark her available **every day 6:00 AM – 11:00 PM**, max 1 shift/day.
3. Back as admin: **Manager view → Shifts needed**: add a need for a day next week, 9:00 AM – 1:00 PM, 1 employee.

| # | Do | Expect |
|---|----|--------|
| C1 (5.7) | **Generate Draft** for that month → confirm | "Run X/10: **1 shift assigned**." (singular). A draft shift for **QA Gina** appears. |
| C2 (5.9) | Disable QA Gina (admin → Employees), add a fresh need, Generate Draft again | She is **not** assigned; the result says no one was available / slot unfilled (a real number). Re-enable her afterward. |
| C3 (6.2) | With a draft present: **Publish Schedule** | Dialog: "This will publish **1 draft shift** on your schedule for *Month*… **1 employee** will see their shifts…" |
| C4 (6.3) | **Cancel** | Nothing publishes. |
| C5 (6.4) | **Publish** | "**1 shift published** — now visible to employees." The draft becomes published; Publish disables with "No draft shifts to publish in *Month*." |
| C6 (1.13) | In the incognito window as QA Gina: open **Profile**, edit phone | `555-0199` → "Phone must be 10 digits"; `(555) 987-6543` saves and displays formatted; clearing it saves. |
| C7 (3.4) | (Optional, needs a QA *manager* who has signed in and created a future shift) Admin → Managers → Disable that manager (no employees, has an upcoming shift) | Message about N upcoming shifts and a **"Disable anyway"** button; confirming disables. Mark SKIPPED if you can't set it up. |
| C8 (8.5) | Org Admin → Schedule → **CSV** and **PDF** (allow the downloads) | Times are AM/PM; an overnight shift's end shows "(+1 day)". |
| C9 (2.8) | Keyboard only on Employees/Managers: Tab to the **Show** filter, change it with the arrow keys | Works; clear focus ring. |
| C10 (4.6) | 375px, Overview "By manager", a manager with a long name | The name wraps (no cut-off "(…"); header not cramped. |
| C11 | Clean-up | Delete the shifts / needs you created; disable QA Gina at the end (list her as left behind). |

---

## PART D — Close the loop from the first report

1. The first report said **6 checks FAILED but described only 4**. **List the other two** (ID, steps,
   expected vs actual, what you saw). If you can't recall them, say so.
2. For each item in "Other observations" from the first report, say whether you still see it:
   raw digits in Org Admin → Employees phone **cards** at 375px; delete-shift confirmation titled
   "Edit Shift"; `?status=bogus` staying in the URL; the Shifts-needed delete dialog showing the date as
   `2026-11-10`; "Not yet scheduled" vs "Unfilled — no employee available" label for failed slots;
   Register Manager email placeholder reading "employee@example.com". (These were **not** fixed in this
   round; just confirm.)

---

## How to report

1. **Summary:** pass/fail counts per Part, and the top problems.
2. **Table** for every ID above: `ID | PASS / FAIL / BLOCKED / SKIPPED | what you saw`.
   **BLOCKED** = couldn't set up the precondition (say what was missing).
3. For each **FAIL**: exact steps, expected vs actual, URL, viewport width, the exact text shown, and
   the console/network error if any.
4. **Anything new or odd** not on this list.
5. **Clean-up:** every "QA …" record you created, and whether it's removed or left behind.

Be literal. If you didn't see it, mark it SKIPPED.
