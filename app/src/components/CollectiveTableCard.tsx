import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Users, Sparkles, ChevronDown, ChevronUp, Check, Info, Camera } from 'lucide-react'
import { toast } from 'sonner'
import type { Ticket } from '../data/mockData'
import ProfileQuiz from './ProfileQuiz'
import { useAuth } from '../hooks/useAuth'
import {
  useMatchmakingProfile, useMesaConsentir, useMesaRede, useMinhaFotoModeracao, useMesaFotoContestar, consentimentoVigente,
} from '../hooks/useMatchmaking'
import { appUrl, siteUrl } from '../lib/appHost'

interface Props {
  ticket: Ticket
  cartQty: number
  onAdd: () => void
  onRemove: () => void
  onQuantityChange: (qty: number) => void
  mostrarAvisoFoto?: boolean // com mais de um ingresso coletivo no evento, o aviso da foto vai só no primeiro
}

export default function CollectiveTableCard({ ticket, cartQty, onAdd, onRemove, onQuantityChange, mostrarAvisoFoto = true }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [showQuiz, setShowQuiz] = useState(false)
  const [showConsent, setShowConsent] = useState(false)
  const { user } = useAuth()
  const { profile } = useMatchmakingProfile()

  const fillPercent = (ticket.sold / ticket.capacity) * 100

  // O aceite e o questionário são opcionais para comprar (a compra exige só a data de nascimento, no
  // checkout). Sem login não há como aceitar: o convite volta em "Sua mesa".
  const handleAdd = () => {
    if (!user || consentimentoVigente(profile)) {
      onAdd()
      return
    }
    setShowConsent(true)
  }

  const fecharQuiz = () => {
    setShowQuiz(false)
    onAdd()
  }

  return (
    <>
      <div className="ticket-card group relative rounded-3xl overflow-hidden backdrop-blur-sm transition-all duration-500 hover:shadow-glow border-2 border-plum/30 bg-gradient-to-br from-plum/10 via-white/5 to-plum/5">
        {/* Badge */}
        <div className="absolute top-4 right-4 z-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-plum text-cream text-xs font-medium rounded-full animate-pulse-glow">
            <Sparkles className="w-3 h-3" />
            Experiência Social
          </span>
        </div>

        {/* Header */}
        <div className="p-6 lg:p-8 pb-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-plum flex items-center justify-center">
              <Users className="w-5 h-5 text-cream" />
            </div>
            <div>
              <h3 className="font-serif text-2xl text-cream">{ticket.name}</h3>
              <p className="text-xs text-cream/70">Mesa compartilhada no evento</p>
            </div>
          </div>

          <p className="text-sm text-cream/70 mb-4 leading-relaxed">{ticket.description}</p>

          <div className="font-serif text-4xl text-cream mb-4">
            R$ {ticket.price}
            <span className="text-sm text-cream/70 font-sans ml-2">/pessoa</span>
          </div>

          {/* Progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-cream/70 mb-2">
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{ticket.sold} pessoas na comunidade</span>
              <span>{ticket.capacity} vagas</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-plum rounded-full transition-all duration-1000" style={{ width: `${fillPercent}%` }} />
            </div>
          </div>

          {/* Perks */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-sm text-plum hover:text-cream transition-colors mb-2"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {expanded ? 'Ocultar benefícios' : 'Ver benefícios'}
          </button>
          <div className={`space-y-2 transition-all overflow-hidden ${expanded ? 'max-h-96 opacity-100 pb-4' : 'max-h-0 opacity-0'}`}>
            {ticket.perks.map((perk, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-cream/70">
                <Check className="w-4 h-4 text-plum flex-shrink-0" />
                {perk}
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="px-6 lg:px-8 py-4 border-t border-white/10">
          <div className="flex items-start gap-3 mb-3">
            <Info className="w-4 h-4 text-cream/40 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-cream/70 leading-relaxed">
              Você senta com outras pessoas que também compraram a mesa coletiva.
              Sua mesa é formada automaticamente 24 h antes do evento, e você pode escolher a sua antes.
            </p>
          </div>
          {mostrarAvisoFoto && user && consentimentoVigente(profile) && <FotoModeracaoAviso />}
        </div>

        {/* Actions */}
        <div className="p-6 lg:p-8 pt-0">
          {cartQty > 0 ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={onRemove} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-cream hover:bg-white/20 transition-colors">-</button>
                <span className="text-cream font-medium">{cartQty}</span>
                <button onClick={() => onQuantityChange(cartQty + 1)} disabled={cartQty >= 1} aria-label="Mais um Match de Mesa" title="1 lugar por conta em cada evento" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-cream hover:bg-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">+</button>
              </div>
              <span className="text-cream/70 text-sm">R$ {ticket.price * cartQty}</span>
            </div>
          ) : (
            <button
              onClick={handleAdd}
              className="w-full py-3 bg-plum text-cream font-medium rounded-full transition-all duration-300 hover:shadow-glow flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Adicionar ao Carrinho
            </button>
          )}
        </div>
      </div>

      {/* Quiz Modal */}
      {/* portal: o cartão fica numa seção com z-index própria, que prenderia o modal atrás das seguintes */}
      {showQuiz && createPortal(<ProfileQuiz onComplete={fecharQuiz} onCancel={fecharQuiz} />, document.body)}

      {/* Consent Modal */}
      {showConsent && (
        <MesaTermoModal
          onAceito={() => { setShowConsent(false); setShowQuiz(true) }}
          onPular={() => { setShowConsent(false); onAdd() }}
          onFechar={() => setShowConsent(false)}
        />
      )}
    </>
  )
}

// Situação da própria foto na moderação (aqui e em "Sua mesa"). O motivo da recusa não chega à pessoa
// (sem leitura de mesa_moderacoes): só o texto genérico. Aprovada ou sem a coluna: nada.
export function FotoModeracaoAviso({ onTrocar, trocarDesativado }: { onTrocar?: () => void; trocarDesativado?: boolean }) {
  const { data: situacao } = useMinhaFotoModeracao()
  const contestar = useMesaFotoContestar()
  const [resposta, setResposta] = useState('')
  const [negada, setNegada] = useState(false) // o banco não aceita contestar esta recusa: some o botão
  const acoes = useRef<HTMLDivElement>(null)

  // a situação mudou (foto nova, outra revisão): os textos da recusa anterior não valem mais, salvo ao ir para
  // 'revisar', onde o "Pedido enviado" tem de ficar
  // (ajuste durante a renderização, não em efeito: o lint do projeto barra setState dentro de useEffect)
  const [situacaoVista, setSituacaoVista] = useState(situacao)
  if (situacao !== situacaoVista) {
    setSituacaoVista(situacao)
    if (situacao !== 'revisar') { setNegada(false); setResposta('') }
  }
  // o botão sumiu: o foco vai para "Trocar foto" em vez de se perder
  useEffect(() => {
    if (negada) acoes.current?.querySelector<HTMLElement>('a, button')?.focus()
  }, [negada])

  const pedirRevisao = () => {
    setResposta('')
    contestar.mutate(undefined, {
      onSuccess: (ok) => {
        if (ok) return setResposta('Pedido enviado. Uma pessoa da equipe vai analisar.')
        setNegada(true)
      },
      onError: (e) => setResposta(e.message), // 42501: mensagem do 2FA em mesaErro
    })
  }

  const texto = situacao === 'sem_foto' ? 'Para aparecer na mesa, envie uma foto do seu rosto.'
    : situacao === 'pendente' ? 'Sua foto está em análise. Seu perfil aparece para os colegas depois da aprovação.'
    : situacao === 'revisar' ? 'Sua foto está com a nossa equipe para análise.'
    : situacao === 'recusada' ? 'Sua foto não foi aprovada. Use uma foto do seu rosto, sem contato escrito (telefone, @, link) e sem conteúdo impróprio. Se a recusa foi automática e você acha que foi engano, peça revisão de uma pessoa da equipe.'
    : null
  if (!texto) return null
  const recusada = situacao === 'recusada'
  const trocar = recusada || situacao === 'sem_foto'

  return (
    <div className={`p-3 rounded-xl border text-sm text-cream space-y-3 ${recusada ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
      <div className="flex items-start gap-2">
        <Camera className={`w-4 h-4 flex-shrink-0 mt-0.5 ${recusada ? 'text-red-300' : 'text-amber-400'}`} />
        <span>{texto}</span>
      </div>
      {trocar && (
        <div ref={acoes} className="flex flex-wrap gap-2">
          {onTrocar ? (
            <button onClick={onTrocar} disabled={trocarDesativado} className="disabled:opacity-50 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-plum text-cream text-xs font-medium hover:shadow-glow">
              {situacao === 'sem_foto' ? 'Enviar foto' : 'Trocar foto'}
            </button>
          ) : (
            <a href={appUrl('/app/profile')} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-plum text-cream text-xs font-medium hover:shadow-glow">
              Trocar foto
            </a>
          )}
          {recusada && !negada && (
            <button onClick={pedirRevisao} disabled={contestar.isPending} className="px-4 py-2 rounded-full border border-white/20 text-xs hover:bg-white/5 disabled:opacity-50">
              {contestar.isPending ? 'Enviando...' : 'Pedir revisão'}
            </button>
          )}
        </div>
      )}
      {/* sempre montado: leitor de tela só anuncia mudança dentro de uma região que já existia */}
      <p role="status" className="text-xs text-cream/80 empty:sr-only">
        {negada && recusada ? (
          <>Esta recusa não pode ser contestada por aqui. Troque a foto ou fale com a equipe <a href={siteUrl('/contato')} className="text-plum-light underline">pelo formulário de contato</a>.</>
        ) : resposta}
      </p>
    </div>
  )
}

// Termo do Match de Mesa: grava o aceite por mesa_consentir (nunca direto na tabela) e, numa caixa
// separada, o segundo aceite da rede social (mesa_mostrar_rede). Usado aqui e em "Sua mesa".
export function MesaTermoModal({ onAceito, onFechar, onPular }: { onAceito: () => void; onFechar: () => void; onPular?: () => void }) {
  const [li, setLi] = useState(false)
  const [rede, setRede] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const consentir = useMesaConsentir()
  const mostrarRede = useMesaRede()
  const salvando = consentir.isPending || mostrarRede.isPending

  const aceitar = async () => {
    setErro(null)
    try {
      await consentir.mutateAsync()
    } catch (e) {
      setErro((e as Error).message)
      return
    }
    if (rede) {
      try {
        await mostrarRede.mutateAsync(true)
      } catch (e) {
        toast.error(`Aceite registrado, mas a rede social não foi liberada: ${(e as Error).message}`)
      }
    }
    toast.success('Aceite registrado.')
    onAceito()
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 glass-backdrop" role="dialog" aria-modal="true" aria-labelledby="mesa-termo-titulo" style={{ paddingBottom: 'calc(var(--cookie-banner-h, 0px) + 1rem)' }}>
      <div className="glass-panel p-6 sm:p-8 max-w-md w-full max-h-full overflow-y-auto">
        <div className="w-12 h-12 rounded-2xl bg-plum/20 flex items-center justify-center mx-auto mb-4">
          <Users className="w-6 h-6 text-plum" />
        </div>
        <h3 id="mesa-termo-titulo" className="font-serif text-xl text-cream text-center mb-3">Match de Mesa</h3>
        {/* ponytail: texto final no PR D (Ricardo revisa) */}
        <div className="text-sm text-cream/70 mb-5 leading-relaxed space-y-2">
          <p>
            Você senta com outras pessoas que compraram este ingresso. As mesas se formam 24 h antes do
            evento, e dá para escolher a sua antes, vendo quem já está nela.
          </p>
          <p>
            O aceite vale para todos os eventos com Match de Mesa até você revogar. Os colegas da sua mesa e
            quem estiver escolhendo mesa no mesmo evento veem seu primeiro nome, sua faixa de idade, sua foto
            (depois de aprovada), seu perfil de mesa (resumo tirado das respostas de temperamento e energia),
            suas etiquetas e sua escolaridade. Não veem as respostas do questionário, só o perfil resumido, nem
            e-mail, telefone ou CPF.
          </p>
          <p>
            A organização do evento vê seu nome completo e sua mesa; a moderação da Evokaa vê sua foto e seu nome.
          </p>
          <p>
            Para participar é preciso ter 18 anos ou mais, nome e foto no Perfil; o resto é opcional. Você pode
            revogar quando quiser em "Sua mesa": suas respostas e etiquetas são apagadas e o lugar continua, só
            com o primeiro nome. As mesas são apagadas 30 dias depois do evento.
          </p>
        </div>
        <div className="space-y-3">
          <label className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
            <input type="checkbox" className="mt-1 accent-plum" checked={li} onChange={(e) => setLi(e.target.checked)} />
            <span className="text-sm text-cream/70">Li e aceito o termo do Match de Mesa.</span>
          </label>
          <label className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
            <input type="checkbox" className="mt-1 accent-plum" checked={rede} onChange={(e) => setRede(e.target.checked)} />
            <span className="text-sm text-cream/70">
              Mostrar minha rede social aos colegas de mesa e a quem estiver escolhendo mesa neste evento (mesmo tipo de ingresso). Opcional; dá para tirar depois.
            </span>
          </label>
          {erro && (
            <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-cream">
              {erro}
              {/nome|foto|nascimento|18/i.test(erro) && (
                <a href={appUrl('/app/profile')} className="block mt-1 text-plum-light underline">Completar meu Perfil</a>
              )}
            </div>
          )}
          <button
            onClick={aceitar}
            disabled={!li || salvando}
            className="w-full py-3 bg-plum text-cream font-medium rounded-full transition-all hover:shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {salvando ? 'Registrando...' : 'Aceitar e continuar'}
          </button>
          {onPular && (
            <button onClick={onPular} className="w-full py-2.5 text-sm text-cream/70 hover:text-cream transition-colors">
              Agora não, só comprar o ingresso
            </button>
          )}
          <button onClick={onFechar} className="w-full py-2.5 text-sm text-cream/70 hover:text-cream transition-colors">
            Voltar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
