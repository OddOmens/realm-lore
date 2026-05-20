import re
with open('electron/main.js', 'r') as f:
    code = f.read()

code = code.replace(".replace(/\//g, '/')", ".replace(/\\\\\\\\/g, '/')")
code = code.replace(".replace(/\/g, '/')", ".replace(/\\\\\\\\/g, '/')")

with open('electron/main.js', 'w') as f:
    f.write(code)
