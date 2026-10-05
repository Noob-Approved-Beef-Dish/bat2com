# bat2com

Turn **DOS DEBUG scripts** into ready-to-run **.COM** programs.

Many retro tutorials, patches and mods ship code as a `DEBUG` script — a plain
text listing of `e100 B8 00 4C CD 21` lines — because text is easy to share.
To run one you normally have to boot DOS and type `debug < script`, assemble,
write, and quit. This tool skips that and writes the final `.COM` directly, so
you can drop it straight into DOSBox.

## Files

| File | Purpose |
| --- | --- |
| `bat2com.bat` | Entry point. This is the file you drag your script onto. |
| `debug2com.ps1` | The converter itself. Keep it next to `bat2com.bat`. |

Requirements: Windows with PowerShell 5.1 (shipped with Windows 10 and 11).
Nothing to install, no admin rights, no network access.

## Usage

**Drag and drop** — drop a `.bat` or `.txt` file onto `bat2com.bat`.

**Command line**

    bat2com.bat myscript.bat

**Call the converter directly**

    powershell -NoProfile -ExecutionPolicy Bypass -File debug2com.ps1 input.bat [output.com]

The output defaults to the input path with a `.com` extension.

## What counts as a DEBUG script

A file is treated as a DEBUG script when it contains at least one `e` line:

    e100 BA 0C 01 B4 09 CD 21 B8 00 4C CD 21
    e10C 48 65 6C 6C 6F 24

- The address is a memory address. A `.COM` always loads at `CS:0100`, so `e100`
  maps to file offset `0`.
- One line can carry any number of bytes.
- Bytes may be space-separated or written contiguously: `e100 B409CD21` is the
  same as `e100 B4 09 CD 21`.
- Every other line (`w`, `q`, `a`, `u`, `n`, `r`, comments, ...) is ignored and
  counted separately in the report.

## Output rules

1. Size = last written address minus `0x100`, plus one.
2. Bytes that are never written stay `0x00`, exactly like DEBUG. The report
   prints `gaps: N byte(s)`.
3. Later lines win. Writing the same address twice keeps the last value.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Converted successfully. |
| `1` | Input file not found. |
| `2` | Invalid address or byte: address outside `0x100..0xFFFF`, or a token that
| | is not an even-length hex group. |
| `3` | Image exceeds 65280 bytes (64 KB minus the 256 byte PSP). |
| `4` | Not a DEBUG script (no `e` line). |

A failed run never leaves a partial `.com` behind: either the whole image is
written, or nothing is.

## Normal .bat files

A plain `.bat` is text interpreted by `COMMAND.COM`. It cannot be turned into a
runnable `.COM` — the CPU would execute the text as machine code. Instead of
faking one, the tool copies the file to `<name>_dos.bat` and prints the DOSBox
steps:

    mount c "C:\path\to\folder"
    c:
    name_dos.bat

## Example

Input `hello.bat`:

    e100 BA0C01B409CD21B8004CCD21
    e10C 48656C6C6F24

Output `hello.com`, 18 bytes:

    100: BA 0C 01    MOV DX,010C   ; point DX at the string
    103: B4 09       MOV AH,09     ; print string
    105: CD 21       INT 21h
    107: B8 00 4C    MOV AX,4C00   ; exit with code 0
    10A: CD 21       INT 21h
    10C: 48 65 6C 6C 6F 24          ; "Hello$"

`$` terminates a string printed through `INT 21h`, function 09h.

## Limitations

- `a` (assemble) lines are not parsed. That would need a built-in assembler.
- COM images only. EXE files are out of scope.
- DEBUG memory initial values and segment registers are not simulated.

## Tests

    node tests/run-tests.js

22 checks: byte-exact conversion for spaced and contiguous input, gap filling and
gap reporting, address and token validation, the size ceiling, duplicate
addresses, correct rejection of non-DEBUG input, and end-to-end runs through
`bat2com.bat`. Needs Node.js plus PowerShell; fixtures are generated in the
system temp directory and cleaned up by the script.

## License

MIT. See [LICENSE](LICENSE).
