// In-memory Supabase client for demo mode.
//
// Intentionally minimal: only implements the subset of the supabase-js API
// surface that the app actually calls (mapped via grep). All data lives in
// module-level arrays seeded from demo-seed.ts; reload restores defaults.
//
// What's mocked:
//   - auth.getSession / onAuthStateChange / signIn* / signOut / signUp /
//     resetPasswordForEmail / updateUser / getClaims  (always "logged in
//     as DEMO_USER")
//   - from(table).select/insert/update/upsert/delete with eq/neq/gt/gte/
//     lt/lte/in/is/ilike/order/limit/filter/single/maybeSingle chains
//   - storage.from("attachments").upload / createSignedUrl / remove
//   - channel(...).on(...).subscribe()  → no-op (demo doesn't need cross-
//     tab realtime)
//   - functions.invoke("suggest-tasks", ...)  → canned suggestions

import {
  DEMO_USER,
  DEMO_PROFILE,
  DEMO_TAGS,
  DEMO_TASKS,
  DEMO_NOTES,
  DEMO_DAY_NOTES,
  DEMO_TIME_ENTRIES,
  DEMO_ATTACHMENTS,
  DEMO_AI_SUGGESTIONS,
} from "./demo-seed";

type Row = Record<string, unknown>;
type SortDir = { column: string; ascending: boolean };

// ---------- in-memory tables ----------

const tables: Record<string, Row[]> = {
  profiles: [DEMO_PROFILE as Row],
  tags: DEMO_TAGS.map((t) => ({ ...t })) as Row[],
  tasks: DEMO_TASKS.map((t) => ({ ...t })) as Row[],
  notes: DEMO_NOTES.map((n) => ({ ...n })) as Row[],
  day_notes: DEMO_DAY_NOTES.map((d) => ({ ...d })) as Row[],
  time_entries: DEMO_TIME_ENTRIES.map((e) => ({ ...e })) as Row[],
  attachments: DEMO_ATTACHMENTS.map((a) => ({ ...a })) as Row[],
};

// File blobs uploaded during the session — keyed by storage path.
const blobUrls = new Map<string, string>();

// ---------- helpers ----------

const newId = () =>
  "demo-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const now = () => new Date().toISOString();

type Filter =
  | {
      kind: "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
      col: string;
      val: unknown;
    }
  | { kind: "in"; col: string; vals: unknown[] }
  | { kind: "is"; col: string; val: unknown }
  | { kind: "ilike"; col: string; pattern: string }
  | { kind: "filter"; col: string; op: string; val: unknown };

function applyFilters(rows: Row[], filters: Filter[]): Row[] {
  return rows.filter((r) =>
    filters.every((f) => {
      const v = r[f.col];
      switch (f.kind) {
        case "eq":
          return v === f.val;
        case "neq":
          return v !== f.val;
        case "gt":
          return (v as number | string) > (f.val as number | string);
        case "gte":
          return (v as number | string) >= (f.val as number | string);
        case "lt":
          return (v as number | string) < (f.val as number | string);
        case "lte":
          return (v as number | string) <= (f.val as number | string);
        case "in":
          return f.vals.includes(v);
        case "is":
          return v === f.val;
        case "ilike": {
          if (typeof v !== "string") return false;
          // Convert SQL ILIKE pattern to a case-insensitive RegExp
          const re = new RegExp(
            "^" +
              f.pattern
                .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
                .replace(/%/g, ".*")
                .replace(/_/g, ".") +
              "$",
            "i",
          );
          return re.test(v);
        }
        case "filter":
          if (f.op === "eq") return v === f.val;
          if (f.op === "neq") return v !== f.val;
          return false;
      }
    }),
  );
}

// ---------- query builder ----------

class DemoQuery<T = Row> implements PromiseLike<{ data: T; error: null }> {
  private filters: Filter[] = [];
  private orderBy: SortDir[] = [];
  private _limit: number | null = null;
  private mode:
    | { kind: "select" }
    | { kind: "insert"; rows: Row[] }
    | { kind: "update"; patch: Row }
    | { kind: "upsert"; rows: Row[]; onConflict?: string }
    | { kind: "delete" } = { kind: "select" };
  private wantRows = true;
  private singleMode: "single" | "maybeSingle" | null = null;
  private returning: Row[] | null = null;

  constructor(private readonly table: string) {}

  // ---- chain methods ----
  select(_cols?: string) {
    // The cols argument is ignored — we always return whole rows.
    return this;
  }
  insert(rows: Row | Row[]) {
    this.mode = { kind: "insert", rows: Array.isArray(rows) ? rows : [rows] };
    return this;
  }
  update(patch: Row) {
    this.mode = { kind: "update", patch };
    return this;
  }
  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.mode = {
      kind: "upsert",
      rows: Array.isArray(rows) ? rows : [rows],
      onConflict: opts?.onConflict,
    };
    return this;
  }
  delete() {
    this.mode = { kind: "delete" };
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push({ kind: "eq", col, val });
    return this;
  }
  neq(col: string, val: unknown) {
    this.filters.push({ kind: "neq", col, val });
    return this;
  }
  gt(col: string, val: unknown) {
    this.filters.push({ kind: "gt", col, val });
    return this;
  }
  gte(col: string, val: unknown) {
    this.filters.push({ kind: "gte", col, val });
    return this;
  }
  lt(col: string, val: unknown) {
    this.filters.push({ kind: "lt", col, val });
    return this;
  }
  lte(col: string, val: unknown) {
    this.filters.push({ kind: "lte", col, val });
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push({ kind: "in", col, vals });
    return this;
  }
  is(col: string, val: unknown) {
    this.filters.push({ kind: "is", col, val });
    return this;
  }
  ilike(col: string, pattern: string) {
    this.filters.push({ kind: "ilike", col, pattern });
    return this;
  }
  filter(col: string, op: string, val: unknown) {
    this.filters.push({ kind: "filter", col, op, val });
    return this;
  }
  order(column: string, opts?: { ascending?: boolean }) {
    this.orderBy.push({ column, ascending: opts?.ascending !== false });
    return this;
  }
  limit(n: number) {
    this._limit = n;
    return this;
  }
  single() {
    this.singleMode = "single";
    return this;
  }
  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this;
  }

  // ---- thenable: triggers execution on await ----
  then<TR1 = unknown, TR2 = never>(
    onFulfilled?:
      | ((value: { data: T; error: null }) => TR1 | PromiseLike<TR1>)
      | null,
    onRejected?: ((reason: unknown) => TR2 | PromiseLike<TR2>) | null,
  ): PromiseLike<TR1 | TR2> {
    return Promise.resolve(this.execute()).then(onFulfilled, onRejected);
  }

  // ---- core execution ----
  private execute(): { data: T; error: null } {
    const t = tables[this.table];
    if (!t) {
      // Unknown table — surface as empty result so the app keeps working.
      return { data: (this.singleMode ? null : []) as T, error: null };
    }

    if (this.mode.kind === "insert") {
      const inserted = this.mode.rows.map((r) => {
        const row: Row = {
          id: typeof r.id === "string" ? r.id : newId(),
          created_at: now(),
          updated_at: now(),
          ...r,
        };
        t.push(row);
        return row;
      });
      this.returning = inserted;
      return this.shape(inserted) as { data: T; error: null };
    }

    if (this.mode.kind === "upsert") {
      const upserted: Row[] = [];
      const conflictCol = this.mode.onConflict ?? "id";
      for (const r of this.mode.rows) {
        const idx = t.findIndex((x) => x[conflictCol] === r[conflictCol]);
        if (idx >= 0) {
          t[idx] = { ...t[idx], ...r, updated_at: now() };
          upserted.push(t[idx]);
        } else {
          const row: Row = {
            id: typeof r.id === "string" ? r.id : newId(),
            created_at: now(),
            updated_at: now(),
            ...r,
          };
          t.push(row);
          upserted.push(row);
        }
      }
      this.returning = upserted;
      return this.shape(upserted) as { data: T; error: null };
    }

    let matched = applyFilters(t, this.filters);

    if (this.mode.kind === "update") {
      matched = matched.map((r) => {
        Object.assign(r, this.mode.kind === "update" ? this.mode.patch : {}, {
          updated_at: now(),
        });
        return r;
      });
      return this.shape(matched) as { data: T; error: null };
    }

    if (this.mode.kind === "delete") {
      const ids = new Set(matched.map((r) => r.id));
      tables[this.table] = t.filter((r) => !ids.has(r.id));
      return this.shape(matched) as { data: T; error: null };
    }

    // select
    let rows = matched.slice();
    if (this.orderBy.length) {
      rows.sort((a, b) => {
        for (const o of this.orderBy) {
          const av = a[o.column];
          const bv = b[o.column];
          if (av === bv) continue;
          if (av == null) return o.ascending ? -1 : 1;
          if (bv == null) return o.ascending ? 1 : -1;
          if (av < bv) return o.ascending ? -1 : 1;
          return o.ascending ? 1 : -1;
        }
        return 0;
      });
    }
    if (this._limit != null) rows = rows.slice(0, this._limit);
    return this.shape(rows) as { data: T; error: null };
  }

  private shape(rows: Row[]): { data: unknown; error: null } {
    if (this.singleMode === "single") {
      return { data: rows[0] ?? null, error: null };
    }
    if (this.singleMode === "maybeSingle") {
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  }
}

// ---------- auth ----------

type AuthCallback = (
  event: string,
  session: { user: typeof DEMO_USER } | null,
) => void;

const authListeners = new Set<AuthCallback>();
const fakeSession = {
  access_token: "demo-token",
  refresh_token: "demo-refresh",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: DEMO_USER,
};

const auth = {
  async getSession() {
    return { data: { session: fakeSession }, error: null };
  },
  async getClaims() {
    return {
      data: { claims: { sub: DEMO_USER.id, email: DEMO_USER.email } },
      error: null,
    };
  },
  onAuthStateChange(cb: AuthCallback) {
    authListeners.add(cb);
    // Fire once on subscribe so AuthProvider picks up the demo session.
    queueMicrotask(() => cb("INITIAL_SESSION", fakeSession));
    return {
      data: {
        subscription: {
          unsubscribe: () => authListeners.delete(cb),
        },
      },
    };
  },
  async signInWithPassword() {
    queueMicrotask(() => {
      authListeners.forEach((cb) => cb("SIGNED_IN", fakeSession));
    });
    return { data: { user: DEMO_USER, session: fakeSession }, error: null };
  },
  async signUp() {
    queueMicrotask(() => {
      authListeners.forEach((cb) => cb("SIGNED_IN", fakeSession));
    });
    return { data: { user: DEMO_USER, session: fakeSession }, error: null };
  },
  async signOut() {
    // Demo is always signed in — re-fire to keep the app stable.
    queueMicrotask(() => {
      authListeners.forEach((cb) => cb("SIGNED_IN", fakeSession));
    });
    return { error: null };
  },
  async resetPasswordForEmail() {
    return { data: {}, error: null };
  },
  async updateUser() {
    return { data: { user: DEMO_USER }, error: null };
  },
};

// ---------- storage ----------

const storage = {
  from(_bucket: string) {
    return {
      async upload(path: string, file: File | Blob) {
        const url = URL.createObjectURL(file);
        blobUrls.set(path, url);
        return { data: { path }, error: null };
      },
      async createSignedUrl(path: string, _expiresIn: number) {
        const url = blobUrls.get(path);
        if (!url) {
          return {
            data: null,
            error: { message: "Demo: no blob for path " + path },
          };
        }
        return { data: { signedUrl: url }, error: null };
      },
      async remove(paths: string[]) {
        for (const p of paths) {
          const url = blobUrls.get(p);
          if (url) URL.revokeObjectURL(url);
          blobUrls.delete(p);
        }
        return { data: {}, error: null };
      },
      async getPublicUrl(path: string) {
        return { data: { publicUrl: blobUrls.get(path) ?? "" } };
      },
    };
  },
};

// ---------- realtime (no-op) ----------

function channel() {
  const stub = {
    on: () => stub,
    subscribe: () => stub,
    unsubscribe: () => Promise.resolve(),
  };
  return stub;
}

// ---------- functions.invoke ----------

const functions = {
  async invoke(name: string) {
    if (name === "suggest-tasks") {
      // Tiny artificial delay so the UI can show its loading state.
      await new Promise((r) => setTimeout(r, 800));
      return { data: { tasks: DEMO_AI_SUGGESTIONS }, error: null };
    }
    return { data: null, error: { message: `Demo: ${name} unavailable` } };
  },
};

// ---------- exported client ----------

export function createDemoSupabaseClient() {
  return {
    auth,
    storage,
    functions,
    from: (table: string) => new DemoQuery(table),
    channel,
    removeChannel: () => Promise.resolve("ok"),
    rpc: async () => ({ data: null, error: null }),
  };
}
