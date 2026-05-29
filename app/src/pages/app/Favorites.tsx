import { Link } from 'react-router-dom'
import { Heart, Star, ArrowRight } from 'lucide-react'

export default function AppFavorites() {
  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-3xl text-espresso mb-6">Favoritos</h1>

      <div className="text-center py-16 bg-white/60 border border-white/60 rounded-3xl">
        <Heart className="w-12 h-12 text-espresso/10 mx-auto mb-4" />
        <p className="text-espresso/40 text-sm mb-2">
          Você ainda não favoritou nenhum evento.
        </p>
        <p className="text-espresso/30 text-xs mb-4">
          Salve seus eventos favoritos para encontrá-los rapidamente.
        </p>
        <Link
          to="/app/events"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all"
        >
          <Star className="w-4 h-4" />
          Explorar eventos
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}
