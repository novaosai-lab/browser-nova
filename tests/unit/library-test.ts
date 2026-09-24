import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { LibraryStore } from '../../src/main/library-store';
import { toCurl } from '../../src/shared/curl';
import type { NetworkRequest } from '../../src/shared/types';
import { execFileSync } from 'node:child_process';
const key = randomBytes(32);
const codec = {
  available: () => true,
  encrypt: (value: string) => { const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key, iv); const body = Buffer.concat([c.update(value), c.final()]); return Buffer.concat([iv, c.getAuthTag(), body]); },
  decrypt: (value: Buffer) => { const c = createDecipheriv('aes-256-gcm', key, value.subarray(0, 12)); c.setAuthTag(value.subarray(12,28)); return Buffer.concat([c.update(value.subarray(28)), c.final()]).toString(); },
};
test('bookmarks persist, update by URL, reject unsafe URL, and delete', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-library-'));
  try {
    const store = new LibraryStore(root, codec);
    store.bookmark('Example', 'https://example.com'); store.bookmark('Updated', 'https://example.com/');
    assert.equal(store.state().bookmarks.length, 1);
    assert.equal(new LibraryStore(root, codec).state().bookmarks[0].title, 'Updated');
    assert.throws(() => store.bookmark('bad', 'javascript:alert(1)'));
    assert.throws(() => store.bookmark('bad', 'https://user:secret@example.com'));
    store.remove('bookmark', store.state().bookmarks[0].id); assert.equal(store.state().bookmarks.length, 0);
  } finally { fs.rmSync(root, {recursive:true, force:true}); }
});
test('vault encrypts all login fields, never lists passwords, updates account and persists removal', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-vault-'));
  try {
    const store = new LibraryStore(root, codec);
    store.saveLogin('https://example.com/login', 'fixture-user', 'fixture-secret');
    const disk = fs.readFileSync(path.join(root, 'logins.json'), 'utf8');
    for (const value of ['fixture-user', 'fixture-secret', 'example.com']) assert.ok(!disk.includes(value));
    const saved = new LibraryStore(root, codec).state().logins[0];
    assert.equal(saved.origin, 'https://example.com'); assert.ok(!('password' in saved));
    store.saveLogin('https://example.com/', 'fixture-user', 'new-secret');
    assert.equal(store.state().logins.length, 1); assert.equal(store.login(saved.id).password, 'new-secret');
    store.saveLogin('http://example.com', 'fixture-user', 'http-secret'); assert.equal(store.state().logins.length, 2);
    store.remove('login', saved.id); assert.throws(() => store.login(saved.id));
    const blocked = new LibraryStore(root, {...codec, available: () => false});
    assert.throws(() => blocked.saveLogin('https://example.com', 'user', 'password'));
    assert.equal(blocked.state().encryptionAvailable, false);
  } finally { fs.rmSync(root, {recursive:true, force:true}); }
});
test('corrupt library fails without overwriting stored data', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-corrupt-'));
  try { fs.writeFileSync(path.join(root,'bookmarks.json'), '{broken');
    assert.throws(() => new LibraryStore(root, codec).bookmark('x','https://example.com'));
    assert.equal(fs.readFileSync(path.join(root,'bookmarks.json'),'utf8'), '{broken');
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
test('cURL quoting round-trips shell metacharacters without executing them', () => {
  const request: NetworkRequest = { id:'1',tabId:'1',url:'https://example.com/api?q=[1]',method:'POST',status:200,isHttp:false,failed:false,timestamp:0,
    requestHeaders: { Authorization:"Bearer '$(echo forbidden)'", 'Content-Length':'123', ':authority':'example.com' },
    postData: '{"value":"a\'b $(echo forbidden) `echo forbidden`\\n"}' };
  const command = toCurl(request);
  // Substitute a local shell function for curl: inspect argv, never send a request.
  const result = execFileSync('/bin/bash', ['-c', 'curl() { printf "%s\\0" "$@"; }; '+command]);
  const args = result.toString().split('\0');
  assert.ok(args.includes(request.url)); assert.ok(args.includes(request.postData!));
  assert.ok(args.includes("Authorization: Bearer '$(echo forbidden)'"));
  assert.ok(!command.includes('Content-Length')); assert.ok(!command.includes(':authority'));
  assert.throws(() => toCurl({...request,requestBodyIncomplete:true}));
  assert.throws(() => toCurl({...request,url:'file:///tmp/private'}));
});
