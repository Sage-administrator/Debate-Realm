import sys
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    content = f.read()
for i, ch in enumerate(content):
    if ord(ch) > 127:
        ctx = content[max(0,i-15):i+15]
        print(f'Pos {i}: U+{ord(ch):04X} "{ch}" => ...{ctx}...')
