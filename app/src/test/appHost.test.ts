import { describe, it, expect } from 'vitest'
import { getAppMode, appUrl } from '../lib/appHost'

const loc = (hostname: string, protocol = 'https:', port = '') => ({ hostname, protocol, port })

describe('appHost', () => {
  it('getAppMode separa admin (alpha), plataforma (app) e site pelo host', () => {
    expect(getAppMode('alpha.evokaa.com.br')).toBe('admin')
    expect(getAppMode('alpha.localhost')).toBe('admin')
    expect(getAppMode('app.evokaa.com.br')).toBe('app')
    expect(getAppMode('app.localhost')).toBe('app')
    for (const host of ['evokaa.com.br', 'www.evokaa.com.br', 'localhost', 'evokaa-git-x.vercel.app', 'app-git-x.vercel.app']) {
      expect(getAppMode(host)).toBe('site')
    }
  })

  it('appUrl aponta para app.* em produção e em localhost; relativo nos previews', () => {
    expect(appUrl('/auth/login', loc('evokaa.com.br'))).toBe('https://app.evokaa.com.br/auth/login')
    expect(appUrl('/auth/register', loc('www.evokaa.com.br'))).toBe('https://app.evokaa.com.br/auth/register')
    expect(appUrl('/auth/login', loc('localhost', 'http:', '3000'))).toBe('http://app.localhost:3000/auth/login')
    expect(appUrl('/auth/login', loc('app.localhost', 'http:', '3000'))).toBe('http://app.localhost:3000/auth/login')
    expect(appUrl('/auth/login', loc('evokaa-git-x.vercel.app'))).toBe('/auth/login')
  })
})
