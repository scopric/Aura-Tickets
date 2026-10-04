import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as I from '@/components/icones/evokaa16'
import EventoCapa from '../../components/EventoCapa'
import { PageHeader, SectionTitle, selectNativo } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '../../hooks/useAuth'
import { useDuplicarEvento } from '../../hooks/useDuplicarEvento'
import { useCreateEvent, useProducerEvents } from '../../hooks/useEvents'
import { confirmacaoDuplicar } from '../../lib/eventoProdutor'
import { FORMATOS } from '../../lib/tipoEvento'
import { dataComSemana } from '../../lib/visaoEvento'

// Começo rápido (F1 PR3c): do zero (só o nome é obrigatório), com o Evo ou copiando um evento anterior.
// Nasce rascunho sem ingressos; o resto se completa no painel do evento (/producer/events/:id/edit).
const ERRO_NOME = 'Escreva o nome: ele aparece na página e no ingresso.'
const ERRO_DATA = 'Escolha a data: a hora só vale junto com ela.'
const MAX_COPIAS = 6

export default function ComecoRapido() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const criar = useCreateEvent()
  const { data: eventos = [], isLoading, isError, refetch, isFetching } = useProducerEvents()
  const { duplicar, duplicando } = useDuplicarEvento()
  const podeEvo = user?.role === 'producer' || user?.role === 'admin' // o mesmo critério do EvoHub

  const [nome, setNome] = useState('')
  const [formato, setFormato] = useState('')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [cidade, setCidade] = useState('')
  const [tentou, setTentou] = useState(false)
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState('')
  const emCurso = useRef(false) // o estado só vale no próximo render: o ref impede o duplo envio

  const erroNome = tentou && !nome.trim()
  const erroData = tentou && !!hora && !data

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault()
    if (emCurso.current) return
    setTentou(true)
    setErro('')
    if (!nome.trim() || (hora && !data)) return
    emCurso.current = true
    setCriando(true)
    try {
      const evento = await criar.mutateAsync({
        event: {
          title: nome.trim(), category: formato || null, date: data || null, time: data ? hora || null : null,
          venue_city: cidade.trim() || null, status: 'draft',
        },
        tickets: [],
      })
      navigate(`/producer/events/${(evento as { id: string }).id}/edit`)
    } catch (err) {
      console.error('[ComecoRapido] criar rascunho', err)
      setErro('Não foi possível criar o rascunho. Confira a internet e tente de novo.')
      emCurso.current = false
      setCriando(false)
    }
  }

  const rotulo = 'mb-1.5 text-[13px] font-medium leading-5'
  const ajuda = 'text-xs leading-4 text-muted-foreground'
  const msgErro = 'mt-1.5 flex items-center gap-1.5 text-xs leading-4 text-destructive'

  return (
    <div>
      <PageHeader
        title="Criar evento"
        description="Em um minuto ele vira rascunho. O resto você completa no painel do evento, que salva sozinho. Nada vai ao ar antes de você enviar e a equipe aprovar."
      />

      <div className="grid gap-10 min-[1100px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] min-[1100px]:gap-12">
        <form onSubmit={enviar} noValidate aria-labelledby="t-zero" className="grid content-start gap-5">
          <SectionTitle id="t-zero">Do zero</SectionTitle>

          <div>
            <Label htmlFor="c-nome" className={rotulo}>Nome do evento</Label>
            <Input
              id="c-nome" value={nome} onChange={e => setNome(e.target.value)} maxLength={80} autoComplete="off" placeholder="Ex.: Noite de Forró"
              aria-invalid={erroNome || undefined} aria-describedby={erroNome ? 'e-nome' : undefined}
            />
            {erroNome && <p id="e-nome" className={msgErro}><I.Erro size={16} aria-hidden="true" />{ERRO_NOME}</p>}
          </div>

          <div>
            <Label htmlFor="c-formato" className={rotulo}>Formato</Label>
            <select id="c-formato" value={formato} onChange={e => setFormato(e.target.value)} className={selectNativo}>
              <option value="">Escolha o formato</option>
              {FORMATOS.map(f => <option key={f.valor} value={f.valor}>{f.rotulo}</option>)}
            </select>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="c-data" className={rotulo}>Data</Label>
              <Input
                id="c-data" type="date" value={data} onChange={e => setData(e.target.value)}
                aria-invalid={erroData || undefined} aria-describedby={erroData ? 'e-data' : undefined}
              />
              {erroData && <p id="e-data" className={msgErro}><I.Erro size={16} aria-hidden="true" />{ERRO_DATA}</p>}
            </div>
            <div>
              <Label htmlFor="c-hora" className={rotulo}>Hora de início</Label>
              <Input id="c-hora" type="time" value={hora} onChange={e => setHora(e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="c-cidade" className={rotulo}>Cidade</Label>
            <Input id="c-cidade" value={cidade} onChange={e => setCidade(e.target.value)} maxLength={100} autoComplete="address-level2" aria-describedby="a-cidade" />
            <p id="a-cidade" className={`${ajuda} mt-1.5`}>O endereço completo, com CEP, entra no painel. Ainda não sabe a data ou o local? Crie assim mesmo: o rascunho espera.</p>
          </div>

          {erro && <p role="alert" className={msgErro}><I.Erro size={16} aria-hidden="true" />{erro}</p>}

          <div className="flex flex-wrap items-center gap-4 pt-1">
            <Button type="submit" disabled={criando} loading={criando}>
              Criar rascunho<I.SetaDireita aria-hidden="true" />
            </Button>
            <span className={ajuda}>Só o nome é obrigatório agora.</span>
          </div>
        </form>

        <div aria-label="Outros jeitos de começar" className="grid content-start border-t border-border">
          {podeEvo && (
            <section aria-labelledby="t-evo" className="grid grid-cols-[48px_minmax(0,1fr)] gap-4 border-b border-border py-5">
              <img src="/evo/evo-corpo-acenando.webp" alt="" width={48} height={64} className="h-16 w-12 object-contain" />
              <div className="grid justify-items-start gap-2">
                <SectionTitle id="t-evo">Montar com o Evo</SectionTitle>
                <p className="text-sm text-muted-foreground">Conte em poucas palavras como é o evento. O Evo propõe nome, formato, temas, data e ingressos; você confere antes de virar rascunho.</p>
                <Button type="button" variant="outline" size="sm" onClick={() => window.dispatchEvent(new Event('evo:planejar'))}>Abrir o Evo</Button>
              </div>
            </section>
          )}

          <section aria-labelledby="t-copia" className="border-b border-border py-5">
            <SectionTitle id="t-copia">Copiar de um evento anterior</SectionTitle>
            <p className="mt-1 text-sm text-muted-foreground">Copia tudo, menos datas, vendas, aprovação e destaque. A foto e os ingressos vão junto.</p>
            {isLoading ? (
              <div aria-busy="true" className="mt-3 space-y-2">
                {[1, 2].map(n => <Skeleton key={n} className="h-14 rounded-md bg-muted" />)}
              </div>
            ) : isError ? (
              <div role="alert" className="mt-3 flex flex-col gap-2 text-sm">
                <p>Não foi possível carregar seus eventos.</p>
                <Button variant="outline" size="sm" className="self-start" onClick={() => refetch()} loading={isFetching}>Tentar de novo</Button>
              </div>
            ) : eventos.length === 0 ? (
              <p className={`${ajuda} mt-3`}>Quando você tiver o primeiro evento, ele aparece aqui para copiar.</p>
            ) : (
              <>
                <ul className="mt-3">
                  {eventos.slice(0, MAX_COPIAS).map(e => (
                    <li key={e.id} className="flex min-h-14 items-center gap-3 border-t border-border first:border-t-0">
                      <EventoCapa evento={e} tamanho="mini-p" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{e.title}</span>
                        <span className={`${ajuda} block truncate`}>
                          {[e.date ? dataComSemana(e.date) : 'sem data', e.venue_name || e.venue_city].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <Button
                        type="button" variant="outline" size="sm" disabled={duplicando} aria-label={`Copiar ${e.title}`}
                        onClick={() => { if (window.confirm(confirmacaoDuplicar(e.title))) void duplicar(e) }}
                      >
                        <I.Copiar aria-hidden="true" />Copiar
                      </Button>
                    </li>
                  ))}
                </ul>
                {eventos.length > MAX_COPIAS && (
                  <p className={`${ajuda} mt-3`}>Mostrando os {MAX_COPIAS} mais recentes. Para copiar outro, use o ícone de duplicar em <Link to="/producer/events" className="underline underline-offset-2">Meus eventos</Link>.</p>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
