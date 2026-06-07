import { supabase } from './supabase'

export interface AddressResult {
  logradouro: string
  bairro: string
  localidade: string // Cidade
  uf: string         // Estado (ex: SP ou Dublin)
  pais: string
  error?: string
}

/**
 * Busca configurações da API de CEP salvas pelo administrador
 */
export async function getCepApiSettings() {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'general')
      .maybeSingle()

    if (error || !data) return null
    return data.value as {
      cepProvider?: string
      cepApiKey?: string
      cepApiUrl?: string
    }
  } catch (err) {
    console.error('[cepService] Erro ao buscar chaves de API:', err)
    return null
  }
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

  // 2. Caso seja Internacional (Irlanda Aircode, etc.)
  const settings = await getCepApiSettings()
  const provider = settings?.cepProvider || 'nominatim'
  const apiKey = settings?.cepApiKey

  // Provedor 2.1: Geoapify
  if (provider === 'geoapify' && apiKey) {
    try {
      const url = `https://api.geoapify.com/v1/geocode/search?postcode=${encodeURIComponent(postalCode)}&filter=countrycode:${countryCode.toLowerCase()}&apiKey=${apiKey}`
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        const feature = data.features?.[0]
        if (feature) {
          const props = feature.properties
          return {
            logradouro: props.street || props.address_line1 || '',
            bairro: props.suburb || props.district || '',
            localidade: props.city || props.town || props.village || '',
            uf: props.state || props.county || '',
            pais: props.country || countryCode
          }
        }
      }
    } catch (err) {
      console.error('[cepService] Erro no Geoapify:', err)
    }
  }

  // Provedor 2.2: Google Maps Geocoding
  if (provider === 'google' && apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(postalCode)}&components=country:${countryCode.toLowerCase()}&key=${apiKey}`
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        const result = data.results?.[0]
        if (result) {
          let route = ''
          let neighborhood = ''
          let city = ''
          let state = ''
          let countryName = ''

          // Extrair do address_components
          for (const component of result.address_components) {
            const types = component.types
            if (types.includes('route')) {
              route = component.long_name
            } else if (types.includes('sublocality') || types.includes('neighborhood')) {
              neighborhood = component.long_name
            } else if (types.includes('locality') || types.includes('administrative_area_level_2')) {
              city = component.long_name
            } else if (types.includes('administrative_area_level_1')) {
              state = component.short_name
            } else if (types.includes('country')) {
              countryName = component.long_name
            }
          }

          return {
            logradouro: route || result.formatted_address || '',
            bairro: neighborhood || '',
            localidade: city || '',
            uf: state || '',
            pais: countryName || countryCode
          }
        }
      }
    } catch (err) {
      console.error('[cepService] Erro no Google Geocoding:', err)
    }
  }

  // Fallback 2.3: Nominatim OpenStreetMap (Gratuito e Público)
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
