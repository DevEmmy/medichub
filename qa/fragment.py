# Turns the single-file build into the fragment the Claude artifact host expects.
# Finds <head>/<body> by position (after the head closes), because the bundled JS itself contains
# "<body" and "</body>" inside the email template strings.
import re, sys
s = open('dist-single/index.html').read()
h0 = s.index('<head>') + 6
h1 = s.index('</head>', h0)
# the real </head> is the last one before the real <body ...> tag that follows it
h1 = s.rindex('</head>', 0, s.index('<body', s.rindex('</script>', 0, s.rindex('</head>')) if '</script>' in s else 0))
head = s[h0:h1]
b0 = s.index('>', s.index('<body', h1)) + 1
b1 = s.rindex('</body>')
keep = [m.group(0) for m in re.finditer(r'<title>.*?</title>|<link[^>]*fonts\.googleapis[^>]*>|<style[\s\S]*?</style>|<script[\s\S]*?</script>', head)]
out = '\n'.join(keep) + '\n' + s[b0:b1]
open(sys.argv[1], 'w').write(out)
print('scripts', out.count('<script'), 'ends with root:', 'id="root"' in s[b0:b1], 'len', len(out))
