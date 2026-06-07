import { useState, useEffect } from 'react'
import { User, Mail, Phone, Calendar, MapPin, Edit3, Save, Star, Ticket, Heart, DollarSign, Shield, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../hooks/useAuth'
import { useUserTickets } from '../../hooks/useUserTickets'
import { useUserOrders } from '../../hooks/useUserOrders'
import { supabase } from '../../lib/supabase'
import PhoneInput, { COUNTRIES_DDI } from '../../components/ui/PhoneInput'
import { searchAddressByPostalCode } from '../../lib/cepService'
import { formatCurrency } from '../../lib/formatters'

export default function ParticipantProfile() {
  const { user } = useAuth()
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
          birth_date: profile.birthDate
        })
        .eq('id', user.id)

      if (error) throw error

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

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-3xl text-cream mb-6">Meu Perfil</h1>

      {/* Header Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-plum/10 to-transparent border border-plum/20 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-plum/20 flex items-center justify-center text-2xl font-serif text-plum-light">
            {(profile.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="font-serif text-2xl text-cream">{profile.name || 'Usuário'}</h2>
            <p className="text-xs text-white/40">{profile.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-plum/20 text-plum-light border border-plum/30">Plano Gratuito</span>
              <span className="flex items-center gap-1 text-[10px] text-amber-400"><Star className="w-3 h-3 fill-amber-400 text-amber-400" /> 4.8</span>
            </div>
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
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Eventos', value: isLoading ? '-' : eventCount.toString(), icon: Calendar },
          { label: 'Favoritos', value: '0', icon: Heart },
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
            <button onClick={() => toast.success('E-mail de recuperação enviado!')} className="px-4 py-2 text-xs text-plum-light hover:bg-plum/10 rounded-full transition-colors">Alterar</button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-cream">Autenticação de dois fatores</div>
              <div className="text-xs text-white/30">Adicione segurança extra</div>
            </div>
            <button onClick={() => toast.success('Configuração iniciada!')} className="px-4 py-2 text-xs text-plum-light hover:bg-plum/10 rounded-full transition-colors">Ativar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
