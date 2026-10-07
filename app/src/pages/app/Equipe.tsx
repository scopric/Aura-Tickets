import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '../../lib/supabase'
import { useEventosDaEquipe, useMeusConvites } from '../../hooks/useEventosDaEquipe'

const CARGO = { admin: 'Administrador', editor: 'Editor', viewer: 'Visualizador' } as const

// Erro do banco (team_aceitar_convite) em texto para a pessoa
function mensagemErro(e: { code?: string; message?: string }) {
  if (e.code === '42501') return 'Para aceitar, ative a verificação em duas etapas no seu perfil e entre de novo com o código do aplicativo.'
  if (e.code === 'P0001') return 'Este convite não está mais disponível. Peça ao produtor para convidar de novo.'
  return 'Não deu para aceitar agora. Tente de novo em instantes.'
}

// Equipe da portaria: o convite feito pelo produtor (TeamManager) é aceito aqui; depois, os eventos para o check-in.
export default function Equipe() {
  const qc = useQueryClient()
  const { data: convites = [], isLoading, isError, error: erroLista, refetch } = useMeusConvites()
  const { data: eventos = [], isError: erroEventos, refetch: refetchEventos } = useEventosDaEquipe()
  const [aceitando, setAceitando] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  const aceitar = async (id: string) => {
    setAceitando(id)
    setErro('')
    const { error } = await supabase.rpc('team_aceitar_convite' as never, { p_id: id } as never)
    setAceitando(null)
    if (error) return setErro(mensagemErro(error))
    qc.invalidateQueries({ queryKey: ['team-meus-convites'] })
    qc.invalidateQueries({ queryKey: ['team-eventos'] })
  }

  if (isLoading) return <div aria-busy="true" className="mx-auto max-w-2xl space-y-3 px-4 py-6"><Skeleton className="h-20 rounded-[10px]" /><span className="sr-only" role="status">Carregando convites</span></div>
  if (isError) {
    return (
      <div role="alert" className="mx-auto flex max-w-2xl flex-col items-start gap-3 px-4 py-6">
        <p className="font-semibold">{(erroLista as { code?: string } | null)?.code === '42501'
          ? 'Sua conta tem verificação em duas etapas: entre de novo com o código do aplicativo para ver seus convites.'
          : 'Não deu para carregar seus convites.'}</p>
        <Button variant="outline" onClick={() => refetch()}>Tentar de novo</Button>
      </div>
    )
  }

  const pendentes = convites.filter(c => !c.accepted_at)
  const aceitos = convites.filter(c => c.accepted_at)

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-xl font-semibold">Equipe</h1>
      <p className="mt-1 text-sm text-muted-foreground">Convites de produtores para trabalhar na portaria dos eventos. Aceitar exige a verificação em duas etapas.</p>
      {erro && <p role="alert" className="mt-4 rounded-[10px] border border-destructive p-3 text-sm text-destructive">{erro}</p>}

      {convites.length === 0 && <p role="status" className="mt-6 text-sm">Você não tem convites de equipe.</p>}

      {pendentes.length > 0 && (
        <section aria-labelledby="equipe-pendentes" className="mt-6">
          <h2 id="equipe-pendentes" className="text-base font-semibold">Convites</h2>
          <ul className="mt-2 grid gap-2">
            {pendentes.map(c => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-[10px] border border-border bg-card p-3">
                <span className="text-sm"><strong>{c.producer_name}</strong> · {CARGO[c.role]}</span>
                <Button size="sm" disabled={aceitando === c.id} onClick={() => aceitar(c.id)} aria-label={`Aceitar convite de ${c.producer_name}`}>
                  {aceitando === c.id ? 'Aceitando...' : 'Aceitar'}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {aceitos.length > 0 && (
        <section aria-labelledby="equipe-eventos" className="mt-6">
          <h2 id="equipe-eventos" className="text-base font-semibold">Eventos para o check-in</h2>
          {aceitos.every(c => c.role === 'viewer') ? (
            <p className="mt-2 text-sm text-muted-foreground">Seu cargo é Visualizador: o check-in é feito por Administrador ou Editor.</p>
          ) : erroEventos ? (
            <div role="alert" className="mt-2 flex flex-col items-start gap-2 text-sm">
              <p>Não deu para carregar os eventos.</p>
              <Button variant="outline" size="sm" onClick={() => refetchEventos()}>Tentar de novo</Button>
            </div>
          ) : eventos.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nenhum evento publicado no momento.</p>
          ) : (
            <ul className="mt-2 grid gap-2">
              {eventos.map(e => (
                <li key={e.id}>
                  <Link to={`/equipe/checkin?eventId=${e.id}`} className="block rounded-[10px] border border-border bg-card p-3 text-sm font-medium underline-offset-4 hover:underline">{e.title}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
