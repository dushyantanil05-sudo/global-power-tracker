import { useState, useEffect, useCallback } from "react";

// ── TWELVE DATA ───────────────────────────────────────────────────────────────
const TWELVE_CHANGE_URL = (symbols, key) =>
  `https://api.twelvedata.com/quote?symbol=${symbols}&apikey=${key}`;

const STOCKS = [
  { symbol: "RELIANCE:NSE",   name: "RELIANCE",  group: "INDIA",       currency: "₹" },
  { symbol: "ADANIENT:NSE",   name: "ADANI ENT", group: "INDIA",       currency: "₹" },
  { symbol: "ADANIPORTS:NSE", name: "ADANI PRT", group: "INDIA",       currency: "₹" },
  { symbol: "NIFTY:NSE",      name: "NIFTY 50",  group: "INDIA",       currency: "₹" },
  { symbol: "SENSEX:BSE",     name: "SENSEX",    group: "INDIA",       currency: "₹" },
  { symbol: "SPX:NYSE",       name: "S&P 500",   group: "GLOBAL",      currency: "$" },
  { symbol: "DJI:NYSE",       name: "DOW JONES", group: "GLOBAL",      currency: "$" },
  { symbol: "IXIC:NASDAQ",    name: "NASDAQ",    group: "GLOBAL",      currency: "$" },
  { symbol: "XAU/USD",        name: "GOLD",      group: "COMMODITIES", currency: "$" },
  { symbol: "WTI/USD",        name: "CRUDE OIL", group: "COMMODITIES", currency: "$" },
  { symbol: "BTC/USD",        name: "BITCOIN",   group: "COMMODITIES", currency: "$" },
];
const GROUPS = ["INDIA", "GLOBAL", "COMMODITIES"];

// ── NEWS FEEDS ────────────────────────────────────────────────────────────────
const RSS = (url) =>
  `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&count=10`;

const CATEGORIES = [
  { id:"trump",        label:"TRUMP FAMILY",   icon:"🦅", color:"#ff4444",
    feeds:["https://feeds.bbci.co.uk/news/world/us-canada/rss.xml","https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml"] },
  { id:"ambani",       label:"AMBANI FAMILY",  icon:"💎", color:"#cc88ff",
    feeds:["https://economictimes.indiatimes.com/rssfeedstopstories.cms","https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms"] },
  { id:"adani",        label:"ADANI GROUP",    icon:"⚡", color:"#ffaa00",
    feeds:["https://economictimes.indiatimes.com/rssfeedstopstories.cms","https://www.business-standard.com/rss/companies-101.rss"] },
  { id:"geopolitical", label:"GEOPOLITICAL",   icon:"🌐", color:"#00ffcc",
    feeds:["https://feeds.bbci.co.uk/news/world/rss.xml","https://rss.nytimes.com/services/xml/rss/nyt/World.xml"] },
  { id:"markets",      label:"MARKET TRIGGERS",icon:"📊", color:"#44aaff",
    feeds:["https://feeds.bbci.co.uk/news/business/rss.xml","https://rss.nytimes.com/services/xml/rss/nyt/Business.xml"] },
];

const RISK_COLOR   = { CRITICAL:"#ff2222", HIGH:"#ff6600", MODERATE:"#ffcc00", LOW:"#00ff88" };
const RISK_BG      = { CRITICAL:"#2a0000", HIGH:"#1a0a00", MODERATE:"#1a1400", LOW:"#001a0a" };

function timeAgo(d) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff/3600000), m = Math.floor(diff/60000);
  if (h>48) return Math.floor(h/24)+"D AGO";
  if (h>0) return h+"H AGO";
  return Math.max(m,1)+"M AGO";
}

function getRisk(articles) {
  const words = ["war","crisis","crash","collapse","sanction","attack","nuclear","plunge","scandal","fraud","arrest","bomb","conflict","threat"];
  const score = articles.reduce((n,a) => {
    const t = (a.title+" "+(a.description||"")).toLowerCase();
    return n + words.filter(w=>t.includes(w)).length;
  }, 0);
  if (score>=6) return "CRITICAL";
  if (score>=3) return "HIGH";
  if (score>=1) return "MODERATE";
  return "LOW";
}

function getSignal(title, desc) {
  const t = (title+" "+(desc||"")).toLowerCase();
  const bear = ["crash","fall","drop","decline","plunge","loss","crisis","war","sanction","fraud","collapse","slump","risk","threat","deficit"];
  const bull = ["surge","rise","gain","growth","profit","deal","record","boost","rally","strong","invest","soar","jump","high"];
  const b = bear.filter(w=>t.includes(w)).length;
  const u = bull.filter(w=>t.includes(w)).length;
  if (b>u) return { icon:"▼", label:"BEARISH", color:"#ff4444" };
  if (u>b) return { icon:"▲", label:"BULLISH", color:"#00ff88" };
  return { icon:"◆", label:"NEUTRAL", color:"#888888" };
}

function fmtPrice(price, currency) {
  if (price==null||isNaN(price)) return "—";
  const n = parseFloat(price);
  return currency + n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
}

// ── STOCK TICKER ──────────────────────────────────────────────────────────────
function StockBar({ stockData }) {
  const items = STOCKS.filter(s=>stockData[s.symbol]?.price).map(s => {
    const d = stockData[s.symbol];
    const up = parseFloat(d.changePct||0)>=0;
    return { text:`${s.name}  ${fmtPrice(d.price,s.currency)}  ${up?"▲":"▼"}${Math.abs(parseFloat(d.changePct||0)).toFixed(2)}%`, up };
  });
  if (!items.length) return null;
  return (
    <div style={{ background:"#000", borderBottom:"2px solid #00ff88", padding:"6px 0", overflow:"hidden", flexShrink:0 }}>
      <div style={{ display:"flex", gap:"60px", animation:"ticker 50s linear infinite", whiteSpace:"nowrap", width:"max-content" }}>
        {[...items,...items].map((item,i) => (
          <span key={i} style={{ fontSize:"11px", fontWeight:"bold", color:item.up?"#00ff88":"#ff4444", letterSpacing:"2px", fontFamily:"'Courier New',monospace" }}>
            {item.up?"▲":"▼"} {item.text}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── STOCK PANEL ───────────────────────────────────────────────────────────────
function StockPanel({ stockData, lastUpdated, onRefresh, loading, apiKey, setApiKey }) {
  const [keyInput, setKeyInput] = useState("");

  if (!apiKey) {
    return (
      <div style={{ width:"240px", flexShrink:0, borderLeft:"2px solid #00ff88", background:"#000", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"20px", gap:"12px" }}>
        <div style={{ fontSize:"28px" }}>📈</div>
        <div style={{ fontSize:"11px", color:"#00ff88", letterSpacing:"3px", fontWeight:"bold", textAlign:"center" }}>MARKET DATA</div>
        <div style={{ fontSize:"10px", color:"#888", lineHeight:1.8, textAlign:"center" }}>
          FREE KEY AT<br/>
          <a href="https://twelvedata.com" target="_blank" rel="noreferrer" style={{ color:"#00ff88", fontWeight:"bold" }}>TWELVEDATA.COM</a><br/>
          <span style={{ fontSize:"9px", color:"#555" }}>800 REQ/DAY · NO CARD</span>
        </div>
        <input
          value={keyInput}
          onChange={e=>setKeyInput(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter"&&keyInput.trim()){ localStorage.setItem("td_key",keyInput.trim()); setApiKey(keyInput.trim()); }}}
          placeholder="PASTE API KEY..."
          style={{ width:"100%", background:"#0a0a0a", border:"2px solid #00ff8844", borderRadius:"0", padding:"8px 10px", color:"#00ff88", fontFamily:"'Courier New',monospace", fontSize:"10px", outline:"none", letterSpacing:"1px" }}
        />
        <button
          onClick={()=>{ if(keyInput.trim()){ localStorage.setItem("td_key",keyInput.trim()); setApiKey(keyInput.trim()); }}}
          style={{ width:"100%", background:"#00ff88", border:"none", padding:"10px", color:"#000", fontFamily:"'Courier New',monospace", fontSize:"11px", fontWeight:"bold", cursor:"pointer", letterSpacing:"3px" }}>
          ACTIVATE
        </button>
      </div>
    );
  }

  return (
    <div style={{ width:"240px", flexShrink:0, borderLeft:"2px solid #00ff88", background:"#000", overflowY:"auto", display:"flex", flexDirection:"column" }}>
      {/* Panel header */}
      <div style={{ padding:"12px 14px", borderBottom:"1px solid #00ff8833", display:"flex", alignItems:"center", justifyContent:"space-between", background:"#001a0a", flexShrink:0 }}>
        <div>
          <div style={{ fontSize:"10px", color:"#00ff88", letterSpacing:"3px", fontWeight:"bold" }}>LIVE MARKETS</div>
          {lastUpdated && <div style={{ fontSize:"8px", color:"#446644", marginTop:"2px" }}>{lastUpdated}</div>}
        </div>
        <div style={{ display:"flex", gap:"6px" }}>
          <button onClick={onRefresh} disabled={loading} style={{ background:"transparent", border:"1px solid #00ff88", color:"#00ff88", padding:"4px 10px", cursor:"pointer", fontFamily:"'Courier New',monospace", fontSize:"10px", fontWeight:"bold", opacity:loading?.5:1 }}>
            {loading?"...":"↺"}
          </button>
          <button onClick={()=>{ localStorage.removeItem("td_key"); setApiKey(""); }} style={{ background:"transparent", border:"1px solid #333", color:"#555", padding:"4px 8px", cursor:"pointer", fontFamily:"inherit", fontSize:"9px" }}>✕</button>
        </div>
      </div>

      <div style={{ padding:"12px", flex:1 }}>
        {GROUPS.map(group => (
          <div key={group} style={{ marginBottom:"20px" }}>
            {/* Group label */}
            <div style={{ fontSize:"9px", color:"#00ff88", letterSpacing:"4px", fontWeight:"bold", marginBottom:"8px", borderBottom:"1px solid #00ff8822", paddingBottom:"4px" }}>
              ── {group}
            </div>
            {STOCKS.filter(s=>s.group===group).map(s => {
              const d = stockData[s.symbol];
              const price = d?.price;
              const changePct = d?.changePct;
              const up = changePct!=null ? parseFloat(changePct)>=0 : null;
              return (
                <div key={s.symbol} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 6px", marginBottom:"3px", borderLeft:`2px solid ${up===null?"#333":up?"#00ff88":"#ff4444"}`, paddingLeft:"10px", background:"#050f08" }}>
                  <div style={{ fontSize:"10px", color:"#aabbaa", fontWeight:"bold", letterSpacing:"1px" }}>{s.name}</div>
                  <div style={{ textAlign:"right" }}>
                    {loading && !price && <div style={{ fontSize:"10px", color:"#444", animation:"pulse 1s infinite" }}>···</div>}
                    {!loading && !price && <div style={{ fontSize:"11px", color:"#333", fontWeight:"bold" }}>—</div>}
                    {price && (
                      <>
                        <div style={{ fontSize:"11px", fontWeight:"bold", color:"#ffffff", letterSpacing:"1px" }}>{fmtPrice(price,s.currency)}</div>
                        {changePct!=null && (
                          <div style={{ fontSize:"10px", fontWeight:"bold", color:up?"#00ff88":"#ff4444", letterSpacing:"1px" }}>
                            {up?"▲":"▼"}{Math.abs(parseFloat(changePct)).toFixed(2)}%
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab,    setActiveTab]    = useState(null);
  const [feedData,     setFeedData]     = useState({});
  const [loading,      setLoading]      = useState({});
  const [timestamps,   setTimestamps]   = useState({});
  const [globalRisk,   setGlobalRisk]   = useState("LOW");
  const [stockData,    setStockData]    = useState({});
  const [stockLoading, setStockLoading] = useState(false);
  const [stockUpdated, setStockUpdated] = useState(null);
  const [apiKey,       setApiKey]       = useState(localStorage.getItem("td_key")||"");
  const [ticker,       setTicker]       = useState([
    "YOUR HIGHNESS — STRATEGIC INTELLIGENCE DASHBOARD ACTIVE",
    "MONITORING: TRUMP · AMBANI · ADANI · GEOPOLITICAL · MARKETS",
    "RELIANCE · ADANI · SENSEX · S&P 500 · GOLD · OIL · BTC",
  ]);

  const activeCat   = CATEGORIES.find(c=>c.id===activeTab);
  const currentData = activeTab ? feedData[activeTab] : null;

  const loadStocks = useCallback(async () => {
    if (!apiKey) return;
    setStockLoading(true);
    try {
      const symbols = STOCKS.map(s=>s.symbol).join(",");
      const res = await fetch(TWELVE_CHANGE_URL(symbols, apiKey));
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      if (data.status==="error") throw new Error(data.message);
      const newData = {};
      STOCKS.forEach(s => {
        const q = data[s.symbol];
        if (!q||q.status==="error") return;
        newData[s.symbol] = { price:q.close||q.price, change:q.change, changePct:q.percent_change };
      });
      setStockData(newData);
      setStockUpdated(new Date().toLocaleTimeString());
    } catch(err) { console.error("Stock error:", err.message); }
    setStockLoading(false);
  }, [apiKey]);

  useEffect(() => {
    if (apiKey) { loadStocks(); const t=setInterval(loadStocks,300000); return ()=>clearInterval(t); }
  }, [apiKey, loadStocks]);

  useEffect(() => {
    if (!activeTab) return;
    const cat = CATEGORIES.find(c=>c.id===activeTab);
    const t = setInterval(()=>cat&&loadFeed(cat), 600000);
    return ()=>clearInterval(t);
  }, [activeTab]);

  async function loadFeed(cat) {
    if (loading[cat.id]) return;
    setLoading(p=>({...p,[cat.id]:true}));
    setActiveTab(cat.id);
    try {
      const results = [];
      for (const feedUrl of cat.feeds) {
        try {
          const res = await fetch(RSS(feedUrl));
          if (!res.ok) continue;
          const data = await res.json();
          if (data.status!=="ok"||!data.items?.length) continue;
          results.push(...data.items);
        } catch { continue; }
      }
      if (!results.length) throw new Error("NO SIGNAL — CANNOT REACH NEWS FEEDS");
      const seen = new Set();
      const articles = results
        .filter(a=>{ if(!a.title||seen.has(a.title)) return false; seen.add(a.title); return true; })
        .sort((a,b)=>new Date(b.pubDate||0)-new Date(a.pubDate||0))
        .slice(0,10);
      const risk = getRisk(articles);
      setFeedData(p=>({...p,[cat.id]:{articles,risk}}));
      setTimestamps(p=>({...p,[cat.id]:new Date().toLocaleTimeString()}));
      setGlobalRisk(p=>{ const o=["CRITICAL","HIGH","MODERATE","LOW"]; return o[Math.min(o.indexOf(p),o.indexOf(risk))]; });
      setTicker(p=>[`${cat.icon} ${cat.label} — ${articles.length} LIVE ARTICLES — RISK: ${risk}`, ...p.slice(0,5)]);
    } catch(err) { setFeedData(p=>({...p,[cat.id]:{error:true,msg:err.message}})); }
    setLoading(p=>({...p,[cat.id]:false}));
  }

  return (
    <div style={{ minHeight:"100vh", background:"#030805", color:"#e8ffe8", fontFamily:"'Courier New',monospace", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <style>{`
        @keyframes ticker  { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.2} }
        @keyframes fadein  { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes scanline {
          0%  { background-position: 0 0; }
          100%{ background-position: 0 100%; }
        }
        .cbtn:hover { background:rgba(0,255,136,.08)!important; border-color:#00ff88!important; }
        .acard { transition:transform .12s, border-color .12s; }
        .acard:hover { transform:translateX(4px); border-left-color:#00ff88!important; }
        a { text-decoration:none; color:inherit; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-thumb { background:#00ff8833; }
        ::-webkit-scrollbar-track { background:#000; }
        ::selection { background:#00ff8833; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ borderBottom:"2px solid #00ff88", padding:"0", background:"#000", flexShrink:0, position:"relative", overflow:"hidden" }}>
        {/* Scanline overlay */}
        <div style={{ position:"absolute", inset:0, backgroundImage:"repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,136,.03) 2px, rgba(0,255,136,.03) 4px)", pointerEvents:"none", zIndex:1 }} />

        <div style={{ padding:"14px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"relative", zIndex:2 }}>
          <div>
            <div style={{ fontSize:"9px", letterSpacing:"5px", color:"#00ff88", marginBottom:"4px", opacity:.7 }}>
              ▸ HOUSE OF OMMI &amp; BEAUMONT · STRATEGIC INTELLIGENCE UNIT · CLASSIFIED
            </div>
            <div style={{ fontSize:"22px", fontWeight:"bold", letterSpacing:"6px", color:"#ffffff", textShadow:"0 0 20px #00ff8866, 0 0 40px #00ff8833" }}>
              GLOBAL POWER TRACKER
            </div>
            <div style={{ fontSize:"9px", letterSpacing:"3px", color:"#00ff8866", marginTop:"4px" }}>
              TRUMP · AMBANI · ADANI · GEOPOLITICAL · MARKETS
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:"9px", color:"#446644", letterSpacing:"3px", marginBottom:"6px" }}>COMPOSITE RISK INDEX</div>
            <div style={{ fontSize:"20px", fontWeight:"bold", letterSpacing:"4px", color:RISK_COLOR[globalRisk], textShadow:`0 0 20px ${RISK_COLOR[globalRisk]}` }}>
              ■ {globalRisk}
            </div>
            <div style={{ fontSize:"9px", color:"#446644", letterSpacing:"2px", marginTop:"4px" }}>
              <span style={{ animation:"blink 1s infinite", color:"#00ff88" }}>●</span> ONLINE
            </div>
          </div>
        </div>
      </div>

      {/* ── NEWS TICKER ── */}
      <div style={{ background:"#001a0a", borderBottom:"1px solid #00ff8833", padding:"6px 0", overflow:"hidden", flexShrink:0 }}>
        <div style={{ display:"flex", gap:"80px", animation:"ticker 35s linear infinite", whiteSpace:"nowrap", width:"max-content" }}>
          {[...ticker,...ticker].map((t,i) => (
            <span key={i} style={{ fontSize:"10px", color:"#00ff88", letterSpacing:"2px", fontWeight:"bold" }}>◆ {t}</span>
          ))}
        </div>
      </div>

      {/* ── STOCK PRICE TICKER ── */}
      <StockBar stockData={stockData} />

      {/* ── BODY ── */}
      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* SIDEBAR */}
        <div style={{ width:"220px", flexShrink:0, borderRight:"2px solid #00ff8833", padding:"16px 10px", display:"flex", flexDirection:"column", gap:"4px", background:"#000", overflowY:"auto" }}>
          <div style={{ fontSize:"9px", color:"#00ff88", letterSpacing:"4px", fontWeight:"bold", padding:"0 6px", marginBottom:"10px", borderBottom:"1px solid #00ff8822", paddingBottom:"8px" }}>
            ── INTEL FEEDS
          </div>

          {CATEGORIES.map(cat => {
            const isActive = activeTab===cat.id;
            const d = feedData[cat.id];
            return (
              <button key={cat.id} className="cbtn" onClick={()=>loadFeed(cat)} style={{ background:isActive?"#001a0a":"transparent", border:`1px solid ${isActive?cat.color:"#00ff8818"}`, borderLeft:`3px solid ${isActive?cat.color:"#00ff8818"}`, padding:"12px 12px", cursor:"pointer", textAlign:"left", fontFamily:"inherit", display:"flex", alignItems:"center", gap:"10px", transition:"all .15s", color:"#e8ffe8", width:"100%" }}>
                <span style={{ fontSize:"14px" }}>{cat.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:"10px", fontWeight:"bold", marginBottom:"3px", color:isActive?"#ffffff":cat.color, letterSpacing:"1px" }}>{cat.label}</div>
                  {loading[cat.id] && <div style={{ fontSize:"8px", color:"#00ff88", animation:"pulse 1s infinite", letterSpacing:"2px" }}>SCANNING...</div>}
                  {!loading[cat.id] && d && !d.error && (
                    <div style={{ fontSize:"8px", color:RISK_COLOR[d.risk], letterSpacing:"1px", fontWeight:"bold" }}>
                      ■ {d.risk} · {timestamps[cat.id]}
                    </div>
                  )}
                  {!loading[cat.id] && d?.error && <div style={{ fontSize:"8px", color:"#ff4444", letterSpacing:"1px" }}>⚠ SIGNAL LOST</div>}
                </div>
              </button>
            );
          })}

          <div style={{ marginTop:"auto", padding:"12px 8px", background:"#001a0a", border:"1px solid #00ff8833" }}>
            <div style={{ fontSize:"8px", color:"#446644", letterSpacing:"3px", marginBottom:"6px" }}>FEEDS ACTIVE</div>
            <div style={{ fontSize:"24px", fontWeight:"bold", color:"#00ff88", textShadow:"0 0 10px #00ff8866" }}>
              {Object.values(feedData).filter(d=>d&&!d.error).length}
              <span style={{ fontSize:"12px", color:"#446644", fontWeight:"normal" }}> / {CATEGORIES.length}</span>
            </div>
          </div>
        </div>

        {/* MAIN PANEL */}
        <div style={{ flex:1, overflowY:"auto", padding:"24px", position:"relative" }}>
          {/* Subtle scanline texture */}
          <div style={{ position:"fixed", inset:0, backgroundImage:"repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,136,.008) 3px, rgba(0,255,136,.008) 4px)", pointerEvents:"none", zIndex:0 }} />

          {/* Welcome */}
          {!activeTab && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:"28px", animation:"fadein .5s ease", position:"relative", zIndex:1 }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:"60px", marginBottom:"8px", filter:"drop-shadow(0 0 20px #00ff88)" }}>🛰️</div>
                <div style={{ fontSize:"16px", color:"#ffffff", letterSpacing:"6px", fontWeight:"bold", marginBottom:"6px" }}>
                  SELECT INTELLIGENCE FEED
                </div>
                <div style={{ fontSize:"10px", color:"#446644", letterSpacing:"3px" }}>
                  LIVE NEWS · LIVE PRICES · AUTO-REFRESH 5–10 MIN
                </div>
              </div>
              <div style={{ display:"flex", gap:"10px", flexWrap:"wrap", justifyContent:"center" }}>
                {CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={()=>loadFeed(cat)} style={{ background:"#000", border:`2px solid ${cat.color}`, padding:"12px 20px", color:cat.color, cursor:"pointer", fontFamily:"inherit", fontSize:"11px", letterSpacing:"2px", fontWeight:"bold", transition:"all .15s" }}
                    onMouseEnter={e=>{ e.currentTarget.style.background=cat.color; e.currentTarget.style.color="#000"; }}
                    onMouseLeave={e=>{ e.currentTarget.style.background="#000"; e.currentTarget.style.color=cat.color; }}>
                    {cat.icon} {cat.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Spinner */}
          {activeTab && loading[activeTab] && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"60%", gap:"20px", position:"relative", zIndex:1 }}>
              <div style={{ width:"40px", height:"40px", border:`2px solid ${activeCat?.color}`, borderTopColor:"transparent", borderRadius:"50%", animation:"spin .7s linear infinite" }} />
              <div style={{ fontSize:"11px", color:"#00ff88", letterSpacing:"5px", fontWeight:"bold", animation:"pulse 1.5s infinite" }}>
                ACQUIRING SIGNAL...
              </div>
            </div>
          )}

          {/* Error */}
          {activeTab && !loading[activeTab] && currentData?.error && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"60%", gap:"16px", position:"relative", zIndex:1 }}>
              <div style={{ fontSize:"11px", color:"#ff4444", letterSpacing:"5px", fontWeight:"bold" }}>⚠ SIGNAL LOST</div>
              <div style={{ fontSize:"11px", color:"#664444", maxWidth:"460px", textAlign:"center", padding:"14px 18px", background:"#0a0000", border:"1px solid #ff444433", lineHeight:1.8, letterSpacing:"1px" }}>
                {currentData.msg}
              </div>
              <button onClick={()=>activeCat&&loadFeed(activeCat)} style={{ background:"transparent", border:"2px solid #ff4444", color:"#ff4444", padding:"10px 24px", cursor:"pointer", fontFamily:"inherit", fontSize:"11px", letterSpacing:"3px", fontWeight:"bold" }}>
                ↺ REACQUIRE
              </button>
            </div>
          )}

          {/* Intel feed */}
          {activeTab && !loading[activeTab] && currentData && !currentData.error && (
            <div style={{ animation:"fadein .3s ease", position:"relative", zIndex:1 }}>

              {/* Feed header */}
              <div style={{ display:"flex", gap:"20px", marginBottom:"24px", alignItems:"flex-start" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:"9px", color:"#446644", letterSpacing:"4px", marginBottom:"8px" }}>
                    {activeCat?.icon} {activeCat?.label} · LIVE FEED · {currentData.articles?.length} ARTICLES · {timestamps[activeTab]}
                  </div>
                  <div style={{ fontSize:"13px", lineHeight:1.7, color:"#aaccaa", borderLeft:`3px solid ${activeCat?.color}`, paddingLeft:"16px", letterSpacing:"0.5px" }}>
                    Live intelligence sourced from BBC and NYT. Risk index calculated from real-time headline analysis.
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:"8px", alignItems:"flex-end", flexShrink:0 }}>
                  <div style={{ padding:"12px 20px", background:RISK_BG[currentData.risk], border:`2px solid ${RISK_COLOR[currentData.risk]}`, textAlign:"center", minWidth:"100px" }}>
                    <div style={{ fontSize:"8px", color:"#446644", letterSpacing:"3px", marginBottom:"4px" }}>RISK</div>
                    <div style={{ fontSize:"15px", fontWeight:"bold", color:RISK_COLOR[currentData.risk], letterSpacing:"3px", textShadow:`0 0 10px ${RISK_COLOR[currentData.risk]}` }}>
                      {currentData.risk}
                    </div>
                  </div>
                  <button onClick={()=>activeCat&&loadFeed(activeCat)} style={{ background:"transparent", border:`1px solid ${activeCat?.color}66`, color:activeCat?.color, padding:"7px 16px", cursor:"pointer", fontFamily:"inherit", fontSize:"10px", letterSpacing:"2px", fontWeight:"bold" }}>
                    ↺ REFRESH
                  </button>
                </div>
              </div>

              {/* Articles */}
              <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                {(currentData.articles||[]).map((a,i) => {
                  const sig = getSignal(a.title, a.description);
                  return (
                    <a key={i} href={a.link} target="_blank" rel="noreferrer">
                      <div className="acard" style={{ background:"#000", border:`1px solid #00ff8818`, borderLeft:`3px solid #00ff8833`, padding:"14px 18px", animation:`fadein .3s ease ${i*.05}s both` }}>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:"10px", marginBottom:"8px", alignItems:"center" }}>
                          <span style={{ fontSize:"10px", fontWeight:"bold", color:sig.color, letterSpacing:"2px" }}>{sig.icon} {sig.label}</span>
                          <span style={{ fontSize:"9px", color:"#334433", letterSpacing:"1px", marginLeft:"auto" }}>{timeAgo(a.pubDate)}</span>
                        </div>
                        <div style={{ fontSize:"13px", fontWeight:"bold", color:"#ffffff", marginBottom:"6px", lineHeight:1.5, letterSpacing:"0.5px" }}>{a.title}</div>
                        <div style={{ fontSize:"11px", color:"#667766", lineHeight:1.7, letterSpacing:"0.3px" }}>
                          {(a.description||"").replace(/<[^>]*>/g,"").slice(0,220)}
                          {(a.description||"").length>220?"…":""}
                        </div>
                        <div style={{ fontSize:"9px", color:`${activeCat?.color}99`, marginTop:"8px", letterSpacing:"2px", fontWeight:"bold" }}>
                          READ FULL REPORT →
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* STOCK PRICES PANEL */}
        <StockPanel
          stockData={stockData}
          lastUpdated={stockUpdated}
          onRefresh={loadStocks}
          loading={stockLoading}
          apiKey={apiKey}
          setApiKey={setApiKey}
        />
      </div>
    </div>
  );
}
