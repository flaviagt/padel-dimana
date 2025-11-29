// frontend/pages/index.tsx
import { NextPage } from "next";
import { useState, useMemo } from "react";

type Slot = {
  date: string;       // "YYYY-MM-DD"
  venue: string;
  court: string;
  start: string;      // "HH:MM:SS" or "HH:MM"
  end?: string;
  price?: number | string;
};

type AiResponse = {
  result?: Array<{ court: string; venue: string; date: string; start: string; price?: number | string }>;
  error?: string;
};

const ALL_COURTS = [
  "Casablanca",
  "The Six Point Club",
  "BDG Padel Club",
  "Padel Co.",
  "Papadelulu",
  "Padel Up",
  "Court 45",
];

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

const timeOptions = Array.from({ length: 24 }).map((_, h) =>
  `${String(h).padStart(2, "0")}:00`
);

const Home: NextPage = () => {
  const today = new Date();
  const defaultEnd = new Date(Date.now() + 7 * 24 * 3600 * 1000);

  const [selectedCourts, setSelectedCourts] = useState<string[]>(
    ["Casablanca", "The Six Point Club", "BDG Padel Club", "Padel Co.", "Papadelulu", "Padel Up"]
  );
  const [startDate, setStartDate] = useState<string>(isoDate(today));
  const [endDate, setEndDate] = useState<string>(isoDate(defaultEnd));
  const [earliest, setEarliest] = useState<string>("00:00");
  const [latest, setLatest] = useState<string>("23:59");
  const [userPrompt, setUserPrompt] = useState<string>("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [aiResult, setAiResult] = useState<AiResponse["result"]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCourt = (c: string) => {
    setSelectedCourts((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  // grouped view memoized for render perf
  const grouped = useMemo(() => {
    const g: Record<string, Record<string, Record<string, Slot[]>>> = {};
    for (const s of slots) {
      const day = s.date;
      g[day] = g[day] || {};
      g[day][s.venue] = g[day][s.venue] || {};
      g[day][s.start] = g[day][s.start] || [];
      g[day][s.start].push(s);
    }
    // convert to sorted days array externally if needed
    return g;
  }, [slots]);

  const sortedDays = useMemo(() => Object.keys(grouped).sort((a, b) => new Date(a).getTime() - new Date(b).getTime()), [grouped]);

  async function checkAvailability() {
    setLoading(true);
    setError(null);
    setAiResult([]);
    setSlots([]);
    try {
      // Basic validation
      const sDate = new Date(startDate);
      const eDate = new Date(endDate);
      if (isNaN(sDate.getTime()) || isNaN(eDate.getTime())) {
        throw new Error("Invalid start or end date");
      }
      if (eDate < sDate) throw new Error("End date must be >= start date");
      const deltaDays = (eDate.getTime() - sDate.getTime()) / (1000 * 3600 * 24);
      if (deltaDays > 28) throw new Error("Date range cannot be longer than 28 days (serverless limit)");

      // Build query string
      const params = new URLSearchParams({
        locations: selectedCourts.join(","),
        start: startDate,
        end: endDate,
        earliest,
        latest,
      });

      const availabilityRes = await fetch(`/api/availability?${params.toString()}`);
      const availabilityJson = await availabilityRes.json();
      if (!availabilityRes.ok) {
        throw new Error(availabilityJson.error || "Failed to fetch availability");
      }
      const fetchedSlots: Slot[] = availabilityJson.slots || [];
      setSlots(fetchedSlots);

      if (userPrompt.trim() && fetchedSlots.length > 0) {
        // call AI endpoint
        const aiFetch = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: userPrompt, slots: fetchedSlots }),
        });
        const aiJson: AiResponse = await aiFetch.json();
        if (!aiFetch.ok) {
          throw new Error(aiJson.error || "AI backend error");
        }
        setAiResult(aiJson.result || []);
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: "24px auto", padding: "0 16px", fontFamily: "system-ui, Arial, sans-serif" }}>
      <h1 style={{ textAlign: "center" }}>PADEL DIMANA? 🎾</h1>
      <p style={{ textAlign: "center", marginTop: 0 }}>cari lapangan padel gak pake ribet! 🔍</p>

      <section>
        <h3>Select Court Locations</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {ALL_COURTS.map((c) => {
            const selected = selectedCourts.includes(c);
            return (
              <button
                key={c}
                onClick={() => toggleCourt(c)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: selected ? "2px solid #111" : "1px solid #ddd",
                  background: selected ? "#f6f6f6" : "#fff",
                  cursor: "pointer",
                }}
                aria-pressed={selected}
              >
                {c}
              </button>
            );
          })}
        </div>
      </section>

      <section style={{ marginTop: 18 }}>
        <h3>Select Your Preferences</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label>
            Start Date<br />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            End Date<br />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label>
            Earliest<br />
            <input type="time" value={earliest} onChange={(e) => setEarliest(e.target.value)} />
          </label>
          <label>
            Latest<br />
            <input type="time" value={latest} onChange={(e) => setLatest(e.target.value)} />
          </label>
        </div>
      </section>

      <section style={{ marginTop: 12 }}>
        <label>
          Ask AI's Recs (optional)<br />
          <input
            placeholder="e.g. cheapest, 2-hour block after 18:00"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
          />
        </label>
      </section>

      <div style={{ marginTop: 12 }}>
        <button onClick={checkAvailability} disabled={loading} style={{ padding: "10px 14px", borderRadius: 8 }}>
          {loading ? "Checking..." : "Check Availability"}
        </button>
      </div>

      {error && <div style={{ color: "crimson", marginTop: 12 }}>{error}</div>}

      {aiResult && aiResult.length > 0 && (
        <section style={{ marginTop: 20 }}>
          <h3>🤖 AI-Powered Recs</h3>
          {aiResult.map((r, i) => (
            <div key={i} style={{ padding: 10, border: "1px solid #eee", borderRadius: 8, marginBottom: 8 }}>
              <strong>{r.court} — {r.venue}</strong><br />
              {r.date} @ {r.start} — Rp{Number(r.price ?? 0).toLocaleString()}
            </div>
          ))}
        </section>
      )}

      <section style={{ marginTop: 20 }}>
        <h3>Here's All the Availability 👀</h3>
        {sortedDays.length === 0 && <div style={{ color: "#555" }}>No slots yet — run "Check Availability".</div>}
        {sortedDays.map((day) => (
          <div key={day} style={{ border: "1px solid #f0f0f0", padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <h4 style={{ margin: "6px 0" }}>{new Date(day).toLocaleDateString()}</h4>
            {Object.entries(grouped[day]).map(([venue, times]) => (
              <div key={venue} style={{ marginBottom: 10 }}>
                <strong>🏟️ {venue}</strong>
                <table style={{ width: "100%", marginTop: 8, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                      <th style={{ padding: "6px 8px" }}>Start</th>
                      <th style={{ padding: "6px 8px" }}>Price (Rp)</th>
                      <th style={{ padding: "6px 8px" }}>Courts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(times).sort().map((start) => {
                      // group by price
                      const priceGroups: Record<string, string[]> = {};
                      times[start].forEach((s) => {
                        const key = String(s.price ?? "0");
                        priceGroups[key] = priceGroups[key] || [];
                        priceGroups[key].push(s.court);
                      });

                      return Object.entries(priceGroups).map(([price, courts], idx) => (
                        <tr key={start + price + idx} style={{ borderTop: "1px solid #fafafa" }}>
                          <td style={{ padding: "8px" }}>{start.slice(0, 5)}</td>
                          <td style={{ padding: "8px" }}>{(Number(price) / 1000).toFixed(1).replace(/\.0$/, "")}</td>
                          <td style={{ padding: "8px" }}>{courts.sort().join(", ")}</td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ))}
      </section>

      <footer style={{ textAlign: "center", color: "#666", marginTop: 24 }}>
        Helped you find your padel spot? <a href="https://www.linkedin.com/in/flaviagabriella/">Let's connect!</a>
      </footer>
    </div>
  );
};

export default Home;
