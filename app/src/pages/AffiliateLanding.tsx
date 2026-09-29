import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { setAffiliateRef } from '../lib/affiliateRef'

// Link público do Afiliado Evokaa: www.evokaa.com.br/p/CODIGO/nome-do-link.
// Registra o código (e o link), conta o clique e leva à seção de planos da página inicial.
export default function AffiliateLanding() {
  const { code = '', link } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    setAffiliateRef(code, link)
    if (link) {
      // contador informativo; falha não impede a navegação
      supabase.rpc('affiliate_link_hit', { p_code: code, p_slug: link } as never)
        .then(({ error }) => { if (error) console.warn('[Afiliado] clique não contado:', error.message) })
    }
    navigate('/#planos', { replace: true })
  }, [code, link, navigate])

  return null
}
