export interface Atracao { id: string; nome: string; foto?: string | null; instagram?: string | null }

const MAX = 12
const INSTAGRAM = /^[A-Za-z0-9._]{1,30}$/ // a mesma regra do BlocoOrganizador

// Foto só por https; data:image/ apenas em desenvolvimento (o modo demonstração)
const fotoOk = (u?: string | null): u is string => typeof u === 'string' && (/^https:\/\//i.test(u) || (import.meta.env.DEV && /^data:image\//i.test(u)))
const iniciais = (nome: string) => Array.from(nome.trim().split(/\s+/).slice(0, 2).map((p) => Array.from(p)[0] ?? '').join('').toUpperCase()).join('')

// Atrações do evento em lista (como o "Alinhamento" do DICE): foto redonda ou monograma, nome e, embaixo, o Instagram.
// Nada de HTML: nome e usuário sempre como texto.
export default function Atracoes({ atracoes }: { atracoes: Atracao[] }) {
  const lista = atracoes.filter((a) => a && typeof a.nome === 'string' && a.nome.trim()).slice(0, MAX)
  if (lista.length === 0) return null
  return (
    <section aria-labelledby="h-atracoes" data-entra="" className="border-t border-border px-5 py-6">
      <h2 id="h-atracoes" className="text-[17px] font-semibold leading-6">Atrações</h2>
      <ul className="mt-2">
        {lista.map((a) => {
          const ig = a.instagram && INSTAGRAM.test(a.instagram) ? a.instagram : null
          return (
            <li key={a.id} className="flex items-center gap-3 border-t border-border py-3 first:border-t-0">
              {fotoOk(a.foto) ? (
                <img src={a.foto} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="size-11 shrink-0 rounded-full object-cover" />
              ) : (
                <span aria-hidden="true" className="font-display grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold" style={{ background: 'var(--evento-fundo)', color: 'var(--evento-texto)' }}>{iniciais(a.nome)}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-display line-clamp-2 break-words text-base font-semibold leading-5">{a.nome}</p>
                {ig && (
                  <a
                    href={`https://instagram.com/${ig}`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="alvo-44 inline-flex max-w-full items-center text-[13px] leading-5 text-muted-foreground transition-colors duration-rapido hover:text-foreground focus-visible:outline-none focus-visible:shadow-ev-foco motion-reduce:transition-none"
                  >
                    <span className="truncate">@{ig}</span><span className="sr-only"> (abre em nova aba)</span>
                  </a>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
