import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import EventoCapa from './EventoCapa'
import { supabase } from '../lib/supabase'
import { diaBR } from '../lib/visaoEvento'
import { categoriasDoCatalogo, cidadesDoCatalogo, ordenarPorData, rotuloDia, QUANDO_SLUG, type EventoCatalogo } from '../lib/explorar'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const QUANDO = [['hoje', 'Hoje'], ['amanha', 'Amanhã'], ['fds', 'Fim de semana'], ['mes', 'Este mês']] as const

// Painel "Eventos": só o que a lista /events já entende (atalhos de data em /events/:quando e busca em ?q=).
// Mesma chave e mesma consulta do EventsBrowse: aberto o painel, a lista de /events já está em cache.
export default function PainelEventos({ aoNavegar }: { aoNavegar: () => void }) {
  const hoje = diaBR(Date.now())
  const { data: catalogo = [], isSuccess } = useQuery({
    queryKey: ['explorar-eventos', hoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*, ticket_types (*)')
        .eq('status', 'published')
        .eq('approval_status', 'approved')
        .eq('visibility', 'public')
        .gte('date', hoje)
        .order('date', { ascending: true })
      if (error) throw error
      return (data ?? []) as EventoCatalogo[]
    },
  })
  const proximo = ordenarPorData(catalogo)[0]
  const categorias = categoriasDoCatalogo(catalogo).slice(0, 6)
  const cidades = cidadesDoCatalogo(catalogo).slice(0, 6)
  const item = 'alvo-44 block rounded-ev-md px-3 py-2 text-sm text-foreground transition-colors duration-micro hover:bg-accent focus-visible:outline-none focus-visible:shadow-ev-foco motion-reduce:transition-none'
  const titulo = 'px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground'
  return (
    <div className="grid gap-4 p-4 text-foreground md:grid-cols-[1.1fr_1fr_1fr]">
      <div className="flex flex-col gap-2">
        {proximo ? (
          <Link to={`/event/${proximo.id}`} onClick={aoNavegar} className="alvo-44 group relative flex min-h-[200px] flex-1 flex-col justify-end overflow-hidden rounded-ev-xl border border-border bg-background p-4 text-white transition-transform duration-rapido hover:-translate-y-px focus-visible:outline-none focus-visible:shadow-ev-foco motion-reduce:transition-none motion-reduce:hover:translate-y-0">
            <EventoCapa evento={proximo} tamanho="faixa" />
            <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-black/20" />
            <span className="relative text-[11px] font-semibold uppercase tracking-widest text-white">Próximo evento</span>
            <span className="font-display relative mt-1 text-lg font-extrabold leading-tight tracking-tight">{proximo.title}</span>
            <span className="relative mt-1 text-[13px] text-white">{[rotuloDia(proximo.date!, hoje).curto, proximo.venue_city].filter(Boolean).join(' · ')}</span>
          </Link>
        ) : (
          <div className="flex min-h-[160px] flex-1 items-end rounded-ev-xl border border-border bg-background p-4 text-sm text-muted-foreground">
            {isSuccess ? 'Nenhum evento publicado por enquanto.' : ''}
          </div>
        )}
        <Link to="/events" onClick={aoNavegar} className={cn(item, 'font-semibold')}>Ver todos os eventos</Link>
      </div>
      <div>
        <p className={titulo}>Quando</p>
        {QUANDO.map(([k, nome]) => (
          <Link key={k} to={`/events/${QUANDO_SLUG[k]}`} onClick={aoNavegar} className={item}>{nome}</Link>
        ))}
        {categorias.length > 0 && <p className={cn(titulo, 'mt-2')}>Categorias</p>}
        {categorias.map(c => (
          <Link key={c.chave} to={`/events?q=${encodeURIComponent(c.nome)}`} onClick={aoNavegar} className={item}>{c.nome}</Link>
        ))}
      </div>
      <div>
        {cidades.length > 0 && <p className={titulo}>Cidades</p>}
        {cidades.map(c => (
          <Link key={c.chave} to={`/events?q=${encodeURIComponent(c.nome)}`} onClick={aoNavegar} className={item}>{c.nome}</Link>
        ))}
      </div>
    </div>
  )
}
