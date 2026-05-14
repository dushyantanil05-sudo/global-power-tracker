// api/stocks.js — Vercel serverless function
// Runs on the server, no CORS issues, fetches Yahoo Finance data
export default async function handler(req, res) {
  // Allow requests from your own site
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const symbols = [
    "RELIANCE.NS",  // Reliance Industries (Ambani)
    "ADANIENT.NS",  // Adani Enterprises
    "ADANIPORTS.NS",// Adani Ports
    "^BSESN",       // BSE Sensex
    "^NSEI",        // Nifty 50
    "^GSPC",        // S&P 500
    "^DJI",         // Dow Jones
    "^IXIC",        // NASDAQ
    "GC=F",         // Gold
    "CL=F",         // Crude Oil
    "DX-Y.NYB",     // US Dollar Index
    "BTC-USD",      // Bitcoin
  ].join(",");

  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=symbol,shortName,regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,currency,marketState`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });

    if (!response.ok) throw new Error(`Yahoo Finance returned ${response.status}`);

    const data = await response.json();
    const quotes = data?.quoteResponse?.result || [];

    const formatted = quotes.map(q => ({
      symbol:      q.symbol,
      name:        q.shortName || q.symbol,
      price:       q.regularMarketPrice,
      change:      q.regularMarketChange,
      changePct:   q.regularMarketChangePercent,
      prevClose:   q.regularMarketPreviousClose,
      currency:    q.currency,
      marketState: q.marketState,
    }));

    res.status(200).json({ success: true, quotes: formatted, timestamp: Date.now() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
