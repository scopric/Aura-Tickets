/**
 * Utilitários de formatação e máscaras para padronização e internacionalização.
 * Evita o uso de dependências externas npm.
 */

/**
 * Formata CPF para o padrão "xxx.xxx.xxx-xx"
 */
export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/**
 * Formata CNPJ para o padrão "xx.xxx.xxx/xxxx-xx"
 */
export function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/**
 * Formata CPF ou CNPJ de acordo com o comprimento
 */
export function formatCPFOrCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 11) {
    return formatCPF(value);
  }
  return formatCNPJ(value);
}

/**
 * Formata CEP/Código Postal.
 * Suporta CEP Brasileiro (xxxxx-xxx) e Aircode da Irlanda (D02 X285)
 */
export function formatPostalCode(value: string, countryCode: string = 'BR'): string {
  const cleaned = value.trim();
  
  if (countryCode.toUpperCase() === 'BR') {
    const digits = cleaned.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  
  if (countryCode.toUpperCase() === 'IE') {
    // Aircode da Irlanda: ex "D02 X285" (7 caracteres alfanuméricos formatados como AAA AAAA)
    const alnum = cleaned.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 7);
    if (alnum.length <= 3) return alnum;
    return `${alnum.slice(0, 3)} ${alnum.slice(3)}`;
  }
  
  // Genérico para outros países
  return cleaned.toUpperCase();
}

/**
 * Formata moeda com pontos e vírgulas de acordo com o padrão internacional,
 * adicionando a bandeira do país de origem correspondente.
 */
export function formatCurrency(
  value: number | undefined | null,
  currency: string = 'BRL',
  countryCode?: string
): string {
  const val = value ?? 0;
  const curr = currency.toUpperCase();
  const country = countryCode?.toUpperCase();

  if (curr === 'BRL' || country === 'BR') {
    return `🇧🇷 R$ ${val.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  if (curr === 'USD' || country === 'US') {
    return `🇺🇸 $ ${val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  if (curr === 'EUR') {
    if (country === 'IE') {
      return `🇮🇪 € ${val.toLocaleString('en-IE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
    }
    if (country === 'PT') {
      return `🇵🇹 € ${val.toLocaleString('pt-PT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
    }
    if (country === 'ES') {
      return `🇪🇸 € ${val.toLocaleString('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
    }
    // União Europeia genérico
    return `🇪🇺 € ${val.toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  if (curr === 'GBP' || country === 'GB') {
    return `🇬🇧 £ ${val.toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  // Fallback para qualquer outro tipo de moeda
  return `🌐 ${curr} ${val.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}
