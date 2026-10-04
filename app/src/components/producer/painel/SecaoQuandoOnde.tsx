import { useRef, useState } from 'react'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/toggle-group'
import { searchAddressByPostalCode } from '../../../lib/cepService'
import { siteUrl } from '../../../lib/appHost'
import { dominioDoLink, enderecoDe, linkValido, type ErrosData } from '../../../lib/painelEvento'
import { LOCAL_MODOS } from '../../../lib/tipoEvento'
import { Campo, Faixa, type PropsSecao } from './campos'

const mascaraCep = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d }

// Seção "Quando e onde": início e fim, modo do local, local com CEP, link da transmissão e "a definir".
// Depois da primeira venda (travado) data, hora, modo e local ficam desabilitados.
export default function SecaoQuandoOnde({ f, set, travado, dono, erros }: PropsSecao & { dono: boolean; erros: ErrosData }) {
  const [cepErro, setCepErro] = useState('')
  const [manual, setManual] = useState(false)
  const ultimoCep = useRef(f.cep)
  const presencial = f.local_modo === 'presencial' || f.local_modo === 'hibrido'
  const online = f.local_modo === 'online' || f.local_modo === 'hibrido'
  const modoNome = LOCAL_MODOS.find(m => m.valor === f.local_modo)?.rotulo ?? f.local_modo
  const link = f.link.trim()
  const linkRuim = link !== '' && !linkValido(link)
  const enderecoPronto = [enderecoDe(f.rua, f.numero, f.bairro), [f.venue_city, f.venue_state].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')

  async function mudaCep(valor: string) {
    const cep = mascaraCep(valor)
    ultimoCep.current = cep
    set({ cep })
    setCepErro('')
    if (cep.replace(/\D/g, '').length !== 8) return
    const r = await searchAddressByPostalCode(cep, 'BR')
    if (ultimoCep.current !== cep) return // a pessoa mudou o CEP enquanto buscava
    if (!r || r.error) {
      setCepErro(r?.error === 'CEP não encontrado' ? 'CEP não encontrado. Confira os números ou preencha o endereço à mão.' : 'Não foi possível buscar o CEP agora. Preencha o endereço à mão.')
      setManual(true)
      return
    }
    set({ rua: r.logradouro, bairro: r.bairro, venue_city: r.localidade, venue_state: r.uf })
  }

  const data = (id: string, rotulo: string, d: keyof typeof f, h: keyof typeof f, erro?: string, opc?: string) => (
    <Campo id={id} rotulo={rotulo} opc={opc} erro={erro}>
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
        <Input id={id} type="date" aria-label={`Data de ${rotulo.toLowerCase()}`} aria-invalid={!!erro} aria-describedby={erro ? `${id}-erro` : undefined} value={f[d] as string} disabled={travado} onChange={e => set({ [d]: e.target.value })} />
        <Input type="time" aria-label={`Hora de ${rotulo.toLowerCase()}`} aria-invalid={!!erro} aria-describedby={erro ? `${id}-erro` : undefined} value={f[h] as string} disabled={travado} onChange={e => set({ [h]: e.target.value })} />
      </div>
    </Campo>
  )

  return (
    <div className="grid gap-4">
      {travado && (
        <Faixa tom="info" className="mb-0" acoes={<Button asChild variant="outline" size="sm"><a href={siteUrl('/contato')} target="_blank" rel="noopener noreferrer">Falar com a equipe<span className="sr-only"> (abre em nova aba)</span></a></Button>}>
          Data, hora e local ficam travados depois da primeira venda. Para mudar, fale com a equipe.
        </Faixa>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {data('f-inicio', 'Início', 'inicioD', 'inicioH', erros.inicio)}
        {data('f-fim', 'Fim', 'fimD', 'fimH', erros.fim, '(opcional)')}
      </div>

      <div className="grid gap-1.5">
        <span id="r-modo" className="text-sm font-medium text-foreground">Local</span>
        {travado
          ? <p className="text-sm text-foreground">{modoNome}</p>
          : <Segmented label="Modo do local" size="md" className="max-w-xl" value={f.local_modo} onValueChange={v => set({ local_modo: v })} items={LOCAL_MODOS.map(m => ({ value: m.valor, label: m.rotulo }))} />}
      </div>

      {presencial && (
        <>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Campo id="f-lnome" rotulo="Nome do local"><Input id="f-lnome" value={f.venue_name} disabled={travado} onChange={e => set({ venue_name: e.target.value })} /></Campo>
            <Campo id="f-cep" rotulo="CEP" erro={cepErro || undefined}>
              <Input id="f-cep" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" value={f.cep} disabled={travado} onChange={e => void mudaCep(e.target.value)} aria-describedby={cepErro ? 'f-cep-erro' : manual ? undefined : 'f-end-ajuda'} />
            </Campo>
            <Campo id="f-num" rotulo="Número"><Input id="f-num" value={f.numero} disabled={travado} onChange={e => set({ numero: e.target.value })} /></Campo>
          </div>
          {manual ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="f-rua" rotulo="Rua"><Input id="f-rua" value={f.rua} disabled={travado} onChange={e => set({ rua: e.target.value })} /></Campo>
              <Campo id="f-bairro" rotulo="Bairro"><Input id="f-bairro" value={f.bairro} disabled={travado} onChange={e => set({ bairro: e.target.value })} /></Campo>
              <Campo id="f-cidade" rotulo="Cidade"><Input id="f-cidade" value={f.venue_city} disabled={travado} onChange={e => set({ venue_city: e.target.value })} /></Campo>
              <Campo id="f-uf" rotulo="Estado (UF)"><Input id="f-uf" maxLength={2} value={f.venue_state} disabled={travado} onChange={e => set({ venue_state: e.target.value.toUpperCase() })} /></Campo>
            </div>
          ) : (
            <Campo id="f-end" rotulo="Endereço" ajuda="O CEP preenche rua, bairro e cidade. Cidade e bairro aparecem antes da compra; o endereço completo, para quem comprou.">
              <Input id="f-end" readOnly aria-describedby="f-end-ajuda" value={enderecoPronto} placeholder="Preencha o CEP" />
              {!travado && <Button type="button" variant="link" size="xs" className="justify-self-start px-0" onClick={() => setManual(true)}>Preencher o endereço à mão</Button>}
            </Campo>
          )}
        </>
      )}

      {online && (
        <Campo
          id="f-link" rotulo="Link da transmissão"
          erro={linkRuim ? 'Use um link que comece com https:// e não tenha usuário@ antes do endereço. Enquanto estiver assim, ele não é salvo.' : undefined}
          ajuda="Só quem tem ingresso vê o link. Pôr ou trocar o link depois da aprovação manda o evento para nova análise."
        >
          <Input id="f-link" type="url" placeholder="https://" maxLength={500} value={f.link} disabled={!dono} aria-invalid={linkRuim} aria-describedby={linkRuim ? 'f-link-erro' : 'f-link-ajuda'} onChange={e => set({ link: e.target.value })} />
          {link !== '' && !linkRuim && <p className="flex items-center gap-1.5 text-xs text-foreground"><I.AbrirExterno size={14} aria-hidden="true" />O link abre em <strong className="font-semibold">{dominioDoLink(link)}</strong></p>}
          {!dono && <p className="text-xs text-muted-foreground">Só o dono do evento muda o link.</p>}
        </Campo>
      )}

      {f.local_modo === 'a_definir' && (
        <Faixa tom="atencao" titulo="Sem venda enquanto o local estiver a definir">A página mostra só “Avise-me”. Quando você puser o local, a venda pode abrir.</Faixa>
      )}
    </div>
  )
}
