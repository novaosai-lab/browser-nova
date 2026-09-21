import fs from 'fs';
import path from 'path';
import os from 'os';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log('\n🚀 Browser Nova CLI');

  // Discover local server info
  const possiblePaths = [
    path.join(os.homedir(), 'Library', 'Application Support', 'Browser Nova', 'local-server.json'),
    path.join(os.homedir(), 'Library', 'Application Support', 'browser-nova', 'local-server.json'),
    path.join(os.homedir(), '.browser-nova', 'local-server.json'),
  ];

  let serverInfo: { port: number; token: string; url: string } | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        serverInfo = JSON.parse(fs.readFileSync(p, 'utf-8'));
        break;
      } catch {}
    }
  }

  if (command === 'run') {
    const filePath = args[1];
    if (!filePath) {
      console.error('Usage: nova-cli run <workflow.json>');
      process.exit(1);
    }

    if (!fs.existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }

    const workflow = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    if (!serverInfo) {
      console.error('Error: Browser Nova is not running or local control server was not found.');
      console.log('Please launch Browser Nova first.');
      process.exit(1);
    }

    console.log(`Running workflow "${workflow.name}" on ${serverInfo.url}...`);

    const res = await fetch(`${serverInfo.url}/run-workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serverInfo.token}`,
      },
      body: JSON.stringify({ workflow }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Execution failed:', err);
      process.exit(1);
    }

    const report = await res.json();
    console.log('\n✅ Workflow Run Report:');
    console.log(`Status: ${report.status}`);
    console.log(`Duration: ${report.finishedAt - report.startedAt}ms`);
    console.log(`Steps:`);
    report.steps.forEach((s: any) => {
      console.log(`  - [${s.status.toUpperCase()}] ${s.action} (${s.durationMs}ms) ${s.error ? `Error: ${s.error}` : ''}`);
    });

    if (report.status === 'completed') {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } else if (command === 'status' || command === 'tabs') {
    if (!serverInfo) {
      console.log('Status: Browser Nova is offline.');
      process.exit(0);
    }

    const res = await fetch(`${serverInfo.url}/tabs`, {
      headers: { Authorization: `Bearer ${serverInfo.token}` },
    });
    const tabs = await res.json();
    console.log(`Status: Connected (Port ${serverInfo.port})`);
    console.log(`Active Tabs: ${tabs.length}`);
    tabs.forEach((t: any) => {
      console.log(`  - [${t.securityStatus.toUpperCase()}] ${t.title} (${t.url})`);
    });
  } else {
    console.log('Commands:');
    console.log('  nova-cli run <workflow.json>    Run a workflow on the active tab');
    console.log('  nova-cli status                 View connected browser tabs');
  }
}

main().catch((err) => {
  console.error('CLI Error:', err);
  process.exit(1);
});
