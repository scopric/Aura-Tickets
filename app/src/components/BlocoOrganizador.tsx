import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import * as I from '@/components/icones/evokaa16'
import { formatCNPJ } from '../lib/formatters'
import { marcaOk, rotuloOk, emailSemProibidos } from '../lib/organizadorTexto'
import type { OrganizadorDoEvento } from '../hooks/useOrganizadorDoEvento'
import EventoCapa from './EventoCapa'
import { IconeInstagram, IconeWhatsApp, iconeDaRede } from './iconesRedes'
import { cn } from '@/lib/utils'

// Dado do banco vira texto e link só depois de conferido aqui (a RPC já valida; isto é a segunda trava no navegador)
const dominio = (url: string) => {
  try {
    const u = new URL(url)
    // sem login na URL, sem punycode (xn--) e sem se passar pela plataforma
    const h = u.hostname.toLowerCase()
    return u.protocol === 'https:' && !u.username && !u.password && !/(^|\.)xn--/.test(h) && marcaOk(h) ? h.replace(/^www\./, '') : null
  } catch { return null }
}

const classeLink = 'flex min-h-11 w-full items-center gap-3 border-t border-border px-5 py-2 text-left hover:bg-[var(--ev-tint-hover)] focus-visible:shadow-[inset_0_0_0_2px_hsl(var(--ring))] focus-visible:outline-none first:border-t-0'

function Item({ icone, rotulo, sub, href }: { icone: ReactNode; rotulo: string; sub?: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={classeLink}>
      <span className="shrink-0 text-muted-foreground">{icone}</span>
      <span className="min-w-0 flex-1 break-words text-base leading-6">
        {rotulo}
        {sub && <span className="block text-[13px] leading-5 text-muted-foreground">{sub}</span>}
        <span className="sr-only"> (abre em nova aba)</span>
      </span>
      <I.AbrirExterno size={16} className="shrink-0 text-muted-foreground" />
    </a>
  )
}

// ---- Cartão de anfitrião (vitrine nova): fecha a coluna de conteúdo -------------------------------------------------
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const inteiro = (n: unknown, min: number, max: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max
const cortar = (t: string, n: number) => Array.from(t.trim()).slice(0, n).join('')
const iniciais = (nome: string) => Array.from(nome.trim().split(/\s+/).slice(0, 2).map((p) => Array.from(p)[0] ?? '').join('').toUpperCase()).join('') || '·'

type Redes = { rotulo: string; url: string }[]

function Anfitriao({ o, titulo, wa, ig, site, email, redes, cnpj }: {
  o: OrganizadorDoEvento; titulo: string; wa: string | null; ig: string | null; site: string | null; email: string | null; redes: Redes; cnpj: string | null
}) {
  const [revelado, setRevelado] = useState(false)
  const [bioAberta, setBioAberta] = useState(false)
  const primeiro = useRef<HTMLAnchorElement>(null)
  useEffect(() => { if (revelado) primeiro.current?.focus() }, [revelado])

  const nome = o.nome || o.razao_social
  const sub = [o.nome && o.razao_social, cnpj && `CNPJ ${cnpj}`].filter(Boolean).join(' · ')
  // segunda trava dos campos novos (a RPC ainda não os tem; ausentes = bloco como antes)
  const bio = typeof o.bio === 'string' && o.bio.trim() ? cortar(o.bio, 280) : null
  const realizados = inteiro(o.eventos_realizados, 1, 100000) ? o.eventos_realizados : null
  const desde = inteiro(o.desde, 1990, new Date().getFullYear()) ? o.desde : null
  const outros = (Array.isArray(o.outros_eventos) ? o.outros_eventos : [])
    .filter((e) => e && typeof e.id === 'string' && UUID.test(e.id) && typeof e.title === 'string' && e.title.trim())
    .slice(0, 3)
    .map((e) => ({
      id: e.id, title: cortar(e.title, 80),
      date: typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : null,
      time: typeof e.time === 'string' ? e.time : null,
      cover_image: typeof e.cover_image === 'string' && /^https:\/\//i.test(e.cover_image) ? e.cover_image : null,
      image_url: typeof e.image_url === 'string' && /^https:\/\//i.test(e.image_url) ? e.image_url : null,
      accent_color: typeof e.accent_color === 'string' ? e.accent_color : null,
    }))

  const canal = 'alvo-44 grid size-11 place-items-center rounded-full text-muted-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))] transition-colors duration-rapido hover:bg-[var(--ev-tint-hover)] hover:text-foreground focus-visible:bg-[var(--ev-tint-hover)] focus-visible:text-foreground focus-visible:outline-none focus-visible:shadow-ev-foco motion-reduce:transition-none'
  const botao = 'alvo-44 inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-transform duration-rapido focus-visible:outline-none focus-visible:shadow-ev-foco active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0'
  const reconhecidas = redes.map((r) => ({ r, rede: iconeDaRede(r.url) }))
  const comIcone = reconhecidas.filter((x) => x.rede)
  const emTexto = reconhecidas.filter((x) => !x.rede)
  const temCanais = ig || site || email
  const rotuloMono = 'evv-mono text-muted-foreground'

  return (
    <section aria-labelledby="h-organizador" className="py-6">
      <div className="mx-5 rounded-[20px] border border-border p-6 shadow-[inset_0_2px_0_var(--evento)]" style={{ backgroundColor: 'color-mix(in oklab, var(--evento) 6%, hsl(var(--card)))' }}>
        <h2 id="h-organizador" className="flex items-center gap-4 text-[11px] font-semibold uppercase leading-5 tracking-[0.08em] text-muted-foreground after:h-px after:flex-1 after:bg-border">Organizador</h2>
        <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 md:grid-cols-[auto_minmax(0,1fr)_auto]">
          <span aria-hidden="true" className="font-display grid size-[52px] place-items-center rounded-full border border-border text-lg font-extrabold" style={{ background: 'var(--evento-fundo)', color: 'var(--evento-texto)' }}>{iniciais(nome || '')}</span>
          <div className="min-w-0">
            {nome && <p className="font-display line-clamp-2 break-words text-lg font-bold leading-6">{nome}</p>}
            {sub && <p className="break-words text-[12.5px] leading-5 text-muted-foreground">{sub}</p>}
          </div>
          {/* Contato escondido até o clique. Isto só tira os links do DOM: a RPC ainda devolve os dados (mitigação parcial contra raspagem, não total). */}
          {(wa || email) && !revelado && (
            <button type="button" aria-expanded={false} onClick={() => setRevelado(true)} className={cn(botao, 'col-span-2 border border-foreground text-foreground hover:bg-foreground/5 md:col-span-1')}>Mostrar contato</button>
          )}
          {(wa || email) && revelado && (
            <div className="col-span-2 flex flex-wrap items-center gap-3 md:col-span-1 md:flex-col md:items-stretch">
              {wa && (
                <a ref={primeiro} href={`https://wa.me/${wa}?text=${encodeURIComponent(`Olá! Vi o evento ${titulo} na Evokaa.`)}`} target="_blank" rel="noopener noreferrer nofollow"
                  className={cn(botao, 'bg-foreground text-background shadow-[inset_0_-2px_0_hsl(var(--background)/0.28)] hover:bg-foreground/90')}>
                  <IconeWhatsApp size={18} />
                  Falar no WhatsApp<span className="sr-only"> (abre em nova aba)</span>
                </a>
              )}
              {email && (
                <a ref={wa ? undefined : primeiro} href={`mailto:${email}`} className="alvo-44 inline-flex min-h-11 items-center justify-center break-all text-sm text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:shadow-ev-foco">{email}</a>
              )}
            </div>
          )}
        </div>

        {(realizados || desde) && (
          <dl className="mt-5 flex divide-x divide-border border-y border-border py-3">
            {realizados && <div className="flex-1 pr-4"><dd className="font-display text-3xl font-extrabold tabular-nums leading-9">{realizados}</dd><dt className={rotuloMono}>eventos realizados</dt></div>}
            {desde && <div className={cn('flex-1', realizados && 'pl-4')}><dd className="font-display text-3xl font-extrabold tabular-nums leading-9">{desde}</dd><dt className={rotuloMono}>no ar desde</dt></div>}
          </dl>
        )}

        {bio && (
          <div className="mt-5">
            <p id="organizador-bio" className={cn('whitespace-pre-line break-words text-[15px] leading-6 text-muted-foreground', !bioAberta && 'line-clamp-3')}>{bio}</p>
            {Array.from(bio).length > 150 && (
              <button type="button" onClick={() => setBioAberta(!bioAberta)} aria-expanded={bioAberta} aria-controls="organizador-bio" className="alvo-44 mt-1 text-sm font-semibold leading-5 text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:shadow-ev-foco">
                {bioAberta ? 'Ler menos' : 'Ler mais'}
              </button>
            )}
          </div>
        )}

        {(temCanais || redes.length > 0) && (
          <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {ig && <a href={`https://instagram.com/${ig}`} target="_blank" rel="noopener noreferrer nofollow" aria-label="Instagram (abre em nova aba)" title={`instagram.com/${ig}`} className={canal}><IconeInstagram size={20} /></a>}
            {site && <a href={site} target="_blank" rel="noopener noreferrer nofollow" aria-label="Site (abre em nova aba)" title={dominio(site)!} className={canal}><I.Globo size={20} /></a>}
            {comIcone.map(({ r, rede }) => {
              const Icone = rede!.Icone
              return <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer nofollow" aria-label={`${rede!.nome} (abre em nova aba)`} title={dominio(r.url)!} className={canal}><Icone size={20} /></a>
            })}
            {emTexto.length > 0 && (temCanais || comIcone.length > 0) && <span aria-hidden="true" className="mx-2 h-5 w-px bg-border" />}
            {emTexto.map(({ r }, i) => (
              <a key={i} href={r.url} target="_blank" rel="noopener noreferrer nofollow" title={dominio(r.url)!}
                className="alvo-44 group relative inline-flex min-h-11 items-center gap-1 px-1 text-sm text-muted-foreground transition-colors duration-rapido hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:shadow-ev-foco motion-reduce:transition-none">
                <span className="relative">
                  {r.rotulo}
                  <span aria-hidden="true" className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-current transition-transform duration-rapido group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none" />
                </span>
                <span className="sr-only"> (abre em nova aba)</span>
                <I.AbrirExterno size={11} aria-hidden="true" />
              </a>
            ))}
          </div>
        )}

        {outros.length > 0 && (
          <div className="mt-5 border-t border-border pt-4">
            <h3 className={rotuloMono}>Outros eventos</h3>
            <ul className="mt-2">
              {outros.map((e, i) => {
                const d = e.date ? new Date(`${e.date}T00:00:00`) : null
                const hora = e.time?.match(/^(\d{1,2}):(\d{2})/)
                const quando = d ? [d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), hora && `${+hora[1]}h${hora[2] === '00' ? '' : hora[2]}`].filter(Boolean).join(' · ') : ''
                return (
                  <li key={`${e.id}-${i}`}>
                    <Link to={`/event/${e.id}`} className="alvo-44 -mx-2 flex min-h-[64px] items-center gap-3 rounded-ev-md px-2 py-2 transition-colors duration-rapido hover:bg-[var(--ev-tint-hover)] focus-visible:outline-none focus-visible:shadow-ev-foco motion-reduce:transition-none">
                      {d && (
                        <span aria-hidden="true" className="grid min-w-12 shrink-0 justify-items-center rounded-ev-lg border border-border px-2 py-1">
                          <b className="font-display text-xl font-extrabold tabular-nums leading-none">{d.getDate()}</b>
                          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                        </span>
                      )}
                      <EventoCapa evento={{ id: e.id, title: e.title, cover_image: e.cover_image, image_url: e.image_url, accent_color: e.accent_color, date: e.date }} tamanho="mini" />
                      <span className="min-w-0 flex-1">
                        <span className="font-display line-clamp-2 break-words text-[15px] font-bold leading-5">{e.title}</span>
                        {quando && <span className="block text-[13px] leading-5 text-muted-foreground">{quando}</span>}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

export default function BlocoOrganizador({ organizador: o, titulo, fino }: { organizador: OrganizadorDoEvento | null | undefined; titulo: string; fino?: boolean }) {
  if (!o) return null
  const wa = o.whatsapp && /^55\d{10,11}$/.test(o.whatsapp) ? o.whatsapp : null
  const ig = o.instagram && /^[A-Za-z0-9._]{1,30}$/.test(o.instagram) ? o.instagram : null
  const site = o.site && dominio(o.site) ? o.site : null
  const email = o.email && emailSemProibidos(o.email) && /^[^\s@<>"?&#%]+@[^\s@<>"?&#%]+\.[^\s@<>"?&#%]+$/.test(o.email) ? o.email : null
  const redes = (Array.isArray(o.outras_redes) ? o.outras_redes : [])
    .filter((r) => r && typeof r.rotulo === 'string' && typeof r.url === 'string' && dominio(r.url) && rotuloOk(r.rotulo))
  const cnpj = o.cnpj ? formatCNPJ(o.cnpj) : null
  const temLinks = wa || ig || site || email || redes.length > 0
  if (!o.nome && !o.razao_social && !cnpj && !temLinks) return null

  if (fino) return <Anfitriao o={o} titulo={titulo} wa={wa} ig={ig} site={site} email={email} redes={redes} cnpj={cnpj} />

  return (
    <section aria-labelledby="h-organizador" className="border-t border-border py-6">
      <div className="px-5">
        <h2 id="h-organizador" className="text-[15px] font-semibold leading-5">Organizador</h2>
        {o.nome && <p className="mt-2 break-words text-base font-medium leading-6">{o.nome}</p>}
        {(o.razao_social || cnpj) && (
          <p className="break-words text-[13px] leading-5 text-muted-foreground">
            {[o.razao_social, cnpj && `CNPJ ${cnpj}`].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
      {temLinks && (
        <div className="mt-3">
          {wa && <Item icone={<I.Conversa size={20} />} rotulo="WhatsApp" sub="wa.me" href={`https://wa.me/${wa}?text=${encodeURIComponent(`Olá! Vi o evento ${titulo} na Evokaa.`)}`} />}
          {ig && <Item icone={<I.Arroba size={20} />} rotulo="Instagram" sub={`instagram.com/${ig}`} href={`https://instagram.com/${ig}`} />}
          {site && <Item icone={<I.Globo size={20} />} rotulo="Site" sub={dominio(site)!} href={site} />}
          {email && (
            <a href={`mailto:${email}`} className={classeLink}>
              <span className="shrink-0 text-muted-foreground"><I.Email size={20} /></span>
              <span className="min-w-0 flex-1 break-words text-base leading-6">E-mail<span className="block text-[13px] leading-5 text-muted-foreground">{email}</span></span>
            </a>
          )}
          {redes.map((r, i) => <Item key={i} icone={<I.Link size={20} />} rotulo={r.rotulo} sub={dominio(r.url)!} href={r.url} />)}
        </div>
      )}
    </section>
  )
}
