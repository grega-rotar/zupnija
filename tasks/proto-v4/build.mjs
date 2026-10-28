// Assembles tasks/prototype-homepage-v4.html from base.css and the three partials.
// Usage: node tasks/proto-v4/build.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const read = (p) => (existsSync(join(dir, p)) ? readFileSync(join(dir, p), "utf8") : "");

const base = read("base.css");
const parts = ["partials/a.html", "partials/b.html", "partials/c.html"].map(read);

const html = `<!doctype html>
<html lang="sl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Župnija Pirniče · prototip v4</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700;14..32,800&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<style>
${base}
</style>
</head>
<body>

<div class="proto" aria-label="Prototip">
  <a href="#top">Domov</a><a href="#stanja">Stanja</a><a href="#telefon">Telefon</a><a href="#urejevalnik">Urejevalnik</a><i></i>
  <a href="#" onclick="delete document.documentElement.dataset.accent;return false">Zlato</a>
  <a href="#" onclick="document.documentElement.dataset.accent='bordo';return false">Bordo</a>
</div>

${parts.join("\n\n")}

<script>
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.1});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
const nav=document.getElementById('nav');
if(nav){const onScroll=()=>nav.classList.toggle('solid',scrollY>window.innerHeight*0.6);addEventListener('scroll',onScroll,{passive:true});onScroll();}
</script>
</body>
</html>
`;
writeFileSync(join(dir, "..", "prototype-homepage-v4.html"), html);
console.log("wrote tasks/prototype-homepage-v4.html");
