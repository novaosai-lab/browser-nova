import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { TabManager } from './tab-manager';
import { EvidenceCollector } from '../automation/evidence';

export class LocalControlServer {
  private server: http.Server | null = null;
  private token: string;
  private port = 0;

  constructor(
    private tabManager: TabManager,
    private evidence: EvidenceCollector,
    private configDir: string
  ) {
    this.token = crypto.randomBytes(24).toString('hex');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
  }

  public start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        // Enforce loopback only
        const remoteIp = req.socket.remoteAddress;
        if (remoteIp !== '127.0.0.1' && remoteIp !== '::1' && remoteIp !== '::ffff:127.0.0.1') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden' }));
          return;
        }

        // Validate Token
        const authHeader = req.headers.authorization;
        if (!authHeader || authHeader !== `Bearer ${this.token}`) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized: invalid or missing Bearer token' }));
          return;
        }

        const url = new URL(req.url || '/', `http://127.0.0.1:${this.port}`);
        const method = req.method;

        // Route: GET /tabs
        if (method === 'GET' && url.pathname === '/tabs') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(this.tabManager.getAllTabs()));
          return;
        }

        // Route: POST /run-workflow
        if (method === 'POST' && url.pathname === '/run-workflow') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', async () => {
            try {
              const { tabId, workflow } = JSON.parse(body);
              const targetTab = tabId ? this.tabManager.getTab(tabId) : this.tabManager.getActiveTab();
              if (!targetTab) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Target tab not found' }));
                return;
              }

              const report = await targetTab.runner.runWorkflow(workflow, targetTab.info.url);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(report));
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // Route: GET /reports
        if (method === 'GET' && url.pathname === '/reports') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(this.evidence.getReports()));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint not found' }));
      });

      this.server.once('error', reject);
      this.server.listen(0, '127.0.0.1', () => {
        this.port = (this.server!.address() as import('net').AddressInfo).port;
        // Write info to config file for CLI discovery
        const infoPath = path.join(this.configDir, 'local-server.json');
        fs.writeFileSync(
          infoPath,
          JSON.stringify({ port: this.port, token: this.token, url: `http://127.0.0.1:${this.port}` }, null, 2),
          { encoding: 'utf-8', mode: 0o600 }
        );
        resolve(this.port);
      });
    });
  }

  public stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
      const infoPath = path.join(this.configDir, 'local-server.json');
      try {
        const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
        if (info.token === this.token) fs.unlinkSync(infoPath);
      } catch { /* Nothing to clean up after a failed start. */ }
    }
  }
}
