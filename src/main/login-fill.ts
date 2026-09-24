export function loginFillScript(row: { origin: string; username: string; password: string }): string {
  return `(() => {
        if (location.origin !== ${JSON.stringify(row.origin)}) return false;
        const visible = e => !e.disabled && !e.readOnly && e.getClientRects().length > 0;
        const passwords = [...document.querySelectorAll('input[type="password"]')].filter(visible);
        if (passwords.length !== 1 || passwords[0].autocomplete === 'new-password') return false;
        const password = passwords[0], scope = password.form || document;
        const username = [...scope.querySelectorAll('input')].filter(visible).find(e => e.autocomplete === 'username') || [...scope.querySelectorAll('input[type="email"],input[type="text"],input:not([type])')].filter(visible)[0];
        const set = (e, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, v); e.dispatchEvent(new Event('input', { bubbles:true })); e.dispatchEvent(new Event('change', { bubbles:true })); };
        if (username) set(username, ${JSON.stringify(row.username)});
        set(password, ${JSON.stringify(row.password)}); return true;
      })()`;
}
