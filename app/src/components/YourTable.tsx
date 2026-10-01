import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Users, Loader2, Flag, LogOut, Undo2, Bell, Clock, ShieldAlert, ExternalLink, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  useMyTable,
  useMesasParaEscolher,
  useEscolherMesa,
  useMatchmakingProfile,
  useMesaAvisos,
  useMesaSair,
  useMesaVoltar,
  useMesaRevogar,
  useMesaRede,
  useMesaDenunciar,
  consentimentoVigente,
  redeVigente,
  type MesaCartao,
  type MotivoDenuncia,
} from '../hooks/useMatchmaking'
import { ESCOLARIDADE, FAIXAS_IDADE, REDE_SOCIAL_RE, etiquetasEmComum, rotuloTag, type MesaTags } from '../lib/mesaTags'
import { MesaTermoModal, FotoModeracaoAviso } from './CollectiveTableCard'
import ProfileQuiz from './ProfileQuiz'

interface YourTableProps {
  eventId: string
}

// "DD/MM às HH:MM" no horário de Brasília, seja qual for o fuso do aparelho
function formaEmTexto(iso: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(iso)).map(x => [x.type, x.value])
  )
  return `${p.day}/${p.month} às ${p.hour}:${p.minute}`
}

const MOTIVOS: Record<MotivoDenuncia, string> = {
  assedio: 'Assédio',
  perfil_falso: 'Perfil falso',
  conteudo_improprio: 'Conteúdo impróprio',
  outro: 'Outro motivo',
}

const MOTIVO_ESCOLHA: Record<string, string> = {
  sem_ingresso: 'A escolha de mesa aparece quando o pagamento do ingresso for confirmado.',
  fora_do_prazo: 'Escolha e troca de mesa só até 2 h antes do evento.',
  travado: 'Sua participação nas mesas deste evento foi suspensa pela organização.',
  sem_perfil: 'Para escolher a mesa, aceite o termo e tenha nome, data de nascimento e foto aprovada no Perfil.',
  saiu: 'Você saiu do Match de Mesa neste evento: volte para escolher a mesa.',
}

/* ============================================================
   Cartão de uma pessoa
   ============================================================ */

function Cartao({ c, minhasTags, eu, onDenunciar }: {
  c: MesaCartao
  minhasTags?: MesaTags | null
  eu?: boolean
  onDenunciar?: (c: MesaCartao) => void
}) {
  if (!c.id && c.nome === 'Lugar ocupado') {
    return (
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-dashed border-white/10 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center"><Users className="w-5 h-5 text-cream/40" /></div>
        <span className="text-sm text-cream/70">Lugar ocupado</span>
      </div>
    )
  }
  const comuns = eu ? new Set<string>() : etiquetasEmComum(minhasTags, c.tags)
  const tags = Object.entries(c.tags ?? {})
    .flatMap(([cat, lista]) => (lista ?? []).map(slug => ({ cat, slug, comum: comuns.has(`${cat}:${slug}`) })))
    .sort((a, b) => Number(b.comum) - Number(a.comum))
  return (
    <div className={`p-4 rounded-2xl border ${eu ? 'bg-plum/10 border-plum/30' : 'bg-white/[0.03] border-white/10'}`}>
      <div className="flex items-center gap-3">
        {/* só JPEG em base64 (o que o Perfil grava): URL externa não vira img */}
        {c.foto?.startsWith('data:image/jpeg;base64,') ? (
          <img src={c.foto} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-plum/20 flex items-center justify-center flex-shrink-0 font-semibold">
            {c.nome.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{c.nome}{eu && <span className="text-cream/70"> (você)</span>}</div>
          <div className="text-xs text-cream/70">
            {[c.faixa_idade && (FAIXAS_IDADE[c.faixa_idade] ?? c.faixa_idade), c.perfil,
              c.escolaridade && (ESCOLARIDADE[c.escolaridade as keyof typeof ESCOLARIDADE] ?? c.escolaridade)]
              .filter(Boolean).join(' · ')}
          </div>
        </div>
        {!eu && c.id && onDenunciar && (
          <button onClick={() => onDenunciar(c)} className="p-2 rounded-full text-cream/70 hover:text-red-300 hover:bg-white/5" aria-label={`Denunciar ${c.nome}`} title="Denunciar">
            <Flag className="w-4 h-4" />
          </button>
        )}
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {tags.map(t => (
            <span key={`${t.cat}:${t.slug}`} className={`px-2 py-0.5 rounded-full text-[11px] border ${t.comum ? 'bg-plum/30 border-plum/50 text-cream font-medium' : 'bg-white/5 border-white/10 text-cream/70'}`}>
              {rotuloTag(t.cat, t.slug)}{t.comum && <span className="sr-only"> (em comum)</span>}
            </span>
          ))}
        </div>
      )}
      {c.rede_social && REDE_SOCIAL_RE.test(c.rede_social) && (
        <a href={c.rede_social} target="_blank" rel="noopener noreferrer nofollow ugc" className="inline-flex items-center gap-1 mt-3 text-xs text-plum-light hover:underline">
          <ExternalLink className="w-3 h-3" /> Rede social
        </a>
      )}
    </div>
  )
}

/* ============================================================
   Escolher ou trocar de mesa
   ============================================================ */

function EscolherMesa({ eventId, minhasTags, onDenunciar, onFeito }: {
  eventId: string
  minhasTags?: MesaTags | null
  onDenunciar: (c: MesaCartao) => void
  onFeito: () => void
}) {
  const { data, isLoading, error } = useMesasParaEscolher(eventId)
  const escolher = useEscolherMesa(eventId)
  const entrar = (numero: number | null) =>
    escolher.mutate(numero, {
      onSuccess: (r) => { toast.success(`Você está na ${r.nome}.`); onFeito() },
      onError: (e) => toast.error(e.message),
    })

  if (isLoading) return <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-plum" /></div>
  if (error) return <p className="text-sm text-cream/70">{error.message}</p>
  if (data?.motivo) return <p className="text-sm text-cream/70">{MOTIVO_ESCOLHA[data.motivo] ?? 'Escolha de mesa indisponível agora.'}</p>

  return (
    <div className="space-y-4">
      <p className="text-xs text-cream/70">Troca livre enquanto houver vaga, até 2 h antes do evento, com 30 minutos entre uma troca e outra.</p>
      {(data?.mesas ?? []).length === 0 && <p className="text-sm text-cream/70">Nenhuma outra mesa com vaga agora.</p>}
      {(data?.mesas ?? []).map(m => (
        <div key={m.numero} className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-serif text-lg">Mesa {m.numero}</div>
              <div className="text-xs text-cream/70">{m.vagas} {m.vagas === 1 ? 'vaga' : 'vagas'}</div>
            </div>
            <button
              onClick={() => entrar(m.numero)}
              disabled={escolher.isPending}
              className="px-4 py-2 bg-plum text-cream text-xs font-medium rounded-full hover:shadow-glow disabled:opacity-50"
            >
              Entrar na Mesa {m.numero}
            </button>
          </div>
          {m.etiquetas && m.etiquetas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {m.etiquetas.slice(0, 8).map(e => (
                <span key={`${e.categoria}:${e.etiqueta}`} className="px-2 py-0.5 rounded-full text-[11px] bg-white/5 border border-white/10 text-cream/70">
                  {rotuloTag(e.categoria, e.etiqueta)} · {e.pessoas}
                </span>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {m.pessoas.map((p, i) => <Cartao key={p.id ?? `oc-${i}`} c={p} minhasTags={minhasTags} onDenunciar={onDenunciar} />)}
          </div>
        </div>
      ))}
      <button
        onClick={() => entrar(null)}
        disabled={escolher.isPending}
        className="w-full py-3 rounded-full border border-plum/40 text-cream text-sm hover:bg-plum/10 flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Plus className="w-4 h-4" /> Mesa nova
      </button>
    </div>
  )
}

/* ============================================================
   Denúncia
   ============================================================ */

function Denunciar({ alvo, onFechar }: { alvo: MesaCartao; onFechar: () => void }) {
  const [motivo, setMotivo] = useState<MotivoDenuncia | null>(null)
  const [detalhe, setDetalhe] = useState('')
  const denunciar = useMesaDenunciar()
  const enviar = () => {
    if (!motivo || !alvo.id) return
    denunciar.mutate({ membro: alvo.id, motivo, detalhe }, {
      onSuccess: (r) => {
        if (r?.ja_denunciado) toast.info('Você já denunciou esta pessoa neste evento.')
        else toast.success('Denúncia enviada. A equipe da Evokaa vai analisar.')
        onFechar()
      },
      // 23514: CHECK do detalhe (caractere de controle ou de direção de texto)
      onError: (e) => toast.error((e as Error & { code?: string }).code === '23514' ? 'Texto com caracteres não permitidos.' : e.message),
    })
  }
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 glass-backdrop" role="dialog" aria-modal="true" aria-labelledby="denuncia-titulo" style={{ paddingBottom: 'calc(var(--cookie-banner-h, 0px) + 1rem)' }}>
      <div className="glass-panel p-6 max-w-md w-full max-h-full overflow-y-auto">
        <h3 id="denuncia-titulo" className="font-serif text-xl text-cream mb-1">Denunciar {alvo.nome}</h3>
        <p className="text-xs text-cream/70 mb-4">A denúncia vai para a equipe da Evokaa, que analisa. Ninguém é bloqueado automaticamente. Depois da análise da equipe da Evokaa, a organização do evento pode ver o motivo e quem foi denunciado; seu nome e o detalhe não são mostrados a ela.</p>
        <fieldset className="space-y-2 mb-4">
          <legend className="text-sm text-cream mb-2">Motivo</legend>
          {(Object.keys(MOTIVOS) as MotivoDenuncia[]).map(m => (
            <label key={m} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer text-sm text-cream/80">
              <input type="radio" name="motivo" className="accent-plum" checked={motivo === m} onChange={() => setMotivo(m)} />
              {MOTIVOS[m]}
            </label>
          ))}
        </fieldset>
        <label className="block text-sm text-cream mb-1" htmlFor="denuncia-detalhe">Detalhe (opcional)</label>
        <textarea
          id="denuncia-detalhe"
          value={detalhe}
          onChange={(e) => setDetalhe(e.target.value)}
          maxLength={500}
          rows={3}
          className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-sm text-cream placeholder:text-cream/40 outline-none focus:border-plum/50"
          placeholder="O que aconteceu?"
        />
        <p className="text-[11px] text-cream/70 mt-1 mb-4">
          Não escreva dados de saúde, religião, orientação sexual ou de outras pessoas. {detalhe.length}/500
        </p>
        <div className="flex gap-2">
          <button onClick={onFechar} className="flex-1 py-2.5 text-sm text-cream/70 hover:text-cream">Cancelar</button>
          <button
            onClick={enviar}
            disabled={!motivo || denunciar.isPending}
            className="flex-1 py-2.5 bg-plum text-cream text-sm font-medium rounded-full disabled:opacity-50"
          >
            {denunciar.isPending ? 'Enviando...' : 'Enviar denúncia'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/* ============================================================
   Sua mesa
   ============================================================ */

export default function YourTable({ eventId }: YourTableProps) {
  const { data, isLoading, error } = useMyTable(eventId)
  const { profile } = useMatchmakingProfile()
  const { avisos, marcarLidos } = useMesaAvisos()
  const sair = useMesaSair(eventId)
  const voltar = useMesaVoltar(eventId)
  const revogar = useMesaRevogar()
  const rede = useMesaRede()

  const [escolhendo, setEscolhendo] = useState(false)
  const [termo, setTermo] = useState(false)
  const [quiz, setQuiz] = useState(false)
  const [revogando, setRevogando] = useState(false)
  const [alvo, setAlvo] = useState<MesaCartao | null>(null)

  const caixa = 'bg-void text-cream rounded-3xl p-5 sm:p-8'
  const avisosEvento = (avisos.data ?? []).filter(a => a.evento === eventId && !a.lido)
  const blocoAvisos = avisosEvento.length > 0 && (
    <div className="p-4 rounded-2xl bg-plum/10 border border-plum/30 space-y-2" role="status">
      {avisosEvento.map(a => (
        <div key={a.id} className="flex items-start gap-2 text-sm">
          <Bell className="w-4 h-4 text-plum flex-shrink-0 mt-0.5" />
          <span>{a.mensagem}{a.mesa ? ` (${a.mesa})` : ''}</span>
        </div>
      ))}
      <button onClick={() => marcarLidos.mutate()} disabled={marcarLidos.isPending} className="text-xs text-plum-light hover:underline">
        Ok, entendi
      </button>
    </div>
  )

  if (isLoading) {
    return (
      <div className={`${caixa} min-h-[200px] flex flex-col items-center justify-center`}>
        <Loader2 className="w-8 h-8 text-plum animate-spin mb-3" />
        <p className="text-sm text-cream/70">Carregando sua mesa</p>
      </div>
    )
  }
  if (error || !data) {
    return <div className={caixa}><p className="text-sm text-cream/70">{error?.message ?? 'Não foi possível carregar sua mesa.'}</p></div>
  }
  if (data.travado) {
    return (
      <div className={`${caixa} space-y-4`}>
        {blocoAvisos}
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm">Sua participação nas mesas deste evento foi suspensa pela organização.</p>
        </div>
      </div>
    )
  }
  // sem ingresso coletivo ativo: o banco não devolve nem a data de formação
  if (!data.forma_em && data.mesas.length === 0) {
    return (
      <div className={caixa}>
        <h3 className="font-serif text-xl mb-2">Sua mesa</h3>
        <p className="text-sm text-cream/70">Sua mesa aparece aqui quando o pagamento do ingresso for confirmado.</p>
      </div>
    )
  }

  const consentido = consentimentoVigente(profile)
  const colegasTodos = data.mesas.flatMap(m => m.colegas ?? [])
  const minhasTags = colegasTodos.find(c => c.eu)?.tags ?? profile?.tags

  const acao = (m: { mutate: (v: void, o: { onSuccess: () => void; onError: (e: Error) => void }) => void }, ok: string) =>
    m.mutate(undefined, { onSuccess: () => toast.success(ok), onError: (e) => toast.error(e.message) })

  return (
    <div className={`${caixa} space-y-5`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-cream/70">Match de Mesa</span>
          <h3 className="font-serif text-2xl">Sua mesa</h3>
        </div>
        <Users className="w-6 h-6 text-plum" />
      </div>

      {blocoAvisos}

      {!consentido ? (
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
          <p className="text-sm mb-3">
            Você aparece para os colegas só pelo primeiro nome, e vê os colegas do mesmo jeito. Aceite o termo
            para mostrar e ver foto, faixa de idade, perfil e gostos, e para escolher a sua mesa.
          </p>
          <button onClick={() => setTermo(true)} className="px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow">
            Ler e aceitar o termo
          </button>
        </div>
      ) : (
        <FotoModeracaoAviso />
      )}

      {data.saiu && (
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
          <p className="text-sm mb-3">Você saiu do Match de Mesa neste evento: seu lugar continua, mas seu perfil não aparece para ninguém.</p>
          <button onClick={() => acao(voltar, 'Seu perfil voltou a aparecer na mesa.')} disabled={voltar.isPending} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 text-sm hover:bg-white/5">
            <Undo2 className="w-4 h-4" /> Voltar ao Match de Mesa
          </button>
        </div>
      )}

      {data.mesas.length === 0 ? (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
          <Clock className="w-5 h-5 text-plum flex-shrink-0 mt-0.5" />
          {new Date(data.forma_em!) < new Date() ? (
            <p className="text-sm">Sua mesa está sendo formada; volte em alguns minutos.</p>
          ) : (
            <p className="text-sm">
              Sua mesa será formada em <strong>{formaEmTexto(data.forma_em!)}</strong> (horário de Brasília).
              {consentido && ' Antes disso, você pode escolher a sua.'}
            </p>
          )}
        </div>
      ) : (
        data.mesas.map(m => (
          <div key={m.nome} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h4 className="font-serif text-xl">{m.nome}</h4>
              <span className="text-xs text-cream/70">{(m.colegas ?? []).length} de {m.capacidade} lugares</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(m.colegas ?? []).map((c, i) => (
                <Cartao key={c.id ?? `oc-${i}`} c={c} eu={c.eu} minhasTags={minhasTags} onDenunciar={setAlvo} />
              ))}
            </div>
          </div>
        ))
      )}

      {consentido && !data.saiu && (
        <div>
          <button onClick={() => setEscolhendo(!escolhendo)} className="w-full py-3 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow">
            {escolhendo ? 'Fechar a lista de mesas' : data.mesas.length ? 'Trocar de mesa' : 'Escolher minha mesa'}
          </button>
          {escolhendo && (
            <div className="mt-4">
              <EscolherMesa eventId={eventId} minhasTags={minhasTags} onDenunciar={setAlvo} onFeito={() => setEscolhendo(false)} />
            </div>
          )}
        </div>
      )}

      {consentido && (
        <div className="pt-4 border-t border-white/10 space-y-3 text-sm">
          <button onClick={() => setQuiz(true)} className="text-plum-light hover:underline">Editar meu perfil de mesa</button>
          {profile?.social_url && (
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 accent-plum"
                checked={redeVigente(profile)}
                disabled={rede.isPending}
                onChange={(e) => rede.mutate(e.target.checked, { onError: (err) => toast.error(err.message) })}
              />
              <span className="text-cream/80">Mostrar minha rede social aos colegas de mesa e a quem estiver escolhendo mesa neste evento (mesmo tipo de ingresso). Opcional; dá para tirar depois.</span>
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            {data.mesas.length > 0 && !data.saiu && (
              <button onClick={() => acao(sair, 'Você saiu do Match de Mesa. Seu lugar continua.')} disabled={sair.isPending} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 text-xs hover:bg-white/5">
                <LogOut className="w-3.5 h-3.5" /> Sair do Match de Mesa
              </button>
            )}
            {!revogando && (
              <button onClick={() => setRevogando(true)} className="px-4 py-2 rounded-full border border-red-400/30 text-xs text-red-200 hover:bg-red-500/10">
                Revogar consentimento
              </button>
            )}
          </div>
          {revogando && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 space-y-3" role="alertdialog" aria-label="Confirmar revogação">
              <p>Revogar apaga suas respostas, etiquetas, escolaridade e rede social. Seu lugar na mesa continua, só com o primeiro nome.</p>
              <div className="flex gap-2">
                <button onClick={() => setRevogando(false)} className="px-4 py-2 text-xs text-cream/70 hover:text-cream">Cancelar</button>
                <button
                  onClick={() => revogar.mutate(undefined, {
                    onSuccess: () => { setRevogando(false); toast.success('Consentimento revogado e respostas apagadas.') },
                    onError: (e) => toast.error(e.message),
                  })}
                  disabled={revogar.isPending}
                  className="px-4 py-2 rounded-full bg-red-500/80 text-cream text-xs font-medium disabled:opacity-50"
                >
                  {revogar.isPending ? 'Revogando...' : 'Confirmar revogação'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {termo && <MesaTermoModal onAceito={() => { setTermo(false); setQuiz(true) }} onFechar={() => setTermo(false)} />}
      {quiz && createPortal(<ProfileQuiz onComplete={() => setQuiz(false)} onCancel={() => setQuiz(false)} />, document.body)}
      {alvo && <Denunciar alvo={alvo} onFechar={() => setAlvo(null)} />}
    </div>
  )
}
