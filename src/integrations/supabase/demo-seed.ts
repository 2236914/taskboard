// Portfolio-quality seed data for demo mode. Tells a coherent story:
// a freelance designer's week — work tag tree, real-looking tasks across
// statuses, time entries that show consistent work patterns, a couple of
// notes, and a few day notes.

const DEMO_USER_ID = "demo-user-0000-0000-0000-000000000000";

export const DEMO_USER = {
  id: DEMO_USER_ID,
  email: "demo@doska.app",
  user_metadata: {
    display_name: "Alex Rivera",
    username: "alexrivera",
  },
  app_metadata: {},
  aud: "authenticated",
  role: "authenticated",
  created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
  updated_at: new Date().toISOString(),
} as const;

export const DEMO_PROFILE = {
  id: DEMO_USER_ID,
  display_name: "Alex Rivera",
  username: "alexrivera",
  location_label: "Lisbon, Portugal",
  timezone: "Europe/Lisbon",
  // Demo user is an admin so the public demo can show off the Admin portal.
  is_admin: true,
  created_at: DEMO_USER.created_at,
  updated_at: new Date().toISOString(),
};

const now = Date.now();
const hours = (h: number) => h * 60 * 60 * 1000;
const days = (d: number) => d * hours(24);
const iso = (t: number) => new Date(t).toISOString();

// Stable IDs so realtime/edits work consistently within a session.
const tagId = (slug: string) => `demo-tag-${slug}`;
const taskId = (slug: string) => `demo-task-${slug}`;
const noteId = (slug: string) => `demo-note-${slug}`;
const entryId = (slug: string) => `demo-entry-${slug}`;

export const DEMO_TAGS = [
  // root tags
  {
    id: tagId("client-orbital"),
    user_id: DEMO_USER_ID,
    name: "Orbital (client)",
    color: "#5055A0",
    parent_id: null,
    daily_target_minutes: 240,
    created_at: iso(now - days(60)),
  },
  {
    id: tagId("client-fern"),
    user_id: DEMO_USER_ID,
    name: "Fern Studio (client)",
    color: "#3D6B3F",
    parent_id: null,
    daily_target_minutes: 120,
    created_at: iso(now - days(45)),
  },
  {
    id: tagId("personal"),
    user_id: DEMO_USER_ID,
    name: "Personal",
    color: "#A86A2C",
    parent_id: null,
    daily_target_minutes: null,
    created_at: iso(now - days(60)),
  },
  // sub-tags
  {
    id: tagId("orbital-design"),
    user_id: DEMO_USER_ID,
    name: "Design",
    color: "#5055A0",
    parent_id: tagId("client-orbital"),
    daily_target_minutes: null,
    created_at: iso(now - days(60)),
  },
  {
    id: tagId("orbital-meetings"),
    user_id: DEMO_USER_ID,
    name: "Meetings",
    color: "#7A5DA8",
    parent_id: tagId("client-orbital"),
    daily_target_minutes: null,
    created_at: iso(now - days(60)),
  },
  {
    id: tagId("fern-illustration"),
    user_id: DEMO_USER_ID,
    name: "Illustration",
    color: "#3D6B3F",
    parent_id: tagId("client-fern"),
    daily_target_minutes: null,
    created_at: iso(now - days(45)),
  },
  {
    id: tagId("urgent"),
    user_id: DEMO_USER_ID,
    name: "Urgent",
    color: "#A03030",
    parent_id: null,
    daily_target_minutes: null,
    created_at: iso(now - days(60)),
  },
];

const today = new Date();
const dayOf = (offsetDays: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays);
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getDay()];
};

export const DEMO_TASKS = [
  {
    id: taskId("logo-explore"),
    user_id: DEMO_USER_ID,
    name: "Explore 3 logo directions for Orbital",
    note: "Mood: optical, calm, structural. No gradient lockups this round.",
    day: dayOf(0),
    status: "in_progress",
    tag_id: tagId("orbital-design"),
    sort_order: 1000,
    pinned_at: iso(now - hours(2)),
    due_at: iso(now + days(2)),
    reminder_offset_minutes: 60,
    created_at: iso(now - days(3)),
    updated_at: iso(now - hours(1)),
  },
  {
    id: taskId("orbital-deck"),
    user_id: DEMO_USER_ID,
    name: "Polish kickoff deck — sections 4 & 5",
    note: "Need a single-spread case study for the wayfinding example.",
    day: dayOf(0),
    status: "todo",
    tag_id: tagId("orbital-design"),
    sort_order: 2000,
    pinned_at: null,
    due_at: iso(now + days(1)),
    reminder_offset_minutes: null,
    created_at: iso(now - days(2)),
    updated_at: iso(now - days(1)),
  },
  {
    id: taskId("orbital-call"),
    user_id: DEMO_USER_ID,
    name: "Weekly check-in with Mira",
    note: "30-min call · agenda in shared doc.",
    day: dayOf(1),
    status: "todo",
    tag_id: tagId("orbital-meetings"),
    sort_order: 3000,
    pinned_at: null,
    due_at: iso(now + days(1) + hours(15)),
    reminder_offset_minutes: 15,
    created_at: iso(now - days(5)),
    updated_at: iso(now - days(5)),
  },
  {
    id: taskId("fern-sketches"),
    user_id: DEMO_USER_ID,
    name: "Send first illustration sketches to Fern",
    note: null,
    day: dayOf(0),
    status: "done",
    tag_id: tagId("fern-illustration"),
    sort_order: 4000,
    pinned_at: null,
    due_at: iso(now - hours(4)),
    reminder_offset_minutes: null,
    created_at: iso(now - days(4)),
    updated_at: iso(now - hours(3)),
  },
  {
    id: taskId("fern-color"),
    user_id: DEMO_USER_ID,
    name: "Pick palette for Fern editorial",
    note: "Two options ready — wait on Mira's feedback before continuing.",
    day: dayOf(2),
    status: "todo",
    tag_id: tagId("fern-illustration"),
    sort_order: 5000,
    pinned_at: null,
    due_at: null,
    reminder_offset_minutes: null,
    created_at: iso(now - days(1)),
    updated_at: iso(now - days(1)),
  },
  {
    id: taskId("invoice"),
    user_id: DEMO_USER_ID,
    name: "Send April invoice to Orbital",
    note: "Last month: 42h design + 6h meetings.",
    day: dayOf(-1),
    status: "done",
    tag_id: tagId("client-orbital"),
    sort_order: 6000,
    pinned_at: null,
    due_at: iso(now - days(1)),
    reminder_offset_minutes: null,
    created_at: iso(now - days(7)),
    updated_at: iso(now - days(1)),
  },
  {
    id: taskId("portfolio"),
    user_id: DEMO_USER_ID,
    name: "Refresh portfolio case studies",
    note: "Add Orbital wayfinding once it goes public.",
    day: dayOf(3),
    status: "todo",
    tag_id: tagId("personal"),
    sort_order: 7000,
    pinned_at: null,
    due_at: null,
    reminder_offset_minutes: null,
    created_at: iso(now - days(10)),
    updated_at: iso(now - days(2)),
  },
  {
    id: taskId("fix-router-typo"),
    user_id: DEMO_USER_ID,
    name: "Fix typo in mobile nav",
    note: null,
    day: dayOf(-1),
    status: "done",
    tag_id: tagId("personal"),
    sort_order: 8000,
    pinned_at: null,
    due_at: null,
    reminder_offset_minutes: null,
    created_at: iso(now - days(2)),
    updated_at: iso(now - days(1)),
  },
];

export const DEMO_NOTES = [
  {
    id: noteId("orbital-brief"),
    user_id: DEMO_USER_ID,
    title: "Orbital — Brand Brief Notes",
    content:
      "Audience: ops teams at logistics startups (Series A–B).\nTone: calm, structural, technically literate. No exclamation marks anywhere.\n\nWords we like: orbit, signal, lattice, register.\nWords we won't use: synergy, disrupt, revolutionary.\n\nReference brands:\n  • Linear (clarity of voice)\n  • Stripe Press (typographic restraint)\n  • Werkplaats Typografie (looseness in editorial work)\n\nNext step — three logo directions:\n  1. Optical (Bauer-grotesk inspired)\n  2. Lockup with custom counters\n  3. Symbol-only mark, sits comfortably as favicon at 16px",
    tag_id: tagId("client-orbital"),
    pinned_at: iso(now - days(1)),
    is_public: true,
    public_slug: "orbital-brief",
    created_at: iso(now - days(8)),
    updated_at: iso(now - hours(6)),
  },
  {
    id: noteId("week-plan"),
    user_id: DEMO_USER_ID,
    title: "Week Plan",
    content:
      "Mon — Orbital exploration day. Block 9–13, no meetings.\nTue — Mira call 15:00. Send recap email by EOD.\nWed — Fern illustrations + palette decisions.\nThu — Buffer day. Catch-up + admin.\nFri — Polish + ship deck v2.",
    tag_id: tagId("personal"),
    pinned_at: null,
    is_public: false,
    public_slug: null,
    created_at: iso(now - days(2)),
    updated_at: iso(now - hours(20)),
  },
  {
    id: noteId("books"),
    user_id: DEMO_USER_ID,
    title: "Books to read",
    content:
      "  • Designing Programmes — Karl Gerstner\n  • Detail in Typography — Jost Hochuli\n  • The Visual Display of Quantitative Information — Edward Tufte",
    tag_id: tagId("personal"),
    pinned_at: null,
    is_public: false,
    public_slug: null,
    created_at: iso(now - days(15)),
    updated_at: iso(now - days(15)),
  },
];

export const DEMO_DAY_NOTES = [
  {
    id: "demo-daynote-today",
    user_id: DEMO_USER_ID,
    day_key: today.toISOString().slice(0, 10),
    content:
      "Energy: medium. Focus block 9–11 for logo exploration. No meetings until Mira at 15:00.",
    updated_at: iso(now - hours(2)),
  },
];

// A handful of time entries from the past week — gives reports something to show.
export const DEMO_TIME_ENTRIES = [
  // today, just finished
  {
    id: entryId("today-orbital"),
    user_id: DEMO_USER_ID,
    task_id: taskId("logo-explore"),
    tag_id: tagId("orbital-design"),
    started_at: iso(now - hours(2)),
    ended_at: iso(now - hours(1) - 15 * 60 * 1000),
    note: "Optical direction — sketches in Figma.",
    created_at: iso(now - hours(2)),
    updated_at: iso(now - hours(1)),
  },
  // yesterday
  {
    id: entryId("y-orbital-deck"),
    user_id: DEMO_USER_ID,
    task_id: taskId("orbital-deck"),
    tag_id: tagId("orbital-design"),
    started_at: iso(now - days(1) - hours(6)),
    ended_at: iso(now - days(1) - hours(3)),
    note: "Wireframe pass on sections 4 & 5.",
    created_at: iso(now - days(1) - hours(6)),
    updated_at: iso(now - days(1) - hours(3)),
  },
  {
    id: entryId("y-fern"),
    user_id: DEMO_USER_ID,
    task_id: taskId("fern-sketches"),
    tag_id: tagId("fern-illustration"),
    started_at: iso(now - days(1) - hours(2)),
    ended_at: iso(now - days(1) - hours(1)),
    note: null,
    created_at: iso(now - days(1) - hours(2)),
    updated_at: iso(now - days(1) - hours(1)),
  },
  // 2 days ago
  {
    id: entryId("d2-orbital"),
    user_id: DEMO_USER_ID,
    task_id: null,
    tag_id: tagId("orbital-meetings"),
    started_at: iso(now - days(2) - hours(5)),
    ended_at: iso(now - days(2) - hours(4) - 30 * 60 * 1000),
    note: "Standup with Orbital eng team.",
    created_at: iso(now - days(2) - hours(5)),
    updated_at: iso(now - days(2) - hours(4)),
  },
  {
    id: entryId("d2-fern"),
    user_id: DEMO_USER_ID,
    task_id: null,
    tag_id: tagId("fern-illustration"),
    started_at: iso(now - days(2) - hours(3)),
    ended_at: iso(now - days(2) - hours(1)),
    note: "Color study + reference gathering.",
    created_at: iso(now - days(2) - hours(3)),
    updated_at: iso(now - days(2) - hours(1)),
  },
  // 3 days ago
  {
    id: entryId("d3-orbital"),
    user_id: DEMO_USER_ID,
    task_id: null,
    tag_id: tagId("orbital-design"),
    started_at: iso(now - days(3) - hours(7)),
    ended_at: iso(now - days(3) - hours(3)),
    note: "Mood board + competitor pass.",
    created_at: iso(now - days(3) - hours(7)),
    updated_at: iso(now - days(3) - hours(3)),
  },
  // 5 days ago
  {
    id: entryId("d5-personal"),
    user_id: DEMO_USER_ID,
    task_id: null,
    tag_id: tagId("personal"),
    started_at: iso(now - days(5) - hours(3)),
    ended_at: iso(now - days(5) - hours(2)),
    note: "Portfolio writing session.",
    created_at: iso(now - days(5) - hours(3)),
    updated_at: iso(now - days(5) - hours(2)),
  },
];

// Empty initial attachment list — uploads from the demo session create blob URLs.
export const DEMO_ATTACHMENTS: Array<Record<string, unknown>> = [];

// A second seeded "user" so the admin inbox shows submissions from more
// than just the logged-in demo account. These extra rows live only in the
// in-memory tables; they don't have auth.users entries.
const FAKE_USER_ID = "demo-user-1111-1111-1111-111111111111";
const FAKE_USER_2_ID = "demo-user-2222-2222-2222-222222222222";

export const DEMO_EXTRA_PROFILES = [
  {
    id: FAKE_USER_ID,
    display_name: "Jordan Lee",
    username: "jordan",
    location_label: null,
    is_admin: false,
    created_at: iso(now - days(40)),
    updated_at: iso(now - days(40)),
  },
  {
    id: FAKE_USER_2_ID,
    display_name: "Sam Chen",
    username: "samc",
    location_label: null,
    is_admin: false,
    created_at: iso(now - days(20)),
    updated_at: iso(now - days(20)),
  },
];

export const DEMO_FEEDBACK = [
  {
    id: "demo-fb-1",
    user_id: DEMO_USER_ID,
    type: "feature",
    subject: "Add keyboard shortcut for archiving",
    message:
      "Would love a single-key shortcut (e.g. 'a') to archive a task without opening the menu. The mouse trip slows down end-of-day cleanup.",
    image_paths: [],
    status: "seen",
    created_at: iso(now - days(4)),
    updated_at: iso(now - days(3)),
  },
  {
    id: "demo-fb-2",
    user_id: DEMO_USER_ID,
    type: "praise",
    subject: "Print report layout is great",
    message:
      "The new report layout looks really clean when exported to PDF. The donut + tag bars combo is exactly what I needed for client invoices.",
    image_paths: [],
    status: "responded",
    created_at: iso(now - days(2)),
    updated_at: iso(now - days(1)),
  },
  {
    id: "demo-fb-3",
    user_id: FAKE_USER_ID,
    type: "bug",
    subject: "Calendar popover clips at the bottom on mobile",
    message:
      "On iPhone safari, the calendar popover in the task modal clips behind the keyboard. Hard to tap dates near the bottom rows.",
    image_paths: [],
    status: "new",
    created_at: iso(now - hours(9)),
    updated_at: iso(now - hours(9)),
  },
  {
    id: "demo-fb-4",
    user_id: FAKE_USER_2_ID,
    type: "feature",
    subject: "Recurring tasks?",
    message:
      "Any plans for recurring tasks (daily / weekly)? I have standups every weekday at 10:30 and re-creating the card each Monday is a chore.",
    image_paths: [],
    status: "new",
    created_at: iso(now - hours(36)),
    updated_at: iso(now - hours(36)),
  },
];

// AI suggestions for the "Suggest tasks" button in demo mode.
export const DEMO_AI_SUGGESTIONS = [
  {
    name: "Schedule Orbital usability test for week 3",
    note: "5 participants, 30 min each, Maze + Loom.",
  },
  {
    name: "Email Mira the kickoff deck v2 by Friday",
    note: null,
  },
  {
    name: "Draft README update for the wayfinding component",
    note: "Cover usage, props table, and a11y notes.",
  },
  {
    name: "Audit invoices for unpaid items > 30 days",
    note: null,
  },
];
