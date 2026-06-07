import { supabase } from './supabase'
import { useAuthStore } from '../stores/authStore'
import { toast } from 'sonner'

/**
 * Redimensiona uma imagem usando Canvas e gera uma string Base64 compacta (JPEG 0.75).
 * Isso garante que o avatar seja leve e possa ser salvo diretamente no Postgres.
 */
export function compressImage(file: File, maxWidth = 150, maxHeight = 150): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height
            height = maxHeight
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Falha ao obter contexto 2D do Canvas'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)
        const base64Url = canvas.toDataURL('image/jpeg', 0.75)
        resolve(base64Url)
      }
      img.onerror = (err) => reject(err)
    }
    reader.onerror = (err) => reject(err)
  })
}

/**
 * Processa a imagem de avatar e a salva na tabela profiles do Supabase.
 */
export async function uploadAvatar(file: File, userId: string): Promise<string | null> {
  if (!userId) {
    toast.error('Usuário não autenticado')
    return null
  }

  const toastId = toast.loading('Processando imagem do avatar...')

  try {
    // 1. Comprime a imagem para Base64 leve
    const base64Url = await compressImage(file, 150, 150)

    // 2. Salva no banco de dados na tabela profiles
    toast.loading('Atualizando perfil no banco...', { id: toastId })
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: base64Url })
      .eq('id', userId)

    if (error) {
      console.error('Erro ao atualizar avatar no Supabase:', error)
      throw error
    }

    // 3. Atualiza o Zustand Store local para refletir a alteração instantaneamente
    const currentStore = useAuthStore.getState()
    if (currentStore.user) {
      currentStore.setUser({
        ...currentStore.user,
        avatar_url: base64Url
      })
    }

    toast.success('Foto de perfil atualizada!', { id: toastId })
    return base64Url
  } catch (err: any) {
    console.error('Erro no upload de avatar:', err)
    toast.error(err.message || 'Falha ao atualizar foto de perfil', { id: toastId })
    return null
  }
}
