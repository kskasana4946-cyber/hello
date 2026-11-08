#!/usr/bin/env python3
import os
import sys
import zipfile

def main():
    if len(sys.argv) < 3:
        print("Usage: zip_dir.py <output_zip> <source_dir>")
        sys.exit(1)
    out_zip = sys.argv[1]
    src_dir = sys.argv[2]
    out_dir = os.path.dirname(os.path.abspath(out_zip))
    if not os.path.exists(out_dir):
        os.makedirs(out_dir, exist_ok=True)
    with zipfile.ZipFile(out_zip, 'w', zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(src_dir):
            for f in files:
                full = os.path.join(root, f)
                rel = os.path.relpath(full, src_dir)
                z.write(full, rel)
    print(f"Created {out_zip} ({os.path.getsize(out_zip)} bytes)")

if __name__ == '__main__':
    main()

