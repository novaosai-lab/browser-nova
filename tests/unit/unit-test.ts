import { normalizeUrl, evaluateSecurityStatus, isProbablySearchQuery } from '../../src/main/navigation';
import { BudgetTracker } from '../../src/ai/budget';
import { NovaError, NovaErrorCode } from '../../src/shared/errors';
import { subscribeToTabState } from '../../src/renderer/tab-state';
import type { Tab, TabState } from '../../src/shared/types';

// Network-free unit tests. These exercise pure functions and the budget
// guardrails, so they run in any environment (including sandboxes that block
// binding a local port for the fixture server used by the e2e smoke test).

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

function expectThrow(fn: () => void, code: NovaErrorCode, testName: string) {
  try {
    fn();
    assert(false, `${testName} (expected throw, got none)`);
  } catch (err) {
    assert(err instanceof NovaError && err.code === code, testName);
  }
}

// 1. normalizeUrl
console.log('1. normalizeUrl:');
assert(normalizeUrl('  ') === 'about:blank', 'Blank input becomes about:blank');
assert(normalizeUrl('http://a.com') === 'http://a.com', 'Explicit http:// is preserved');
assert(normalizeUrl('https://a.com') === 'https://a.com', 'Explicit https:// is preserved');
assert(normalizeUrl('localhost:3000') === 'http://localhost:3000', 'localhost defaults to http://');
assert(normalizeUrl('127.0.0.1:8080/x') === 'http://127.0.0.1:8080/x', 'Loopback IP defaults to http://');
assert(normalizeUrl('192.168.1.5') === 'http://192.168.1.5', 'Private IP defaults to http://');
assert(normalizeUrl('example.com') === 'https://example.com', 'Bare domain defaults to https://');
assert(normalizeUrl('example.com', true) === 'http://example.com', 'preferHttp forces http:// for a bare domain');

// 1b. Omnibox search (Chrome-style): non-host input becomes a Google search.
console.log('\n1b. omnibox search:');
assert(isProbablySearchQuery('weather today') === true, 'Phrase with spaces is a search');
assert(isProbablySearchQuery('แมว') === true, 'Single bare word (no dot) is a search');
assert(isProbablySearchQuery('example.com') === false, 'Bare domain is not a search');
assert(isProbablySearchQuery('http://a.com') === false, 'Explicit URL is not a search');
assert(isProbablySearchQuery('127.0.0.1:8080') === false, 'Loopback host is not a search');
assert(
  normalizeUrl('weather today') === 'https://www.google.com/search?q=weather%20today',
  'Search phrase is routed to Google search'
);
assert(
  normalizeUrl('nova browser') === 'https://www.google.com/search?q=nova%20browser',
  'Multi-word query is URL-encoded for search'
);
assert(normalizeUrl('example.com') === 'https://example.com', 'Domain still navigates, not searched');

// 2. evaluateSecurityStatus
console.log('\n2. evaluateSecurityStatus:');
const httpsSec = evaluateSecurityStatus('https://example.com');
assert(httpsSec.isSecure && httpsSec.securityStatus === 'https', 'HTTPS URL → secure/https');

const localHttp = evaluateSecurityStatus('http://127.0.0.1:8080');
assert(localHttp.isHttp && localHttp.securityStatus === 'http', 'Loopback HTTP → http status');
assert(localHttp.badgeText.includes('เครื่องใน') || localHttp.badgeText.includes('วงใน'), 'Loopback HTTP gets the local badge');

const publicHttp = evaluateSecurityStatus('http://example.com');
assert(publicHttp.badgeText.includes('ไม่เข้ารหัส'), 'Public HTTP gets the unencrypted badge');

const internal = evaluateSecurityStatus('about:blank');
assert(internal.securityStatus === 'internal', 'about:blank → internal status');

const bad = evaluateSecurityStatus('not a url');
assert(bad.securityStatus === 'error', 'Malformed URL → error status');

// 3. BudgetTracker: action limit
console.log('\n3. BudgetTracker action limit:');
const b1 = new BudgetTracker({ maxActions: 2, maxDurationMs: 60000, requireConfirmForSensitive: false });
b1.start();
b1.recordAction('click', { i: 1 });
b1.recordAction('click', { i: 2 });
expectThrow(() => b1.recordAction('click', { i: 3 }), NovaErrorCode.BUDGET_EXCEEDED, 'Exceeding maxActions throws BUDGET_EXCEEDED');

// 4. BudgetTracker: loop detection (same action+params 3x)
console.log('\n4. BudgetTracker loop detection:');
const b2 = new BudgetTracker({ maxActions: 20, maxDurationMs: 60000, requireConfirmForSensitive: false });
b2.start();
b2.recordAction('click', { selector: '#x' });
b2.recordAction('click', { selector: '#x' });
expectThrow(() => b2.recordAction('click', { selector: '#x' }), NovaErrorCode.ACTION_FAILED, 'Same action+params 3× throws ACTION_FAILED');

// 5. BudgetTracker: sensitive-action detection
console.log('\n5. BudgetTracker sensitive detection:');
const b3 = new BudgetTracker({ maxActions: 20, maxDurationMs: 60000, requireConfirmForSensitive: true });
b3.start();
assert(b3.recordAction('click', { selector: '#checkout-btn' }).isSensitive, 'English "checkout" flagged sensitive');
assert(b3.recordAction('fill', { text: 'ยืนยันการซื้อ' }).isSensitive, 'Thai "ซื้อ" flagged sensitive');
assert(!b3.recordAction('click', { selector: '#read-more' }).isSensitive, 'Benign action not flagged');

const b4 = new BudgetTracker({ maxActions: 20, maxDurationMs: 60000, requireConfirmForSensitive: false });
b4.start();
assert(!b4.recordAction('click', { selector: '#checkout-btn' }).isSensitive, 'requireConfirmForSensitive:false disables flagging');

// Regression: the first tab arrives after renderer mount, and IPC replies can
// arrive after a newer selection event. Navigation must keep the visible tab.
console.log('\n6. Tab selection synchronization:');
const makeTab = (id: string): Tab => ({
  id, title: id, url: 'http://127.0.0.1:8080', profile: 'default',
  isLoading: false, canGoBack: false, canGoForward: false,
  isHttp: true, isSecure: false, securityStatus: 'http',
});
const emptyState: TabState = { tabs: [], activeTabId: null };
const firstState: TabState = { tabs: [makeTab('first')], activeTabId: 'first' };
const secondState: TabState = { tabs: [makeTab('first'), makeTab('second')], activeTabId: 'second' };
function makeTabSource() {
  let resolveSnapshot!: (state: TabState) => void;
  let listener: ((state: TabState) => void) | undefined;
  const snapshot = new Promise<TabState>((resolve) => { resolveSnapshot = resolve; });
  return {
    getState: () => snapshot,
    onStateChanged(callback: (state: TabState) => void) {
      listener = callback;
      return () => { listener = undefined; };
    },
    emit: (state: TabState) => listener?.(state),
    resolveSnapshot: (state: TabState) => resolveSnapshot(state),
  };
}

const delayedTab = makeTabSource();
const observed: TabState[] = [];
const disposeDelayed = subscribeToTabState(delayedTab, (state) => observed.push(state), () => assert(false, 'Unexpected tab-state error'));
delayedTab.resolveSnapshot(emptyState);
await Promise.resolve();
delayedTab.emit(firstState);
assert(observed.at(-1)?.activeTabId === 'first', 'First tab created after mount becomes the navigation target');
delayedTab.emit(secondState);
delayedTab.emit(secondState);
assert(observed.at(-1)?.tabs.length === 2 && observed.at(-1)?.activeTabId === 'second', 'Repeated updates retain one entry per tab and select the main-process target');
delayedTab.emit(firstState);
assert(observed.at(-1)?.tabs.length === 1 && observed.at(-1)?.activeTabId === 'first', 'Closing active tab applies the replacement selected by main');
const beforeDispose = observed.length;
disposeDelayed();
delayedTab.emit(emptyState);
assert(observed.length === beforeDispose, 'Unmount unsubscribes tab updates');

const racingSource = makeTabSource();
const racedStates: TabState[] = [];
const disposeRace = subscribeToTabState(racingSource, (state) => racedStates.push(state), () => assert(false, 'Unexpected snapshot error'));
racingSource.emit(secondState);
racingSource.resolveSnapshot(firstState);
await Promise.resolve();
assert(racedStates.length === 1 && racedStates[0].activeTabId === 'second', 'Stale initial IPC response cannot overwrite a newer active tab');
disposeRace();

const reloadSource = makeTabSource();
const reloadStates: TabState[] = [];
const disposeReload = subscribeToTabState(reloadSource, (state) => reloadStates.push(state), () => assert(false, 'Unexpected reload error'));
reloadSource.resolveSnapshot(secondState);
await Promise.resolve();
assert(reloadStates[0]?.activeTabId === 'second', 'Renderer reload restores the selected tab instead of defaulting to the first');
disposeReload();

const disposedSource = makeTabSource();
const disposedStates: TabState[] = [];
const disposePending = subscribeToTabState(disposedSource, (state) => disposedStates.push(state), () => assert(false, 'Unexpected disposed error'));
disposePending();
disposedSource.resolveSnapshot(firstState);
await Promise.resolve();
assert(disposedStates.length === 0, 'Pending bootstrap cannot update an unmounted renderer');

console.log(`\n🎉 Unit Tests Finished: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
