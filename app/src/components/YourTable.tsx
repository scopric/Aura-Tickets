import { useState } from 'react'
import { Users, Sparkles, Heart, MessageCircle, Camera, Trophy, ChevronRight } from 'lucide-react'
import { mesasColetivas } from '../data/mockData'

export default function YourTable() {
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [liked, setLiked] = useState<Record<string, boolean>>({})
  const mesa = mesasColetivas[0]

  const toggleLike = (id: string) => {
    setLiked(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const icebreakers = [
    'Qual foi o último show que te arrepiou?',
    'Se pudesse tocar uma música agora, qual seria?',
    'Qual seu lugar favorito na cidade?',
    'Techno ou House? Defenda sua causa.',
  ]

  return (
    <div className="space-y-6">
      {/* Mesa Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-plum/20 via-plum/5 to-transparent border border-plum/20 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-plum flex items-center justify-center">
            <Users className="w-6 h-6 text-cream" />
          </div>
          <div>
            <h2 className="font-serif text-2xl text-cream">{mesa.name}</h2>
            <p className="text-sm text-cream/40">{mesa.theme}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-cream/40">Compatibilidade do grupo</span>
              <span className="text-sm font-medium text-plum">{mesa.compatibility}%</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-plum rounded-full transition-all"
                style={{ width: `${mesa.compatibility}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {['Temperamento equilibrado', 'Interesses alinhados', 'Vibe compatível'].map(tag => (
            <span key={tag} className="px-3 py-1 bg-white/5 text-cream/50 text-[10px] rounded-full border border-white/10 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-plum" />
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Members */}
      <div>
        <h3 className="text-sm font-medium text-cream/60 mb-4 uppercase tracking-wider">Seus Colegas de Mesa</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {mesa.members.map((member) => (
            <button
              key={member.id}
              onClick={() => setSelectedMember(selectedMember === member.id ? null : member.id)}
              className={`p-4 rounded-2xl border text-left transition-all duration-300 ${
                selectedMember === member.id
                  ? 'border-plum bg-plum/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}
            >
              <div className="relative mb-3">
                <img
                  src={member.avatar}
                  alt={member.name}
                  className={`w-14 h-14 rounded-full object-cover mx-auto ring-2 transition-all ${
                    member.name === 'Você' ? 'ring-plum' : 'ring-white/20'
                  }`}
                />
                {member.name === 'Você' && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-plum text-[9px] text-cream rounded-full">
                    Você
                  </span>
                )}
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-cream">{member.name}</div>
                <div className="text-xs text-cream/40">{member.role}</div>
                <div className="text-[10px] text-plum mt-1">{member.vibe}</div>
              </div>

              {/* Expanded details */}
              <div className={`overflow-hidden transition-all ${
                selectedMember === member.id ? 'max-h-40 opacity-100 mt-3 pt-3 border-t border-white/10' : 'max-h-0 opacity-0'
              }`}>
                <div className="flex flex-wrap gap-1">
                  {member.interests.map(i => (
                    <span key={i} className="px-2 py-0.5 bg-white/5 text-cream/50 text-[10px] rounded-full">
                      {i}
                    </span>
                  ))}
                </div>
                {member.name !== 'Você' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleLike(member.id) }}
                    className={`mt-2 flex items-center gap-1 text-xs transition-colors ${
                      liked[member.id] ? 'text-red-400' : 'text-cream/30 hover:text-cream/60'
                    }`}
                  >
                    <Heart className={`w-3 h-3 ${liked[member.id] ? 'fill-current' : ''}`} />
                    {liked[member.id] ? 'Curtiu' : 'Curtir'}
                  </button>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Icebreakers */}
      <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle className="w-4 h-4 text-plum" />
          <h3 className="text-sm font-medium text-cream">Quebra-Gelos</h3>
          <span className="text-[10px] text-cream/30 ml-auto">Comece a conversa</span>
        </div>
        <div className="space-y-2">
          {icebreakers.map((q, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group cursor-pointer">
              <span className="text-xs text-plum font-medium">{i + 1}</span>
              <span className="text-sm text-cream/70 flex-1">{q}</span>
              <ChevronRight className="w-4 h-4 text-cream/20 group-hover:text-plum transition-colors" />
            </div>
          ))}
        </div>
      </div>

      {/* Gamification */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
          <Camera className="w-5 h-5 text-plum mx-auto mb-2" />
          <div className="text-sm text-cream font-medium">Missão Fotográfica</div>
          <div className="text-xs text-cream/40 mt-1">Tire uma foto em grupo</div>
        </div>
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
          <Trophy className="w-5 h-5 text-amber-400 mx-auto mb-2" />
          <div className="text-sm text-cream font-medium">Quiz do Evento</div>
          <div className="text-xs text-cream/40 mt-1">Responda e ganhe pontos</div>
        </div>
      </div>

      {/* Seating */}
      <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
        <h3 className="text-sm font-medium text-cream mb-4">Disposição da Mesa</h3>
        <div className="flex items-center justify-center gap-2">
          {mesa.members.map((m, i) => (
            <div key={m.id} className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-medium ${
                m.name === 'Você' ? 'bg-plum text-cream' : 'bg-white/10 text-cream/50'
              }`}>
                {m.name[0]}
              </div>
              <span className="text-[9px] text-cream/30 mt-1">{i + 1}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
