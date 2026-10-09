import { cn } from '@/lib/utils'

export interface Atracao { id: string; nome: string; foto?: string | null; instagram?: string | null }

const MAX = 12
const INSTAGRAM = /^[A-Za-z0-9._]{1,30}$/ // a mesma regra do BlocoOrganizador

// Foto só por https; data:image/ apenas em desenvolvimento (o modo demonstração)
const fotoOk = (u?: string | null): u is string => typeof u === 'string' && (/^https:\/\//i.test(u) || (import.meta.env.DEV && /^data:image\//i.test(u)))
const iniciais = (nome: string) => Array.from(nome.trim().split(/\s+/).slice(0, 2).map((p) => Array.from(p)[0] ?? '').join('').toUpperCase()).join('')

// Atrações do evento: carrossel com ímã no celular, grade no computador. Nada de HTML: nome e usuário sempre como texto.
export default function Atracoes({ atracoes }: { atracoes: Atracao[] }) {
  const lista = atracoes.filter((a) => a && typeof a.nome === 'string' && a.nome.trim()).slice(0, MAX)
  if (lista.length === 0) return null
  return (
    <section aria-labelledby="h-atracoes" data-entra="" className="border-t border-border py-6">
      <h2 id="h-atracoes" className="mx-5 flex items-center gap-4 text-[11px] font-semibold uppercase leading-5 tracking-[0.08em] text-muted-foreground after:h-px after:flex-1 after:bg-border">Atrações</h2>
      <ul
        tabIndex={0}
        aria-label="Lista de atrações"
        className="mt-4 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-2 focus-visible:outline-none focus-visible:shadow-ev-foco md:grid md:grid-cols-4 md:overflow-visible"
      >
        {lista.map((a) => {
          const ig = a.instagram && INSTAGRAM.test(a.instagram) ? a.instagram : null
          return (
            <li key={a.id} className="w-[44vw] max-w-[190px] shrink-0 snap-start md:w-auto md:max-w-none">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-border bg-card">
                {fotoOk(a.foto) ? (
                  <img src={a.foto} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="size-full object-cover" />
                ) : (
                  <span aria-hidden="true" className="evv-monograma font-display grid size-full place-items-center text-4xl font-extrabold">{iniciais(a.nome)}</span>
                )}
              </div>
              <p className="font-display wide mt-2 line-clamp-2 break-words text-[15px] font-extrabold leading-5 tracking-[-0.01em]">{a.nome}</p>
              {ig && (
                <a
                  href={`https://instagram.com/${ig}`}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className={cn('alvo-44 mt-1 inline-flex max-w-full items-center rounded-full border border-border px-3 py-0.5 text-[12px] text-muted-foreground transition-colors duration-rapido hover:text-foreground focus-visible:outline-none focus-visible:shadow-ev-foco motion-reduce:transition-none')}
                >
                  <span className="truncate">@{ig}</span><span className="sr-only"> (abre em nova aba)</span>
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
