import * as THREE from 'three'

const texCache: Record<string, THREE.CanvasTexture> = {}

/**
 * Creates high-resolution, crisp number canvas textures for 3D cubes.
 * Uses 256x256 offscreen canvas with mipmapping and linear filtering for razor-sharp rendering on Retina/HiDPI screens.
 */
export function createNumberTexture(
  text: string | number,
  bgColor = '#ffffff',
  textColor = '#10203a',
  borderColor = '#2563eb'
): THREE.CanvasTexture {
  const key = `${text}_${bgColor}_${textColor}_${borderColor}`
  if (texCache[key]) return texCache[key]

  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  // Clear & Solid Background
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, 256, 256)

  // Distinct border stroke
  ctx.strokeStyle = borderColor
  ctx.lineWidth = 12
  ctx.strokeRect(6, 6, 244, 244)

  // Crisp Bold Monospace Number Font
  ctx.fillStyle = textColor
  const str = String(text)
  const fontSize = str.length > 3 ? 68 : str.length > 2 ? 84 : 104
  ctx.font = `bold ${fontSize}px Consolas, "SF Mono", Menlo, Monaco, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(str, 128, 134)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texCache[key] = texture
  return texture
}

/**
 * Creates rectangular high-resolution textures (e.g. for wide accumulator registers).
 */
export function createWideTextTexture(
  text: string,
  width = 512,
  height = 170,
  bgColor = '#ffffff',
  textColor = '#14532d',
  borderColor = '#16a34a'
): THREE.CanvasTexture {
  const key = `wide_${text}_${width}x${height}_${bgColor}_${textColor}`
  if (texCache[key]) return texCache[key]

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = borderColor
  ctx.lineWidth = 10
  ctx.strokeRect(5, 5, width - 10, height - 10)

  ctx.fillStyle = textColor
  ctx.font = `bold 64px Consolas, "SF Mono", Menlo, Monaco, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, width / 2, height / 2 + 4)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texCache[key] = texture
  return texture
}

export function createTextSprite(text: string, color = '#ffffff', fontSize = 42): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 96
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 256, 96)
    ctx.font = `bold ${fontSize}px "SF Mono", Consolas, "JetBrains Mono", monospace`
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.lineWidth = 4
    ctx.strokeText(text, 128, 48)
    ctx.fillText(text, 128, 48)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false
  })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(1.4, 0.52, 1)
  return sprite
}

/**
 * Creates a thick, volumetric, bold 3D arrow with a cylinder shaft, cone head, and floating billboard label.
 * Zero 1px line artifacts, readable from any camera distance.
 */
export function createBoldArrow(
  direction: THREE.Vector3,
  length: number,
  color: number | string,
  labelText?: string,
  shaftRadius = 0.06,
  headRadius = 0.18,
  headLength = 0.4
): THREE.Group {
  const group = new THREE.Group()
  const dir = direction.clone().normalize()

  const shaftLen = Math.max(0.1, length - headLength)
  const shaftGeo = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLen, 16)
  shaftGeo.translate(0, shaftLen / 2, 0)
  const headGeo = new THREE.ConeGeometry(headRadius, headLength, 16)
  headGeo.translate(0, shaftLen + headLength / 2, 0)

  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.25,
    metalness: 0.2
  })

  const shaft = new THREE.Mesh(shaftGeo, mat)
  const head = new THREE.Mesh(headGeo, mat)
  group.add(shaft)
  group.add(head)

  const defaultDir = new THREE.Vector3(0, 1, 0)
  const quat = new THREE.Quaternion().setFromUnitVectors(defaultDir, dir)
  group.quaternion.copy(quat)

  if (labelText) {
    const hexColor = typeof color === 'string' ? color : `#${color.toString(16).padStart(6, '0')}`
    const sprite = createTextSprite(labelText, hexColor)
    // Place billboard sprite past the arrow head
    const tipOffset = dir.clone().multiplyScalar(length + 0.38)
    sprite.position.copy(tipOffset)
    group.add(sprite)
  }

  return group
}

export function clearTextureCache() {
  for (const key in texCache) {
    texCache[key].dispose()
    delete texCache[key]
  }
}

