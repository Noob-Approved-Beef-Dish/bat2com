#!/usr/bin/env node
// bat2com test suite - run with:  node tests/run-tests.js
// Fixtures are generated in the system temp directory and removed on exit.
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BAT = path.join(ROOT, 'bat2com.bat');
const PS1 = path.join(ROOT, 'debug2com.ps1');
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'bat2com-test-'));

let okN = 0, badN = 0;
const failed = [];
function check(name, cond, detail) {
  if (cond) { okN++; console.log('  [PASS] ' + name); }
  else { badN++; failed.push(name); console.log('  [FAIL] ' + name + (detail ? '   ' + detail : '')); }
}
function fixture(name, text) {
  const p = path.join(T, name);
  fs.writeFileSync(p, text, 'ascii');
  return p;
}
function p(name) { return path.join(T, name); }
function runPs1(args) {
  const r = cp.spawnSync('powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS1].concat(args),
    { encoding: 'utf8', input: '' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
function runCmd(line) {
  const r = cp.spawnSync('cmd.exe', ['/c', line], { encoding: 'utf8', input: '\n', timeout: 120000 });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
function hex(file) { try { return fs.readFileSync(file).toString('hex'); } catch (e) { return 'MISSING'; } }

const EXP = 'ba0e01b409cd21b8004ccd2148656c6c6f24';

console.log('bat2com test suite');
console.log('  repo     : ' + ROOT);
console.log('  temp dir : ' + T);
console.log('');

fixture('spaced.bat', 'e100 BA 0E 01 B4 09 CD 21 B8 00 4C CD 21\r\ne10C 48 65 6C 6C 6F 24\r\n');
fixture('contig.bat', 'e100 BA0E01B409CD21B8004CCD21\r\ne10C 48656C6C6F24\r\n');
fixture('gap.bat', 'e100 BA 0E 01 B4 09 CD 21 B8 00 4C CD 21\r\ne10E 48 65 6C 6C 6F 24\r\n');
fixture('low.bat', 'e0FF AA BB\r\n');
fixture('odd.bat', 'e100 B4E\r\n');
fixture('zz.bat', 'e100 ZZ\r\n');
fixture('big.bat', 'e100 ' + 'AA '.repeat(65281) + '\r\n');
fixture('none.bat', '@echo off\r\necho hi\r\n');
fixture('echoish.bat', '@echo off\r\necho hello\r\necho e100 B4\r\n');
fixture('upper.bat', 'E100 BA 0E 01\r\n');
fixture('mix.bat', ['e100 B4 09', 'w', 'q', '; comment', '# comment', '', 'u 100 105', 'a 100', 'rem leftover'].join('\r\n') + '\r\n');
fixture('ov.bat', 'e100 AA BB CC DD\r\ne102 11 22\r\n');
fixture('gd.bat', 'e100 AA BB\r\ne105 CC\r\ne100 DD\r\n');
fixture('readme.bat', 'e100 BA0C01B409CD21B8004CCD21\r\ne10C 48656C6C6F24\r\n');

console.log('debug2com.ps1');
let r;
r = runPs1([p('spaced.bat'), p('spaced.com')]);
check('spaced bytes convert exactly', hex(p('spaced.com')) === EXP, 'got=' + hex(p('spaced.com')));
r = runPs1([p('contig.bat'), p('contig.com')]);
check('contiguous bytes convert exactly', hex(p('contig.com')) === EXP, 'got=' + hex(p('contig.com')));
r = runPs1([p('gap.bat'), p('gap.com')]);
check('gaps are filled with 00', hex(p('gap.com')) === 'ba0e01b409cd21b8004ccd21000048656c6c6f24', 'got=' + hex(p('gap.com')));
check('gap count is reported', /gaps\s*:\s*2\s*byte/.test(r.out), r.out.slice(0, 120));
r = runPs1([p('low.bat'), p('low.com')]);
check('address below 0x100 -> exit 2', r.code === 2, 'exit=' + r.code);
check('no output file after a failure', !fs.existsSync(p('low.com')), '');
r = runPs1([p('odd.bat'), p('odd.com')]);
check('odd-length token -> exit 2', r.code === 2, 'exit=' + r.code);
r = runPs1([p('zz.bat'), p('zz.com')]);
check('non-hex token -> exit 2', r.code === 2, 'exit=' + r.code);
r = runPs1([p('big.bat'), p('big.com')]);
check('image over 65280 bytes -> exit 3', r.code === 3, 'exit=' + r.code);
r = runPs1([p('none.bat'), p('none.com')]);
check('no e-lines -> exit 4', r.code === 4, 'exit=' + r.code);
r = runPs1([p('missing.bat'), p('missing.com')]);
check('missing input -> exit 1', r.code === 1, 'exit=' + r.code);
r = runPs1([p('upper.bat'), p('upper.com')]);
check('uppercase E address is accepted', hex(p('upper.com')) === 'ba0e01', 'got=' + hex(p('upper.com')));
r = runPs1([p('echoish.bat'), p('echoish.com')]);
check('plain bat with echo lines -> exit 4', r.code === 4, 'exit=' + r.code);
r = runPs1([p('mix.bat'), p('mix.com')]);
check('ignored count covers every non-e line', /ignored lines:\s*7/.test(r.out), r.out.replace(/\r?\n/g, ' ').slice(0, 140));
r = runPs1([p('ov.bat'), p('ov.com')]);
check('overlapping writes: last one wins', hex(p('ov.com')) === 'aabb1122', 'got=' + hex(p('ov.com')));
r = runPs1([p('gd.bat'), p('gd.com')]);
check('duplicate address plus gap is exact', hex(p('gd.com')) === 'ddbb000000cc', 'got=' + hex(p('gd.com')));
r = runPs1([p('readme.bat'), p('readme.com')]);
check('README example is 18 bytes', /18 bytes/.test(r.out), r.out.replace(/\r?\n/g, ' ').slice(0, 140));
check('README example hex is exact', hex(p('readme.com')) === 'ba0c01b409cd21b8004ccd2148656c6c6f24', 'got=' + hex(p('readme.com')));

console.log('');
console.log('bat2com.bat (end to end)');
fs.copyFileSync(p('spaced.bat'), p('e2e.bat'));
const harness = path.join(T, 'harness.bat');
fs.writeFileSync(harness, [
  '@echo off',
  'call "' + BAT + '" "' + p('e2e.bat') + '" >nul',
  'echo R1=%errorlevel%',
  'call "' + BAT + '" "' + p('none.bat') + '" >nul',
  'echo R2=%errorlevel%'
].join('\r\n') + '\r\n', 'ascii');
const hb = runCmd(harness);
check('debug script through bat2com.bat is exact', hex(p('e2e.com')) === EXP, 'got=' + hex(p('e2e.com')));
check('plain bat produces no .com', !fs.existsSync(p('none.com')), '');
check('plain bat is copied to _dos.bat', fs.existsSync(p('none_dos.bat')), '');

console.log('');
console.log('setlocal scope');
fs.writeFileSync(p('child.bat'), '@echo off\r\nsetlocal\r\nset "LEAKFLAG=yes"\r\nexit /b 0\r\n', 'ascii');
fs.writeFileSync(p('parent.bat'), '@echo off\r\nset "LEAKFLAG="\r\ncall "' + p('child.bat') + '"\r\nif defined LEAKFLAG (echo LEAKED) else (echo CLEAN)\r\n', 'ascii');
const lk = runCmd(p('parent.bat'));
check('setlocal does not leak to the caller', /CLEAN/.test(lk.out), lk.out.trim());

fs.rmSync(T, { recursive: true, force: true });
console.log('');
console.log('==================================');
console.log('  ok=' + okN + '   bad=' + badN + (failed.length ? '   failed: ' + failed.join(', ') : ''));
console.log('==================================');
process.exit(failed.length ? 1 : 0);
