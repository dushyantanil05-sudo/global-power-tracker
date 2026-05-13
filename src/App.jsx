import { useState, useEffect } from "react";

const CATEGORIES = [
  {
    id: "trump", label: "Trump Family", icon: "🦅", color: "#c0392b",
    query: "Trump family business OR Ivanka Trump OR Jared Kushner OR Trump Jr OR Eric Trump",
  },
  {
    id: "ambani", label: "Ambani Family", icon: "💎", color: "#8e44ad",
    query: "Mukesh Ambani OR Reliance Industries OR Jio OR Ambani family",
  },
  {
    id: "adani", label: "Adani Group", icon: "⚡", color: "#e67e22",
    query: "Gautam Adani OR Adani Group OR Adani Enterprises",
  },
  {
    id: "geopolitical", label: "Geopolitical", icon: "🌐", color: "#16a085",
    query: "geopolitical crisis OR war OR NATO OR China Taiwan OR Iran sanctions",
  },
  {
    id: "markets", label: "Market Triggers", icon: "📊", color: "#2980b9",
    query: "stock market crash OR Fed interest rate OR recession OR tariffs OR inflation",
  },
];

const RISK_COLOR = { CRITICAL: "#c0392b", HIGH: "#e74c3c", MODERATE: "#f39c12", LOW: "#27ae60" };

function timeAgo(d) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (h > 48) return Math.floor(h / 24) + "d ago";
  if (h > 0) return h + "h ago";
  return m + "m ago";
}

function getRisk(articles) {
  const words = ["war","crisis","crash","collapse","sanction","attack","nuclear","plunge","scandal","fraud","arrest","indict","bomb","conflict"];
  const score = articles.reduce((n, a) => {
    const t = (a.title + " " + (a.description || "")).toLowerCase();
    return n + words.filter(w => t.includes(w)).length;
  }, 0);
  if (score >= 6) return "CRITICAL";
  if (score >= 3) return "HIGH";
  if (score >= 1) return "MODERATE";
  return "LOW";
}

function getSignal(title, desc) {
  const t = (title + " " + (desc || "")).toLowerCase();
  const bear = ["crash","fall","drop","decline","plunge","loss","crisis","war","sanction","fraud","arrest","ban","collapse","slump"];
  const bull = ["surge","rise","gain","growth","profit","deal","record","expansion","boost","rally","strong","invest","launch","soar"];
  const b = bear.filter(w => t.includes(w)).length;
  const u = bull.filter(w => t.includes(w)).length;
  if (b > u) return { icon: "▼", label: "BEARISH", color: "#e74c3c" };
  if (u > b) return { icon: "▲", label: "BULLISH", color: "#2ecc71" };
  return { icon: "◆", label: "NEUTRAL", color: "#7f8c8d" };
}

const styles = {
  app: { minHeight:"100vh", background:"#080c14", color:"#dde8dd", fontFamily:"'Courier New',monospace", display:"flex", flexDirection:"column", overflow:"hidden" },
  header: { borderBottom:"1px solid #0f1e0f", padding:"14px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", background:"#060a10", flexShrink:0 },
  ticker: { background:"#050e05", borderBottom:"1px solid #0f1e0f", padding:"7px 0", overflow:"hidden", flexShrink:0 },
  body: { display:"flex", flex:1, overflow:"hidden" },
  sidebar: { width:"215px", flexShrink:0, borderRight:"1px solid #0f1e0f", padding:"16px 10px", display:"flex", flexDirection:"column", gap:"6px", background:"#060a10", overflowY:"auto" },
  main: { flex:1, overflowY:"auto", padding:"24px" },
  riskmat: { width:"170px", flexShrink:0, borderLeft:"1px solid #0f1e0f", padding:"16px 10px", background:"#060a10", overflowY:"auto" },
};

export default function App() {
  const [apiKey, setApiKey]       = useState(localStorage.getItem("gnews_key") || "");
  const [keyInput, setKeyInput]   = useState("");
  const [activeTab, setActiveTab] = useState(null);
  const [feedData, setFeedData]   = useState({});
  const [loading, setLoading]     = useState({});
  const [timestamps, setTimestamps] = useState({});
  const [globalRisk, setGlobalRisk] = useState("MODERATE");
  const [ticker, setTicker]       = useState([
    "TRACKER READY — SELECT A FEED TO LOAD LIVE INTELLIGENCE",
    "MONITORING: TRUMP · AMBANI · ADANI · GEOPOLITICAL · MARKETS",
    "YOUR HIGHNESS — STRATEGIC INTELLIGENCE DASHBOARD ACTIVE",
  ]);

  const activeCat   = CATEGORIES.find(c => c.id === activeTab);
  const currentData = activeTab ? feedData[activeTab] : null;

  useEffect(() => {
    if (!apiKey || !activeTab) return;
    const cat = CATEGORIES.find(c => c.id === activeTab);
    const t = setInterval(() => cat && loadFeed(cat), 600000);
    return () => clearInterval(t);
  }, [apiKey, activeTab]);

  async function loadFeed(cat) {
    if (loading[cat.id]) return;
    setLoading(p => ({ ...p, [cat.id]: true }));
    setActiveTab(cat.id);
    try {
      const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(cat.query)}&lang=en&max=6&apikey=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.errors?.[0] || `HTTP ${res.status} — check your API key`);
      }
      const data = await res.json();
      const articles = data.articles || [];
      if (!articles.length) throw new Error("No articles returned. Try again shortly.");

      const risk = getRisk(articles);
      setFeedData(p => ({ ...p, [cat.id]: { articles, risk } }));
      setTimestamps(p => ({ ...p, [cat.id]: new Date().toLocaleTimeString() }));
      if (["CRITICAL","HIGH"].includes(risk)) {
        setGlobalRisk(p => p === "CRITICAL" ? "CRITICAL" : risk);
      }
      setTicker(p => [`${cat.icon} ${cat.label.toUpperCase()} — ${articles.length} ARTICLES — RISK: ${risk}`, ...p.slice(0,5)]);
    } catch (err) {
      setFeedData(p => ({ ...p, [cat.id]: { error: true, msg: err.message } }));
    }
    setLoading(p => ({ ...p, [cat.id]: false }));
  }

  function submitKey() {
    const k = keyInput.trim();
    if (!k) return;
    localStorage.setItem("gnews_key", k);
    setApiKey(k);
  }

  function changeKey() {
    localStorage.removeItem("gnews_key");
    setApiKey("");
    setKeyInput("");
    setFeedData({});
    setActiveTab(null);
  }

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={styles.app}>
      <style>{`
        @keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.2}}
        @keyframes fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .cbtn:hover{background:rgba(255,255,255,.05)!important}
        .acard:hover{transform:translateX(3px)}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#152015}
        a{text-decoration:none;color:inherit}
      `}</style>

      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <div style={{ fontSize:"9px", letterSpacing:"4px", color:"#00cc7a", marginBottom:"3px" }}>
            HOUSE OF OMMI &amp; BEAUMONT · STRATEGIC INTELLIGENCE UNIT
          </div>
          <div style={{ fontSize:"20px", fontWeight:"bold", letterSpacing:"3px", color:"#fff" }}>
            GLOBAL POWER TRACKER
          </div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:"9px", color:"#2a3a2a", letterSpacing:"2px", marginBottom:"4px" }}>COMPOSITE RISK INDEX</div>
          <div style={{ fontSize:"16px", fontWeight:"bold", letterSpacing:"3px", color:RISK_COLOR[globalRisk], textShadow:`0 0 14px ${RISK_COLOR[globalRisk]}55` }}>
            ● {globalRisk}
          </div>
        </div>
      </div>

      {/* TICKER */}
      <div style={styles.ticker}>
        <div style={{ display:"flex", gap:"100px", animation:"ticker 30s linear infinite", whiteSpace:"nowrap", width:"max-content" }}>
          {[...ticker,...ticker].map((t,i) => (
            <span key={i} style={{ fontSize:"10px", color:"#00cc7a", letterSpacing:"1px", opacity:.75 }}>◆ {t}</span>
          ))}
        </div>
      </div>

      {/* API KEY GATE */}
      {!apiKey && (
        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"#0a1018", border:"1px solid #1a3a2a", borderRadius:"8px", padding:"36px 40px", maxWidth:"460px", width:"100%", animation:"fadein .5s ease" }}>
            <div style={{ fontSize:"28px", textAlign:"center", marginBottom:"12px" }}>🔑</div>
            <div style={{ fontSize:"13px", fontWeight:"bold", color:"#fff", letterSpacing:"2px", marginBottom:"8px", textAlign:"center" }}>
              GNEWS API KEY REQUIRED
            </div>
            <div style={{ fontSize:"11px", color:"#5a6a5a", lineHeight:1.8, marginBottom:"24px", textAlign:"center" }}>
              Get your free key at{" "}
              <a href="https://gnews.io" target="_blank" rel="noreferrer" style={{ color:"#00cc7a" }}>gnews.io</a>
              {" "}— 100 requests/day free, no credit card needed.
              <br/>Your key is saved in your browser — enter it once only.
            </div>
            <div style={{ display:"flex", gap:"8px" }}>
              <input
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submitKey()}
                placeholder="Paste your GNews API key..."
                style={{ flex:1, background:"#060a10", border:"1px solid #1a3a2a", borderRadius:"4px", padding:"10px 14px", color:"#dde8dd", fontFamily:"inherit", fontSize:"11px", outline:"none" }}
              />
              <button onClick={submitKey} style={{ background:"#00cc7a", border:"none", borderRadius:"4px", padding:"10px 18px", color:"#060a10", fontFamily:"inherit", fontSize:"11px", fontWeight:"bold", cursor:"pointer", letterSpacing:"1px" }}>
                ENTER
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN */}
      {apiKey && (
        <div style={styles.body}>

          {/* SIDEBAR */}
          <div style={styles.sidebar}>
            <div style={{ fontSize:"8px", color:"#1a2a1a", letterSpacing:"3px", padding:"0 4px", marginBottom:"6px" }}>INTELLIGENCE FEEDS</div>
            {CATEGORIES.map(cat => {
              const isActive = activeTab === cat.id;
              const d = feedData[cat.id];
              return (
                <button key={cat.id} className="cbtn" onClick={() => loadFeed(cat)} style={{ background:isActive?`${cat.color}14`:"transparent", border:`1px solid ${isActive?cat.color:"#0f1e0f"}`, borderRadius:"4px", padding:"11px 12px", cursor:"pointer", textAlign:"left", fontFamily:"inherit", fontSize:"11px", display:"flex", alignItems:"center", gap:"10px", transition:"all .2s", color:"#dde8dd", width:"100%" }}>
                  <span style={{ fontSize:"15px" }}>{cat.icon}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:"bold", marginBottom:"2px", color:isActive?"#fff":"#556" }}>{cat.label}</div>
                    {loading[cat.id] && <div style={{ fontSize:"8px", color:cat.color, animation:"pulse 1s infinite", letterSpacing:"1px" }}>FETCHING...</div>}
                    {!loading[cat.id] && d && !d.error && <div style={{ fontSize:"8px", color:RISK_COLOR[d.risk], letterSpacing:"1px" }}>{d.risk} · {timestamps[cat.id]}</div>}
                    {!loading[cat.id] && d?.error && <div style={{ fontSize:"8px", color:"#e74c3c", letterSpacing:"1px" }}>ERROR · RETRY</div>}
                  </div>
                </button>
              );
            })}
            <div style={{ marginTop:"auto" }}>
              <div style={{ padding:"10px", background:"#080e08", borderRadius:"4px", border:"1px solid #0f1e0f", marginBottom:"8px" }}>
                <div style={{ fontSize:"8px", color:"#1a2a1a", letterSpacing:"2px", marginBottom:"5px" }}>FEEDS LOADED</div>
                <div style={{ fontSize:"20px", fontWeight:"bold", color:"#00cc7a" }}>
                  {Object.values(feedData).filter(d=>d&&!d.error).length}
                  <span style={{ fontSize:"11px", color:"#2a3a2a", fontWeight:"normal" }}> / {CATEGORIES.length}</span>
                </div>
              </div>
              <button onClick={changeKey} style={{ width:"100%", background:"transparent", border:"1px solid #1a2a1a", borderRadius:"4px", padding:"7px", cursor:"pointer", fontFamily:"inherit", fontSize:"8px", color:"#334", letterSpacing:"1px" }}>
                CHANGE API KEY
              </button>
            </div>
          </div>

          {/* MAIN PANEL */}
          <div style={styles.main}>
            {!activeTab && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:"24px", animation:"fadein .5s ease" }}>
                <div style={{ fontSize:"52px" }}>🛰️</div>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:"13px", color:"#2a3a2a", letterSpacing:"4px", marginBottom:"6px" }}>SELECT AN INTELLIGENCE FEED</div>
                  <div style={{ fontSize:"10px", color:"#1a2a1a", letterSpacing:"2px" }}>LIVE NEWS · AUTO-REFRESH 10 MIN · TRUMP · AMBANI · ADANI · GEO · MARKETS</div>
                </div>
                <div style={{ display:"flex", gap:"10px", flexWrap:"wrap", justifyContent:"center" }}>
                  {CATEGORIES.map(cat => (
                    <button key={cat.id} onClick={() => loadFeed(cat)} style={{ background:`${cat.color}12`, border:`1px solid ${cat.color}55`, borderRadius:"6px", padding:"10px 18px", color:cat.color, cursor:"pointer", fontFamily:"inherit", fontSize:"11px", letterSpacing:"1px" }}>
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab && loading[activeTab] && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"60%", gap:"20px" }}>
                <div style={{ width:"36px", height:"36px", border:`2px solid ${activeCat?.color}`, borderTopColor:"transparent", borderRadius:"50%", animation:"spin .8s linear infinite" }} />
                <div style={{ fontSize:"10px", color:"#2a3a2a", letterSpacing:"4px", animation:"pulse 1.5s infinite" }}>FETCHING LIVE NEWS...</div>
              </div>
            )}

            {activeTab && !loading[activeTab] && currentData?.error && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"60%", gap:"14px", animation:"fadein .3s ease" }}>
                <div style={{ fontSize:"36px" }}>⚠️</div>
                <div style={{ fontSize:"11px", color:"#e74c3c", letterSpacing:"3px" }}>FEED ERROR</div>
                <div style={{ fontSize:"11px", color:"#7a8a7a", maxWidth:"440px", textAlign:"center", padding:"12px 16px", background:"#0c0f0c", borderRadius:"4px", border:"1px solid #1a2a1a", lineHeight:1.7 }}>
                  {currentData.msg}
                </div>
                <button onClick={() => activeCat && loadFeed(activeCat)} style={{ background:"transparent", border:"1px solid #e74c3c", color:"#e74c3c", padding:"8px 22px", cursor:"pointer", fontFamily:"inherit", fontSize:"10px", letterSpacing:"2px", borderRadius:"4px" }}>
                  ↺ RETRY
                </button>
              </div>
            )}

            {activeTab && !loading[activeTab] && currentData && !currentData.error && (
              <div style={{ animation:"fadein .4s ease" }}>
                <div style={{ display:"flex", gap:"20px", marginBottom:"22px", alignItems:"flex-start" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:"8px", color:"#2a3a2a", letterSpacing:"3px", marginBottom:"8px" }}>
                      {activeCat?.icon} {activeCat?.label.toUpperCase()} · LIVE FEED · {currentData.articles?.length} ARTICLES · {timestamps[activeTab]}
                    </div>
                    <div style={{ fontSize:"12px", lineHeight:1.7, color:"#5a6a5a", borderLeft:`3px solid ${activeCat?.color}`, paddingLeft:"16px" }}>
                      Live news from 60,000+ global sources. Risk auto-calculated from headline sentiment.
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:"8px", alignItems:"flex-end" }}>
                    <div style={{ padding:"10px 18px", background:`${RISK_COLOR[currentData.risk]}0e`, border:`1px solid ${RISK_COLOR[currentData.risk]}44`, borderRadius:"6px", textAlign:"center", minWidth:"90px" }}>
                      <div style={{ fontSize:"8px", color:"#2a3a2a", letterSpacing:"2px", marginBottom:"4px" }}>RISK</div>
                      <div style={{ fontSize:"13px", fontWeight:"bold", color:RISK_COLOR[currentData.risk], letterSpacing:"2px" }}>{currentData.risk}</div>
                    </div>
                    <button onClick={() => activeCat && loadFeed(activeCat)} style={{ background:"transparent", border:`1px solid ${activeCat?.color}55`, color:activeCat?.color, padding:"6px 14px", cursor:"pointer", fontFamily:"inherit", fontSize:"9px", letterSpacing:"1px", borderRadius:"3px" }}>
                      ↺ REFRESH
                    </button>
                  </div>
                </div>

                <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                  {(currentData.articles || []).map((a, i) => {
                    const sig = getSignal(a.title, a.description);
                    return (
                      <a key={i} href={a.url} target="_blank" rel="noreferrer">
                        <div className="acard" style={{ background:"#0a1018", border:"1px solid #0f1a10", borderLeft:`2px solid ${activeCat?.color}88`, borderRadius:"5px", padding:"14px 18px", transition:"transform .15s", animation:`fadein .4s ease ${i*.06}s both` }}>
                          <div style={{ display:"flex", flexWrap:"wrap", gap:"7px", marginBottom:"8px", alignItems:"center" }}>
                            <span style={{ fontSize:"10px", fontWeight:"bold", color:sig.color }}>{sig.icon} {sig.label}</span>
                            <span style={{ fontSize:"9px", color:"#2a3a2a", marginLeft:"auto" }}>{a.source?.name} · {timeAgo(a.publishedAt)}</span>
                          </div>
                          <div style={{ fontSize:"12px", fontWeight:"bold", color:"#c8d4c8", marginBottom:"6px", lineHeight:1.5 }}>{a.title}</div>
                          <div style={{ fontSize:"11px", color:"#4a5a4a", lineHeight:1.65 }}>{(a.description||"").slice(0,160)}{(a.description||"").length>160?"…":""}</div>
                          <div style={{ fontSize:"9px", color:`${activeCat?.color}88`, marginTop:"6px" }}>TAP TO READ FULL ARTICLE →</div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* RISK MATRIX */}
          {Object.keys(feedData).some(k => feedData[k] && !feedData[k].error) && (
            <div style={styles.riskmat}>
              <div style={{ fontSize:"8px", color:"#1a2a1a", letterSpacing:"3px", marginBottom:"12px" }}>RISK MATRIX</div>
              {CATEGORIES.filter(c => feedData[c.id] && !feedData[c.id].error).map(cat => {
                const d = feedData[cat.id];
                return (
                  <div key={cat.id} onClick={() => setActiveTab(cat.id)} style={{ marginBottom:"8px", cursor:"pointer", padding:"9px 10px", background:"#0a1018", border:`1px solid ${activeTab===cat.id?cat.color:"#0f1a10"}`, borderRadius:"4px", transition:"border-color .2s" }}>
                    <div style={{ fontSize:"9px", color:"#4a5a4a", marginBottom:"4px" }}>{cat.icon} {cat.label}</div>
                    <div style={{ fontSize:"10px", fontWeight:"bold", color:RISK_COLOR[d.risk], marginBottom:"4px" }}>{d.risk}</div>
                    <div style={{ fontSize:"8px", color:"#2a3a2a" }}>{d.articles?.length} articles</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
