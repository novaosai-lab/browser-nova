import { normalizeUrl, evaluateSecurityStatus } from '../../src/main/navigation';
import { MockAdapter } from '../../src/ai/adapters/mock-adapter';
import { createFixtureServer } from '../fixtures/server';
import http from 'http';

async function runSmokeTests() {
  console.log('🧪 Starting Browser Nova Smoke Tests...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Test Navigation & HTTP handling (PLAN.md Acceptance Criteria lines 11-23, 133)
  console.log('1. Navigation & HTTP Security Status:');
  const httpUrl = normalizeUrl('http://127.0.0.1:8080/search');
  assert(httpUrl === 'http://127.0.0.1:8080/search', 'Strict HTTP URLs must preserve http:// scheme without forcing https');

  const httpSec = evaluateSecurityStatus(httpUrl);
  assert(httpSec.isHttp === true, 'HTTP URL is marked as isHttp: true');
  assert(httpSec.isSecure === false, 'HTTP URL is marked as isSecure: false');
  assert(httpSec.securityStatus === 'http', 'HTTP URL has securityStatus: "http"');
  assert(httpSec.badgeText.includes('HTTP'), 'HTTP URL badge displays HTTP indicator');

  const httpsUrl = normalizeUrl('https://example.com');
  const httpsSec = evaluateSecurityStatus(httpsUrl);
  assert(httpsSec.isSecure === true && httpsSec.securityStatus === 'https', 'HTTPS URL has securityStatus: "https"');

  const localBare = normalizeUrl('127.0.0.1:8080');
  assert(localBare === 'http://127.0.0.1:8080', 'Bare IP/localhost defaults to http://');

  // 2. Test Fixture Server
  console.log('\n2. Fixture Server on http://127.0.0.1:8080:');
  const server = createFixtureServer(8080);
  await new Promise((r) => setTimeout(r, 500));

  const checkEndpoint = (path: string): Promise<{ status: number; body: string }> => {
    return new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:8080${path}`, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode || 0, body }));
      }).on('error', reject);
    });
  };

  try {
    const rootRes = await checkEndpoint('/');
    assert(rootRes.status === 200 && rootRes.body.includes('Browser Nova Test Fixture'), 'Root fixture page loads with 200 OK');

    const searchRes = await checkEndpoint('/search');
    assert(searchRes.status === 200 && searchRes.body.includes('data-testid="search"'), 'Search fixture contains [data-testid=search]');
    assert(searchRes.body.includes('data-testid="submit"'), 'Search fixture contains [data-testid=submit]');
    assert(searchRes.body.includes('data-testid="result"'), 'Search fixture contains [data-testid=result]');

    const tableRes = await checkEndpoint('/table');
    assert(tableRes.status === 200 && tableRes.body.includes('โน้ตบุ๊ก Nova Pro 16'), 'Table fixture contains Thai UTF-8 products');

    const errRes = await checkEndpoint('/errors');
    assert(errRes.status === 200 && errRes.body.includes('จำลองข้อผิดพลาด'), 'Errors fixture loads correctly');

    const redirectRes = await checkEndpoint('/redirect');
    assert(redirectRes.status === 302, 'Redirect fixture returns HTTP 302 redirect');
  } finally {
    server.close();
  }

  // 3. Test AI Natural Language Thai Orchestrator Loop (PLAN.md Acceptance Criteria lines 85-98, 140)
  console.log('\n3. Thai Natural Language AI Tool Loop:');
  const mockAdapter = new MockAdapter();
  const mockObservation = {
    url: 'http://127.0.0.1:8080/search',
    title: 'หน้าค้นหา HTTP',
    interactiveElements: [
      { selector: '[data-testid="search"]', tagName: 'input', testid: 'search', text: '' },
      { selector: '[data-testid="submit"]', tagName: 'button', testid: 'submit', text: 'ค้นหา' },
    ],
    visibleTextSummary: 'ค้นหาข้อมูลบนระบบ HTTP',
  };

  const thaiPrompt = 'เปิดเว็บ HTTP 127.0.0.1:8080 ค้นหาคำว่า nova แล้วสรุปผลพร้อมถ่ายภาพ';

  // Step 1: fill search input
  const decision1 = await mockAdapter.generateDecision(thaiPrompt, [], mockObservation, []);
  assert(
    decision1.type === 'tool_call' && decision1.toolName === 'fill' && decision1.args.value === 'nova',
    'AI decides to call "fill" with value "nova"'
  );

  // Step 2: click submit
  const decision2 = await mockAdapter.generateDecision(
    thaiPrompt,
    [
      { role: 'user', content: thaiPrompt },
      { role: 'assistant', toolCalls: [{ id: '1', name: 'fill', args: decision1.args }] },
      { role: 'tool', toolResult: { id: '1', name: 'fill', result: true } },
    ],
    mockObservation,
    []
  );
  assert(
    decision2.type === 'tool_call' && decision2.toolName === 'click',
    'AI decides to call "click" on submit button'
  );

  // Step 3: assertText result
  const decision3 = await mockAdapter.generateDecision(
    thaiPrompt,
    [
      { role: 'user', content: thaiPrompt },
      { role: 'assistant', toolCalls: [{ id: '1', name: 'fill', args: decision1.args }] },
      { role: 'tool', toolResult: { id: '1', name: 'fill', result: true } },
      { role: 'assistant', toolCalls: [{ id: '2', name: 'click', args: decision2.args }] },
      { role: 'tool', toolResult: { id: '2', name: 'click', result: true } },
    ],
    mockObservation,
    []
  );
  assert(
    decision3.type === 'tool_call' && decision3.toolName === 'assertText' && decision3.args.contains === 'nova',
    'AI decides to call "assertText" verifying result contains "nova"'
  );

  // Step 4: screenshot
  const decision4 = await mockAdapter.generateDecision(
    thaiPrompt,
    [
      { role: 'user', content: thaiPrompt },
      { role: 'assistant', toolCalls: [{ id: '1', name: 'fill', args: decision1.args }] },
      { role: 'tool', toolResult: { id: '1', name: 'fill', result: true } },
      { role: 'assistant', toolCalls: [{ id: '2', name: 'click', args: decision2.args }] },
      { role: 'tool', toolResult: { id: '2', name: 'click', result: true } },
      { role: 'assistant', toolCalls: [{ id: '3', name: 'assertText', args: decision3.args }] },
      { role: 'tool', toolResult: { id: '3', name: 'assertText', result: true } },
    ],
    mockObservation,
    []
  );
  assert(
    decision4.type === 'tool_call' && decision4.toolName === 'screenshot',
    'AI decides to call "screenshot" to capture evidence'
  );

  // Step 5: finish
  const decision5 = await mockAdapter.generateDecision(
    thaiPrompt,
    [
      { role: 'user', content: thaiPrompt },
      { role: 'assistant', toolCalls: [{ id: '1', name: 'fill', args: decision1.args }] },
      { role: 'tool', toolResult: { id: '1', name: 'fill', result: true } },
      { role: 'assistant', toolCalls: [{ id: '2', name: 'click', args: decision2.args }] },
      { role: 'tool', toolResult: { id: '2', name: 'click', result: true } },
      { role: 'assistant', toolCalls: [{ id: '3', name: 'assertText', args: decision3.args }] },
      { role: 'tool', toolResult: { id: '3', name: 'assertText', result: true } },
      { role: 'assistant', toolCalls: [{ id: '4', name: 'screenshot', args: decision4.args }] },
      { role: 'tool', toolResult: { id: '4', name: 'screenshot', result: true } },
    ],
    mockObservation,
    []
  );
  assert(
    decision5.type === 'finish' && (decision5.message?.includes('nova') || decision5.message?.includes('สำเร็จ')),
    'AI finishes workflow with Thai summary referencing real proof'
  );

  console.log(`\n🎉 Tests Finished: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) process.exit(1);
}

runSmokeTests().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
