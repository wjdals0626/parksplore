"""web/ 의 로컬 JS·CSS 참조에 ?v=<시각> 를 붙여 브라우저 캐시를 무효화 (코드 수정 후 실행)."""
import re, time, pathlib
v = time.strftime("%Y%m%d%H%M")
web = pathlib.Path(__file__).resolve().parent.parent / "web"
pat = re.compile(r'((?:from |src=|href=)")(\./)?([\w-]+\.(?:js|css))(\?v=\d+)?(")')
for f in [web / "index.html", *web.glob("*.js")]:
    s = f.read_text(encoding="utf-8")
    n = pat.sub(lambda m: f'{m[1]}{m[2] or ""}{m[3]}?v={v}{m[5]}', s)
    if n != s: f.write_text(n, encoding="utf-8"); print("bumped", f.name)
print("version", v)
