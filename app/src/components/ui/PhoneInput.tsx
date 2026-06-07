import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

export interface CountryDdi {
  code: string        // DDI: '+55'
  country: string     // 'BR'
  flag: string        // '🇧🇷'
  name: string        // 'Brasil'
  mask: string        // Ex: '(99) 99999-9999'
}

export const COUNTRIES_DDI: CountryDdi[] = [
  { code: '+55', country: 'BR', flag: '🇧🇷', name: 'Brasil', mask: '(99) 99999-9999' },
  { code: '+1', country: 'US', flag: '🇺🇸', name: 'Estados Unidos', mask: '(999) 999-9999' },
  { code: '+351', country: 'PT', flag: '🇵🇹', name: 'Portugal', mask: '999 999 999' },
  { code: '+353', country: 'IE', flag: '🇮🇪', name: 'Irlanda', mask: '99 999 9999' },
  { code: '+44', country: 'GB', flag: '🇬🇧', name: 'Reino Unido', mask: '9999 999999' },
  { code: '+34', country: 'ES', flag: '🇪🇸', name: 'Espanha', mask: '999 99 99 99' },
]

interface PhoneInputProps {
  value: string
  onChange: (fullNumber: string) => void
  className?: string
  disabled?: boolean
  id?: string
}

export default function PhoneInput({
  value,
  onChange,
  className = '',
  disabled = false,
  id
}: PhoneInputProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState<CountryDdi>(COUNTRIES_DDI[0])
  const [localNumber, setLocalNumber] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Sincronizar valor recebido externamente (ex: '+5511987654321')
  useEffect(() => {
    if (!value) {
      setLocalNumber('')
      return
    }

    // Tentar encontrar DDI correspondente no início da string
    const match = COUNTRIES_DDI.find(c => value.startsWith(c.code))
    if (match) {
      setSelectedCountry(match)
      const numberPart = value.slice(match.code.length)
      setLocalNumber(applyMask(numberPart, match.mask))
    } else {
      // Se não der match com nenhum, assume padrão BR mas sem DDI forçado na tela se o valor for genérico
      setLocalNumber(value)
    }
  }, [value])

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Aplica máscara ao número digitado
  const applyMask = (val: string, mask: string): string => {
    const cleanVal = val.replace(/\D/g, '')
    let formatted = ''
    let valIdx = 0

    // Se o país for Brasil, lidar dinamicamente com celular (9 dígitos) e fixo (8 dígitos)
    let activeMask = mask
    if (selectedCountry.code === '+55') {
      if (cleanVal.length <= 10) {
        activeMask = '(99) 9999-9999'
      } else {
        activeMask = '(99) 99999-9999'
      }
    }

    for (let i = 0; i < activeMask.length && valIdx < cleanVal.length; i++) {
      if (activeMask[i] === '9') {
        formatted += cleanVal[valIdx]
        valIdx++
      } else {
        formatted += activeMask[i]
      }
    }
    return formatted
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value
    const masked = applyMask(rawVal, selectedCountry.mask)
    setLocalNumber(masked)

    // Remover formatação ao enviar para o pai, ou enviar número com DDI
    const cleanNumber = masked.replace(/\D/g, '')
    onChange(selectedCountry.code + cleanNumber)
  }

  const handleSelectCountry = (country: CountryDdi) => {
    setSelectedCountry(country)
    setDropdownOpen(false)

    // Reaplicar máscara com novo padrão de país
    const cleanNumber = localNumber.replace(/\D/g, '')
    const newMasked = applyMask(cleanNumber, country.mask)
    setLocalNumber(newMasked)

    onChange(country.code + cleanNumber)
  }

  return (
    <div ref={containerRef} className={`relative flex items-center w-full ${className}`}>
      {/* Botão Seletor de DDI */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-1.5 px-3 py-2.5 bg-white/40 border border-white/60 rounded-l-xl text-sm text-espresso hover:bg-white/60 transition-all focus:outline-none focus:border-plum/30 h-[42px] border-r-0"
      >
        <span className="text-base leading-none select-none">{selectedCountry.flag}</span>
        <span className="text-xs font-semibold font-mono text-espresso/80">{selectedCountry.code}</span>
        <ChevronDown className="w-3.5 h-3.5 text-espresso/40 flex-shrink-0" />
      </button>

      {/* Input de Número Local */}
      <input
        type="tel"
        id={id}
        disabled={disabled}
        placeholder={selectedCountry.mask}
        value={localNumber}
        onChange={handleInputChange}
        className="flex-1 px-4 py-2.5 bg-white/60 border border-white/60 rounded-r-xl text-sm text-espresso focus:outline-none focus:border-plum/30 h-[42px]"
      />

      {/* Dropdown de Países */}
      {dropdownOpen && (
        <div className="absolute top-full left-0 mt-1.5 w-64 bg-white/95 backdrop-blur-md border border-stone-200/80 rounded-2xl shadow-elevated z-50 py-1.5 overflow-hidden animate-fade-in max-h-60 overflow-y-auto">
          <div className="px-3 py-1 text-[10px] font-bold text-espresso/40 uppercase tracking-wider border-b border-stone-100 mb-1">
            Selecione o País
          </div>
          {COUNTRIES_DDI.map(c => (
            <button
              key={c.code}
              type="button"
              onClick={() => handleSelectCountry(c)}
              className={`flex items-center gap-3 w-full px-4 py-2 text-left hover:bg-plum/5 text-sm transition-colors ${selectedCountry.code === c.code ? 'bg-plum/10 text-plum font-semibold' : 'text-espresso'}`}
            >
              <span className="text-lg leading-none">{c.flag}</span>
              <span className="flex-1 truncate">{c.name}</span>
              <span className="text-xs font-mono text-espresso/40">{c.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
