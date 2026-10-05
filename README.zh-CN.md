# bat2com · 中文说明

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![tests](https://github.com/Noob-Approved-Beef-Dish/bat2com/actions/workflows/tests.yml/badge.svg)](https://github.com/Noob-Approved-Beef-Dish/bat2com/actions/workflows/tests.yml)

[English](README.md) | **中文**

把 **DOS DEBUG 脚本** 转换成可直接运行的 **.COM 程序**。

    git clone https://github.com/Noob-Approved-Beef-Dish/bat2com

英文主文档见 [README.md](README.md)。

## 文件

| 文件 | 作用 |
| --- | --- |
| `bat2com.bat` | 入口，把脚本拖到它上面即可 |
| `debug2com.ps1` | 转换器本体，必须与 `bat2com.bat` 放在同一目录 |

环境要求：Windows + PowerShell 5.1（Win10/11 自带）。免安装、免管理员、不联网。

## 用法

**拖放**：把 `.bat` / `.txt` 拖到 `bat2com.bat` 上。

**命令行**

    bat2com.bat 你的脚本.bat

**直接调转换器**

    powershell -NoProfile -ExecutionPolicy Bypass -File debug2com.ps1 输入.bat [输出.com]

输出默认与输入同目录同名，扩展名改为 `.com`。

## 什么算「DEBUG 脚本」

只要文件里存在 `e` 开头的行，就按 DEBUG 脚本处理：

    e100 BA 0C 01 B4 09 CD 21 B8 00 4C CD 21
    e10C 48 65 6C 6C 6F 24

- 地址是内存地址。`.COM` 永远载入到 `CS:0100`，所以 `e100` 对应文件偏移 `0`。
- 一行可以写任意多个字节。
- 字节可空格分隔，也可连续写：`e100 B409CD21` 等价于 `e100 B4 09 CD 21`。
- 其它行（`w` / `q` / `a` / `u` / `n` / `r` / 注释 等）会被忽略，并在报告里单独计数。

## 输出规则

1. 大小 = 最后写入地址 − 0x100 + 1。
2. 从未写过的字节保持 `0x00`（与 DEBUG 一致），报告里显示 `gaps: N byte(s)`。
3. 后面的行覆盖前面的：同一地址写两次，以最后写入为准。

## 退出码

| 码 | 含义 |
| --- | --- |
| `0` | 转换成功 |
| `1` | 输入文件不存在 |
| `2` | 地址或字节非法（地址不在 `0x100..0xFFFF`，或 token 不是偶数长度十六进制） |
| `3` | 镜像超过 65280 字节（64 KB 减 256 字节 PSP） |
| `4` | 不是调试脚本（没有 `e` 行） |

**失败时不会留下半成品 `.com`**：要么完整写出，要么什么都不留。

## 普通 .bat 会怎样

普通 `.bat` 是给 `COMMAND.COM` 解释的文本，无法变成能跑的 `.COM`（让 CPU 执行文本等于乱套）。
本工具不会伪造一个，而是把文件复制成 `<名字>_dos.bat`，并打印 DOSBox 的运行步骤：

    mount c "C:\路径\到\目录"
    c:
    名字_dos.bat

## 完整示例

输入 `hello.bat`：

    e100 BA0C01B409CD21B8004CCD21
    e10C 48656C6C6F24

产出 `hello.com`，18 字节：

    100: BA 0C 01    MOV DX,010C   ; DX 指向字符串
    103: B4 09       MOV AH,09     ; 显示字符串
    105: CD 21       INT 21h
    107: B8 00 4C    MOV AX,4C00   ; 退出，返回码 0
    10A: CD 21       INT 21h
    10C: 48 65 6C 6C 6F 24          ; "Hello$"

`INT 21h` 09h 号功能以 `$` 作为字符串结束符。

## 已知边界

- 不解析 `a`（汇编）行，那需要内置汇编器。
- 只做 COM 镜像，不处理 EXE。
- 不模拟 DEBUG 的内存初值 / 段寄存器。

## 测试

    node tests/run-tests.js

22 项检查，覆盖字节级精度、空洞填充、地址/字节校验、尺寸上限、重复地址、
非调试脚本的正确拒绝，以及经 `bat2com.bat` 的端到端流程。需要 Node.js + PowerShell。

## 许可

MIT，见 [LICENSE](LICENSE)。
