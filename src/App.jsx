import { useState, useEffect, useCallback } from "react";

const RSS = (url) =>
  `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&count=10`;

const CATEGORIES = [
  {
    id: "trump", label: "Trump Family", icon: "🦅", color: "#c0392b",
    feeds: [
      "https://feeds.bbci.co.uk/news/world/us-canada/rss.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml",
    ],
  },
  {
    id: "ambani", label: "Ambani Family", icon: "💎", color: "#8e44ad",
    feeds: [
      "https://economictimes.indiatimes.com/rssfeedstopstories.cms",
      "https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms",
    ],
  },
  {
    id: "adani", label: "Adani Group", icon: "⚡", color: "#e67e22",
    feeds: [
      "https://economictimes.indiatimes.com/rssfeedstopstories.cms",
      "https://www.business-standard.com/rss/companies-101.rss",
    ],
  },
  {
    id: "geopolitical", label: "Geopolitical", icon: "🌐", color: "#16a085",
    feeds: [
      "https://feeds.bbci.co.uk/news/world/rss.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    ],
  },
  {
    id: "markets", label: "Market Triggers", icon: "📊", color: "#2980b9",
    feeds: [
      "https://feeds.bbci.co.uk/news/business/rss.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
    ],
  },
];

// Stock groups for the market panel
const STOCK_GROUPS = [
  {
    label: "INDIA",
    symbols: ["RELIANCE.NS", "ADANIENT.NS", "ADANIPORTS.NS", "^BSESN", "^NSEI"],
  },
  {
    label: "GLOBAL",
    symbols: ["^GSPC", "^DJI", "^IXIC"],
  },
  {
    label: "COMMODITIES",
    symbols: ["GC=F", "CL=F", "DX-Y.NYB", "BTC-USD"],
  },
];

const FRIENDLY_NAMES = {
  "RELIANCE.NS":   "Reliance (Ambani)",
  "ADANIENT.NS":   "Adani Enterprises",
  "ADANIPORTS.NS": "Adani Ports",
  "^BSESN":        "BSE Sensex",
  "^NSEI":         "Nifty 50",
  "^GSPC":         "S&P 500",
  "^DJI":          "Dow Jones",
  "^IXIC":         "NASDAQ",
  "GC=F":          "Gold",
  "CL=F":          "Crude Oil",
  "DX-Y.NYB":      "USD Index",
  "BTC-USD":       "Bitcoin",
};

const RISK_COLOR = { CRITICAL:"#c0392b", HIGH:"#e74c3c", MODERATE:"#f39c12", LOW:"#27ae60" };

function timeAgo(d) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (h > 48) return Math.floor(h / 24) + "d ago";
  if (h > 0) return h + "h ago";
  return Math.max(m, 1) + "m ago";
}

function getRisk(articles) {
  const words = ["war","crisis","crash","collapse","sanction","attack","nuclear","plunge","scandal","fraud","arrest","bomb","conflict","threat"];
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
  const bear = ["crash","fall","drop","decline","plunge","loss","crisis","war","sanction","fraud","arrest","collapse","slump","deficit","risk","threat"];
  const bull = ["surge","rise","gain","growth","profit","deal","record","boost","rally","strong","invest","launch","soar","high","jump"];
  const b = bear.filter(w => t.includes(w)).length;
  const u = bull.filter(w => t.includes(w)).length;
  if (b > u) return { icon:"▼", label:"BEARISH", color:"#e74c3c" };
  if (u > b) return { icon:"▲", label:"BULLISH", color:"#2ecc71" };
  return { icon:"◆", label:"NEUTRAL", color:"#7f8c8d" };
}

async function fetchFeed(cat) {
  const results = [];
  for (const feedUrl of cat.feeds) {
    try {
      const res = await fetch(RSS(feedUrl));
      if (!res.ok) continue;
      const data = await res.json();
      if (data.status !== "ok" || !data.items?.length) continue;
      results.push(...data.items);
    } catch { continue; }
  }
  if (!results.length) throw new Error("Could not reach news feeds. Check your connection.");
  const seen = new Set();
  return results
    .filter(a => { if (!a.title || seen.has(a.title)) return false; seen.add(a.title); return true; })
    .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0))
    .slice(0, 10);
}

function fmt(price, currency) {
  if (price == null) return "—";
  if (currency === "INR") return "₹" + price.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  if (currency === "USD") return "$" + price.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// ── STOCK TICKER BAR ─────────────────────────────────────────────────────────
function StockBar({ quotes }) {
  if (!quotes?.length) return null;
  const items = quotes.map(q => {
    const up = q.change >= 0;
    return `${FRIENDLY_NAMES[q.symbol] || q.symbol}  ${fmt(q.price, q.currency)}  ${up ? "▲" : "▼"} ${Math.abs(q.changePct).toFixed(2)}%`;
  });
  return (
    <div style={{ background:"#04080d", borderBottom:"1px solid #0a180a", padding:"5px 0", overflow:"hidden", flexShrink:0 }}>
      <div style={{ display:"flex", gap:"60px", animation:"ticker 40s linear infinite", whiteSpace:"nowrap", width:"max-content" }}>
        {[...items,...items].map((t, i) => {
          const up = !t.includes("▼");
          return <span key={i} style={{ fontSize:"10px", color: up ? "#2ecc71" : "#e74c3c", letterSpacing:"1px", opacity:.9 }}>● {t}</span>;
        })}
      </div>
    </div>
  );
}

// ── STOCK PANEL ───────────────────────────────────────────────────────────────
function StockPanel({ quotes, lastUpdated, onRefresh, loading }) {
  const bySymbol = Object.fromEntries((quotes || []).map(q => [q.symbol, q]));

  return (
    <div style={{ width:"260px", flexShrink:0, borderLeft:"1px solid #0f1e0f", background:"#060a10", overflowY:"auto", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"14px 14px 8px", borderBottom:"1px solid #0a180a", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:"8px", color:"#1a2a1a", letterSpacing:"3px", marginBottom:"2px" }}>LIVE MARKETS</div>
          {lastUpdated && <div style={{ fontSize:"8px", color:"#2a3a2a" }}>Updated {lastUpdated}</div>}
        </div>
        <button onClick={onRefresh} disabled={loading} style={{ background:"transparent", border:"1px solid #1a3a1a", color:"#00cc7a", padding:"4px 10px", cursor:"pointer", fontFamily:"inherit", fontSize:"9px", borderRadius:"3px", opacity: loading ? .5 : 1 }}>
          {loading ? "..." : "↺"}
        </button>
      </div>

      <div style={{ padding:"10px", flex:1 }}>
        {STOCK_GROUPS.map(group => (
          <div key={group.label} style={{ marginBottom:"16px" }}>
            <div style={{ fontSize:"8px", color:"#1a2a1a", letterSpacing:"3px", marginBottom:"8px", paddingLeft:"2px" }}>{group.label}</div>
            {group.symbols.map(sym => {
              const q = bySymbol[sym];
              const up = q ? q.change >= 0 : null;
              return (
                <div key={sym} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 8px", background:"#0a1018", borderRadius:"4px", marginBottom:"4px", border:"1px solid #0f1a10" }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:"10px", color:"#8a9a8a", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {FRIENDLY_NAMES[sym] || sym}
                    </div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    {!q && <div style={{ fontSize:"10px", color:"#2a3a2a" }}>—</div>}
                    {q && (
                      <>
                        <div style={{ fontSize:"11px", fontWeight:"bold", color:"#dde8dd" }}>{fmt(q.price, q.currency)}</div>
                        <div style={{ fontSize:"9px", color: up ? "#2ecc71" : "#e74c3c" }}>
                          {up ? "▲" : "▼"} {Math.abs(q.changePct).toFixed(2)}%
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {!quotes?.length && !loading && (
          <div style={{ fontSize:"10px", color:"#2a3a2a", textAlign:"center", padding:"20px 0", lineHeight:1.8 }}>
            Click ↺ to load<br/>live market data
          </div>
        )}
        {loading && (
          <div style={{ fontSize:"10px", color:"#2a3a2a", textAlign:"center", padding:"20px 0", animation:"pulse 1.5s infinite" }}>
            FETCHING PRICES...
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab,     setActiveTab]     = useState(null);
  const [feedData,      setFeedData]      = useState({});
  const [loading,       setLoading]       = useState({});
  const [timestamps,    setTimestamps]    = useState({});
  const [globalRisk,    setGlobalRisk]    = useState("MODERATE");
  const [quotes,        setQuotes]        = useState([]);
  const [stockLoading,  setStockLoading]  = useState(false);
  const [stockUpdated,  setStockUpdated]  = useState(null);
  const [ticker,        setTicker]        = useState([
    "YOUR HIGHNESS — STRATEGIC INTELLIGENCE DASHBOARD ACTIVE",
    "MONITORING: TRUMP · AMBANI · ADANI · GEOPOLITICAL · MARKETS",
    "RELIANCE · ADANI · SENSEX · NIFTY · S&P 500 · GOLD · OIL · BTC",
  ]);

  const activeCat   = CATEGORIES.find(c => c.id === activeTab);
  const currentData = activeTab ? feedData[activeTab] : null;

  // Load stocks on mount and every 5 minutes
  const loadStocks = useCallback(async () => {
    setStockLoading(true);
    try {
      // Call our Vercel serverless API route
      const res = await fetch("/api/stocks");
      if (!res.ok) throw new Error("Stock API error");
      const data = await res.json();
      if (data.success && data.quotes?.length) {
        setQuotes(data.quotes);
        setStockUpdated(new Date().toLocaleTimeString());
      }
    } catch {
      // Silently fail — stocks panel just stays empty
    }
    setStockLoading(false);
  }, []);

  useEffect(() => {
    loadStocks();
    const t = setInterval(loadStocks, 300000); // every 5 min
    return () => clearInterval(t);
  }, [loadStocks]);

  // Auto-refresh active news feed every 10 min
  useEffect(() => {
    if (!activeTab) return;
    const cat = CATEGORIES.find(c => c.id === activeTab);
    const t = setInterval(() => cat && loadFeed(cat), 600000);
    return () => clearInterval(t);
  }, [activeTab]);

  async function loadFeed(cat) {
    if (loading[cat.id]) return;
    setLoading(p => ({ ...p, [cat.id]: true }));
    setActiveTab(cat.id);
    try {
      const articles = await fetchFeed(cat);
      const risk = getRisk(articles);
      setFeedData(p => ({ ...p, [cat.id]: { articles, risk } }));
      setTimestamps(p => ({ ...p, [cat.id]: new Date().toLocaleTimeString() }));
      setGlobalRisk(p => {
        const order = ["CRITICAL","HIGH","MODERATE","LOW"];
        return order[Math.min(order.indexOf(p), order.indexOf(risk))];
      });
      setTicker(p => [`${cat.icon} ${cat.label.toUpperCase()} — ${articles.length} ARTICLES — RISK: ${risk}`, ...p.slice(0,5)]);
    } catch (err) {
      setFeedData(p => ({ ...p, [cat.id]: { error: true, msg: err.message } }));
    }
    setLoading(p => ({ ...p, [cat.id]: false }));
  }

  return (
    <div style={{ minHeight:"100vh", background:"#080c14", color:"#dde8dd", fontFamily:"'Courier New',monospace", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <style>{`
        @keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.2}}
        @keyframes fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .cbtn:hover{background:rgba(255,255,255,.05)!important}
        .acard{transition:transform .15s}.acard:hover{transform:translateX(3px)}
        a{text-decoration:none;color:inherit}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#152015}
      `}</style>

      {/* HEADER */}
      <div style={{ borderBottom:"1px solid #0f1e0f", padding:"12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", background:"#060a10", flexShrink:0 }}>
        <div>
          <div style={{ fontSize:"9px", letterSpacing:"4px", color:"#00cc7a", marginBottom:"3px" }}>HOUSE OF OMMI &amp; BEAUMONT · STRATEGIC INTELLIGENCE UNIT</div>
          <div style={{ fontSize:"20px", fontWeight:"bold", letterSpacing:"3px", color:"#fff" }}>GLOBAL POWER TRACKER</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:"9px", color:"#2a3a2a", letterSpacing:"2px", marginBottom:"4px" }}>COMPOSITE RISK INDEX</div>
          <div style={{ fontSize:"16px", fontWeight:"bold", letterSpacing:"3px", color:RISK_COLOR[globalRisk], textShadow:`0 0 14px ${RISK_COLOR[globalRisk]}55` }}>● {globalRisk}</div>
        </div>
      </div>

      {/* NEWS TICKER */}
      <div style={{ background:"#050e05", borderBottom:"1px solid #0f1e0f", padding:"6px 0", overflow:"hidden", flexShrink:0 }}>
        <div style={{ display:"flex", gap:"100px", animation:"ticker 30s linear infinite", whiteSpace:"nowrap", width:"max-content" }}>
          {[...ticker,...ticker].map((t,i) => (
            <span key={i} style={{ fontSize:"10px", color:"#00cc7a", letterSpacing:"1px", opacity:.75 }}>◆ {t}</span>
          ))}
        </div>
      </div>

      {/* STOCK PRICE TICKER */}
      <StockBar quotes={quotes} />

      {/* BODY */}
      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* SIDEBAR */}
        <div style={{ width:"210px", flexShrink:0, borderRight:"1px solid #0f1e0f", padding:"16px 10px", display:"flex", flexDirection:"column", gap:"6px", background:"#060a10", overflowY:"auto" }}>
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
          <div style={{ marginTop:"auto", padding:"10px", background:"#080e08", borderRadius:"4px", border:"1px solid #0f1e0f" }}>
            <div style={{ fontSize:"8px", color:"#1a2a1a", letterSpacing:"2px", marginBottom:"5px" }}>FEEDS LOADED</div>
            <div style={{ fontSize:"20px", fontWeight:"bold", color:"#00cc7a" }}>
              {Object.values(feedData).filter(d=>d&&!d.error).length}
              <span style={{ fontSize:"11px", color:"#2a3a2a", fontWeight:"normal" }}> / {CATEGORIES.length}</span>
            </div>
          </div>
        </div>

        {/* MAIN NEWS PANEL */}
        <div style={{ flex:1, overflowY:"auto", padding:"24px" }}>
          {!activeTab && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:"24px", animation:"fadein .5s ease" }}>
              <div style={{ fontSize:"52px" }}>🛰️</div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:"13px", color:"#2a3a2a", letterSpacing:"4px", marginBottom:"6px" }}>SELECT AN INTELLIGENCE FEED</div>
                <div style={{ fontSize:"10px", color:"#1a2a1a", letterSpacing:"2px" }}>LIVE NEWS + LIVE PRICES · AUTO-REFRESH EVERY 5–10 MIN</div>
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
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"60%", gap:"14px" }}>
              <div style={{ fontSize:"36px" }}>⚠️</div>
              <div style={{ fontSize:"11px", color:"#e74c3c", letterSpacing:"3px" }}>FEED ERROR</div>
              <div style={{ fontSize:"11px", color:"#7a8a7a", maxWidth:"440px", textAlign:"center", padding:"12px 16px", background:"#0c0f0c", borderRadius:"4px", border:"1px solid #1a2a1a", lineHeight:1.7 }}>{currentData.msg}</div>
              <button onClick={() => activeCat && loadFeed(activeCat)} style={{ background:"transparent", border:"1px solid #e74c3c", color:"#e74c3c", padding:"8px 22px", cursor:"pointer", fontFamily:"inherit", fontSize:"10px", letterSpacing:"2px", borderRadius:"4px" }}>↺ RETRY</button>
            </div>
          )}

          {activeTab && !loading[activeTab] && currentData && !currentData.error && (
            <div style={{ animation:"fadein .4s ease" }}>
              <div style={{ display:"flex", gap:"20px", marginBottom:"22px", alignItems:"flex-start" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:"8px", color:"#2a3a2a", letterSpacing:"3px", marginBottom:"8px" }}>
                    {activeCat?.icon} {activeCat?.label.toUpperCase()} · {currentData.articles?.length} LIVE ARTICLES · {timestamps[activeTab]}
                  </div>
                  <div style={{ fontSize:"12px", lineHeight:1.7, color:"#5a6a5a", borderLeft:`3px solid ${activeCat?.color}`, paddingLeft:"16px" }}>
                    Live news from BBC and NYT. Risk score calculated from headline sentiment.
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:"8px", alignItems:"flex-end" }}>
                  <div style={{ padding:"10px 18px", background:`${RISK_COLOR[currentData.risk]}0e`, border:`1px solid ${RISK_COLOR[currentData.risk]}44`, borderRadius:"6px", textAlign:"center", minWidth:"90px" }}>
                    <div style={{ fontSize:"8px", color:"#2a3a2a", letterSpacing:"2px", marginBottom:"4px" }}>RISK</div>
                    <div style={{ fontSize:"13px", fontWeight:"bold", color:RISK_COLOR[currentData.risk], letterSpacing:"2px" }}>{currentData.risk}</div>
                  </div>
                  <button onClick={() => activeCat && loadFeed(activeCat)} style={{ background:"transparent", border:`1px solid ${activeCat?.color}55`, color:activeCat?.color, padding:"6px 14px", cursor:"pointer", fontFamily:"inherit", fontSize:"9px", letterSpacing:"1px", borderRadius:"3px" }}>↺ REFRESH</button>
                </div>
              </div>

              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                {(currentData.articles || []).map((a, i) => {
                  const sig = getSignal(a.title, a.description);
                  return (
                    <a key={i} href={a.link} target="_blank" rel="noreferrer">
                      <div className="acard" style={{ background:"#0a1018", border:"1px solid #0f1a10", borderLeft:`2px solid ${activeCat?.color}88`, borderRadius:"5px", padding:"14px 18px", animation:`fadein .4s ease ${i*.06}s both` }}>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:"7px", marginBottom:"8px", alignItems:"center" }}>
                          <span style={{ fontSize:"10px", fontWeight:"bold", color:sig.color }}>{sig.icon} {sig.label}</span>
                          <span style={{ fontSize:"9px", color:"#2a3a2a", marginLeft:"auto" }}>{timeAgo(a.pubDate)}</span>
                        </div>
                        <div style={{ fontSize:"12px", fontWeight:"bold", color:"#c8d4c8", marginBottom:"6px", lineHeight:1.5 }}>{a.title}</div>
                        <div style={{ fontSize:"11px", color:"#4a5a4a", lineHeight:1.65 }}>
                          {(a.description || "").replace(/<[^>]*>/g,"").slice(0,200)}
                          {(a.description||"").length>200?"…":""}
                        </div>
                        <div style={{ fontSize:"9px", color:`${activeCat?.color}88`, marginTop:"6px" }}>READ FULL ARTICLE →</div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* LIVE STOCK PRICES PANEL */}
        <StockPanel
          quotes={quotes}
          lastUpdated={stockUpdated}
          onRefresh={loadStocks}
          loading={stockLoading}
        />
      </div>
    </div>
  );
}
