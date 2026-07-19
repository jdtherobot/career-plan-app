/* Sources: every reference record with a citation, in one place. */

import { useMemo, useState } from "react";
import { useAppState } from "../state/store";

export function Sources() {
  const { bootstrap } = useAppState();
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    if (!bootstrap) return [];
    const domains: Record<string, any[]> = bootstrap.referenceDomains;
    return Object.entries(domains)
      .map(([domain, rows]) => ({
        domain,
        rows: (rows as any[]).filter((row) => row.sourceLabel || row.sourceUrl),
      }))
      .filter((g) => g.rows.length > 0)
      .sort((a, b) => a.domain.localeCompare(b.domain));
  }, [bootstrap]);

  if (!bootstrap) {
    return (
      <header className="screen-head">
        <h2>Sources</h2>
        <p>Loading…</p>
      </header>
    );
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? groups
        .map((g) => ({
          ...g,
          rows: g.rows.filter(
            (row) =>
              (row.label ?? "").toLowerCase().includes(q) ||
              (row.sourceLabel ?? "").toLowerCase().includes(q) ||
              g.domain.includes(q),
          ),
        }))
        .filter((g) => g.rows.length > 0)
    : groups;

  return (
    <>
      <header className="screen-head">
        <h2>Sources</h2>
        <p>Where every reference number comes from. Overridden values keep their original citation.</p>
      </header>

      <input
        type="text"
        placeholder="Search sources — e.g. BAH, DFAS, Stanford"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ maxWidth: 420, marginBottom: 16 }}
        aria-label="Search sources"
      />

      {filtered.map((group) => (
        <section key={group.domain} style={{ marginBottom: 18 }}>
          <p className="section-h">{group.domain.replace(/_/g, " ")}</p>
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: "34%" }}>Record</th>
                  <th style={{ width: "40%", textAlign: "left" }}>Source</th>
                  <th style={{ textAlign: "left" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ fontFamily: "var(--font-ui)", textAlign: "left" }}>{row.label ?? row.id}</td>
                    <td style={{ fontFamily: "var(--font-ui)", textAlign: "left" }}>
                      {row.sourceUrl ? (
                        <a href={row.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                          {row.sourceLabel || row.sourceUrl}
                        </a>
                      ) : (
                        row.sourceLabel || "—"
                      )}
                    </td>
                    <td style={{ fontFamily: "var(--font-ui)", textAlign: "left", color: "var(--ink-3)", fontSize: 12 }}>
                      {row.verificationStatus ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
