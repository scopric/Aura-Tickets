// Ingresso sem internet (Decisão 162, D4). Service worker só para "Meus ingressos".
// Faz duas coisas e nada mais:
//  1. a abertura de /app/tickets: rede primeiro; sem rede, serve a casca do app (index.html, igual para todos, sem dado de ninguém);
//  2. os arquivos /assets/* (nome com hash, imutáveis): cache primeiro.
// Nunca toca em Supabase nem em outra rota. Os ingressos em si ficam no app (src/lib/ingressosOffline.ts), por conta e apagados no logout.
const CACHE = 'evk-ingressos-v1'
const CASCA = '/app/tickets'

// guarda os /assets/ que a casca pede (script de entrada, modulepreload, css): sem eles a casca abre em branco
function guardarAssetsDa(c, resp) {
  return resp.text().then((html) => Promise.all([...new Set(html.match(/\/assets\/[^"'\s<>]+/g) || [])].map((u) => c.match(u).then((j) => j || c.add(u).catch(() => {})))))
}

self.addEventListener('install', (e) => {
  self.skipWaiting() // versão nova assume já; a casca é rede primeiro, então um deploy novo nunca fica preso
  e.waitUntil(caches.open(CACHE).then((c) => c.add(CASCA).then(() => c.match(CASCA)).then((r) => guardarAssetsDa(c, r))).catch(() => {}))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('message', (e) => {
  // a página manda os /assets/ que já carregou, para o que abriu antes do worker também ficar guardado
  if (e.data?.tipo !== 'assets') return
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all((e.data.urls || [])
    .filter((u) => typeof u === 'string' && u.startsWith(self.location.origin + '/assets/'))
    .map((u) => c.match(u).then((j) => j || c.add(u).catch(() => {}))))))
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate' && url.pathname === CASCA) {
    e.respondWith(
      fetch(req, { signal: AbortSignal.timeout(5000) }).then(
        (r) => { if (r.ok) { const copia = r.clone(), p = r.clone(); caches.open(CACHE).then((c) => c.put(CASCA, copia).then(() => guardarAssetsDa(c, p))) } return r },
        () => caches.match(CASCA, { ignoreVary: true }).then((c) => c || Response.error()),
      ),
    )
  } else if (url.pathname.startsWith('/assets/')) {
    // ponytail: o cache de /assets/ só cresce até o próximo CACHE = '...-v2'; sem limpeza por deploy
    e.respondWith(caches.match(req, { ignoreVary: true }).then((c) => c || fetch(req).then((r) => { if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((x) => x.put(req, copia)) } return r })))
  }
})
