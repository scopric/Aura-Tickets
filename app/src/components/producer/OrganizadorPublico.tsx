import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { useOrganizadorPublico, type Rede } from '../../hooks/useOrganizadorPublico'
import PhoneInput from '../ui/PhoneInput'
import { formatCNPJ } from '../../lib/formatters'
import { marcaOk, rotuloOk, hostOk, normalizaUrl, emailSemProibidos, mensagemCheck } from '../../lib/organizadorTexto'
import { SectionTitle, Erro } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'

type Mostrar = 'nome' | 'whatsapp' | 'instagram' | 'site' | 'email' | 'outras_redes'
interface Form {
  nome: string; whatsapp: string; instagram: string; site: string; email: string
  redes: Rede[]
  mostrar: Record<Mostrar, boolean>
}
type Erros = Partial<Record<'nome' | 'whatsapp' | 'instagram' | 'site' | 'email' | 'redes', string>>

const VAZIO: Form = {
  nome: '', whatsapp: '', instagram: '', site: '', email: '', redes: [],
  mostrar: { nome: true, whatsapp: false, instagram: false, site: false, email: false, outras_redes: false },
}
const MAX_REDES = 5
// mesma regra do CHECK do banco (https, host ASCII, sem porta nem '?' logo após o domínio)
const urlBanco = (u: string) => u.length <= 200 && /^https:\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}(\/[^\s"<>]*)?$/.test(u) && hostOk(u)
// motivo da recusa (undefined = aceita); a URL já vem normalizada
const erroUrl = (u: string) => {
  if (urlBanco(u)) return undefined
  const h = u.match(/^https:\/\/([^/]+)/)?.[1] ?? ''
  if (!marcaOk(h)) return 'O endereço não pode conter a marca Evokaa ou Aura Tickets.'
  if (/(^|\.)xn--/i.test(h)) return 'Endereços com caracteres especiais (xn--) não são aceitos.'
  return 'Informe um endereço válido, por exemplo www.seusite.com.br.'
}
const SEGUNDO_FATOR = 'Confirme o segundo fator de novo e tente outra vez.'

// o banco guarda 55+DDD+número; o PhoneInput trabalha com "+55..."
const doBanco = (z: string | null) => (z ? `+${z}` : '')
// só dígitos nacionais (DDD+número); '' se vazio
const nacional = (v: string) => v.replace(/\D/g, '').replace(/^55/, '')

export function validar(f: Form): Erros {
  const e: Erros = {}
  const nome = f.nome.trim()
  if (!nome) e.nome = 'Informe o nome do organizador.'
  else if (nome.length > 80) e.nome = 'Use até 80 caracteres.'
  else if (!marcaOk(nome)) e.nome = 'O nome não pode lembrar a marca Evokaa ou Aura Tickets.'
  const zap = nacional(f.whatsapp)
  if (zap && !/^\d{10,11}$/.test(zap)) e.whatsapp = 'Informe o DDD e o número (10 ou 11 dígitos).'
  const insta = f.instagram.trim().replace(/^@/, '')
  if (insta && !/^[A-Za-z0-9._]{1,30}$/.test(insta)) e.instagram = 'Use só letras, números, ponto e sublinhado (até 30).'
  const erroSite = erroUrl(normalizaUrl(f.site))
  if (f.site.trim() && erroSite) e.site = erroSite
  const email = f.email.trim()
  if (email && (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) e.email = 'Informe um e-mail válido.'
  else if (email && !emailSemProibidos(email)) e.email = 'O e-mail não pode ter ? & # % , ; < > ".'
  for (const r of f.redes) {
    const rot = r.rotulo.trim(), url = normalizaUrl(r.url)
    if (!rot && !url) continue
    if (!rot || rot.length > 30) { e.redes = 'Cada rede precisa de um nome de até 30 caracteres.'; break }
    if (!rotuloOk(rot)) { e.redes = 'O nome da rede não pode ter Pix, Pagamento nem lembrar a marca.'; break }
    const erroRede = erroUrl(url)
    if (erroRede) { e.redes = erroRede; break }
  }
  if (!e.redes && JSON.stringify(f.redes.filter(r => r.rotulo.trim() || r.url.trim())).length > 950) e.redes = 'Encurte os endereços das redes'
  return e
}

export default function OrganizadorPublico() {
  const { data, isPending, isError, error, refetch, isFetching, salvar, salvando } = useOrganizadorPublico()
  const [edit, setEdit] = useState<Form | null>(null)
  const [mostrarErros, setMostrarErros] = useState(false)

  if (isPending) return <Skeleton aria-busy="true" className="h-96 rounded-[10px] bg-muted" />
  if (isError && (error as { code?: string } | null)?.code === '42501') return <p role="alert" className="rounded-[10px] border border-border bg-card p-4 text-sm text-foreground">{SEGUNDO_FATOR}</p>
  if (isError) return <Erro texto="Não foi possível carregar os dados do organizador." refetch={() => refetch()} carregando={isFetching} />

  const base: Form = data
    ? {
        nome: data.nome_publico ?? '', whatsapp: doBanco(data.whatsapp), instagram: data.instagram ?? '',
        site: data.site ?? '', email: data.email_contato ?? '', redes: data.outras_redes ?? [],
        mostrar: {
          nome: data.mostrar_nome, whatsapp: data.mostrar_whatsapp, instagram: data.mostrar_instagram,
          site: data.mostrar_site, email: data.mostrar_email, outras_redes: data.mostrar_outras_redes,
        },
      }
    : VAZIO
  const f = edit ?? base
  const mudou = edit !== null && JSON.stringify(edit) !== JSON.stringify(base)
  const erros = mostrarErros ? validar(f) : {}
  const set = (p: Partial<Form>) => setEdit({ ...f, ...p })
  const setMostrar = (k: Mostrar, v: boolean) => setEdit({ ...f, mostrar: { ...f.mostrar, [k]: v } })

  const enviar = async () => {
    setMostrarErros(true)
    const ruins = Object.keys(validar(f))
    if (ruins.length) {
      toast.error('Confira os campos marcados.')
      const alvo = document.getElementById(ruins[0] === 'redes' ? 'org-outras_redes' : `org-${ruins[0]}`)
      ;(alvo?.querySelector('input') ?? alvo)?.focus()
      return
    }
    const redes = f.redes.map(r => ({ rotulo: r.rotulo.trim(), url: normalizaUrl(r.url) })).filter(r => r.rotulo || r.url)
    try {
      await salvar({
        nome_publico: f.nome.trim(),
        whatsapp: nacional(f.whatsapp) || null,
        instagram: f.instagram.trim().replace(/^@/, '') || null,
        site: normalizaUrl(f.site) || null,
        email_contato: f.email.trim() || null,
        outras_redes: redes.length ? redes : null,
        mostrar_nome: f.mostrar.nome, mostrar_whatsapp: f.mostrar.whatsapp, mostrar_instagram: f.mostrar.instagram,
        mostrar_site: f.mostrar.site, mostrar_email: f.mostrar.email, mostrar_outras_redes: f.mostrar.outras_redes,
      })
      setEdit(null)
      setMostrarErros(false)
      toast.success('Dados do organizador salvos!')
    } catch (err) {
      const code = (err as { code?: string })?.code
      toast.error(
        code === '42501' ? SEGUNDO_FATOR
        : code === '23514' ? mensagemCheck((err as { message?: string })?.message)
        : 'Erro ao salvar os dados do organizador',
      )
    }
  }

  // campo com rótulo, erro ligado por aria-describedby e interruptor de exibição
  const campo = (k: Mostrar, rotulo: string, ajuda: string | null, erro: string | undefined, entrada: (p: { id: string; describedby?: string }) => ReactNode) => {
    const id = `org-${k}`
    const desc = [erro ? `${id}-erro` : '', ajuda ? `${id}-ajuda` : ''].filter(Boolean).join(' ') || undefined
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor={id}>{rotulo}</Label>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Label htmlFor={`${id}-mostrar`} className="text-xs font-normal">Mostrar na página do evento</Label>
            <Switch id={`${id}-mostrar`} aria-label={`Mostrar ${rotulo} na página do evento`} checked={f.mostrar[k]} onCheckedChange={v => setMostrar(k, v)} />
          </span>
        </div>
        {entrada({ id, describedby: desc })}
        {ajuda && <p id={`${id}-ajuda`} className="text-xs text-muted-foreground">{ajuda}</p>}
        {erro && <p id={`${id}-erro`} role="alert" className="text-xs text-destructive">{erro}</p>}
      </div>
    )
  }
  const texto = (campoForm: 'nome' | 'instagram' | 'site' | 'email', p: { id: string; describedby?: string }, extra: object = {}) => (
    <Input id={p.id} value={f[campoForm]} onChange={e => set({ [campoForm]: e.target.value })} aria-invalid={!!erros[campoForm]} aria-describedby={p.describedby} {...extra} />
  )

  return (
    <section className="space-y-6 rounded-[10px] border border-border bg-card p-4 sm:p-6">
      <SectionTitle>Organizador (aparece na página dos seus eventos)</SectionTitle>

      <div className="space-y-2 rounded-[10px] border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <p>Se sua conta tem CNPJ cadastrado, a razão social e o CNPJ do seu cadastro (aba Perfil) aparecem sempre na página do evento (exigência de identificação do vendedor — a confirmar com o jurídico). Quem é pessoa física não mostra CNPJ nem CPF.</p>
        <p>Estes dados ficam públicos para qualquer pessoa que abrir a página do evento. Desligar um campo o esconde na hora; para apagar o dado, esvazie o campo e salve.</p>
      </div>

      {data?.cnpj && (
        <div className="space-y-2">
          <Label htmlFor="org-cnpj">CNPJ do cadastro</Label>
          <Input id="org-cnpj" value={formatCNPJ(data.cnpj)} readOnly />
        </div>
      )}

      {campo('nome', 'Nome do organizador', null, erros.nome, p => texto('nome', p, { maxLength: 80, autoComplete: 'organization' }))}
      {campo('whatsapp', 'WhatsApp', null, erros.whatsapp, p => (
        <PhoneInput id={p.id} aria-describedby={p.describedby} aria-invalid={!!erros.whatsapp} apenasBrasil value={f.whatsapp} onChange={v => set({ whatsapp: v.replace(/\D/g, '').length <= 2 ? '' : v })} />
      ))}
      {campo('instagram', 'Instagram', 'Só o nome de usuário, com ou sem @.', erros.instagram, p => texto('instagram', p, { maxLength: 31, autoCapitalize: 'none' }))}
      {campo('site', 'Site', 'Pode digitar só www.seusite.com.br: o https:// entra sozinho.', erros.site, p => texto('site', p, { inputMode: 'url', placeholder: 'www.seusite.com.br', onBlur: () => set({ site: normalizaUrl(f.site) }) }))}
      {campo('email', 'E-mail de contato', null, erros.email, p => texto('email', p, { type: 'email', autoComplete: 'email' }))}

      {campo('outras_redes', 'Outras redes', `Até ${MAX_REDES}. Nome da rede e endereço. Pode digitar só www.seusite.com.br: o https:// entra sozinho.`, erros.redes, p => (
        <div className="space-y-2" id={p.id} role="group" aria-describedby={p.describedby} aria-label="Outras redes">
          {f.redes.map((r, i) => (
            <div key={i} className="flex flex-col gap-2 sm:flex-row">
              <Input aria-label={`Nome da rede ${i + 1}`} placeholder="Nome (ex.: TikTok)" maxLength={30} value={r.rotulo}
                onChange={e => set({ redes: f.redes.map((x, j) => j === i ? { ...x, rotulo: e.target.value } : x) })} className="sm:w-1/3" />
              <Input aria-label={`Endereço da rede ${i + 1}`} placeholder="www.seusite.com.br" inputMode="url" value={r.url}
                onBlur={() => set({ redes: f.redes.map((x, j) => j === i ? { ...x, url: normalizaUrl(x.url) } : x) })}
                onChange={e => set({ redes: f.redes.map((x, j) => j === i ? { ...x, url: e.target.value } : x) })} />
              <Button type="button" variant="outline" aria-label={`Remover rede ${i + 1}`} onClick={() => set({ redes: f.redes.filter((_, j) => j !== i) })}>
                <I.Lixeira aria-hidden="true" />
              </Button>
            </div>
          ))}
          {f.redes.length < MAX_REDES && (
            <Button type="button" variant="outline" size="sm" onClick={() => set({ redes: [...f.redes, { rotulo: '', url: '' }] })}>
              <I.Criar aria-hidden="true" />Adicionar rede
            </Button>
          )}
        </div>
      ))}

      <div className="flex justify-end">
        <Button onClick={enviar} disabled={!mudou} loading={salvando}>
          <I.Guardar aria-hidden="true" />Salvar
        </Button>
      </div>
    </section>
  )
}
