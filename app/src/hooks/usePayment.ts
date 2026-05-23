import { useState } from 'react';
import { supabase } from '@/lib/supabase'; // Ajuste dependendo do caminho do cliente Supabase do frontend

export interface PaymentRequest {
  orderId: string;
  method: 'credit_card' | 'pix' | 'boleto';
  amount: number;
  customerName: string;
  customerEmail: string;
  customerCpf: string;
}

export interface PaymentResult {
  transactionId: string;
  status: 'approved' | 'pending' | 'declined' | 'error';
  qrCodeData?: string;      // Pix copy/paste
  qrCodeImageUrl?: string;  // Pix QR Code
  clientSecret?: string;    // Stripe Client Secret
  message?: string;
}

export function usePayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processPayment = async (request: PaymentRequest): Promise<PaymentResult> => {
    setLoading(true);
    setError(null);

    try {
      if (request.method === 'credit_card') {
        // Chamar Edge Function para criar o PaymentIntent do Stripe
        const { data, error: functionError } = await supabase.functions.invoke('stripe-create-payment', {
          body: {
            orderId: request.orderId,
            amount: request.amount,
            customerEmail: request.customerEmail,
            customerName: request.customerName,
          },
        });

        if (functionError) throw new Error(functionError.message || 'Erro ao iniciar pagamento com cartão');

        return {
          transactionId: data.transactionId,
          status: 'pending', // Fica pendente até a confirmação do Stripe Elements no front
          clientSecret: data.clientSecret,
        };
      } else if (request.method === 'pix') {
        // Chamar Edge Function para gerar cobrança Pix via Woovi
        const { data, error: functionError } = await supabase.functions.invoke('woovi-create-pix', {
          body: {
            orderId: request.orderId,
            amount: request.amount,
            customerName: request.customerName,
            customerEmail: request.customerEmail,
            customerCpf: request.customerCpf,
          },
        });

        if (functionError) throw new Error(functionError.message || 'Erro ao gerar Pix');

        return {
          transactionId: data.chargeId,
          status: 'pending',
          qrCodeData: data.qrCodeData,
          qrCodeImageUrl: data.qrCodeImageUrl,
        };
      } else {
        throw new Error('Método de pagamento não suportado');
      }
    } catch (err: any) {
      const msg = err.message || 'Falha no processamento do pagamento';
      setError(msg);
      return {
        transactionId: '',
        status: 'error',
        message: msg,
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    processPayment,
    loading,
    error,
  };
}
