import { useState, useEffect, useRef, useCallback } from "react";

// ─── Config ──────────────────────────────────────────────
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";

const SEVERITY_CONFIG = {
  critical: { color: "#ff2d55", bg: "rgba(255,45,85,0.12)", label: "KRITIČNO", icon: "⚠" },
  high: { color: "#ff9500", bg: "rgba(255,149,0,0.12)", label: "VISOKO", icon: "🔶" },
  medium: { color: "#ffcc00", bg: "rgba(255,204,0,0.12)", label: "SREDNJE", icon: "🔸" },
  low: { color: "#30d158", bg: "rgba(48,209,88,0.12)", label: "NIZKO", icon: "✓" },
};

const TYPE_ICONS = {
  "Vlom": "🚪", "Vandalizem": "💥", "Požar": "🔥", "Tatvina": "🏴",
  "Sumljiva oseba": "👤", "Tehnična napaka": "⚙", "Napad": "⚔",
  "Nepooblaščen dostop": "🔒", "Drugo": "📋",
};

const SAMPLE_INCIDENTS = [
  "Ob 23:45 je varnostnik opazil neznanega moškega, ki je poskušal odpreti stranska vrata skladišča. Oseba je pobegnila, ko je zaslišala alarm. Na vratih so vidne poškodbe ključavnice.",
  "Kamera na parkirišču je ob 03:20 posnela dva posameznika, ki sta z grafiti posprejala fasado poslovnega objekta. Škoda je ocenjena na približno 2000 EUR.",
  "Požarni alarm se je sprožil v 3. nadstropju pisarniškega kompleksa. Vzrok je bil kratek stik v serverski sobi. Gasilci so bili obveščeni.",
  "Zaposleni je prijavil, da je iz garderobe izginila njegova denarnica med delovnim časom. Varnostne kamere pokrivajo hodnik, ne pa garderobe.",
  "Med nočno patroljo je varnostnik odkril odprto okno v pritličju banke. Notranjost ni bila motena, vendar je bil alarm onemogočen.",
];

// ─── Demo responses (fallback when no API key) ──────────
const DEMO_RESPONSES = [
  {
    severity: "high", type: "Vlom", summary: "Poskus vloma v skladišče s poškodbo ključavnice.",
    response: "Takoj obvestite policijo in zavarujte območje. Preglejte posnetke varnostnih kamer za identifikacijo osumljenca. Preverite, ali je bil karkoli odtujen.",
    risk_factors: ["Poškodba ključavnice", "Nočni čas", "Pobeg osumljenca"], priority_score: 78,
  },
  {
    severity: "medium", type: "Vandalizem", summary: "Grafitiranje fasade poslovnega objekta v nočnih urah.",
    response: "Dokumentirajte škodo s fotografijami in prijavite incident policiji. Posnetke kamer shranite kot dokazno gradivo. Organizirajte čiščenje fasade.",
    risk_factors: ["Materialna škoda", "Ponavljajoče se dejanje", "Nočno dogajanje"], priority_score: 52,
  },
  {
    severity: "critical", type: "Požar", summary: "Požarni alarm zaradi kratkega stika v serverski sobi.",
    response: "Evakuirajte nadstropje in preverite stanje serverske sobe. Gasilci so že obveščeni. Po sanaciji preverite vse električne inštalacije in server opremo za morebitno škodo.",
    risk_factors: ["Nevarnost požara", "Kritična infrastruktura", "Električna napaka"], priority_score: 91,
  },
  {
    severity: "medium", type: "Tatvina", summary: "Kraja denarnice iz garderobe med delovnim časom.",
    response: "Preverite posnetke kamer na hodniku za sumljivo aktivnost. Opravite razgovore s prisotnimi zaposlenimi. Razmislite o namestitvi kamere ali zaklepanja v garderobi.",
    risk_factors: ["Notranja grožnja", "Pomanjkljiv nadzor", "Osebna lastnina"], priority_score: 45,
  },
  {
    severity: "high", type: "Nepooblaščen dostop", summary: "Odprto okno in onemogočen alarm v bančni poslovalnici.",
    response: "Takoj izvedite pregled notranjosti banke in preverite trezor. Obvestite policijo in bančno varnostno službo. Analizirajte zakaj je bil alarm onemogočen — mogoča sabotaža.",
    risk_factors: ["Onemogočen alarm", "Finančna institucija", "Možna sabotaža"], priority_score: 85,
  },
];

// ─── Utility Components ─────────────────────────────────

function AnimatedNumber({ value, duration = 800 }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const startTime = performance.now();
    const animate = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(ref.current);
  }, [value, duration]);
  return display;
}

function PulsingDot({ color }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: 10, height: 10 }}>
      <span style={{
        position: "absolute", inset: 0, borderRadius: "50%", backgroundColor: color,
        animation: "pulse 2s ease-in-out infinite",
      }} />
      <span style={{
        position: "absolute", inset: -3, borderRadius: "50%", border: `1.5px solid ${color}`,
        animation: "pulsering 2s ease-in-out infinite", opacity: 0.4,
      }} />
    </span>
  );
}

function SeverityBar({ counts, total }) {
  if (total === 0) return null;
  return (
    <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", gap: 2 }}>
      {["critical", "high", "medium", "low"].map((s) =>
        counts[s] > 0 ? (
          <div key={s} style={{
            flex: counts[s] / total, backgroundColor: SEVERITY_CONFIG[s].color,
            transition: "flex 0.6s cubic-bezier(0.34,1.56,0.64,1)",
          }} />
        ) : null
      )}
    </div>
  );
}

// ─── API Service ─────────────────────────────────────────

async function analyzeWithAI(text) {
  const prompt = `Analiziraj ta varnostni incident in odgovori SAMO z JSON objektom (brez markdown, brez backtick-ov):
{
  "severity": "critical|high|medium|low",
  "type": "Vlom|Vandalizem|Požar|Tatvina|Sumljiva oseba|Tehnična napaka|Napad|Nepooblaščen dostop|Drugo",
  "summary": "kratek povzetek v slovenščini (1 stavek)",
  "response": "priporočen odziv v slovenščini (2-3 stavki)",
  "risk_factors": ["dejavnik1", "dejavnik2", "dejavnik3"],
  "priority_score": 1-100
}

Incident: "${text}"`;

  if (!API_KEY) {
    // Demo mode — simulate API delay and return mock response
    await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800));
    const mock = DEMO_RESPONSES[Math.floor(Math.random() * DEMO_RESPONSES.length)];
    return {
      ...mock,
      summary: `[DEMO] ${mock.summary}`,
      priority_score: Math.max(10, Math.min(99, mock.priority_score + Math.floor(Math.random() * 20 - 10))),
    };
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  const raw = data.content.map((i) => i.text || "").join("\n");
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// ─── Main App ────────────────────────────────────────────

export default function App() {
  const [incidents, setIncidents] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const textareaRef = useRef(null);

  const handleAnalyze = useCallback(async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeWithAI(input.trim());
      const newIncident = {
        id: Date.now(),
        text: input.trim(),
        ...result,
        timestamp: new Date().toLocaleString("sl-SI"),
      };
      setIncidents((prev) => [newIncident, ...prev]);
      setInput("");
      setSelectedIncident(newIncident);
    } catch (err) {
      setError("Napaka pri analizi. Poskusite znova.");
      console.error(err);
    }
    setLoading(false);
  }, [input, loading]);

  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  incidents.forEach((i) => { if (severityCounts[i.severity] !== undefined) severityCounts[i.severity]++; });
  const avgScore = incidents.length ? Math.round(incidents.reduce((a, i) => a + (i.priority_score || 0), 0) / incidents.length) : 0;
  const typeCounts = {};
  incidents.forEach((i) => { typeCounts[i.type] = (typeCounts[i.type] || 0) + 1; });

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0e17",
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      color: "#e4e8f1",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <header style={{
        borderBottom: "1px solid rgba(56,189,248,0.1)",
        background: "linear-gradient(180deg, rgba(56,189,248,0.04) 0%, transparent 100%)",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: "linear-gradient(90deg, transparent, rgba(56,189,248,0.5), transparent)",
        }} />
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: "linear-gradient(135deg, #38bdf8, #818cf8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 700, color: "#0a0e17",
              boxShadow: "0 0 20px rgba(56,189,248,0.3)",
            }}>AI</div>
            <div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em" }}>
                Security Incident Analyzer
              </div>
              <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.05em" }}>
                AI-POWERED THREAT CLASSIFICATION
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {!API_KEY && (
              <span style={{
                fontSize: 10, color: "#ff9500", background: "rgba(255,149,0,0.1)",
                padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,149,0,0.2)",
              }}>
                DEMO MODE
              </span>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PulsingDot color="#30d158" />
              <span style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.05em" }}>SYSTEM ACTIVE</span>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 28px" }}>
        {/* Input Section */}
        <section style={{
          background: "linear-gradient(135deg, rgba(56,189,248,0.06), rgba(129,140,248,0.04))",
          border: "1px solid rgba(56,189,248,0.12)", borderRadius: 14,
          padding: 24, marginBottom: 24, position: "relative", overflow: "hidden",
          animation: "fadeIn 0.5s ease",
        }}>
          <div style={{
            position: "absolute", inset: 0, opacity: 0.03,
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(56,189,248,0.5) 40px, rgba(56,189,248,0.5) 41px)",
          }} />
          <div style={{ position: "relative" }}>
            <div style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600,
              fontSize: 13, color: "#38bdf8", marginBottom: 12,
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}>
              ▸ Vnesi opis incidenta za AI analizo
            </div>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) handleAnalyze(); }}
              placeholder="Opiši varnostni incident... (npr. 'Ob 02:30 je varnostnik opazil razbitje stekla na vhodnih vratih trgovine.')"
              rows={3}
              style={{
                width: "100%", background: "rgba(10,14,23,0.7)", border: "1px solid rgba(56,189,248,0.15)",
                borderRadius: 10, padding: "14px 16px", color: "#e4e8f1", fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace", resize: "vertical",
                transition: "border-color 0.3s",
              }}
              onFocus={(e) => e.target.style.borderColor = "rgba(56,189,248,0.4)"}
              onBlur={(e) => e.target.style.borderColor = "rgba(56,189,248,0.15)"}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
              <button
                onClick={handleAnalyze}
                disabled={loading || !input.trim()}
                style={{
                  background: loading
                    ? "linear-gradient(90deg, #1e2a3a, #2a3a4a, #1e2a3a)"
                    : "linear-gradient(135deg, #38bdf8, #818cf8)",
                  backgroundSize: loading ? "200% 100%" : "100% 100%",
                  animation: loading ? "shimmer 1.5s linear infinite" : "none",
                  border: "none", borderRadius: 10, padding: "10px 22px",
                  color: loading ? "#64748b" : "#0a0e17", fontWeight: 700, fontSize: 13,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  cursor: loading ? "wait" : "pointer",
                  opacity: !input.trim() ? 0.4 : 1,
                  transition: "all 0.3s", letterSpacing: "0.02em",
                }}
              >
                {loading ? "⟳ Analiziram..." : "◈ Analiziraj incident"}
              </button>
              <span style={{ fontSize: 11, color: "#475569" }}>ali poskusi primer →</span>
              {SAMPLE_INCIDENTS.slice(0, 3).map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                  style={{
                    background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.1)",
                    borderRadius: 8, padding: "6px 12px", color: "#64748b", fontSize: 11,
                    cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
                    transition: "all 0.2s", maxWidth: 200, overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => { e.target.style.color = "#38bdf8"; e.target.style.borderColor = "rgba(56,189,248,0.3)"; }}
                  onMouseLeave={(e) => { e.target.style.color = "#64748b"; e.target.style.borderColor = "rgba(56,189,248,0.1)"; }}
                >
                  Primer {i + 1}
                </button>
              ))}
            </div>
            {error && (
              <div style={{ marginTop: 12, color: "#ff2d55", fontSize: 12, padding: "8px 12px", background: "rgba(255,45,85,0.08)", borderRadius: 8 }}>
                {error}
              </div>
            )}
          </div>
        </section>

        {/* Stats Bar */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12, marginBottom: 24,
        }}>
          {[
            { label: "Skupno incidentov", value: incidents.length, color: "#38bdf8" },
            { label: "Kritičnih", value: severityCounts.critical, color: "#ff2d55" },
            { label: "Visokih", value: severityCounts.high, color: "#ff9500" },
            { label: "Povp. prioriteta", value: avgScore, color: "#818cf8", suffix: "/100" },
          ].map((stat, i) => (
            <div key={i} style={{
              background: "rgba(30,42,58,0.4)", border: "1px solid rgba(56,189,248,0.08)",
              borderRadius: 12, padding: "16px 18px",
              animation: `slideUp 0.4s ease ${i * 0.08}s both`,
            }}>
              <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                {stat.label}
              </div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 28, fontWeight: 800, color: stat.color }}>
                <AnimatedNumber value={stat.value} />
                {stat.suffix && <span style={{ fontSize: 13, color: "#475569", fontWeight: 400 }}>{stat.suffix}</span>}
              </div>
            </div>
          ))}
        </div>

        {incidents.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SeverityBar counts={severityCounts} total={incidents.length} />
          </div>
        )}

        {/* Main Content */}
        <div style={{ display: "grid", gridTemplateColumns: selectedIncident ? "1fr 1fr" : "1fr", gap: 20 }}>
          {/* Incident List */}
          <div>
            <div style={{
              fontSize: 11, color: "#64748b", letterSpacing: "0.08em",
              textTransform: "uppercase", marginBottom: 12, fontWeight: 600,
            }}>
              ◆ Analizirani incidenti ({incidents.length})
            </div>
            {incidents.length === 0 ? (
              <div style={{
                background: "rgba(30,42,58,0.3)", border: "1px dashed rgba(56,189,248,0.15)",
                borderRadius: 14, padding: "48px 24px", textAlign: "center",
              }}>
                <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>◇</div>
                <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, color: "#475569", fontWeight: 500 }}>
                  Še ni analiziranih incidentov
                </div>
                <div style={{ fontSize: 12, color: "#334155", marginTop: 6 }}>
                  Vnesi opis incidenta zgoraj za AI analizo
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {incidents.map((inc, idx) => {
                  const sev = SEVERITY_CONFIG[inc.severity] || SEVERITY_CONFIG.medium;
                  const isSelected = selectedIncident?.id === inc.id;
                  return (
                    <div
                      key={inc.id}
                      onClick={() => setSelectedIncident(inc)}
                      style={{
                        background: isSelected ? "rgba(56,189,248,0.08)" : "rgba(30,42,58,0.3)",
                        border: `1px solid ${isSelected ? "rgba(56,189,248,0.3)" : "rgba(56,189,248,0.06)"}`,
                        borderRadius: 12, padding: "16px 18px", cursor: "pointer",
                        transition: "all 0.25s",
                        animation: `slideUp 0.4s ease ${idx * 0.06}s both`,
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.borderColor = "rgba(56,189,248,0.2)"; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.borderColor = "rgba(56,189,248,0.06)"; }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            background: sev.bg, color: sev.color,
                            padding: "3px 10px", borderRadius: 6, fontSize: 10,
                            fontWeight: 700, letterSpacing: "0.06em",
                          }}>
                            {sev.icon} {sev.label}
                          </span>
                          <span style={{
                            fontSize: 10, color: "#475569",
                            background: "rgba(71,85,105,0.15)",
                            padding: "3px 8px", borderRadius: 5,
                          }}>
                            {TYPE_ICONS[inc.type] || "📋"} {inc.type}
                          </span>
                        </div>
                        <div style={{
                          fontFamily: "'Plus Jakarta Sans', sans-serif",
                          fontSize: 18, fontWeight: 800,
                          color: inc.priority_score >= 70 ? "#ff2d55" : inc.priority_score >= 40 ? "#ff9500" : "#30d158",
                        }}>
                          {inc.priority_score}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, marginBottom: 6 }}>
                        {inc.summary}
                      </div>
                      <div style={{ fontSize: 10, color: "#334155" }}>{inc.timestamp}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detail Panel */}
          {selectedIncident && (
            <div style={{ animation: "slideUp 0.3s ease" }}>
              <div style={{
                fontSize: 11, color: "#64748b", letterSpacing: "0.08em",
                textTransform: "uppercase", marginBottom: 12, fontWeight: 600,
              }}>
                ◆ Podrobna analiza
              </div>
              <div style={{
                background: "rgba(30,42,58,0.4)", border: "1px solid rgba(56,189,248,0.1)",
                borderRadius: 14, overflow: "hidden",
              }}>
                {/* Detail Header */}
                <div style={{
                  background: SEVERITY_CONFIG[selectedIncident.severity]?.bg || "rgba(255,204,0,0.12)",
                  borderBottom: `1px solid ${SEVERITY_CONFIG[selectedIncident.severity]?.color || "#ffcc00"}22`,
                  padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{TYPE_ICONS[selectedIncident.type] || "📋"}</span>
                    <div>
                      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 15, color: "#e4e8f1" }}>
                        {selectedIncident.type}
                      </div>
                      <div style={{ fontSize: 10, color: "#64748b" }}>{selectedIncident.timestamp}</div>
                    </div>
                  </div>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: `linear-gradient(135deg, ${SEVERITY_CONFIG[selectedIncident.severity]?.color}33, ${SEVERITY_CONFIG[selectedIncident.severity]?.color}11)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: 20, fontWeight: 800,
                    color: SEVERITY_CONFIG[selectedIncident.severity]?.color,
                  }}>
                    {selectedIncident.priority_score}
                  </div>
                </div>

                <div style={{ padding: 20 }}>
                  {/* Original text */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, color: "#38bdf8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>
                      Izvorni opis
                    </div>
                    <div style={{
                      fontSize: 12, color: "#94a3b8", lineHeight: 1.6,
                      background: "rgba(10,14,23,0.5)", borderRadius: 8,
                      padding: "12px 14px", borderLeft: "2px solid rgba(56,189,248,0.2)",
                    }}>
                      {selectedIncident.text}
                    </div>
                  </div>

                  {/* AI Summary */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, color: "#38bdf8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>
                      AI Povzetek
                    </div>
                    <div style={{ fontSize: 13, color: "#e4e8f1", lineHeight: 1.6 }}>
                      {selectedIncident.summary}
                    </div>
                  </div>

                  {/* Recommended Response */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, color: "#38bdf8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>
                      Priporočen odziv
                    </div>
                    <div style={{
                      fontSize: 12, color: "#c4cbda", lineHeight: 1.6,
                      background: "linear-gradient(135deg, rgba(56,189,248,0.06), rgba(129,140,248,0.04))",
                      borderRadius: 10, padding: "14px 16px",
                      border: "1px solid rgba(56,189,248,0.1)",
                    }}>
                      {selectedIncident.response}
                    </div>
                  </div>

                  {/* Risk Factors */}
                  {selectedIncident.risk_factors?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: "#38bdf8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>
                        Dejavniki tveganja
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {selectedIncident.risk_factors.map((f, i) => (
                          <span key={i} style={{
                            fontSize: 11, color: "#ff9500",
                            background: "rgba(255,149,0,0.08)",
                            border: "1px solid rgba(255,149,0,0.15)",
                            padding: "5px 12px", borderRadius: 8,
                          }}>
                            ⚡ {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Severity Scale */}
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(56,189,248,0.08)" }}>
                    <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                      Lestvica resnosti
                    </div>
                    <div style={{ position: "relative", height: 8, borderRadius: 4, background: "rgba(30,42,58,0.6)" }}>
                      <div style={{
                        position: "absolute", left: 0, top: 0, bottom: 0,
                        width: `${selectedIncident.priority_score}%`,
                        borderRadius: 4,
                        background: "linear-gradient(90deg, #30d158, #ffcc00 40%, #ff9500 70%, #ff2d55)",
                        transition: "width 0.8s cubic-bezier(0.34,1.56,0.64,1)",
                      }} />
                      <div style={{
                        position: "absolute", top: -3,
                        left: `calc(${selectedIncident.priority_score}% - 7px)`,
                        width: 14, height: 14, borderRadius: "50%",
                        background: "#fff", boxShadow: "0 0 10px rgba(56,189,248,0.5)",
                        transition: "left 0.8s cubic-bezier(0.34,1.56,0.64,1)",
                      }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 9, color: "#475569" }}>
                      <span>NIZKO</span><span>SREDNJE</span><span>VISOKO</span><span>KRITIČNO</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Type Distribution */}
              {Object.keys(typeCounts).length > 1 && (
                <div style={{
                  marginTop: 12, background: "rgba(30,42,58,0.3)",
                  border: "1px solid rgba(56,189,248,0.08)",
                  borderRadius: 12, padding: "16px 18px",
                }}>
                  <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12, fontWeight: 600 }}>
                    Porazdelitev tipov
                  </div>
                  {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                    <div key={type} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 14, width: 22 }}>{TYPE_ICONS[type] || "📋"}</span>
                      <span style={{ fontSize: 11, color: "#94a3b8", flex: 1 }}>{type}</span>
                      <div style={{ width: 80, height: 4, borderRadius: 2, background: "rgba(30,42,58,0.6)" }}>
                        <div style={{
                          height: "100%", borderRadius: 2,
                          width: `${(count / incidents.length) * 100}%`,
                          background: "linear-gradient(90deg, #38bdf8, #818cf8)",
                          transition: "width 0.5s ease",
                        }} />
                      </div>
                      <span style={{ fontSize: 11, color: "#64748b", width: 20, textAlign: "right" }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        maxWidth: 1200, margin: "0 auto", padding: "20px 28px 40px",
        borderTop: "1px solid rgba(56,189,248,0.06)",
        textAlign: "center", fontSize: 10, color: "#334155",
        letterSpacing: "0.06em",
      }}>
        SECURITY AI ANALYZER v1.0 — Powered by Claude AI — Built with React + Vite
      </footer>
    </div>
  );
}
