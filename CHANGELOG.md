# Changelog

## v4 — 2026-10-05

- Detection moved into `debug2com.ps1` (new exit code 4 = not a DEBUG script).
  The `.bat` no longer probes with `findstr`, which removes a dependency on the
  undocumented `/r` + `/c:` combination and eliminates a case where the two
  files could disagree about the input type.
- Contiguous hex bytes are now accepted: `e100 B409CD21` equals `e100 B4 09 CD 21`.
  Odd-length tokens are rejected with exit code 2.
- All exit paths in `bat2com.bat` use explicit `endlocal`.
- The normal-BAT path copies the file to `<name>_dos.bat` and prints DOSBox
  instructions. The old 16-byte `MZ` stub was junk code and is gone.
- `ignored lines` now counts every non-empty line that is not an `e` line, so the
  report satisfies `e-lines + ignored = non-empty lines`.
- 22 automated checks in `tests/run-tests.js`.

## v3 — 2026-10-05

- Address validation: every `e` address must be inside `0x100..0xFFFF`.
- Byte token validation: must be an even-length hex group.
- Size guard: images above 65280 bytes are refused (64 KB minus the 256 byte PSP).
- Uppercase `E` and uppercase hex digits are accepted.
- Richer report: e-lines, ignored lines, address range, size, gap count.

## v2 — 2026-06-21

- `bat2com.bat` entry point with drag-and-drop support.
- `debug2com.ps1` converter written in PowerShell.

## v1 — 2026-06-21

- First working version.