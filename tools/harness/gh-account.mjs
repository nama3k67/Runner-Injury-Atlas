/**
 * Stops `gh ...` and `git push` when the active gh account is not the owner of
 * `origin`, so personal and work repos never get mixed up. Pure functions,
 * unit-tested (gh-account.test.mjs); the hook itself is hook-gh-account.mjs.
 */

// A command segment (after && ; | or newline) that starts with gh or git ... push.
const SEGMENT = /(?:^|&&|\|\||[;|\n])\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*(gh|git)\b([^&;|\n]*)/g;

// The block message names `gh auth switch` as the fix, so it must pass. Other `gh auth` commands
// and anything chained after the switch stay guarded: segments are checked one by one.
const AUTH_SWITCH = /^\s+auth\s+switch(\s|$)/;

export function touchesGitHub(command) {
  for (const [, bin, rest] of command.matchAll(SEGMENT)) {
    if (bin === 'gh') {
      if (AUTH_SWITCH.test(rest)) continue;
      return true;
    }
    if (/(^|\s)push(\s|$)/.test(rest)) return true;
  }
  return false;
}

export function ownerFromRemote(url) {
  const m = url.trim().match(/github\.com[/:]([^/\s]+)\/[^/\s]+/);
  return m?.[1] ?? null;
}

// ponytail: parses `gh auth status` text (gh 2.52 has no --json); revisit if the format changes.
export function parseAuthStatus(text) {
  const loggedIn = [];
  let active = null;
  let current = null;
  for (const line of text.split('\n')) {
    const acct = line.match(/Logged in to \S+ account (\S+)/);
    if (acct) {
      current = acct[1];
      loggedIn.push(current);
    } else if (current && /Active account:\s*true/.test(line)) {
      active = current;
    }
  }
  return active ? { active, loggedIn } : null;
}

/** @returns {string | null} reason to block, or null to allow. Fails open. */
export function ghAccountReason({ command, remoteUrl, status }) {
  if (!touchesGitHub(command)) return null;
  const owner = ownerFromRemote(remoteUrl);
  const accounts = parseAuthStatus(status);
  if (!owner || !accounts) return null;
  const same = (a, b) => a.toLowerCase() === b.toLowerCase();
  // An owner that is not one of our accounts is likely an organisation: cannot judge.
  const ownerAccount = accounts.loggedIn.find((a) => same(a, owner));
  if (!ownerAccount || same(accounts.active, owner)) return null;
  return `Active gh account is "${accounts.active}" but origin belongs to "${owner}". Ask the maintainer, then run: gh auth switch -u ${ownerAccount}`;
}
