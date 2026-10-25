"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { normalizeName } from "@/lib/taxonomy";

type Category = { id: string; label: string; freshDaysTypical: number; openedDaysTypical: number };

type InvRow = {
  id: string;
  name: string;
  categoryId: string;
  quantity: number;
  unit: string;
  urgencyScore: number;
  frozen: boolean;
  shelfDaysOverride: number | null;
  openedAt: string | null;
  expiresOn: string | null;
  source: string;
};

type Meal = {
  rank: number;
  title: string;
  minutes: number;
  energy: number;
  score: number;
  spoilage_value: number;
  rationale: string;
  steps: string[];
  optional_adds: string[];
  ingredients_used: { inventory_item_id: string; qty: number; name: string }[];
};

type Session = {
  userId: string;
  profile: {
    vegetarianMode: string;
    defaultMinutes: number;
    defaultEnergy: number;
    stapleItemsJson: string;
    timezone: string;
    retentionDays: number;
  } | null;
  notificationPref: {
    digestEnabled: boolean;
    digestHourLocal: number;
    digestSnoozeUntil: string | null;
  } | null;
  inventory: InvRow[];
  suggestionHistory: { id: string; createdAt: string; constraints: unknown; mealCount: number }[];
  categories: Category[];
};

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || res.statusText);
  }
  return res.json() as Promise<T>;
}

export function SpoilPlannerApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualQty, setManualQty] = useState("1");
  const [manualCat, setManualCat] = useState("");
  const [ingestId, setIngestId] = useState<string | null>(null);
  const [ingestReview, setIngestReview] = useState<
    { name: string; categoryId: string; quantity: number; unit: string }[]
  >([]);
  const [tonight, setTonight] = useState<{ suggestionId: string; meals: Meal[] } | null>(null);
  const [digestPreview, setDigestPreview] = useState<unknown>(null);

  const catLabel = useMemo(() => {
    const m = new Map<string, string>();
    session?.categories.forEach((c) => m.set(c.id, c.label));
    return m;
  }, [session]);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/session", { credentials: "include" });
    const data = await j<Session>(res);
    setSession(data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (session?.categories?.length && !manualCat) {
      setManualCat(session.categories[0].id);
    }
  }, [session, manualCat]);

  const saveProfile = async () => {
    if (!session?.profile) return;
    setBusy(true);
    setError(null);
    try {
      const staplesRaw = (document.getElementById("staples-input") as HTMLTextAreaElement)?.value ?? "";
      const staples = staplesRaw
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vegetarianMode: (document.getElementById("veg-mode") as HTMLSelectElement).value,
          defaultMinutes: parseInt((document.getElementById("def-min") as HTMLInputElement).value, 10),
          defaultEnergy: parseInt((document.getElementById("def-energy") as HTMLSelectElement).value, 10),
          timezone: (document.getElementById("tz") as HTMLInputElement).value,
          retentionDays: parseInt((document.getElementById("retention") as HTMLInputElement).value, 10),
          stapleItems: staples,
          digestEnabled: (document.getElementById("digest-on") as HTMLInputElement).checked,
          digestHourLocal: parseInt((document.getElementById("digest-hour") as HTMLInputElement).value, 10),
          digestSnoozeUntil: (() => {
            const v = (document.getElementById("digest-snooze") as HTMLInputElement).value;
            return v ? new Date(v).toISOString() : null;
          })(),
        }),
      });
      await j(res);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
    } finally {
      setBusy(false);
    }
  };

  const addManual = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: manualName,
          quantity: parseFloat(manualQty) || 1,
          categoryId: manualCat || undefined,
        }),
      });
      await j(res);
      setManualName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "add failed");
    } finally {
      setBusy(false);
    }
  };

  const patchItem = async (id: string, patch: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/inventory/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      await j(res);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "update failed");
    } finally {
      setBusy(false);
    }
  };

  const deleteItem = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/inventory/${id}`, { method: "DELETE", credentials: "include" });
      await j(res);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete failed");
    } finally {
      setBusy(false);
    }
  };

  const uploadIngest = async (file: File, type: "fridge" | "receipt") => {
    setBusy(true);
    setError(null);
    setIngestId(null);
    setIngestReview([]);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("type", type);
      const res = await fetch("/api/ingest", { method: "POST", body: fd, credentials: "include" });
      const out = await j<{ id: string }>(res);
      setIngestId(out.id);
      const pr = await fetch(`/api/ingest/${out.id}/process`, { method: "POST", credentials: "include" });
      await j(pr);
      const gr = await fetch(`/api/ingest/${out.id}`, { credentials: "include" });
      const run = await j<{ modelOutput: { kind?: string; items?: { name: string; estimated_category_id: string; confidence: number }[]; lines?: { name: string; quantity: number; unit: string; estimated_category_id: string }[] } }>(gr);
      const mo = run.modelOutput;
      if (mo.kind === "fridge" && mo.items) {
        setIngestReview(
          mo.items.map((i) => ({
            name: i.name,
            categoryId: i.estimated_category_id,
            quantity: 1,
            unit: "each",
          })),
        );
      } else if (mo.kind === "receipt" && mo.lines) {
        setIngestReview(
          mo.lines.map((l) => ({
            name: l.name,
            categoryId: l.estimated_category_id,
            quantity: l.quantity,
            unit: l.unit || "each",
          })),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload failed");
    } finally {
      setBusy(false);
    }
  };

  const commitIngest = async () => {
    if (!ingestId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/ingest/${ingestId}/commit`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: ingestReview }),
      });
      await j(res);
      setIngestId(null);
      setIngestReview([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "commit failed");
    } finally {
      setBusy(false);
    }
  };

  const runTonight = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tonight", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxMinutes: session?.profile?.defaultMinutes,
          energy: session?.profile?.defaultEnergy,
          vegetarianMode: session?.profile?.vegetarianMode,
        }),
      });
      const out = await j<{ suggestionId: string; meals: Meal[] }>(res);
      setTonight(out);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "tonight failed");
    } finally {
      setBusy(false);
    }
  };

  const cookMeal = async (mealRank: number) => {
    if (!tonight?.suggestionId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/cook", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId: tonight.suggestionId, mealRank }),
      });
      await j(res);
      setTonight(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "cook failed");
    } finally {
      setBusy(false);
    }
  };

  const loadSuggestion = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/suggestions/${id}`, { credentials: "include" });
      const out = await j<{ id: string; payload: { meals: Meal[] } }>(res);
      setTonight({ suggestionId: out.id, meals: out.payload.meals ?? [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed");
    } finally {
      setBusy(false);
    }
  };

  const previewDigest = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/digest/preview", { credentials: "include" });
      const out = await j<{ digest: unknown }>(res);
      setDigestPreview(out.digest);
    } catch (e) {
      setError(e instanceof Error ? e.message : "digest preview failed");
    } finally {
      setBusy(false);
    }
  };

  const runPurge = async () => {
    setBusy(true);
    try {
      await j(await fetch("/api/purge", { method: "POST", credentials: "include" }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "purge failed");
    } finally {
      setBusy(false);
    }
  };

  if (!session) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-zinc-500">
        Loading your pantry…
      </div>
    );
  }

  const p = session.profile;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Use-it-before-it-spoils</h1>
        <p className="text-sm text-zinc-600">
          Tonight-first vegetarian cook planner. Urgency scores are <strong>waste-reduction heuristics</strong>, not
          food-safety advice. When in doubt, follow package dates and your senses.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
        <h2 className="text-lg font-medium">Your settings</h2>
        {p && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Vegetarian mode
              <select id="veg-mode" className="mt-1 w-full rounded border border-zinc-300 px-2 py-1" defaultValue={p.vegetarianMode}>
                <option value="lacto_ovo">Lacto-ovo vegetarian</option>
                <option value="vegan">Vegan</option>
              </select>
            </label>
            <label className="text-sm">
              Default time budget (minutes)
              <input id="def-min" type="number" className="mt-1 w-full rounded border border-zinc-300 px-2 py-1" defaultValue={p.defaultMinutes} />
            </label>
            <label className="text-sm">
              Default energy (1 easy – 3 effort)
              <select id="def-energy" className="mt-1 w-full rounded border border-zinc-300 px-2 py-1" defaultValue={p.defaultEnergy}>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>
            <label className="text-sm">
              Timezone (IANA)
              <input id="tz" className="mt-1 w-full rounded border border-zinc-300 px-2 py-1" defaultValue={p.timezone} />
            </label>
            <label className="text-sm sm:col-span-2">
              Staples you always have (comma or newline)
              <textarea
                id="staples-input"
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 font-mono text-xs"
                rows={3}
                defaultValue={(() => {
                  try {
                    return (JSON.parse(p.stapleItemsJson) as string[]).join(", ");
                  } catch {
                    return "";
                  }
                })()}
              />
            </label>
            <label className="text-sm">
              Retention days for receipt/photo blobs
              <input id="retention" type="number" className="mt-1 w-full rounded border border-zinc-300 px-2 py-1" defaultValue={p.retentionDays} />
            </label>
            <div className="text-sm space-y-2">
              <label className="flex items-center gap-2">
                <input id="digest-on" type="checkbox" defaultChecked={session.notificationPref?.digestEnabled} />
                Daily digest (stored snapshot; wire email separately)
              </label>
              <label>
                Digest hour (local)
                <input id="digest-hour" type="number" min={0} max={23} className="mt-1 w-full rounded border border-zinc-300 px-2 py-1" defaultValue={session.notificationPref?.digestHourLocal ?? 17} />
              </label>
              <label className="sm:col-span-2">
                Snooze digests until (local datetime, optional)
                <input
                  id="digest-snooze"
                  type="datetime-local"
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1"
                  defaultValue={
                    session.notificationPref?.digestSnoozeUntil
                      ? new Date(session.notificationPref.digestSnoozeUntil).toISOString().slice(0, 16)
                      : ""
                  }
                />
              </label>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => void saveProfile()}
          disabled={busy}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          Save settings
        </button>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
        <h2 className="text-lg font-medium">Add inventory</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-[160px] flex-1 rounded border border-zinc-300 px-2 py-1"
            placeholder="e.g. baby spinach"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
          />
          <input
            className="w-20 rounded border border-zinc-300 px-2 py-1"
            value={manualQty}
            onChange={(e) => setManualQty(e.target.value)}
          />
          <select className="rounded border border-zinc-300 px-2 py-1" value={manualCat} onChange={(e) => setManualCat(e.target.value)}>
            {session.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <button type="button" disabled={busy} onClick={() => void addManual()} className="rounded-lg bg-zinc-900 px-3 py-1 text-sm text-white">
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <span className="font-medium">Fridge photo</span>
            <input type="file" accept="image/*" className="text-xs" onChange={(e) => e.target.files?.[0] && void uploadIngest(e.target.files[0], "fridge")} />
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <span className="font-medium">Receipt photo</span>
            <input type="file" accept="image/*" className="text-xs" onChange={(e) => e.target.files?.[0] && void uploadIngest(e.target.files[0], "receipt")} />
          </label>
        </div>
        {ingestReview.length > 0 && (
          <div className="space-y-2 rounded border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-900">Review extracted lines, then commit.</p>
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="py-1">Name</th>
                  <th>Category</th>
                  <th>Qty</th>
                  <th>Unit</th>
                </tr>
              </thead>
              <tbody>
                {ingestReview.map((row, idx) => (
                  <tr key={idx} className="border-t border-amber-100">
                    <td className="py-1 pr-2">
                      <input
                        className="w-full rounded border px-1"
                        value={row.name}
                        onChange={(e) => {
                          const next = [...ingestReview];
                          next[idx] = { ...row, name: e.target.value };
                          setIngestReview(next);
                        }}
                      />
                    </td>
                    <td>
                      <select
                        className="rounded border px-1"
                        value={row.categoryId}
                        onChange={(e) => {
                          const next = [...ingestReview];
                          next[idx] = { ...row, categoryId: e.target.value };
                          setIngestReview(next);
                        }}
                      >
                        {session.categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        className="w-16 rounded border px-1"
                        value={row.quantity}
                        onChange={(e) => {
                          const next = [...ingestReview];
                          next[idx] = { ...row, quantity: parseFloat(e.target.value) || 1 };
                          setIngestReview(next);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        className="w-20 rounded border px-1"
                        value={row.unit}
                        onChange={(e) => {
                          const next = [...ingestReview];
                          next[idx] = { ...row, unit: e.target.value };
                          setIngestReview(next);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const merged = new Map<string, { name: string; categoryId: string; quantity: number; unit: string }>();
                for (const row of ingestReview) {
                  const key = normalizeName(row.name);
                  const prev = merged.get(key);
                  if (prev) {
                    merged.set(key, {
                      ...row,
                      name: prev.name.length >= row.name.length ? prev.name : row.name,
                      quantity: prev.quantity + row.quantity,
                      unit: prev.unit === row.unit ? prev.unit : prev.unit,
                    });
                  } else {
                    merged.set(key, { ...row });
                  }
                }
                setIngestReview([...merged.values()]);
              }}
              className="rounded border border-zinc-400 px-3 py-1 text-sm"
            >
              Merge duplicate names
            </button>
            <button type="button" disabled={busy} onClick={() => void commitIngest()} className="rounded bg-emerald-700 px-3 py-1 text-sm text-white">
              Commit to pantry
            </button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Pantry (by urgency)</h2>
          <button type="button" disabled={busy} onClick={() => void runPurge()} className="text-xs text-zinc-600 underline">
            Purge old upload blobs
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-zinc-500">
                <th className="py-1">Item</th>
                <th>Category</th>
                <th>Urgency</th>
                <th>Qty</th>
                <th>Flags</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {session.inventory.map((it) => (
                <tr key={it.id} className="border-t border-zinc-100">
                  <td className="py-1 font-medium">{it.name}</td>
                  <td className="text-xs text-zinc-600">{catLabel.get(it.categoryId) ?? it.categoryId}</td>
                  <td>{it.urgencyScore.toFixed(1)}</td>
                  <td>
                    {it.quantity} {it.unit}
                  </td>
                  <td className="space-x-2 text-xs">
                    <label className="inline-flex items-center gap-1">
                      <input type="checkbox" checked={it.frozen} onChange={(e) => void patchItem(it.id, { frozen: e.target.checked })} />
                      frozen
                    </label>
                  </td>
                  <td className="space-x-1 text-right">
                    <button type="button" className="text-xs text-emerald-700 underline" onClick={() => void patchItem(it.id, { openedAt: new Date().toISOString() })}>
                      mark opened today
                    </button>
                    <button type="button" className="text-xs text-red-600 underline" onClick={() => void deleteItem(it.id)}>
                      remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {session.inventory.length === 0 && <p className="text-sm text-zinc-500">Nothing here yet — add a few items.</p>}
        </div>
        <p className="text-xs text-zinc-500">
          Override assumed shelf life (days): edit per row (advanced). Category defaults: see settings retention for how long raw uploads are kept.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {session.inventory.slice(0, 6).map((it) => (
            <div key={it.id + "-shelf"} className="flex items-center gap-2 text-xs">
              <span className="truncate">{it.name}</span>
              <input
                type="number"
                placeholder="days override"
                className="w-24 rounded border px-1"
                defaultValue={it.shelfDaysOverride ?? ""}
                onBlur={(e) => {
                  const v = e.target.value;
                  if (v === "") void patchItem(it.id, { shelfDaysOverride: null });
                  else void patchItem(it.id, { shelfDaysOverride: parseInt(v, 10) });
                }}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
        <h2 className="text-lg font-medium">Tonight</h2>
        <button
          type="button"
          disabled={busy}
          onClick={() => void runTonight()}
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
        >
          Rank meals for tonight
        </button>
        {tonight && tonight.meals.length > 0 && (
          <ul className="space-y-4">
            {tonight.meals.map((m) => (
              <li key={m.rank} className="rounded-lg border border-zinc-100 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      #{m.rank} {m.title}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {m.minutes} min · energy {m.energy} · score {m.score.toFixed(2)}
                    </p>
                    <p className="text-xs text-zinc-600">{m.rationale}</p>
                  </div>
                  <button type="button" disabled={busy} onClick={() => void cookMeal(m.rank)} className="rounded bg-emerald-700 px-3 py-1 text-xs text-white">
                    We cooked this
                  </button>
                </div>
                <p className="mt-2 text-xs font-medium text-zinc-700">Uses</p>
                <ul className="list-disc pl-5 text-xs text-zinc-600">
                  {m.ingredients_used.map((u) => (
                    <li key={u.inventory_item_id}>
                      {u.name} (−{u.qty})
                    </li>
                  ))}
                </ul>
                <ol className="mt-2 list-decimal pl-5 text-sm text-zinc-800">
                  {m.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                {m.optional_adds?.length ? (
                  <p className="mt-1 text-xs text-amber-800">Optional adds: {m.optional_adds.join(", ")}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {tonight && tonight.meals.length === 0 && <p className="text-sm text-zinc-500">No valid meals matched filters — tweak inventory or constraints.</p>}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-2">
        <h2 className="text-lg font-medium">Suggestion history</h2>
        <ul className="text-sm text-zinc-700 space-y-1">
          {session.suggestionHistory.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-2">
              <span>{new Date(h.createdAt).toLocaleString()}</span>
              <span className="text-zinc-400">({h.mealCount} meals)</span>
              <button type="button" className="text-emerald-700 underline text-xs" onClick={() => void loadSuggestion(h.id)}>
                Load
              </button>
            </li>
          ))}
        </ul>
        {session.suggestionHistory.length === 0 && <p className="text-xs text-zinc-500">No runs yet.</p>}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-2">
        <h2 className="text-lg font-medium">Digest preview</h2>
        <button type="button" disabled={busy} onClick={() => void previewDigest()} className="rounded border border-zinc-300 px-3 py-1 text-sm">
          Build preview now
        </button>
        {digestPreview && (
          <pre className="max-h-64 overflow-auto rounded bg-zinc-50 p-2 text-xs">{JSON.stringify(digestPreview, null, 2)}</pre>
        )}
        <p className="text-xs text-zinc-500">
          Schedule <code className="rounded bg-zinc-100 px-1">POST /api/cron/digest</code> with{" "}
          <code className="rounded bg-zinc-100 px-1">Authorization: Bearer $CRON_SECRET</code> when <code className="rounded bg-zinc-100 px-1">CRON_SECRET</code>{" "}
          is set.
        </p>
      </section>
    </div>
  );
}
