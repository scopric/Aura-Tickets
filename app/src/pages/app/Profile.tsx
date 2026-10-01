import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { User, Mail, Phone, Calendar, MapPin, Edit3, Save, Ticket, DollarSign, Shield, Loader2, Search, Camera } from 'lucide-react'
import { toast } from 'sonner'
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

export default function ParticipantProfile() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
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
      // foto nova volta a 'pendente' no banco: relê o aviso da moderação
      if (await uploadAvatar(file, user.id)) queryClient.invalidateQueries({ queryKey: ['foto-moderacao'] })
    } finally { setEnviandoFoto(false) }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-3xl text-cream mb-6">Meu Perfil</h1>

      {/* Header Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-plum/10 to-transparent border border-plum/20 mb-6">
        <div className="flex items-center gap-4">
          <input ref={fotoRef} type="file" accept="image/*" className="hidden" onChange={trocarFoto} />
          <button
            type="button"
            onClick={() => fotoRef.current?.click()}
            disabled={enviandoFoto}
            aria-label="Alterar foto de perfil"
            title="Alterar foto de perfil"
            className="relative w-20 h-20 shrink-0 rounded-full bg-plum/20 flex items-center justify-center text-2xl font-serif text-plum-light overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum disabled:opacity-60"
          >
            {user?.avatar_url || user?.avatar
              ? <img src={user.avatar_url || user.avatar} alt="" className="w-full h-full object-cover" />
              : (profile.name || 'U').charAt(0).toUpperCase()}
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1 text-[10px] font-sans text-[#fff]">{/* branco nos dois temas (.light .text-white escureceria) */}
              {enviandoFoto ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />} Alterar
            </span>
          </button>
          <div className="flex-1">
            <h2 className="font-serif text-2xl text-cream">{profile.name || 'Usuário'}</h2>
            <p className="text-xs text-white/40">{profile.email}</p>
          </div>
          <button 
            disabled={isSaving}
            onClick={() => { if (editing) { handleSave() } else setEditing(true) }} 
            className="px-4 py-2 bg-white/[0.05] border border-white/[0.08] rounded-full text-xs text-white/60 hover:text-plum-light transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSaving ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando</>
            ) : editing ? (
              <><Save className="w-3.5 h-3.5" /> Salvar</>
            ) : (
              <><Edit3 className="w-3.5 h-3.5" /> Editar</>
            )}
          </button>
        </div>
        {user && consentimentoVigente(perfilMesa) && <div className="mt-4"><FotoModeracaoAviso /></div>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Eventos', value: isLoading ? '-' : eventCount.toString(), icon: Calendar },
          { label: 'Ingressos', value: isLoading ? '-' : activeTickets.toString(), icon: Ticket },
          { label: 'Gasto Total', value: isLoading ? '-' : formatCurrency(totalSpent, 'BRL'), icon: DollarSign },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-md text-center">
            <s.icon className="w-4 h-4 text-plum mx-auto mb-1.5" />
            <div className="font-serif text-xl text-cream">{s.value}</div>
            <div className="text-[10px] text-white/40">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-md space-y-5">
        <h3 className="text-sm font-semibold text-cream mb-2">Informações Pessoais</h3>
        
        {/* Nome */}
        <div className="flex items-center gap-3">
          <User className="w-4 h-4 text-white/20 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-[10px] text-white/30 uppercase">Nome</div>
            {editing ? (
              <input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-cream focus:outline-none focus:border-plum/30 mt-0.5" />
            ) : (
              <div className="text-sm text-cream">{profile.name || '-'}</div>
            )}
          </div>
        </div>

        {/* Email */}
        <div className="flex items-center gap-3">
          <Mail className="w-4 h-4 text-white/20 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-[10px] text-white/30 uppercase">Email</div>
            {editing ? (
              <input value={profile.email} disabled className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white/40 focus:outline-none cursor-not-allowed mt-0.5" />
            ) : (
              <div className="text-sm text-cream">{profile.email || '-'}</div>
            )}
          </div>
        </div>

        {/* Telefone Internacional com PhoneInput */}
        <div className="flex items-start gap-3">
          <Phone className="w-4 h-4 text-white/20 flex-shrink-0 mt-3" />
          <div className="flex-1">
            <div className="text-[10px] text-white/30 uppercase mb-1">Telefone</div>
            {editing ? (
              <PhoneInput value={profile.phone} onChange={val => setProfile({ ...profile, phone: val })} />
            ) : (
              <div className="text-sm text-cream">
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
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-white/20 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-[10px] text-white/30 uppercase">Nascimento</div>
            {editing ? (
              <input type="date" value={profile.birthDate} onChange={e => setProfile({ ...profile, birthDate: e.target.value })} className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-cream focus:outline-none focus:border-plum/30 mt-0.5" />
            ) : (
              <div className="text-sm text-cream">
                {profile.birthDate ? new Date(profile.birthDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
              </div>
            )}
          </div>
        </div>

        {/* CEP/Código Postal & Cidade com Autocomplete */}
        <div className="flex items-start gap-3">
          <MapPin className="w-4 h-4 text-white/20 flex-shrink-0 mt-3" />
          <div className="flex-1 relative">
            <div className="text-[10px] text-white/30 uppercase mb-1">Cidade e Endereço</div>
            
            {editing ? (
              <div className="space-y-3 mt-0.5">
                {/* Busca CEP */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="CEP (Brasil) ou Código Postal"
                    value={cep}
                    onChange={e => setCep(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-cream focus:outline-none focus:border-plum/30"
                  />
                  <button
                    type="button"
                    onClick={handleCepSearch}
                    disabled={searchingCep}
                    className="px-4 py-2 bg-plum/20 hover:bg-plum/30 text-plum-light border border-plum/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {searchingCep ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    Buscar
                  </button>
                </div>

                {/* Input de Cidade (com autocomplete) */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Digite sua cidade"
                    value={profile.city}
                    onChange={e => handleCityChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-cream focus:outline-none focus:border-plum/30"
                  />
                  {loadingCities && (
                    <div className="absolute right-3 top-2.5">
                      <Loader2 className="w-4 h-4 animate-spin text-white/20" />
                    </div>
                  )}
                  {showCitiesDropdown && citiesList.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-stone-900 border border-white/10 rounded-lg shadow-lg z-50 py-1 max-h-40 overflow-y-auto">
                      {citiesList.map((cityName, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleSelectCity(cityName)}
                          className="w-full text-left px-4 py-2 text-sm text-cream hover:bg-white/[0.05] transition-colors"
                        >
                          {cityName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-cream">{profile.city || '-'}</div>
            )}
          </div>
        </div>

        {/* Bio */}
        <div className="pt-2">
          <div className="text-[10px] text-white/30 uppercase mb-1">Bio</div>
          {editing ? (
            <textarea value={profile.bio} onChange={e => setProfile({ ...profile, bio: e.target.value })} rows={2} className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-cream focus:outline-none focus:border-plum/30 resize-none" />
          ) : (
            <div className="text-sm text-white/60">{profile.bio || 'Nenhuma bio adicionada.'}</div>
          )}
        </div>
      </div>

      {/* Security */}
      <div className="mt-6 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-md">
        <h3 className="text-sm font-semibold text-cream mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-plum" /> Segurança</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-cream">Senha</div>
              <div className="text-xs text-white/30">Altere sua senha periodicamente</div>
            </div>
            <Link to="/auth/forgot" className="px-4 py-2 text-xs text-plum-light hover:bg-plum/10 rounded-full transition-colors">Alterar</Link>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-cream">Autenticação de dois fatores</div>
              <div className="text-xs text-white/30">
                {mfa.loading ? 'Carregando status...' : mfa.enabled ? 'Ativa — o login pede o código do aplicativo autenticador' : 'Adicione segurança extra com um aplicativo autenticador'}
              </div>
            </div>
            <button
              disabled={mfa.loading}
              aria-label={mfa.enabled ? 'Desativar 2FA' : 'Ativar 2FA'}
              aria-pressed={mfa.enabled}
              onClick={mfa.toggle}
              className={`relative w-11 h-6 shrink-0 rounded-full transition-colors ${mfa.enabled ? 'bg-plum' : 'bg-espresso/50'} disabled:opacity-55`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${mfa.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
      </div>
      {mfa.modal}
    </div>
  )
}
