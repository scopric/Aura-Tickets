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

export default function BlocoOrganizador({ organizador: o, titulo }: { organizador: OrganizadorDoEvento | null | undefined; titulo: string }) {
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
