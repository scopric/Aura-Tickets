import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '../../hooks/useAuth'
import { useTwoFactor } from '../../hooks/useTwoFactor'
import { useAuthStore } from '../../stores/authStore'
import { useUserTickets } from '../../hooks/useUserTickets'
import { useUserOrders } from '../../hooks/useUserOrders'
import { supabase } from '../../lib/supabase'
import { uploadAvatar } from '../../lib/avatarUpload'
import PhoneInput, { COUNTRIES_DDI } from '../../components/ui/PhoneInput'
import { searchAddressByPostalCode } from '../../lib/cepService'
import { formatCurrency } from '../../lib/formatters'
import { FotoModeracaoAviso } from '../../components/CollectiveTableCard'
import { useMatchmakingProfile, consentimentoVigente } from '../../hooks/useMatchmaking'
import ThemeToggle from '../../components/ThemeToggle'

export default function ParticipantProfile() {
  const { user } = useAuth()
  const { profile: perfilMesa } = useMatchmakingProfile()
  const mfa = useTwoFactor()
  const [editing, setEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    bio: '',
    birthDate: '',
  })

  const [cep, setCep] = useState('')
  const [searchingCep, setSearchingCep] = useState(false)
  const [citiesList, setCitiesList] = useState<any[]>([])
  const [showCitiesDropdown, setShowCitiesDropdown] = useState(false)
  const [loadingCities, setLoadingCities] = useState(false)

  const handleCityChange = async (val: string) => {
    setProfile(prev => ({ ...prev, city: val }))
    if (val.length < 2) {
      setCitiesList([])
      setShowCitiesDropdown(false)
      return
    }
    
    setLoadingCities(true)
    try {
      const { data, error } = await supabase
        .from('cities')
        .select('name, states(uf)')
        .ilike('name', `%${val}%`)
        .limit(5)
        
      if (error) throw error
      if (data) {
        setCitiesList(data.map((c: any) => `${c.name} - ${c.states?.uf || ''}`))
        setShowCitiesDropdown(true)
      }
    } catch (err) {
      console.error('Erro ao buscar cidades:', err)
    } finally {
      setLoadingCities(false)
    }
  }

  const handleSelectCity = (cityStr: string) => {
    setProfile(prev => ({ ...prev, city: cityStr }))
    setShowCitiesDropdown(false)
  }

  const handleCepSearch = async () => {
    const cleaned = cep.replace(/\D/g, '')
    if (cleaned.length !== 8) {
      toast.error('Digite um CEP válido com 8 dígitos.')
      return
    }
    
    setSearchingCep(true)
    const toastId = toast.loading('Consultando CEP...')
    try {
      const res = await searchAddressByPostalCode(cleaned, 'BR')
      if (res && !res.error) {
        setProfile(prev => ({
          ...prev,
          city: `${res.localidade} - ${res.uf}`
        }))
        toast.success('Cidade preenchida com sucesso!', { id: toastId })
      } else {
        toast.error(res?.error || 'CEP não encontrado.', { id: toastId })
      }
    } catch (err) {
      toast.error('Erro ao consultar CEP.', { id: toastId })
    } finally {
      setSearchingCep(false)
    }
  }

  // Sincronizar com o usuário carregado do Supabase
  useEffect(() => {
    if (user) {
      setProfile({
        name: user.full_name || user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        city: user.city || '',
        bio: user.bio || '',
        birthDate: user.birth_date || '',
      })
    }
  }, [user])

  const { data: tickets = [], isLoading: isLoadingTickets } = useUserTickets()
  const { data: orders = [], isLoading: isLoadingOrders } = useUserOrders()

  const activeTickets = tickets.filter(t => t.status === 'active').length
  const totalSpent = orders
    .filter(o => o.status === 'paid')
    .reduce((s, o) => s + o.total_amount, 0)
  const eventCount = new Set(tickets.map(t => t.event_id)).size

  const handleSave = async () => {
    if (!user?.id) return
    // chave `phone` ausente = perfil ainda não veio do banco (o persist a remove; o usuário provisório não a tem): salvar agora gravaria vazio por cima
    if (user.phone === undefined) { toast.error('Aguarde o perfil terminar de carregar e tente de novo'); return }
    setIsSaving(true)
    const toastId = toast.loading('Salvando alterações no perfil...')
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.name,
          phone: profile.phone,
          bio: profile.bio,
          city: profile.city,
          birth_date: profile.birthDate || null, // coluna date: '' daria erro no banco
        })
        .eq('id', user.id)

      if (error) throw error

      // atualiza o store com o que foi gravado (sem reler pela rede: uma falha na releitura zeraria o formulário e o papel)
      const atual = useAuthStore.getState().user
      if (atual) useAuthStore.getState().setUser({ ...atual, full_name: profile.name, phone: profile.phone, city: profile.city, bio: profile.bio, birth_date: profile.birthDate || null })
      toast.success('Perfil salvo com sucesso!', { id: toastId })
      setEditing(false)
    } catch (err: any) {
      console.error('[ParticipantProfile] Erro ao salvar:', err)
      toast.error(err.message || 'Erro ao salvar perfil', { id: toastId })
    } finally {
      setIsSaving(false)
    }
  }

  const isLoading = isLoadingTickets || isLoadingOrders
  const fotoRef = useRef<HTMLInputElement>(null)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const trocarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user?.id) return
    setEnviandoFoto(true)
    try {
      await uploadAvatar(file, user.id)
    } finally { setEnviandoFoto(false) }
  }

  const tituloSecao = 'mb-3 flex items-center gap-2 text-[15px] font-semibold leading-5'
  const rotulo = 'text-xs leading-4 text-muted-foreground'
  const campo = 'mt-1 h-10 rounded-ev-lg bg-card'
  const icone = 'flex-none text-muted-foreground'

  return (
    <div className="max-w-3xl text-foreground">
      <h1 className="mb-6 text-2xl font-semibold tracking-[-0.015em]">Meu Perfil</h1>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <input ref={fotoRef} type="file" accept="image/*" className="hidden" onChange={trocarFoto} />
          <button
            type="button"
            onClick={() => fotoRef.current?.click()}
            disabled={enviandoFoto}
            aria-label="Alterar foto de perfil"
            title="Alterar foto de perfil"
            className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-2xl font-semibold text-foreground focus-visible:outline-none focus-visible:shadow-ev-foco disabled:opacity-60"
          >
            {user?.avatar_url || user?.avatar
              ? <img src={user.avatar_url || user.avatar} alt="" className="h-full w-full object-cover" />
              : (profile.name || 'U').charAt(0).toUpperCase()}
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1 text-[11px] font-medium text-[#fff]">{/* branco sobre véu preto nos dois temas: cor própria, não depende do tema */}
              {enviandoFoto ? <Spinner role="presentation" aria-hidden="true" className="size-3" /> : <I.Camera size={12} aria-hidden="true" />} Alterar
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-semibold leading-7 tracking-[-0.015em]">{profile.name || 'Usuário'}</h2>
            <p className="truncate text-[13px] leading-[18px] text-muted-foreground">{profile.email}</p>
          </div>
          <Button
            variant="outline"
            loading={isSaving}
            onClick={() => { if (editing) { handleSave() } else setEditing(true) }}
          >
            {editing ? (
              <><I.Guardar aria-hidden="true" /> Salvar</>
            ) : (
              <><I.Editar aria-hidden="true" /> Editar</>
            )}
          </Button>
        </div>
        {user && consentimentoVigente(perfilMesa) && <div className="mt-4"><FotoModeracaoAviso onTrocar={() => fotoRef.current?.click()} trocarDesativado={enviandoFoto} /></div>}
      </div>

      {/* Stats */}
      <dl className="mb-6 grid grid-cols-[1fr_1fr_1.6fr] divide-x divide-border border-y border-border py-3 text-center">
        {[
          { label: 'Eventos', value: isLoading ? '-' : eventCount.toString() },
          { label: 'Ingressos', value: isLoading ? '-' : activeTickets.toString() },
          { label: 'Gasto Total', value: isLoading ? '-' : formatCurrency(totalSpent, 'BRL') },
        ].map(s => (
          <div key={s.label} className="flex flex-col-reverse px-1">
            <dt className="mt-0.5 text-xs leading-4 text-muted-foreground">{s.label}</dt>
            <dd className="whitespace-nowrap font-display text-lg font-semibold leading-6 tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      {/* Info */}
      <section aria-labelledby="t-info" className="space-y-5">
        <h3 id="t-info" className={`${tituloSecao} !mb-0`}>Informações Pessoais</h3>

        {/* Nome */}
        <div className="flex items-start gap-3">
          <I.Conta size={16} aria-hidden="true" className={`${icone} mt-0.5`} />
          <div className="min-w-0 flex-1">
            <div className={rotulo}>Nome</div>
            {editing ? (
              <Input value={profile.name} aria-label="Nome" onChange={e => setProfile({ ...profile, name: e.target.value })} className={campo} />
            ) : (
              <div className="text-base">{profile.name || '-'}</div>
            )}
          </div>
        </div>

        {/* Email */}
        <div className="flex items-start gap-3">
          <I.Email size={16} aria-hidden="true" className={`${icone} mt-0.5`} />
          <div className="min-w-0 flex-1">
            <div className={rotulo}>Email</div>
            {editing ? (
              <Input value={profile.email} aria-label="Email" disabled className={`${campo} bg-secondary`} />
            ) : (
              <div className="break-words text-base">{profile.email || '-'}</div>
            )}
          </div>
        </div>

        {/* Telefone Internacional com PhoneInput */}
        <div className="flex items-start gap-3">
          <I.Telefone size={16} aria-hidden="true" className={`${icone} mt-0.5`} />
          <div className="min-w-0 flex-1">
            <div className={`${rotulo} mb-1`}>Telefone</div>
            {editing ? (
              <PhoneInput value={profile.phone} onChange={val => setProfile({ ...profile, phone: val })} />
            ) : (
              <div className="text-base">
                {profile.phone ? (
                  (() => {
                    const ddiMatch = COUNTRIES_DDI.find(c => profile.phone.startsWith(c.code))
                    if (ddiMatch) {
                      const numPart = profile.phone.slice(ddiMatch.code.length)
                      // Formatar localmente de acordo com a máscara
                      let formatted = ''
                      let valIdx = 0
                      const activeMask = ddiMatch.code === '+55' && numPart.length > 10 ? '(99) 99999-9999' : ddiMatch.mask
                      for (let i = 0; i < activeMask.length && valIdx < numPart.length; i++) {
                        if (activeMask[i] === '9') {
                          formatted += numPart[valIdx]
                          valIdx++
                        } else {
                          formatted += activeMask[i]
                        }
                      }
                      return `${ddiMatch.flag} ${ddiMatch.code} ${formatted}`
                    }
                    return profile.phone
                  })()
                ) : '-'}
              </div>
            )}
          </div>
        </div>

        {/* Nascimento */}
        <div className="flex items-start gap-3">
          <I.Eventos size={16} aria-hidden="true" className={`${icone} mt-0.5`} />
          <div className="min-w-0 flex-1">
            <div className={rotulo}>Nascimento</div>
            {editing ? (
              <Input type="date" value={profile.birthDate} aria-label="Nascimento" onChange={e => setProfile({ ...profile, birthDate: e.target.value })} className={campo} />
            ) : (
              <div className="text-base">
                {profile.birthDate ? new Date(profile.birthDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
              </div>
            )}
          </div>
        </div>

        {/* CEP/Código Postal & Cidade com Autocomplete */}
        <div className="flex items-start gap-3">
          <I.Local size={16} aria-hidden="true" className={`${icone} mt-0.5`} />
          <div className="relative min-w-0 flex-1">
            <div className={rotulo}>Cidade e Endereço</div>

            {editing ? (
              <div className="mt-1 space-y-3">
                {/* Busca CEP */}
                <div className="flex gap-2">
                  <Input
                    type="text"
                    aria-label="CEP ou código postal"
                    placeholder="CEP (Brasil) ou Código Postal"
                    value={cep}
                    onChange={e => setCep(e.target.value)}
                    className="h-10 flex-1 rounded-ev-lg bg-card"
                  />
                  <Button type="button" variant="outline" onClick={handleCepSearch} loading={searchingCep}>
                    <I.Buscar aria-hidden="true" />
                    Buscar
                  </Button>
                </div>

                {/* Input de Cidade (com autocomplete) */}
                <div className="relative">
                  <Input
                    type="text"
                    aria-label="Cidade"
                    placeholder="Digite sua cidade"
                    value={profile.city}
                    onChange={e => handleCityChange(e.target.value)}
                    className="h-10 rounded-ev-lg bg-card"
                  />
                  {loadingCities && (
                    <div className="absolute right-3 top-3">
                      <Spinner role="presentation" aria-hidden="true" className="size-4 text-muted-foreground" />
                    </div>
                  )}
                  {showCitiesDropdown && citiesList.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-40 overflow-y-auto rounded-ev-md border border-border bg-popover py-1 text-popover-foreground shadow-ev-2">
                      {citiesList.map((cityName, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleSelectCity(cityName)}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--ev-tint-hover)] focus-visible:outline-none focus-visible:bg-[var(--ev-tint-hover)]"
                        >
                          {cityName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-base">{profile.city || '-'}</div>
            )}
          </div>
        </div>

        {/* Bio */}
        <div>
          <div className={`${rotulo} mb-1`}>Bio</div>
          {editing ? (
            <Textarea value={profile.bio} aria-label="Bio" onChange={e => setProfile({ ...profile, bio: e.target.value })} rows={2} className="resize-none rounded-ev-lg bg-card" />
          ) : (
            <div className="text-base text-muted-foreground">{profile.bio || 'Nenhuma bio adicionada.'}</div>
          )}
        </div>
      </section>

      {/* Eventos salvos (VF): sem item na barra do celular (a prancha tem só Explorar, Ingressos e Conta) */}
      <div className="mt-6 border-t border-border">
        <Link to="/app/salvos" className="flex items-center justify-between rounded-ev-md px-1 py-4 text-[15px] font-semibold transition-colors hover:text-primary focus-visible:outline-none focus-visible:shadow-ev-foco">
          Eventos salvos <I.ChevronDireita size={16} aria-hidden="true" />
        </Link>
      </div>

      {/* Aparência: o seletor de tema também mora na Conta (Decisão 143) */}
      <section aria-labelledby="t-aparencia" className="border-t border-border py-6">
        <h3 id="t-aparencia" className={tituloSecao}>Aparência</h3>
        <ThemeToggle />
      </section>

      {/* Security */}
      <section aria-labelledby="t-seguranca" className="border-t border-border pt-6">
        <h3 id="t-seguranca" className={tituloSecao}><I.Escudo size={16} aria-hidden="true" className="text-muted-foreground" /> Segurança</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-base">Senha</div>
              <div className="text-[13px] leading-[18px] text-muted-foreground">Altere sua senha periodicamente</div>
            </div>
            <Button asChild variant="outline" size="sm"><Link to="/auth/forgot">Alterar</Link></Button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div id="rotulo-2fa" className="text-base">Autenticação de dois fatores</div>
              <div className="text-[13px] leading-[18px] text-muted-foreground">
                {mfa.loading ? 'Carregando status...' : mfa.enabled ? 'Ativa — o login pede o código do aplicativo autenticador' : 'Adicione segurança extra com um aplicativo autenticador'}
              </div>
            </div>
            <Switch
              checked={mfa.enabled}
              disabled={mfa.loading}
              aria-labelledby="rotulo-2fa"
              onCheckedChange={() => mfa.toggle()}
            />
          </div>
        </div>
      </section>
      {mfa.modal}
    </div>
  )
}
