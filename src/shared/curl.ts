import type { NetworkRequest } from './types';
const quote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'";
export function toCurl(request: NetworkRequest): string {
  const url = new URL(request.url);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('cURL supports HTTP(S) requests only');
  if (request.requestBodyIncomplete) throw new Error('Request payload is incomplete; use DevTools to export this request');
  const args = ['curl', '--globoff', '--request', quote(request.method), '--url', quote(request.url)];
  for (const [name, value] of Object.entries(request.requestHeaders || {})) {
    if (name.startsWith(':') || /^(host|content-length|connection|accept-encoding)$/i.test(name)) continue;
    if (/[\r\n\0]/.test(name + value)) continue;
    args.push('--header', quote(`${name}: ${value}`));
  }
  if (request.postData !== undefined) args.push('--data-raw', quote(request.postData));
  if (args.some(arg => arg.includes('\0'))) throw new Error('Binary payload cannot be copied as a shell command');
  return args.join(' ');
}
