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

  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas)
    fallback.colorSpace = THREE.SRGBColorSpace
    return fallback
  }

  // Clear & Solid Background
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, size, size)

  // Distinct border stroke with safe margin
  ctx.strokeStyle = borderColor
  ctx.lineWidth = 8
  ctx.strokeRect(4, 4, size - 8, size - 8)

  // Dynamic font scaling with safe margin to guarantee zero clipping
  ctx.fillStyle = textColor
  const str = String(text)
  let fontSize = str.length > 6 ? 34 : str.length > 4 ? 44 : str.length > 3 ? 56 : str.length > 2 ? 68 : str.length > 1 ? 80 : 92
  ctx.font = `bold ${fontSize}px Consolas, "SF Mono", Menlo, Monaco, monospace`

  // Measure text and scale down if width exceeds safe 204px inner bounds
  const maxSafeWidth = 204
  let metrics = ctx.measureText(str)
  while (metrics.width > maxSafeWidth && fontSize > 16) {
    fontSize -= 2
    ctx.font = `bold ${fontSize}px Consolas, "SF Mono", Menlo, Monaco, monospace`
    metrics = ctx.measureText(str)
  }

  // Perfectly centered horizontally and vertically
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(str, size / 2, size / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
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
  const key = `wide_${text}_${width}x${height}_${bgColor}_${textColor}_${borderColor}`
  if (texCache[key]) return texCache[key]

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas)
    fallback.colorSpace = THREE.SRGBColorSpace
    return fallback
  }

  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = borderColor
  ctx.lineWidth = 8
  ctx.strokeRect(4, 4, width - 8, height - 8)

  ctx.fillStyle = textColor
  let fontSize = 56
  ctx.font = `bold ${fontSize}px Consolas, "SF Mono", Menlo, Monaco, monospace`

  const maxSafeWidth = width - 40
  let metrics = ctx.measureText(text)
  while (metrics.width > maxSafeWidth && fontSize > 18) {
    fontSize -= 2
    ctx.font = `bold ${fontSize}px Consolas, "SF Mono", Menlo, Monaco, monospace`
    metrics = ctx.measureText(text)
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, width / 2, height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  texCache[key] = texture
  return texture
}

export function createTextSprite(text: string, color = '#ffffff', fontSize = 36): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 512, 128)
    let currentFontSize = fontSize
    ctx.font = `bold ${currentFontSize}px "SF Mono", Consolas, "JetBrains Mono", monospace`

    const maxTextWidth = 480
    let metrics = ctx.measureText(text)
    while (metrics.width > maxTextWidth && currentFontSize > 14) {
      currentFontSize -= 2
      ctx.font = `bold ${currentFontSize}px "SF Mono", Consolas, "JetBrains Mono", monospace`
      metrics = ctx.measureText(text)
    }

    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)'
    ctx.lineWidth = 4
    ctx.strokeText(text, 256, 64)
    ctx.fillText(text, 256, 64)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.needsUpdate = true
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false
  })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(2.4, 0.6, 1)
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

/**
 * Creates high-resolution tabular cell textures for DataFrame slabs.
 * Handles heterogeneous dtypes: numbers, string/object, booleans, and frosted NaN cells.
 */
export function createTabularCellTexture(
  val: any,
  options: {
    dtype?: string
    isNaN?: boolean
    isSelected?: boolean
    selectedMode?: 'iloc' | 'loc' | 'match' | 'active'
    bg?: string
    textCol?: string
    borderCol?: string
    align?: 'left' | 'center' | 'right'
    isDark?: boolean
  } = {}
): THREE.CanvasTexture {
  const isNaNVal = options.isNaN || val === 'NaN' || val === null || val === undefined || (typeof val === 'number' && isNaN(val))
  const key = `cell_${val}_${options.dtype}_${isNaNVal}_${options.isSelected}_${options.selectedMode}_${options.bg}_${options.textCol}_${options.isDark}`
  if (texCache[key]) return texCache[key]

  const w = 512
  const h = 184
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas)
    fallback.colorSpace = THREE.SRGBColorSpace
    return fallback
  }

  const isDark = !!options.isDark
  let bg = options.bg || (isDark ? '#1e2530' : '#ffffff')
  let textCol = options.textCol || (isDark ? '#e2e8f0' : '#0f172a')
  let borderCol = options.borderCol || (isDark ? '#334155' : '#cbd5e1')

  if (options.isSelected) {
    if (options.selectedMode === 'loc') {
      bg = isDark ? '#451a03' : '#fef3c7'
      textCol = isDark ? '#fbbf24' : '#9a3412'
      borderCol = '#ea580c'
    } else if (options.selectedMode === 'match') {
      bg = isDark ? '#064e3b' : '#ecfdf5'
      textCol = isDark ? '#34d399' : '#065f46'
      borderCol = '#10b981'
    } else {
      bg = isDark ? '#172554' : '#eff6ff'
      textCol = isDark ? '#60a5fa' : '#1d4ed8'
      borderCol = '#3b82f6'
    }
  }

  // 1. Background
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  // 2. NaN Missing Value Special Rendering (Crosshatch frosted pattern)
  if (isNaNVal) {
    ctx.fillStyle = isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(254, 226, 226, 0.75)'
    ctx.fillRect(0, 0, w, h)

    // Diagonal hatching lines
    ctx.strokeStyle = isDark ? 'rgba(248, 113, 113, 0.28)' : 'rgba(239, 68, 68, 0.3)'
    ctx.lineWidth = 3
    for (let x = -h; x < w + h; x += 22) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x + h, h)
      ctx.stroke()
    }

    // Dashed warning border
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 6
    ctx.setLineDash([16, 8])
    ctx.strokeRect(3, 3, w - 6, h - 6)
    ctx.setLineDash([])

    // Bold NaN text
    ctx.fillStyle = isDark ? '#f87171' : '#b91c1c'
    ctx.font = 'bold 58px Consolas, "SF Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('NaN', w / 2, h / 2)
  } else if (typeof val === 'boolean' || val === 'True' || val === 'False') {
    // 3. Boolean toggle chip
    const isTrue = val === true || val === 'True'
    ctx.strokeStyle = borderCol
    ctx.lineWidth = 5
    ctx.strokeRect(2, 2, w - 4, h - 4)

    // Pill badge in center
    const pillW = 200
    const pillH = 76
    const pillX = (w - pillW) / 2
    const pillY = (h - pillH) / 2
    const pillR = 16

    ctx.beginPath()
    ctx.roundRect(pillX, pillY, pillW, pillH, pillR)
    ctx.fillStyle = isTrue ? (isDark ? '#064e3b' : '#dcfce7') : (isDark ? '#334155' : '#f1f5f9')
    ctx.fill()
    ctx.strokeStyle = isTrue ? '#16a34a' : '#94a3b8'
    ctx.lineWidth = 3
    ctx.stroke()

    ctx.fillStyle = isTrue ? (isDark ? '#4ade80' : '#15803d') : (isDark ? '#94a3b8' : '#64748b')
    ctx.font = 'bold 38px Consolas, "SF Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(isTrue ? '● True' : '○ False', w / 2, h / 2)
  } else {
    // 4. Standard tabular value (Numeric or String)
    ctx.strokeStyle = borderCol
    ctx.lineWidth = options.isSelected ? 8 : 5
    ctx.strokeRect(2, 2, w - 4, h - 4)

    const str = String(val)
    const isNum = typeof val === 'number'
    const align = options.align || (isNum ? 'right' : 'center')

    let fontSize = str.length > 10 ? 36 : str.length > 7 ? 42 : str.length > 4 ? 50 : 58
    ctx.font = `bold ${fontSize}px Consolas, "SF Mono", Menlo, monospace`

    const maxW = w - 80
    let metrics = ctx.measureText(str)
    while (metrics.width > maxW && fontSize > 18) {
      fontSize -= 2
      ctx.font = `bold ${fontSize}px Consolas, "SF Mono", Menlo, monospace`
      metrics = ctx.measureText(str)
    }

    ctx.fillStyle = textCol
    ctx.textBaseline = 'middle'

    if (align === 'right') {
      ctx.textAlign = 'right'
      ctx.fillText(str, w - 48, h / 2)
    } else if (align === 'left') {
      ctx.textAlign = 'left'
      ctx.fillText(str, 48, h / 2)
    } else {
      ctx.textAlign = 'center'
      ctx.fillText(str, w / 2, h / 2)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  texCache[key] = texture
  return texture
}

/**
 * Creates elevated Column Header plaque textures featuring Column Label + Dtype Badge Pill.
 */
export function createHeaderPlaqueTexture(
  colName: string,
  dtype: string,
  options: {
    isSelected?: boolean
    bg?: string
    textCol?: string
    borderCol?: string
    isDark?: boolean
  } = {}
): THREE.CanvasTexture {
  const key = `hdr_${colName}_${dtype}_${options.isSelected}_${options.bg}_${options.isDark}`
  if (texCache[key]) return texCache[key]

  const w = 512
  const h = 200
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas)
    fallback.colorSpace = THREE.SRGBColorSpace
    return fallback
  }

  const isDark = !!options.isDark
  let bg = options.bg || (isDark ? '#0f172a' : '#f8fafc')
  let textCol = options.textCol || (isDark ? '#f8fafc' : '#0f172a')
  let borderCol = options.borderCol || (isDark ? '#334155' : '#94a3b8')

  if (options.isSelected) {
    bg = isDark ? '#1e3a8a' : '#dbeafe'
    textCol = isDark ? '#93c5fd' : '#1e40af'
    borderCol = '#2563eb'
  }

  // Plaque Base
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  // Double accent top header border
  ctx.strokeStyle = borderCol
  ctx.lineWidth = 6
  ctx.strokeRect(3, 3, w - 6, h - 6)

  // Column Label (Top portion)
  ctx.fillStyle = textCol
  ctx.font = 'bold 48px Consolas, "SF Mono", Menlo, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(colName, w / 2, 66)

  // Dtype Chip Palette
  const dtypeLower = dtype.toLowerCase()
  let chipBg = '#2563eb'
  let chipText = '#ffffff'

  if (dtypeLower.includes('int')) {
    chipBg = '#2563eb' // Blue
  } else if (dtypeLower.includes('float')) {
    chipBg = '#0891b2' // Cyan
  } else if (dtypeLower.includes('cat')) {
    chipBg = '#059669' // Emerald
  } else if (dtypeLower.includes('bool')) {
    chipBg = '#16a34a' // Green
  } else if (dtypeLower.includes('date')) {
    chipBg = '#d97706' // Amber
  } else {
    chipBg = '#7c3aed' // Purple object/str
  }

  // Rounded Dtype Pill
  const pillW = 220
  const pillH = 50
  const pillX = (w - pillW) / 2
  const pillY = 120
  const pillR = 12

  ctx.beginPath()
  ctx.roundRect(pillX, pillY, pillW, pillH, pillR)
  ctx.fillStyle = chipBg
  ctx.fill()

  ctx.fillStyle = chipText
  ctx.font = 'bold 26px Consolas, "SF Mono", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(dtype, w / 2, pillY + pillH / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  texCache[key] = texture
  return texture
}

/**
 * Creates distinct Row Index plaque textures with metadata coordinate styling.
 */
export function createIndexPlaqueTexture(
  label: string | number,
  options: {
    pos?: number
    isSelected?: boolean
    selectedMode?: 'iloc' | 'loc'
    bg?: string
    textCol?: string
    borderCol?: string
    isDark?: boolean
  } = {}
): THREE.CanvasTexture {
  const key = `idx_${label}_${options.pos}_${options.isSelected}_${options.selectedMode}_${options.isDark}`
  if (texCache[key]) return texCache[key]

  const w = 384
  const h = 184
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas)
    fallback.colorSpace = THREE.SRGBColorSpace
    return fallback
  }

  const isDark = !!options.isDark
  let bg = options.bg || (isDark ? '#27201b' : '#fef3c7')
  let textCol = options.textCol || (isDark ? '#fed7aa' : '#9a3412')
  let borderCol = options.borderCol || (isDark ? '#b45309' : '#ea580c')

  if (options.isSelected) {
    if (options.selectedMode === 'iloc') {
      bg = isDark ? '#172554' : '#eff6ff'
      textCol = isDark ? '#60a5fa' : '#1d4ed8'
      borderCol = '#3b82f6'
    } else {
      bg = isDark ? '#7c2d12' : '#ffedd5'
      textCol = isDark ? '#fdba74' : '#c2410c'
      borderCol = '#ea580c'
    }
  }

  // Background
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  // Warm metadata border
  ctx.strokeStyle = borderCol
  ctx.lineWidth = options.isSelected ? 8 : 5
  ctx.strokeRect(3, 3, w - 6, h - 6)

  // Row coordinate label
  const str = String(label)
  let fontSize = str.length > 6 ? 38 : str.length > 4 ? 46 : 56
  ctx.font = `bold ${fontSize}px Consolas, "SF Mono", Menlo, monospace`
  ctx.fillStyle = textCol
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (options.pos !== undefined) {
    // Label on top
    ctx.fillText(str, w / 2, 72)

    // Offset badge on bottom: [pos]
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)'
    ctx.font = 'bold 28px Consolas, "SF Mono", monospace'
    ctx.fillText(`offset [${options.pos}]`, w / 2, 134)
  } else {
    ctx.fillText(str, w / 2, h / 2)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  texCache[key] = texture
  return texture
}

export function clearTextureCache() {
  for (const key in texCache) {
    texCache[key].dispose()
    delete texCache[key]
  }
}

