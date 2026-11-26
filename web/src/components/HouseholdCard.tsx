/* Household members and the costs each one adds, for the years they apply.
   Optional: with nobody listed, the plan uses your own numbers and the
   service profile's dependents setting. Anyone marked as a dependent gives
   family health coverage; BAH / OHA / COLA use with-dependent rates only while
   a dependent also "lives with me". */

import { useAppState, useDispatch, fmtMoney } from "../state/store";
import { uid } from "./planHelpers";

const CATEGORIES = [
  ["insurance", "Insurance"],
  ["food", "Food"],
  ["housing", "Housing"],
  ["transportation", "Transportation"],
  ["healthcareOutOfPocket", "Health out-of-pocket"],
  ["personal", "Personal"],
  ["entertainment", "Entertainment"],
  ["miscellaneous", "Other"],
];

export function HouseholdCard() {
  const state = useAppState();
  const dispatch = useDispatch();
  const profile = state.profile;
  const members: any[] = profile?.household ?? [];
  const baseYear = profile?.baseYear ?? 2026;
  const set = (next: any[]) => dispatch({ type: "setProfile", profile: { ...profile, household: next } });
  const patch = (i: number, p: any) => set(members.map((m, j) => (j === i ? { ...m, ...p } : m)));
  const patchCost = (i: number, k: number, p: any) =>
    patch(i, { costs: (members[i].costs ?? []).map((c: any, j: number) => (j === k ? { ...c, ...p } : c)) });

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="row between">
        <div>
          <h3 style={{ margin: 0 }}>Household</h3>
          <p className="sub" style={{ margin: "2px 0 0" }}>
            Optional. Add someone and the costs they bring (insurance, food…) for the years they're with you. Each cost
            becomes its own line you can fine-tune year by year above.
          </p>
        </div>
        <button
          className="small"
          onClick={() =>
            set([
              ...members,
              { id: uid("m"), name: "Spouse", dependent: true, fromYear: baseYear + 1, toYear: null, costs: [{ id: uid("c"), label: "Insurance", category: "insurance", monthly: 150 }] },
            ])
          }
        >
          + Member
        </button>
      </div>
      {!members.length && <p className="notice" style={{ marginTop: 8 }}>No one added — the plan is for you alone.</p>}
      {members.length > 0 && (() => {
        const deps = members.filter((m) => m.dependent !== false);
        const first = deps.length ? Math.min(...deps.map((m) => Number(m.fromYear ?? baseYear))) : null;
        return (
          <p className="notice" style={{ marginTop: 8 }}>
            {first === null
              ? "No dependents: without-dependent BAH / OHA / COLA and individual health coverage."
              : first <= baseYear
                ? "Dependents from now: family health coverage; with-dependent BAH / OHA / COLA only for those who live with you."
                : `Single until ${first - 1} · family health coverage from ${first}${
                    deps.some((m) => m.livesWithYou) ? " and with-dependent BAH / OHA / COLA" : "; housing allowances stay single-rate unless a dependent “lives with me”"
                  }. Change the “from” year below.`}
          </p>
        );
      })()}
      {members.map((m, i) => {
        const monthly = (m.costs ?? []).reduce((s: number, c: any) => s + (Number(c.monthly) || 0), 0);
        return (
          <div className="member" key={m.id}>
            <div className="member-head">
              <input type="text" aria-label="Name or role" value={m.name} onChange={(e) => patch(i, { name: e.target.value })} />
              <span className="notice">from</span>
              <input type="number" aria-label="From year" value={m.fromYear ?? baseYear} onChange={(e) => patch(i, { fromYear: Number(e.target.value) })} />
              <span className="notice">to</span>
              <input
                type="number"
                aria-label="To year (blank = open-ended)"
                placeholder="—"
                value={m.toYear ?? ""}
                onChange={(e) => patch(i, { toYear: e.target.value === "" ? null : Number(e.target.value) })}
              />
              <label className="notice" style={{ display: "flex", gap: 5, alignItems: "center", whiteSpace: "nowrap" }}>
                <input type="checkbox" checked={m.dependent !== false} onChange={(e) => patch(i, { dependent: e.target.checked })} />
                dependent
              </label>
              {m.dependent !== false && (
                <label className="notice" style={{ display: "flex", gap: 5, alignItems: "center", whiteSpace: "nowrap" }} title="With-dependent BAH / OHA / COLA need the dependent living with you">
                  <input type="checkbox" checked={!!m.livesWithYou} onChange={(e) => patch(i, { livesWithYou: e.target.checked })} />
                  lives with me
                </label>
              )}
              <button className="small danger" aria-label={`Remove ${m.name}`} onClick={() => set(members.filter((_, j) => j !== i))}>✕</button>
            </div>
            {(m.costs ?? []).map((c: any, k: number) => (
              <div className="member-cost" key={c.id}>
                <input type="text" aria-label="Cost" value={c.label} onChange={(e) => patchCost(i, k, { label: e.target.value })} />
                <select aria-label="Category" value={c.category} onChange={(e) => patchCost(i, k, { category: e.target.value })}>
                  {CATEGORIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
                <input type="number" aria-label="Monthly amount" value={c.monthly} onChange={(e) => patchCost(i, k, { monthly: Number(e.target.value) })} />
                <span className="notice">/mo</span>
                <button
                  className="lock-btn"
                  aria-label={`Remove ${c.label}`}
                  onClick={() => patch(i, { costs: (m.costs ?? []).filter((_: any, j: number) => j !== k) })}
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="row" style={{ marginTop: 4 }}>
              <button
                className="small"
                onClick={() => patch(i, { costs: [...(m.costs ?? []), { id: uid("c"), label: "Food", category: "food", monthly: 300 }] })}
              >
                + Cost
              </button>
              <span className="notice">{fmtMoney(monthly)}/mo while in the household</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
