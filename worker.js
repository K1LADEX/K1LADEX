addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

async function handleRequest(request) {
  const url = new URL(request.url);
  const ticker = (url.searchParams.get('ticker') || '').toUpperCase();
  if (!ticker) return new Response(JSON.stringify({error:'No ticker'}), {headers:CORS});
  if (url.pathname === '/scan') return fullScan(ticker);
  if (url.pathname === '/candles') return getCandles(ticker);
  if (url.pathname === '/auth-log') return logAuth(url);
  if (url.pathname === '/debug') return debugMetrics(ticker);
  return legacyPrice(ticker);
}

async function getCandles(ticker) {
  try {
    const to = Math.floor(Date.now() / 1000);
    const from = to - 52 * 7 * 24 * 3600;
    const r = await fetch(
      `https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=W&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`
    );
    const data = await r.json();
    if (!data.c || data.s === 'no_data') throw new Error('No candle data');
    return new Response(JSON.stringify(data.c), {headers:CORS});
  } catch(e) {
    return new Response(JSON.stringify({error:e.message}), {headers:CORS});
  }
}

async function legacyPrice(ticker) {
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_API_KEY}`);
    const q = await r.json();
    if (!q.c) throw new Error('No data');
    const price = q.c;
    const prev = q.pc;
    const chg = prev ? ((price-prev)/prev*100) : 0;
    let name = ticker;
    try {
      const pr = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FINNHUB_API_KEY}`);
      const pj = await pr.json();
      if (pj.name) name = pj.name.replace(/,?\s*(Inc\.?|Corp\.?|Ltd\.?|LLC\.?|PLC\.?)$/gi,'').trim();
    } catch(e) {}
    return new Response(JSON.stringify({
      chart:{result:[{meta:{regularMarketPrice:price,chartPreviousClose:prev,longName:name}}]}
    }), {headers:CORS});
  } catch(e) {
    return new Response(JSON.stringify({error:e.message}), {headers:CORS});
  }
}

// ── FLOAT LOOKUP TABLE ───────────────────────────────────────
// Real float figures — updated on material events (offerings, warrants, ATM)
// Last updated: March 29, 2026
const FLOAT_TABLE = {
  'ONDS':   8200000,
  'GSAT':   1200000000,
  'LWLG':   131000000,
  'IBRX':   15000000,
  'DNN':    620000000,
  'MVIS':   180000000,
  'PL':     14000000,
  'TSEM':   160000000,
  'RCAT':   28000000,
  'GLNG':   95000000,
  'ERAS':   120000000,
  'NVDA':   2400000000,
  'LPTH':   32000000,
  'ASTS':   220000000,
  'LTRX':   28000000,
  'CODA':   15000000,
  'SWMR':   8000000,
  'DPRO':   12000000,
  'PLTR':   2100000000,
  'SMCI':   580000000,
  'NOW':    1050000000,
  'COIN':   240000000,
  'CRWD':   240000000,
  'AMD':    1600000000,
  'TSLA':   3100000000,
  'META':   2500000000,
  'AAPL':   15200000000,
  'MSFT':   7400000000,
  'GOOGL':  12100000000,
  'AMZN':   10500000000,
  'GME':    305000000,
  'BA':     760000000,
};

async function fullScan(ticker) {
  try {
    const [quoteRes, profileRes, metricsRes, earningsRes, candleRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_API_KEY}`),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FINNHUB_API_KEY}`),
      fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${FINNHUB_API_KEY}`),
      fetch(`https://finnhub.io/api/v1/calendar/earnings?symbol=${ticker}&from=${new Date().toISOString().split('T')[0]}&to=${new Date(Date.now()+180*24*60*60*1000).toISOString().split('T')[0]}&token=${FINNHUB_API_KEY}`),
      fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=D&from=${Math.floor((Date.now()-30*24*60*60*1000)/1000)}&to=${Math.floor(Date.now()/1000)}&token=${FINNHUB_API_KEY}`)
    ]);

    const [quote, profile, metrics, earnings, candle] = await Promise.all([
      quoteRes.json(), profileRes.json(), metricsRes.json(),
      earningsRes.json(), candleRes.json()
    ]);

    if (!quote.c) throw new Error('No Finnhub data');

    const m = metrics.metric || {};

    const currentPrice  = quote.c;
    const prevClose     = quote.pc;
    const week52Low     = m['52WeekLow'];
    const week52High    = m['52WeekHigh'];
    const ma50          = m['50DayMA'];
    const floatShares   = FLOAT_TABLE[ticker] || (profile.shareOutstanding ? profile.shareOutstanding * 1e6 : null);
    let shortPct        = m.shortInterestPercentOfFloat ? m.shortInterestPercentOfFloat/100 : null;
    if (shortPct === null) {
      try {
        const fvRes = await fetch(`https://finviz.com/quote.ashx?t=${ticker}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
        });
        const fvHtml = await fvRes.text();
        const fvMatch = fvHtml.match(/Short Float<\/a><\/td><td[^>]*>.*?([\d.]+)%/);
        if (fvMatch) shortPct = parseFloat(fvMatch[1]) / 100;
      } catch (_) { /* leave shortPct as null */ }
    }
    const totalRevenue  = m.revenuePerShareTTM && profile.shareOutstanding ? m.revenuePerShareTTM * profile.shareOutstanding * 1e6 : null;
    const revenueGrowth = m.revenueGrowthTTMYoy ? m.revenueGrowthTTMYoy/100 : null;
    const totalCash     = m.cashAndCashEquivalentsAnnual ?? m.cashAndEquivalentsAnnual ?? m.totalCashAnnual ?? m.freeCashFlowAnnual ?? null;

    let nextEarnings = null;
    const now = Date.now()/1000;
    const upcoming = (earnings.earningsCalendar || []).filter(e => {
      const d = new Date(e.date).getTime()/1000;
      return d > now;
    }).sort((a,b) => new Date(a.date)-new Date(b.date));
    if (upcoming.length) {
      nextEarnings = new Date(upcoming[0].date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    }

    let newLow30d = false;
    const lows = candle.l || [];
    if (lows.length && week52Low) {
      const recentMin = Math.min(...lows);
      newLow30d = recentMin <= week52Low * 1.002;
    }

    let nScore = 1.5, nStrikes = 0, nFlags = [], nSplitDate = null;
    try {
      const n = await checkN(ticker);
      nScore = n.score; nStrikes = n.strikes; nFlags = n.flags; nSplitDate = n.splitDate || null;
    } catch(e) { nFlags = ['Legal scan unavailable']; }

    const fmt = (n,b,s) => n>=b?(n/b).toFixed(1)+s:n>=1e6?(n/1e6).toFixed(0)+'M':n?(n/1e3).toFixed(0)+'K':'N/A';
    const surgeVal = (week52Low&&currentPrice) ? (currentPrice-week52Low)/week52Low*100 : 0;
    const change   = (prevClose&&currentPrice) ? (currentPrice-prevClose)/prevClose*100 : 0;
    const name     = (profile.name||ticker).replace(/,?\s*(Inc\.?|Corp\.?|Ltd\.?|LLC\.?|PLC\.?)$/gi,'').trim();

    // ── VERDICT LOGIC ────────────────────────────────────────
    const floatOver1B = floatShares && floatShares > 1e9;
    let totalScore = null;
    let rec, verdict, col;
    if (floatOver1B) {
      rec = 'WRONG INSTRUMENT';
      verdict = 'Wrong instrument. K1LADEX is built for geometric moves.';
      col = '#4a6888';
    } else {
      // Score is computed by caller if known; for live scans use nScore as proxy
      rec = null; verdict = null; col = null;
    }

    return new Response(JSON.stringify({
      name,
      price: '$'+currentPrice.toFixed(2),
      change: (change>=0?'+':'')+change.toFixed(2)+'%',
      currentPrice, week52Low, week52High, ma50,
      floatShares, shortPct, totalRevenue, revenueGrowth, totalCash,
      newLow30d, surgeVal,
      surgeFormatted: (surgeVal>=0?'+':'')+surgeVal.toFixed(0)+'%',
      shortPctFormatted: shortPct?(shortPct*100).toFixed(1)+'%':'N/A',
      floatFormatted: floatShares?fmt(floatShares,1e9,'B'):'N/A',
      revenueFormatted: totalRevenue?'$'+fmt(totalRevenue,1e9,'B')+' TTM':'Pre-revenue',
      nextEarnings,
      nScore, nStrikes, nFlags, splitDate: nSplitDate,
      rec, verdict, col
    }), {headers:CORS});

  } catch(e) {
    return new Response(JSON.stringify({error:e.message}), {headers:CORS});
  }
}

// ── AUTH LOGGING ─────────────────────────────────────────────
async function logAuth(url) {
  const VALID = ['LAZYGATE','DAD','DEX','KLDX'];
  const code = (url.searchParams.get('code') || '').toUpperCase();
  const ts = new Date().toISOString();
  if (VALID.includes(code)) {
    console.log(`[K1LADEX AUTH] code=${code} ts=${ts}`);
  }
  return new Response(JSON.stringify({ok: VALID.includes(code), ts}), {headers:CORS});
}

// ── DEBUG METRICS ─────────────────────────────────────────────
async function debugMetrics(ticker) {
  if (!ticker) return new Response(JSON.stringify({error:'No ticker'}), {headers:CORS});
  try {
    const r = await fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${FINNHUB_API_KEY}`);
    const data = await r.json();
    return new Response(JSON.stringify(data), {headers:CORS});
  } catch(e) {
    return new Response(JSON.stringify({error:e.message}), {headers:CORS});
  }
}

async function checkN(ticker) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version':'2023-06-01'
    },
    body: JSON.stringify({
      model:'claude-sonnet-4-20250514',
      max_tokens:700,
      tools:[{type:'web_search_20250305',name:'web_search'}],
      system:'You are the K1LADEX N checkpoint scanner. Apply the SMCI Rule: 2+ strikes = score 0. Also detect reverse stock splits. Respond ONLY with valid JSON, no other text.',
      messages:[{role:'user',content:`Search "${ticker} SEC investigation lawsuit DOJ short seller fraud class action going concern reverse stock split". Return ONLY JSON: {"strikes":<number>,"flags":["brief flag"],"score":<1.5 if clean, 1.0 if minor, 0.5 if 1 strike, 0 if 2+ strikes>,"splitDate":<"YYYY-MM-DD" of most recent reverse split or null>}`}]
    })
  });
  const data = await resp.json();
  const text = (data.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('');
  const clean = text.replace(/```json|```/g,'').trim();
  return JSON.parse(clean);
}
