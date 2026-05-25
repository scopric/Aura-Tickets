import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const wooviApiKey = Deno.env.get('WOOVI_API_KEY')
    if (!wooviApiKey) {
      return new Response(JSON.stringify({ error: 'Woovi API Key is not configured' }), { status: 500 })
    }

    const { orderId, amount, customerName, customerEmail, customerCpf } = await req.json()

    if (!orderId || !amount) {
      return new Response(
        JSON.stringify({ error: 'Missing orderId or amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // A API Woovi/OpenPix exige o valor (value) em centavos inteiros (integers)
    const valueInCents = Math.round(amount * 100)

    const response = await fetch('https://api.openpix.com.br/v1/charge', {
      method: 'POST',
      headers: {
        'Authorization': wooviApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        correlationID: orderId,
        value: valueInCents,
        comment: `Ingressos Evokaa - Pedido ${orderId}`,
        customer: {
          name: customerName,
          email: customerEmail,
          taxID: customerCpf?.replace(/\D/g, ''), // CPF limpo (apenas números)
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to create Pix charge on Woovi')
    }

    const data = await response.json()

    return new Response(
      JSON.stringify({
        chargeId: data.charge.correlationID,
        qrCodeData: data.charge.brCode,
        qrCodeImageUrl: data.charge.qrCodeImage,
        status: 'pending'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
