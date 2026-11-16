import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import customersRoutes from './routes/customers.js';
import companyRoutes from './routes/company.js';
import receiptsRoutes from './routes/receipts.js';
import issuesRoutes from './routes/issues.js';
import stockRoutes from './routes/stock.js';
import taxRoutes from './routes/tax.js';
import expensesRoutes from './routes/expenses.js';
import carsRoutes from './routes/cars.js';
import auditRoutes from './routes/audit.js';
import attachmentsRoutes from './routes/attachments.js';
import scansRoutes from './routes/scans.js';
import { startScanConsumer } from './services/scan-consumer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = Fastify({ logger: true });

app.register(multipart, {
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
});

app.get('/api/health', async () => {
  const row = db.prepare('SELECT COUNT(*) AS c FROM customers').get();
  return { ok: true, customers: row.c, time: new Date().toISOString() };
});

app.register(customersRoutes, { prefix: '/api/customers' });
app.register(companyRoutes, { prefix: '/api/company' });
app.register(receiptsRoutes, { prefix: '/api/receipts' });
app.register(issuesRoutes, { prefix: '/api/issues' });
app.register(stockRoutes, { prefix: '/api/stock' });
app.register(taxRoutes, { prefix: '/api/tax' });
app.register(expensesRoutes, { prefix: '/api/expenses' });
app.register(carsRoutes, { prefix: '/api/cars' });
app.register(auditRoutes, { prefix: '/api/audit' });
app.register(attachmentsRoutes, { prefix: '/api/attachments' });
app.register(scansRoutes, { prefix: '/api/scans' });

if (process.env.SERVE_WEB === '1') {
  const webDist = path.join(__dirname, '..', '..', 'web', 'dist');
  if (!fs.existsSync(webDist)) {
    app.log.warn('web/dist 不存在，请先运行 npm run build');
  } else {
    app.register(fastifyStatic, { root: webDist, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api')) {
        reply.code(404).send({ error: 'Not found' });
      } else {
        reply.sendFile('index.html');
      }
    });
  }
}

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const sslCert = process.env.SSL_CERTFILE;
const sslKey = process.env.SSL_KEYFILE;
const useHttps = sslCert && sslKey && fs.existsSync(sslCert) && fs.existsSync(sslKey);

const listenOptions = { port, host };
if (useHttps) {
  listenOptions.https = {
    cert: fs.readFileSync(sslCert),
    key: fs.readFileSync(sslKey),
  };
}

app.listen(listenOptions).then(() => {
  const protocol = useHttps ? 'https' : 'http';
  app.log.info(`Server on ${protocol}://${host}:${port}`);
  startScanConsumer(3000);
});