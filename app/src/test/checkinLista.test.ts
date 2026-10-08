import { describe, it, expect } from 'vitest'
import { filtrarSituacao, linhasCsvCheckin, ordenarPorEntrada, ritmoPorHora, COLUNAS_CSV_CHECKIN, type LinhaLista } from '../lib/checkin'
import { toCsv } from '../lib/exportCsv'

describe('ritmo de entrada por hora (Brasília)', () => {
  it('agrupa por hora cheia e preenche as horas vazias entre a primeira e a última', () => {
    // 22:30Z = 19:30 em Brasília
    const r = ritmoPorHora(['2026-10-10T22:30:00Z', '2026-10-10T22:45:00Z', '2026-10-11T01:10:00Z', null, 'lixo'])
    expect(r).toEqual([{ rotulo: '19h', qtd: 2 }, { rotulo: '20h', qtd: 0 }, { rotulo: '21h', qtd: 0 }, { rotulo: '22h', qtd: 1 }])
  })
  it('usa o fuso de Brasília, não o do aparelho, e põe a data quando passa da meia-noite', () => {
    // 02:30Z = 23:30 do dia 10; 03:10Z = 00:10 do dia 11
    expect(ritmoPorHora(['2026-10-11T02:30:00Z', '2026-10-11T03:10:00Z'])).toEqual([{ rotulo: '10/10 23h', qtd: 1 }, { rotulo: '11/10 00h', qtd: 1 }])
  })
  it('intervalo longo (30 dias): só as horas com entrada, sem barras vazias no meio', () => {
    const r = ritmoPorHora(['2026-09-10T22:30:00Z', '2026-10-10T22:30:00Z', '2026-10-10T22:50:00Z'])
    expect(r).toEqual([{ rotulo: '10/09 19h', qtd: 1 }, { rotulo: '10/10 19h', qtd: 2 }])
  })
  it('sem entradas, nada para mostrar', () => expect(ritmoPorHora([null, null])).toEqual([]))
})

const l = (name: string, status: LinhaLista['status'], checkedInAt: string | null): LinhaLista => ({ name, ticketType: 'Pista', status, checkedInAt })
const linhas = [l('Ana', 'usado', '2026-10-10T22:30:00Z'), l('Bia', 'pendente', null), l('Caio', 'usado', '2026-10-10T23:30:00Z'), l('Duda', 'cancelado', null), l('Eli', 'transferido', null)]

describe('filtro e ordem da lista', () => {
  it('filtra por situação; "todos" não filtra', () => {
    expect(filtrarSituacao(linhas, 'todos')).toHaveLength(5)
    expect(filtrarSituacao(linhas, 'usado').map(x => x.name)).toEqual(['Ana', 'Caio'])
    expect(filtrarSituacao(linhas, 'pendente').map(x => x.name)).toEqual(['Bia'])
    expect(filtrarSituacao(linhas, 'cancelado').map(x => x.name)).toEqual(['Duda'])
    expect(filtrarSituacao(linhas, 'transferido').map(x => x.name)).toEqual(['Eli'])
  })
  it('ordena pela hora de entrada, mais recente primeiro, e quem não entrou fica no fim sem mudar de ordem', () => {
    expect(ordenarPorEntrada(linhas).map(x => x.name)).toEqual(['Caio', 'Ana', 'Bia', 'Duda', 'Eli'])
    expect(linhas[0].name).toBe('Ana') // não altera a lista original
  })
})

describe('CSV do check-in', () => {
  it('só nome, tipo, situação e hora: sem e-mail, CPF nem código do ingresso', () => {
    const csv = toCsv(linhasCsvCheckin(linhas), COLUNAS_CSV_CHECKIN)
    const [cab, ana, bia] = csv.replace('﻿', '').split('\r\n')
    expect(cab).toBe('Nome;Tipo;Situação;Hora de entrada')
    expect(ana).toBe('Ana;Pista;Entrou;10/10/2026 19:30')
    expect(bia).toBe('Bia;Pista;Não entrou;')
    expect(csv).not.toMatch(/@|cpf|qr_code|ticketCode/i)
  })
})
