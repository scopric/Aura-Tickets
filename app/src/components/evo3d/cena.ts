// Cena 3D do Evo (porta da prova docs/identidade-v3/evo-3d/index.html, v4.1). Único arquivo que importa `three`:
// o EvoCena só o carrega por import() dinâmico, então o three fica num chunk próprio fora do pacote de entrada.
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'

export type Urls = { modelo: string; marca: string; marcaTexto: string }

const POSE = -0.35 // pose 3/4 fixa; oscila ±17° em 14 s (regra do lock: nunca giro de 360°)
const reduzido = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** Monta a cena num canvas próprio dentro de `host` e marca o canvas com `pronta` ao primeiro quadro (a marca fica no
 *  canvas, não no host: o StrictMode monta duas vezes e o desmonte da primeira instância apagaria a marca da segunda).
 *  Devolve a função que desfaz tudo. Se o modelo ou a textura não carregam, desfaz sozinha e `pronta` nunca aparece:
 *  o poster do componente continua. O canvas é criado aqui porque o StrictMode monta duas vezes e o
 *  `forceContextLoss` do desmonte mataria o contexto da segunda montagem num canvas compartilhado. */
export async function montar(host: HTMLElement, urls: Urls): Promise<() => void> {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true') // o leitor de tela fica só com o alt do poster; o 3D é a mesma imagem
  host.appendChild(canvas)
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: true })
  if (!gl) { canvas.remove(); return () => {} }

  let renderer: THREE.WebGLRenderer
  const cena = new THREE.Scene()
  try {
    renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.toneMapping = THREE.NeutralToneMapping // o ACES lavava a cor da marca
    renderer.toneMappingExposure = 1.0
    const pm = new THREE.PMREMGenerator(renderer), sala = new RoomEnvironment()
    cena.environment = pm.fromScene(sala, 0.04).texture; pm.dispose(); sala.dispose()
  } catch (e) { canvas.remove(); throw e }
  const camera = new THREE.PerspectiveCamera(24, 1, 0.01, 100)
  const fecharTextura = (t: THREE.Texture | null | undefined) => { if (t) { (t.source?.data as ImageBitmap | undefined)?.close?.(); t.dispose() } }
  const desistir = () => {
    cena.traverse(o => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      for (const mat of ([] as THREE.Material[]).concat(m.material ?? [])) {
        for (const v of Object.values(mat)) if ((v as THREE.Texture)?.isTexture) fecharTextura(v as THREE.Texture)
        mat.dispose()
      }
    })
    cena.environment?.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove()
  }

  // Luz de estúdio sobre material fosco: principal branca alta à esquerda, preenchimento frio fraco, contraluz neutra fria
  cena.add(new THREE.HemisphereLight(0xffffff, 0x0a0a12, 0.35))
  const principal = new THREE.DirectionalLight(0xffffff, 2.0); principal.position.set(4, 7, 6); cena.add(principal)
  const preench = new THREE.DirectionalLight(0xcfd8ff, 0.6); preench.position.set(-6, 1, 4); cena.add(preench)
  const contra = new THREE.DirectionalLight(0xbfcbff, 0.9); contra.position.set(-3, 5, -7); cena.add(contra)

  // Modelo texturizado (evo-web.glb: 34 mil triângulos, meshopt, 1,4 MB). Sem modelo ou sem textura, fica o poster.
  let gltf: Awaited<ReturnType<GLTFLoader['loadAsync']>>
  try {
    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder)
    gltf = await loader.loadAsync(urls.modelo)
  } catch (e) { console.warn('Evo: modelo não carregou, fica o poster', e); desistir(); return () => {} }
  cena.add(gltf.scene) // já na cena: qualquer desistir() daqui em diante libera geometria e texturas do modelo
  // Saiu da rota enquanto baixava (o React tirou o host do DOM): não decodifica textura nem gera PMREM à toa
  if (!host.isConnected) { desistir(); return () => {} }
  const malhas: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = []
  gltf.scene.traverse(o => { if ((o as THREE.Mesh).isMesh) malhas.push(o as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>) })
  if (!malhas.length || !malhas.every(m => m.material?.map?.image)) { console.warn('Evo: textura não carregou, fica o poster'); desistir(); return () => {} }
  // O gerador marcou o material inteiro como metal: a cor ficava refém do reflexo e 17 % mais escura
  // (o mapa metal/rugosidade de 2048² vem no glb e não é usado: fecha a ImageBitmap aqui, antes de soltar a referência)
  for (const m of malhas) {
    const mat = m.material
    fecharTextura(mat.metalnessMap ?? mat.roughnessMap)
    mat.metalness = 0; mat.metalnessMap = null; mat.roughnessMap = null; mat.roughness = 0.55; mat.envMapIntensity = 0.5; mat.needsUpdate = true
  }

  const evo = new THREE.Group(); evo.add(gltf.scene); cena.add(evo) // add() tira o modelo da cena e o põe no grupo
  // Centraliza no chão e normaliza a altura para 6 unidades
  const caixa = new THREE.Box3().setFromObject(gltf.scene), tam = caixa.getSize(new THREE.Vector3()), centro = caixa.getCenter(new THREE.Vector3())
  const k = 6 / tam.y; gltf.scene.scale.setScalar(k)
  gltf.scene.position.set(-centro.x * k, -caixa.min.y * k - 1.2, -centro.z * k)
  gltf.scene.updateMatrixWorld(true)

  // Marca no peito (Decisão 251): a textura gerada embaralhou o símbolo; cobre com um retalho branco e projeta a logo
  // oficial (ícone e palavra) por DecalGeometry sobre a própria malha, onde um raio frontal toca o peito.
  const carregar = (src: string) => new Promise<THREE.Texture>((ok, erro) => new THREE.TextureLoader().load(src, t => { t.colorSpace = THREE.SRGBColorSpace; ok(t) }, undefined, erro))
  const texturas = (await Promise.allSettled([carregar(urls.marca), carregar(urls.marcaTexto)])).flatMap(r => r.status === 'fulfilled' ? [r.value] : [])
  if (!host.isConnected) { texturas.forEach(t => t.dispose()); desistir(); return () => {} }
  const raio = new THREE.Raycaster(new THREE.Vector3(0, 0.95, 5), new THREE.Vector3(0, 0, -1))
  const toque = raio.intersectObjects(malhas, false)[0]
  if (texturas.length < 2 || !toque?.face) { texturas.forEach(t => t.dispose()); console.warn('Evo: decalque da marca não aplicado') }
  else {
    const [icone, texto] = texturas
    {
      const p = toque.point, n = toque.face.normal.clone().transformDirection(toque.object.matrixWorld)
      const ori = new THREE.Object3D(); ori.position.copy(p); ori.lookAt(p.clone().add(n)) // projetor olha para dentro do peito
      const decal = (tamanho: THREE.Vector3, material: THREE.Material, dy = 0, dz = 0.12) => {
        const pos = p.clone().add(n.clone().multiplyScalar(dz)); pos.y += dy
        evo.add(new THREE.Mesh(new DecalGeometry(toque.object as THREE.Mesh, pos, ori.rotation, tamanho), material))
      }
      const fosco = { roughness: 0.55, polygonOffset: true, depthWrite: false }
      decal(new THREE.Vector3(1.3, 1.35, 0.6), new THREE.MeshStandardMaterial({ ...fosco, color: 0xf4f4f4, polygonOffsetFactor: -2 }), 0)
      decal(new THREE.Vector3(0.56, 0.56, 0.6), new THREE.MeshStandardMaterial({ ...fosco, map: icone, transparent: true, polygonOffsetFactor: -4 }), 0.2)
      decal(new THREE.Vector3(0.7, 0.125, 0.6), new THREE.MeshStandardMaterial({ ...fosco, map: texto, transparent: true, polygonOffsetFactor: -4 }), -0.2)
    }
  }

  let anim = 0, visivel = true, perdido = false
  function enquadrar() {
    const w = host.clientWidth, h = host.clientHeight, aspect = w / h
    if (!w || !h) return // host sem tamanho (escondido): NaN na câmera não
    renderer.setSize(w, h, false); camera.aspect = aspect
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    camera.position.set(0, 2.0, Math.max(6.6 / (2 * tan), (tam.x * k + 0.8) / aspect / (2 * tan)) * 1.08)
    camera.lookAt(0, 1.8, 0); camera.updateProjectionMatrix()
    if (!anim) renderer.render(cena, camera)
  }
  const ro = new ResizeObserver(() => enquadrar()); ro.observe(host) // o host muda de tamanho sem a janela mudar (layout, acordeão)

  // Movimento: pausa fora da tela, aba oculta, movimento reduzido e perda de contexto.
  const relogio = new THREE.Timer(); relogio.connect(document)
  const podeAnimar = () => !reduzido() && visivel && !perdido && !document.hidden
  function quadro() {
    relogio.update(); const t = relogio.getElapsed()
    evo.rotation.y = POSE + Math.sin(t * 2 * Math.PI / 14) * 0.3
    evo.position.y = Math.sin(t * 0.8) * 0.04
    renderer.render(cena, camera)
    anim = podeAnimar() ? requestAnimationFrame(quadro) : 0
  }
  function ligar() { if (!anim && podeAnimar()) { relogio.reset(); anim = requestAnimationFrame(quadro) } }
  function desligar() { cancelAnimationFrame(anim); anim = 0 }
  const io = new IntersectionObserver(([e]) => { visivel = e.isIntersecting; if (visivel) ligar(); else desligar() }); io.observe(canvas)
  const aoVisib = () => document.hidden ? desligar() : ligar(); document.addEventListener('visibilitychange', aoVisib)
  const aoPerder = (e: Event) => { e.preventDefault(); perdido = true; desligar(); canvas.classList.remove('pronta') }; canvas.addEventListener('webglcontextlost', aoPerder)
  const mql = matchMedia('(prefers-reduced-motion: reduce)'), aoMudarMov = () => reduzido() ? desligar() : ligar(); mql.addEventListener('change', aoMudarMov)

  enquadrar(); quadro(); canvas.classList.add('pronta')

  return () => {
    perdido = true; desligar(); mql.removeEventListener('change', aoMudarMov); io.disconnect()
    ro.disconnect(); document.removeEventListener('visibilitychange', aoVisib)
    canvas.removeEventListener('webglcontextlost', aoPerder); relogio.disconnect(); relogio.dispose()
    desistir()
  }
}
