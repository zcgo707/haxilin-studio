"""Subset and convert fonts to WOFF2 format."""
import subprocess
import sys
import os

FONT_DIR = r"D:\ai\haxilin\public\fonts"
PYFTSUBSET = os.path.join(
    r"C:\Users\linhua\.workbuddy\binaries\python\envs\default\Scripts",
    "pyftsubset.exe",
)

# Characters used on the site: site title + tagline + common Latin/digits/punctuation
CHARS = (
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    "0123456789"
    " .,!?:;-'\"()/"
    # Chinese characters from tagline: 不折锋芒，不伪自由
    "不折锋芒，不伪自由"
)

fonts = [
    {
        "input": os.path.join(FONT_DIR, "HongLeiXingShuJianTi-2.otf"),
        "output": os.path.join(FONT_DIR, "HongLeiXingShuJianTi-2.woff2"),
    },
    {
        "input": os.path.join(FONT_DIR, "typhooncondital-12.ttf"),
        "output": os.path.join(FONT_DIR, "typhooncondital-12.woff2"),
    },
]

for font in fonts:
    input_path = font["input"]
    output_path = font["output"]

    if not os.path.exists(input_path):
        print(f"SKIP: {input_path} not found")
        continue

    cmd = [
        PYFTSUBSET,
        input_path,
        f"--text={CHARS}",
        "--flavor=woff2",
        f"--output-file={output_path}",
        "--no-hinting",
        "--desubroutinize",
    ]

    print(f"Subsetting {os.path.basename(input_path)}...")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"ERROR: {result.stderr}")
    else:
        original_size = os.path.getsize(input_path) / 1024
        new_size = os.path.getsize(output_path) / 1024
        print(
            f"  OK: {os.path.basename(input_path)} "
            f"{original_size:.0f}KB -> {new_size:.0f}KB "
            f"({(new_size/original_size)*100:.1f}%)"
        )

print("Done!")
