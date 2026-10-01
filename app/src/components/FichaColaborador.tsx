import { useState, type Dispatch, type SetStateAction } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { searchAddressByPostalCode } from '../lib/cepService'
import { formatCPF, formatPostalCode, UFS } from '../lib/formatters'
import { campo, digitos, PIX, rotulo, type Ficha } from '../lib/fichaColaborador'
import PhoneInput from './ui/PhoneInput'

// Os cinco blocos do cadastro; o formulário, o botão e os avisos ficam com cada tela
export function CamposFicha({ f, setF, disabled }: { f: Ficha; setF: Dispatch<SetStateAction<Ficha>>; disabled: boolean }) {
  const set = <K extends keyof Ficha>(k: K, v: Ficha[K]) => setF((x) => ({ ...x, [k]: v }))
  const [buscandoCep, setBuscandoCep] = useState(false)

  const buscarCep = async () => {
    const cep = digitos(f.cep)
    if (cep.length !== 8) return
    setBuscandoCep(true)
    const r = await searchAddressByPostalCode(cep, 'BR')
    setBuscandoCep(false)
    if (!r || r.error) { toast.error(r?.error || 'CEP não encontrado.'); return }
    setF((x) => (digitos(x.cep) === cep ? {
      ...x, rua: r.logradouro || x.rua, bairro: r.bairro || x.bairro, cidade: r.localidade || x.cidade, uf: UFS.includes(r.uf) ? r.uf : x.uf,
    } : x))
  }

  return (
    <>
      <fieldset className="grid sm:grid-cols-2 gap-4" disabled={disabled}>
        <legend className="font-serif text-lg text-espresso mb-3">Dados pessoais</legend>
        <div className="sm:col-span-2">
          <label htmlFor="c-nome" className={rotulo}>Nome completo</label>
          <input id="c-nome" autoComplete="name" value={f.nome_completo} onChange={(e) => set('nome_completo', e.target.value)} className={campo} />
        </div>
        <div>
          <label htmlFor="c-cpf" className={rotulo}>CPF</label>
          <input id="c-cpf" inputMode="numeric" value={f.cpf} onChange={(e) => set('cpf', formatCPF(e.target.value))} placeholder="000.000.000-00" className={campo} />
        </div>
        <div>
          <label htmlFor="c-rg" className={rotulo}>RG</label>
          <input id="c-rg" value={f.rg} maxLength={20} onChange={(e) => set('rg', e.target.value)} className={campo} />
        </div>
        <div>
          <label htmlFor="c-nasc" className={rotulo}>Data de nascimento</label>
          <input id="c-nasc" type="date" value={f.data_nascimento} onChange={(e) => set('data_nascimento', e.target.value)} className={campo} />
        </div>
      </fieldset>

      <fieldset className="grid sm:grid-cols-6 gap-4" disabled={disabled}>
        <legend className="font-serif text-lg text-espresso mb-3">Endereço</legend>
        <div className="sm:col-span-2">
          <label htmlFor="c-cep" className={rotulo}>CEP {buscandoCep && <Loader2 className="inline w-3 h-3 animate-spin ml-1" />}</label>
          <input id="c-cep" inputMode="numeric" autoComplete="postal-code" value={f.cep} maxLength={9}
            onChange={(e) => set('cep', formatPostalCode(e.target.value))} onBlur={buscarCep} placeholder="00000-000" className={campo} />
        </div>
        <div className="sm:col-span-4">
          <label htmlFor="c-rua" className={rotulo}>Rua</label>
          <input id="c-rua" autoComplete="address-line1" value={f.rua} onChange={(e) => set('rua', e.target.value)} className={campo} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="c-numero" className={rotulo}>Número</label>
          <input id="c-numero" value={f.numero} maxLength={20} onChange={(e) => set('numero', e.target.value)} className={campo} />
        </div>
        <div className="sm:col-span-4">
          <label htmlFor="c-complemento" className={rotulo}>Complemento (opcional)</label>
          <input id="c-complemento" autoComplete="address-line2" value={f.complemento} maxLength={100} onChange={(e) => set('complemento', e.target.value)} className={campo} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="c-bairro" className={rotulo}>Bairro</label>
          <input id="c-bairro" value={f.bairro} onChange={(e) => set('bairro', e.target.value)} className={campo} />
        </div>
        <div className="sm:col-span-3">
          <label htmlFor="c-cidade" className={rotulo}>Cidade</label>
          <input id="c-cidade" autoComplete="address-level2" value={f.cidade} onChange={(e) => set('cidade', e.target.value)} className={campo} />
        </div>
        <div className="sm:col-span-1">
          <label htmlFor="c-uf" className={rotulo}>UF</label>
          <select id="c-uf" value={f.uf} onChange={(e) => set('uf', e.target.value)} className={campo}>
            <option value="">—</option>
            {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </fieldset>

      <fieldset className="grid sm:grid-cols-2 gap-4" disabled={disabled}>
        <legend className="font-serif text-lg text-espresso mb-3">Contatos</legend>
        <div className="sm:col-span-2">
          <label htmlFor="c-email2" className={rotulo}>E-mail secundário (diferente do e-mail da conta)</label>
          <input id="c-email2" type="email" autoComplete="email" value={f.email_secundario} onChange={(e) => set('email_secundario', e.target.value)} className={campo} />
        </div>
        <div>
          <label htmlFor="c-telefone" className={rotulo}>Telefone</label>
          <PhoneInput id="c-telefone" value={f.telefone} onChange={(v) => set('telefone', v)} />
        </div>
        <div>
          <label htmlFor="c-whatsapp" className={rotulo}>WhatsApp</label>
          <PhoneInput id="c-whatsapp" value={f.whatsapp} onChange={(v) => set('whatsapp', v)} />
        </div>
      </fieldset>

      <fieldset className="grid sm:grid-cols-2 gap-4" disabled={disabled}>
        <legend className="font-serif text-lg text-espresso mb-3">Contato de emergência</legend>
        <div className="sm:col-span-2">
          <label htmlFor="c-emerg-nome" className={rotulo}>Nome</label>
          <input id="c-emerg-nome" value={f.emergencia_nome} onChange={(e) => set('emergencia_nome', e.target.value)} className={campo} />
        </div>
        <div>
          <label htmlFor="c-emerg-parentesco" className={rotulo}>Parentesco</label>
          <input id="c-emerg-parentesco" value={f.emergencia_parentesco} maxLength={50} onChange={(e) => set('emergencia_parentesco', e.target.value)} placeholder="Mãe, irmão, cônjuge…" className={campo} />
        </div>
        <div>
          <label htmlFor="c-emerg-tel" className={rotulo}>Telefone</label>
          <PhoneInput id="c-emerg-tel" value={f.emergencia_telefone} onChange={(v) => set('emergencia_telefone', v)} />
        </div>
      </fieldset>

      <fieldset className="grid sm:grid-cols-6 gap-4" disabled={disabled}>
        <legend className="font-serif text-lg text-espresso mb-3">Pagamento</legend>
        <div className="sm:col-span-2">
          <label htmlFor="c-pix-tipo" className={rotulo}>Tipo de chave Pix</label>
          <select id="c-pix-tipo" value={f.pix_tipo} onChange={(e) => setF((x) => ({ ...x, pix_tipo: e.target.value, pix_chave: '' }))} className={campo}>
            {PIX.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div className="sm:col-span-4">
          <label htmlFor="c-pix" className={rotulo}>Chave Pix</label>
          {f.pix_tipo === 'telefone' ? (
            <PhoneInput id="c-pix" apenasBrasil value={f.pix_chave} onChange={(v) => set('pix_chave', v)} />
          ) : (
            <input id="c-pix" value={f.pix_chave} inputMode={f.pix_tipo === 'cpf' ? 'numeric' : undefined}
              onChange={(e) => set('pix_chave', f.pix_tipo === 'cpf' ? formatCPF(e.target.value) : e.target.value)}
              placeholder={f.pix_tipo === 'cpf' ? '000.000.000-00' : f.pix_tipo === 'email' ? 'voce@email.com' : '00000000-0000-0000-0000-000000000000'}
              className={campo} />
          )}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="c-banco" className={rotulo}>Banco (opcional)</label>
          <input id="c-banco" value={f.banco} maxLength={80} onChange={(e) => set('banco', e.target.value)} className={campo} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="c-agencia" className={rotulo}>Agência (opcional)</label>
          <input id="c-agencia" value={f.agencia} maxLength={20} onChange={(e) => set('agencia', e.target.value)} className={campo} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="c-conta" className={rotulo}>Conta (opcional)</label>
          <input id="c-conta" value={f.conta} maxLength={30} onChange={(e) => set('conta', e.target.value)} className={campo} />
        </div>
      </fieldset>
    </>
  )
}
