import type { ReactNode } from 'react'
import * as I from '@/components/icones/evokaa16'
import { formatCNPJ } from '../lib/formatters'
import { marcaOk, rotuloOk, emailSemProibidos } from '../lib/organizadorTexto'
import type { OrganizadorDoEvento } from '../hooks/useOrganizadorDoEvento'

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

// Pílula fina (vitrine nova): mesmo conteúdo e mesmo rel do Item, só o visual muda
const classePilula = 'alvo-44 inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-border px-4 py-1.5 text-left transition-colors duration-rapido hover:bg-[var(--ev-tint-hover)] focus-visible:outline-none focus-visible:shadow-ev-foco motion-reduce:transition-none'

function Item({ icone, rotulo, sub, href, fino }: { icone: ReactNode; rotulo: string; sub?: string; href: string; fino?: boolean }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={fino ? classePilula : classeLink}>
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

  return (
    <section aria-labelledby="h-organizador" className="border-t border-border py-6">
      <div className="px-5">
        <h2 id="h-organizador" className={fino ? 'flex items-center gap-4 text-[11px] font-semibold uppercase leading-5 tracking-[0.08em] text-muted-foreground after:h-px after:flex-1 after:bg-border' : 'text-[15px] font-semibold leading-5'}>Organizador</h2>
        {fino && (o.nome || o.razao_social) && (
          <span aria-hidden="true" className="font-display mt-3 grid size-12 place-items-center rounded-full border border-border text-base font-extrabold" style={{ background: 'var(--evento-fundo)', color: 'var(--evento-texto)' }}>
            {Array.from((o.nome || o.razao_social || '').trim().split(/\s+/).slice(0, 2).map((p) => Array.from(p)[0] ?? '').join('').toUpperCase()).join('')}
          </span>
        )}
        {o.nome && <p className="mt-2 break-words text-base font-medium leading-6">{o.nome}</p>}
        {(o.razao_social || cnpj) && (
          <p className="break-words text-[13px] leading-5 text-muted-foreground">
            {[o.razao_social, cnpj && `CNPJ ${cnpj}`].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
      {temLinks && (
        <div className={fino ? 'mx-5 mt-4 flex flex-wrap gap-2' : 'mt-3'}>
          {wa && <Item fino={fino} icone={<I.Conversa size={20} />} rotulo="WhatsApp" sub="wa.me" href={`https://wa.me/${wa}?text=${encodeURIComponent(`Olá! Vi o evento ${titulo} na Evokaa.`)}`} />}
          {ig && <Item fino={fino} icone={<I.Arroba size={20} />} rotulo="Instagram" sub={`instagram.com/${ig}`} href={`https://instagram.com/${ig}`} />}
          {site && <Item fino={fino} icone={<I.Globo size={20} />} rotulo="Site" sub={dominio(site)!} href={site} />}
          {email && (
            <a href={`mailto:${email}`} className={fino ? classePilula : classeLink}>
              <span className="shrink-0 text-muted-foreground"><I.Email size={20} /></span>
              <span className="min-w-0 flex-1 break-words text-base leading-6">E-mail<span className="block text-[13px] leading-5 text-muted-foreground">{email}</span></span>
            </a>
          )}
          {redes.map((r, i) => <Item key={i} fino={fino} icone={<I.Link size={20} />} rotulo={r.rotulo} sub={dominio(r.url)!} href={r.url} />)}
        </div>
      )}
    </section>
  )
}
