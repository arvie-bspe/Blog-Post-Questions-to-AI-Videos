import {createServer} from 'node:http';

// Used only during a controlled volume migration. It never opens the database
// or starts background work, so the stored review and render state stays intact.
createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  if (req.url === '/health') return res.end('Migration service ready');
  const destination = process.env.STUDIO_REDIRECT_ORIGIN;
  if (destination && req.method === 'GET' && req.url === '/') {
    res.writeHead(302, {Location: new URL('/', destination).href});
    return res.end('Article Video Studio has moved.');
  }
  res.writeHead(503, {'Retry-After': '60'});
  res.end('Article Video Studio is moving to its new Railway project. Saved work is preserved. Please reload shortly.');
}).listen(Number(process.env.PORT || 8080), '0.0.0.0');
