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

  if (fino) {
    // Cartão de anfitrião (vitrine): identidade + ação principal, canais em ícones redondos, outras redes em texto
    const nome = o.nome || o.razao_social
    const sub = [o.nome && o.razao_social, cnpj && `CNPJ ${cnpj}`].filter(Boolean).join(' · ')
    const canal = 'alvo-44 grid size-11 place-items-center rounded-full text-muted-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))] transition-colors duration-rapido hover:bg-[var(--ev-tint-hover)] hover:text-foreground focus-visible:bg-[var(--ev-tint-hover)] focus-visible:text-foreground focus-visible:outline-none focus-visible:shadow-ev-foco motion-reduce:transition-none'
    const temCanais = ig || site || email
    return (
      <section aria-labelledby="h-organizador" className="border-t border-border py-6">
        <div className="px-5">
          <h2 id="h-organizador" className="flex items-center gap-4 text-[11px] font-semibold uppercase leading-5 tracking-[0.08em] text-muted-foreground after:h-px after:flex-1 after:bg-border">Organizador</h2>
          <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 md:grid-cols-[auto_minmax(0,1fr)_auto]">
            <span aria-hidden="true" className="font-display grid size-[52px] place-items-center rounded-full border border-border text-lg font-extrabold" style={{ background: 'var(--evento-fundo)', color: 'var(--evento-texto)' }}>
              {Array.from((nome || '').trim().split(/\s+/).slice(0, 2).map((p) => Array.from(p)[0] ?? '').join('').toUpperCase()).join('') || '·'}
            </span>
            <div className="min-w-0">
              {nome && <p className="font-display line-clamp-2 break-words text-lg font-bold leading-6">{nome}</p>}
              {sub && <p className="break-words text-[12.5px] leading-5 text-muted-foreground">{sub}</p>}
            </div>
            {wa && (
              <a
                href={`https://wa.me/${wa}?text=${encodeURIComponent(`Olá! Vi o evento ${titulo} na Evokaa.`)}`}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="alvo-44 col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background shadow-[inset_0_-2px_0_hsl(var(--background)/0.28)] transition-transform duration-rapido hover:bg-foreground/90 focus-visible:outline-none focus-visible:shadow-ev-foco active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0 md:col-span-1"
              >
                <I.Conversa size={18} aria-hidden="true" />
                Falar no WhatsApp<span className="sr-only"> (abre em nova aba)</span>
              </a>
            )}
          </div>
          {(temCanais || redes.length > 0) && (
            <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 md:pl-[68px]">
              {ig && <a href={`https://instagram.com/${ig}`} target="_blank" rel="noopener noreferrer nofollow" aria-label="Instagram (abre em nova aba)" title={`instagram.com/${ig}`} className={canal}><I.Arroba size={20} /></a>}
              {site && <a href={site} target="_blank" rel="noopener noreferrer nofollow" aria-label="Site (abre em nova aba)" title={dominio(site)!} className={canal}><I.Globo size={20} /></a>}
              {email && <a href={`mailto:${email}`} aria-label="E-mail" title={email} className={canal}><I.Email size={20} /></a>}
              {temCanais && redes.length > 0 && <span aria-hidden="true" className="mx-2 h-5 w-px bg-border" />}
              {redes.map((r, i) => (
                <a
                  key={i}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  title={dominio(r.url)!}
                  className="alvo-44 group relative inline-flex min-h-11 items-center gap-1 px-1 text-sm text-muted-foreground transition-colors duration-rapido hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:shadow-ev-foco motion-reduce:transition-none"
                >
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
        </div>
      </section>
    )
  }

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
