import { describe, expect, it } from 'vitest';
import { ghAccountReason, ownerFromRemote, parseAuthStatus, touchesGitHub } from './gh-account.mjs';

const STATUS = `github.com
  ✓ Logged in to github.com account work-acct (keyring)
  - Active account: true
  - Git operations protocol: https

  ✓ Logged in to github.com account me (keyring)
  - Active account: false
  - Git operations protocol: https
`;

describe('touchesGitHub', () => {
  it('matches gh and git push, also inside chains', () => {
    expect(touchesGitHub('gh pr create --fill')).toBe(true);
    expect(touchesGitHub('git push origin main')).toBe(true);
    expect(touchesGitHub('git -C . push')).toBe(true);
    expect(touchesGitHub('pnpm check && gh pr view')).toBe(true);
    expect(touchesGitHub('FOO=1 gh api user')).toBe(true);
  });
  it('ignores everything else', () => {
    expect(touchesGitHub('pnpm check')).toBe(false);
    expect(touchesGitHub('git status')).toBe(false);
    expect(touchesGitHub('git commit -m "gh push"')).toBe(false);
    expect(touchesGitHub('ghost --version')).toBe(false);
  });
});

describe('ownerFromRemote', () => {
  it('reads https and ssh remotes', () => {
    expect(ownerFromRemote('https://github.com/me/Repo.git')).toBe('me');
    expect(ownerFromRemote('git@github.com:me/Repo.git')).toBe('me');
    expect(ownerFromRemote('https://user@github.com/me/Repo')).toBe('me');
  });
  it('returns null for anything else', () => {
    expect(ownerFromRemote('https://gitlab.com/me/Repo.git')).toBeNull();
    expect(ownerFromRemote('')).toBeNull();
  });
});

describe('parseAuthStatus', () => {
  it('finds the active and all logged-in accounts', () => {
    expect(parseAuthStatus(STATUS)).toEqual({
      active: 'work-acct',
      loggedIn: ['work-acct', 'me'],
    });
  });
  it('returns null when nothing can be parsed', () => {
    expect(parseAuthStatus('You are not logged in')).toBeNull();
  });
});

describe('ghAccountReason', () => {
  const base = {
    command: 'gh pr create',
    remoteUrl: 'https://github.com/me/Repo.git',
    status: STATUS,
  };
  it('blocks when the active account is not the owner, naming the fix', () => {
    expect(ghAccountReason(base)).toMatch(/gh auth switch -u me/);
  });
  it('allows when the active account owns the remote (case-insensitive)', () => {
    const status = STATUS.replace('Active account: true', 'X').replace(
      /(account me \(keyring\)\n\s+- Active account: )false/,
      '$1true',
    );
    expect(ghAccountReason({ ...base, status })).toBeNull();
    expect(ghAccountReason({ ...base, remoteUrl: 'git@github.com:ME/r.git', status })).toBeNull();
  });
  it('allows when the owner is not a logged-in account (org)', () => {
    expect(ghAccountReason({ ...base, remoteUrl: 'https://github.com/some-org/r.git' })).toBeNull();
  });
  it('allows unrelated commands and fails open on missing info', () => {
    expect(ghAccountReason({ ...base, command: 'pnpm check' })).toBeNull();
    expect(ghAccountReason({ ...base, remoteUrl: '' })).toBeNull();
    expect(ghAccountReason({ ...base, status: 'not logged in' })).toBeNull();
  });
});
