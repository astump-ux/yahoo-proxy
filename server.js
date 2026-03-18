// yahoo-proxy/server.js
// Deploy on Render.com as a Node.js Web Service
// Start command: node server.js

const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;

// Fetch from Yahoo Finance with browser-like headers
function fetchYahoo(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': 'https://finance.yahoo.com',
        'Referer': 'https://finance.yahoo.com/',
      }
    };
    https.get(url, options, (res) => {
      let data = '';
      // Handle gzip
      let stream = res;
      if (res.headers['content-encoding'] === 'gzip') {
        const zlib = require('zlib');
        stream = res.pipe(zlib.createGunzip());
      }
      stream.on('data', chunk => data += chunk);
      stream.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Yahoo returned non-JSON: ' + data.slice(0, 100))); }
      });
    }).on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // /quotes?symbols=AAPL,MSFT,1810.HK
  if (url.pathname === '/quotes') {
    const symbols = url.searchParams.get('symbols');
    if (!symbols) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'symbols param required' }));
      return;
    }
    try {
      const data = await fetchYahoo(
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&fields=regularMarketPrice,regularMarketChangePercent`
      );
      res.writeHead(200);
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // /spark?symbols=AAPL,MSFT&range=8d&interval=1d
  if (url.pathname === '/spark') {
    const symbols = url.searchParams.get('symbols');
    const range = url.searchParams.get('range') || '8d';
    const interval = url.searchParams.get('interval') || '1d';
    if (!symbols) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'symbols param required' }));
      return;
    }
    try {
      const data = await fetchYahoo(
        `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${encodeURIComponent(symbols)}&range=${range}&interval=${interval}`
      );
      res.writeHead(200);
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found. Use /quotes or /spark or /health' }));
});

server.listen(PORT, () => {
  console.log(`Yahoo proxy running on port ${PORT}`);
});
