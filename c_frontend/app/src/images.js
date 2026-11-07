// Image library, kept in this browser only. No upload endpoint exists in the API contract yet.
const KEY = 'atelier_images'
const MAX_BYTES = 5 * 1024 * 1024

export function loadImages() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || []
  } catch {
    return []
  }
}

export function saveImages(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
    return true
  } catch {
    return false // storage full or blocked: library lasts until reload
  }
}

// Resize to a small JPEG thumbnail so the library fits in storage.
export function fileToImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error(`${file.name} is not an image.`))
    if (file.size > MAX_BYTES) return reject(new Error(`${file.name} is over 5 MB.`))
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 480 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve({
        id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        src: c.toDataURL('image/jpeg', 0.8),
        tags: [],
      })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`${file.name} could not be read.`))
    }
    img.src = url
  })
}

// SAMPLE stats, deterministic per image. Replace with real post performance from the backend.
export function sampleStats(id) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const r = (n) => ((h = (h * 1103515245 + 12345) >>> 0) % n)
  const reach = 800 + r(8200)
  const engagement = 1.5 + r(800) / 100
  return { reach, engagement: Math.round(engagement * 10) / 10, saves: Math.round(reach * engagement / 100 * 0.3), clicks: Math.round(reach * engagement / 100 * 0.2) }
}
