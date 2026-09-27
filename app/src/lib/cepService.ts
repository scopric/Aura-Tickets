export interface AddressResult {
  logradouro: string
  bairro: string
  localidade: string // Cidade
  uf: string         // Estado (ex: SP ou Dublin)
  pais: string
  error?: string
}

/**
 * Consulta CEP (Brasil) ou Código Postal/Aircode (Internacional)
 */
export async function searchAddressByPostalCode(
  postalCode: string,
  countryCode: string = 'BR'
): Promise<AddressResult | null> {
  const code = postalCode.replace(/[^a-zA-Z0-9]/g, '').trim()
  if (!code) return null

  // 1. Caso seja Brasil (ViaCEP)
  if (countryCode.toUpperCase() === 'BR') {
    if (code.length !== 8) return { logradouro: '', bairro: '', localidade: '', uf: '', pais: 'Brasil', error: 'CEP inválido' }

    try {
      const response = await fetch(`https://viacep.com.br/ws/${code}/json/`)
      if (!response.ok) throw new Error('Falha na requisição ao ViaCEP')
      
      const data = await response.json()
      if (data.erro) {
        return { logradouro: '', bairro: '', localidade: '', uf: '', pais: 'Brasil', error: 'CEP não encontrado' }
      }

      return {
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        localidade: data.localidade || '',
        uf: data.uf || '',
        pais: 'Brasil'
      }
    } catch (err) {
      console.error('[cepService] Erro no ViaCEP:', err)
      return null
    }
  }

  // 2. Internacional (Irlanda Aircode, etc.): Nominatim OpenStreetMap, gratuito e sem chave.
  // Não lê platform_settings: a linha `general` é pública no navegador e não pode guardar chave de API.
  try {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(postalCode)}&countrycodes=${countryCode.toLowerCase()}&format=json&addressdetails=1`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'EvokaaTicketsApp/1.0'
      }
    })
    if (response.ok) {
      const data = await response.json()
      const item = data?.[0]
      if (item) {
        const addr = item.address
        return {
          logradouro: addr.road || addr.suburb || '',
          bairro: addr.neighbourhood || addr.suburb || '',
          localidade: addr.city || addr.town || addr.village || addr.municipality || '',
          uf: addr.state || addr.county || '',
          pais: addr.country || countryCode
        }
      }
    }
  } catch (err) {
    console.error('[cepService] Erro no Nominatim:', err)
  }

  return null
}
