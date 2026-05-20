/**
 * Minimal MP4 box parser to extract raw GPMF bytes.
 * Works with any byte source — File.slice (browser), or fetch with Range headers (Tauri).
 *
 * Strategy:
 *  1. Scan top-level boxes to find 'moov' (jumping over mdat in a single seek)
 *  2. Read the entire moov box into memory and parse it synchronously
 *  3. Find the 'trak' whose hdlr name contains "GoPro MET"
 *  4. Use its stbl (stco/co64 + stsz + stsc) to locate sample data in the file
 *  5. Read data chunks (typically one large read for GoPro files)
 */

type ReadSlice = (start: number, end: number) => Promise<DataView>

interface TrackInfo {
  chunkOffsets: number[]
  sampleSizes: number[]
  sampleToChunk: Array<{ firstChunk: number; samplesPerChunk: number }>
}

interface BoxInfo {
  dataStart: number
  dataSize: number
}

// ── In-memory (synchronous) box helpers ──────────────────────────────────────

function fourcc(buf: DataView, offset: number): string {
  return String.fromCharCode(
    buf.getUint8(offset), buf.getUint8(offset + 1),
    buf.getUint8(offset + 2), buf.getUint8(offset + 3),
  )
}

function findBoxInBuffer(buf: DataView, start: number, end: number, type: string): BoxInfo | null {
  let offset = start
  while (offset + 8 <= end) {
    const sz = buf.getUint32(offset, false)
    const t = fourcc(buf, offset + 4)
    if (sz < 8 || offset + sz > end) break
    if (t === type) return { dataStart: offset + 8, dataSize: sz - 8 }
    offset += sz
  }
  return null
}

function getSamplesPerChunk(
  oneBasedChunkIdx: number,
  stsc: Array<{ firstChunk: number; samplesPerChunk: number }>,
): number {
  let spc = 1
  for (const entry of stsc) {
    if (oneBasedChunkIdx >= entry.firstChunk) spc = entry.samplesPerChunk
    else break
  }
  return spc
}

function parseTrackForGPMF(buf: DataView, trakStart: number, trakEnd: number): TrackInfo | null {
  const mdia = findBoxInBuffer(buf, trakStart, trakEnd, "mdia")
  if (!mdia) return null
  const mdiaEnd = mdia.dataStart + mdia.dataSize

  const hdlr = findBoxInBuffer(buf, mdia.dataStart, mdiaEnd, "hdlr")
  if (!hdlr) return null

  // hdlr data layout: 4 version/flags + 4 pre_defined + 4 handler_type + 12 reserved + null-term name
  let name = ""
  for (let i = 24; i < Math.min(hdlr.dataSize, 100); i++) {
    const ch = buf.getUint8(hdlr.dataStart + i)
    if (ch === 0) break
    if (ch >= 32 && ch < 128) name += String.fromCharCode(ch)
  }
  if (!name.includes("GoPro MET")) return null

  const minf = findBoxInBuffer(buf, mdia.dataStart, mdiaEnd, "minf")
  if (!minf) return null
  const minfEnd = minf.dataStart + minf.dataSize

  const stbl = findBoxInBuffer(buf, minf.dataStart, minfEnd, "stbl")
  if (!stbl) return null
  const stblEnd = stbl.dataStart + stbl.dataSize

  const stco = findBoxInBuffer(buf, stbl.dataStart, stblEnd, "stco")
  const co64 = stco ? null : findBoxInBuffer(buf, stbl.dataStart, stblEnd, "co64")
  const stsz = findBoxInBuffer(buf, stbl.dataStart, stblEnd, "stsz")
  const stsc = findBoxInBuffer(buf, stbl.dataStart, stblEnd, "stsc")

  if (!stsz || !stsc || (!stco && !co64)) return null

  let chunkOffsets: number[]
  if (stco) {
    const count = buf.getUint32(stco.dataStart + 4, false)
    chunkOffsets = []
    for (let i = 0; i < count; i++) {
      chunkOffsets.push(buf.getUint32(stco.dataStart + 8 + i * 4, false))
    }
  } else {
    const count = buf.getUint32(co64!.dataStart + 4, false)
    chunkOffsets = []
    for (let i = 0; i < count; i++) {
      const hi = buf.getUint32(co64!.dataStart + 8 + i * 8, false)
      const lo = buf.getUint32(co64!.dataStart + 12 + i * 8, false)
      chunkOffsets.push(hi * 4294967296 + lo)
    }
  }

  const defaultSz = buf.getUint32(stsz.dataStart + 4, false)
  const sampleCount = buf.getUint32(stsz.dataStart + 8, false)
  let sampleSizes: number[]
  if (defaultSz !== 0) {
    sampleSizes = new Array(sampleCount).fill(defaultSz)
  } else {
    sampleSizes = []
    for (let i = 0; i < sampleCount; i++) {
      sampleSizes.push(buf.getUint32(stsz.dataStart + 12 + i * 4, false))
    }
  }

  const stscCount = buf.getUint32(stsc.dataStart + 4, false)
  const sampleToChunk: Array<{ firstChunk: number; samplesPerChunk: number }> = []
  for (let i = 0; i < stscCount; i++) {
    sampleToChunk.push({
      firstChunk: buf.getUint32(stsc.dataStart + 8 + i * 12, false),
      samplesPerChunk: buf.getUint32(stsc.dataStart + 12 + i * 12, false),
    })
  }

  return { chunkOffsets, sampleSizes, sampleToChunk }
}

function findGPMFTrackInMoov(moovBuf: DataView): TrackInfo | null {
  const size = moovBuf.byteLength
  let offset = 8 // skip outer moov header
  while (offset + 8 <= size) {
    const sz = moovBuf.getUint32(offset, false)
    const type = fourcc(moovBuf, offset + 4)
    if (sz < 8 || offset + sz > size) break
    if (type === "trak") {
      const info = parseTrackForGPMF(moovBuf, offset + 8, offset + sz)
      if (info) return info
    }
    offset += sz
  }
  return null
}

// ── Core reader (works with any byte source) ──────────────────────────────────

async function findMoovFromReader(
  readSlice: ReadSlice,
  fileSize: number,
): Promise<{ start: number; size: number } | null> {
  // Walk top-level boxes jumping over each using its size field.
  // mdat (potentially GBs) is skipped in one step — only the 16-byte header is read.
  let offset = 0
  while (offset + 8 <= fileSize) {
    const hdr = await readSlice(offset, offset + 16)
    const sz32 = hdr.getUint32(0, false)
    const type = fourcc(hdr, 4)
    let sz = sz32
    const hdrSz = sz32 === 1 ? 16 : 8
    if (sz32 === 1) {
      sz = hdr.getUint32(8, false) * 4294967296 + hdr.getUint32(12, false)
    } else if (sz32 === 0) {
      sz = fileSize - offset
    }
    if (sz < hdrSz) break
    if (type === "moov") return { start: offset, size: sz }
    offset += sz
  }
  return null
}

async function extractFromReader(readSlice: ReadSlice, fileSize: number): Promise<Uint8Array | null> {
  const moovRef = await findMoovFromReader(readSlice, fileSize)
  if (!moovRef) return null

  const moovBuf = await readSlice(moovRef.start, moovRef.start + moovRef.size)
  const trackInfo = findGPMFTrackInMoov(moovBuf)
  if (!trackInfo) return null

  const { chunkOffsets, sampleSizes, sampleToChunk } = trackInfo
  const parts: Uint8Array[] = []
  let sampleIdx = 0

  for (let ci = 0; ci < chunkOffsets.length; ci++) {
    const spc = getSamplesPerChunk(ci + 1, sampleToChunk)
    let chunkBytes = 0
    for (let s = 0; s < spc && sampleIdx + s < sampleSizes.length; s++) {
      chunkBytes += sampleSizes[sampleIdx + s]!
    }
    const chunkStart = chunkOffsets[ci]
    if (chunkBytes > 0 && chunkStart !== undefined) {
      const slice = await readSlice(chunkStart, chunkStart + chunkBytes)
      parts.push(new Uint8Array(slice.buffer))
    }
    sampleIdx += spc
  }

  if (parts.length === 0) return null

  const total = parts.reduce((s, c) => s + c.length, 0)
  const out = new Uint8Array(total)
  let pos = 0
  for (const part of parts) { out.set(part, pos); pos += part.length }
  return out
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Extract raw GPMF bytes from a File object (browser drag-drop or file picker).
 */
export async function extractGPMFBytesFromFile(file: File): Promise<Uint8Array | null> {
  try {
    return await extractFromReader(
      async (start, end) => new DataView(await file.slice(start, end).arrayBuffer()),
      file.size,
    )
  } catch {
    return null
  }
}

/**
 * Extract raw GPMF bytes from a URL using HTTP Range requests.
 * Works with Tauri asset:// URLs and any server that supports Range headers.
 */
export async function extractGPMFBytesFromUrl(url: string): Promise<Uint8Array | null> {
  try {
    // First range request: get 16 bytes + Content-Range header for total file size
    const probe = await fetch(url, { headers: { Range: "bytes=0-15" } })
    const cr = probe.headers.get("Content-Range") // "bytes 0-15/TOTAL"
    const fileSize = cr ? parseInt(cr.split("/")[1] ?? "0", 10) : NaN
    if (!fileSize || isNaN(fileSize)) return null

    return await extractFromReader(
      async (start, end) => {
        const res = await fetch(url, { headers: { Range: `bytes=${start}-${end - 1}` } })
        return new DataView(await res.arrayBuffer())
      },
      fileSize,
    )
  } catch {
    return null
  }
}
