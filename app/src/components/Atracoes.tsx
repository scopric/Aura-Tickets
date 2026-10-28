import { cn } from '@/lib/utils'

export interface Atracao { id: string; nome: string; foto?: string | null; instagram?: string | null }

const MAX = 12
const INSTAGRAM = /^[A-Za-z0-9._]{1,30}$/ // a mesma regra do BlocoOrganizador

// Foto só por https; data:image/ apenas em desenvolvimento (o modo demonstração)
const fotoOk = (u?: string | null): u is string => typeof u === 'string' && (/^https:\/\//i.test(u) || (import.meta.env.DEV && /^data:image\//i.test(u)))
const iniciais = (nome: string) => Array.from(nome.trim().split(/\s+/).slice(0, 2).map((p) => Array.from(p)[0] ?? '').join('').toUpperCase()).join('')

// Atrações do evento: lista simples (foto redonda ou monograma, nome, Instagram). Nada de HTML: nome e usuário sempre como texto.
export default function Atracoes({ atracoes }: { atracoes: Atracao[] }) {
  const lista = atracoes.filter((a) => a && typeof a.nome === 'string' && a.nome.trim()).slice(0, MAX)
  if (lista.length === 0) return null
  return (
    <section aria-labelledby="h-atracoes" data-entra="" className="border-t border-border px-5 py-6">
      <h2 id="h-atracoes" className="flex items-center gap-4 text-[11px] font-semibold uppercase leading-5 tracking-[0.08em] text-muted-foreground after:h-px after:flex-1 after:bg-border">Atrações</h2>
      <ul aria-label="Lista de atrações" className="mt-3 divide-y divide-border">
        {lista.map((a) => {
          const ig = a.instagram && INSTAGRAM.test(a.instagram) ? a.instagram : null
          return (
            <li key={a.id} className="flex items-center gap-3 py-3">
              {fotoOk(a.foto) ? (
                <img src={a.foto} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="size-10 shrink-0 rounded-full border border-border object-cover" />
              ) : (
                <span aria-hidden="true" className="evv-monograma grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold">{iniciais(a.nome)}</span>
              )}
              <p className="min-w-0 flex-1 break-words text-base font-medium leading-6">{a.nome}</p>
              {ig && (
                <a
                  href={`https://instagram.com/${ig}`}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className={cn('alvo-44 inline-flex min-w-0 max-w-[45%] items-center text-[13px] text-muted-foreground underline-offset-4 transition-colors duration-rapido hover:text-foreground hover:underline focus-visible:outline-none focus-visible:shadow-ev-foco motion-reduce:transition-none')}
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
