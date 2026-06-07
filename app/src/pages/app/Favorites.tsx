import { Link } from 'react-router-dom'
import { Heart, Star, ArrowRight } from 'lucide-react'

export default function AppFavorites() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold text-white mb-6">Favoritos</h1>

      <div className="text-center py-16 bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-3xl">
        <Heart className="w-12 h-12 text-white/10 mx-auto mb-4" />
        <p className="text-white/40 text-sm mb-2">
          Você ainda não favoritou nenhum evento.
        </p>
        <p className="text-white/30 text-xs mb-6">
          Salve seus eventos favoritos para encontrá-los rapidamente.
        </p>
        <Link
          to="/app/events"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#1d68c4] to-[#8f33f5] hover:from-[#2573d9] hover:to-[#9d47ff] text-white text-sm font-semibold rounded-xl shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 transition-all duration-200"
        >
          <Star className="w-4 h-4" />
          <span>Explorar eventos</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}
