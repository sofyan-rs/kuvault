import { useEffect, useState } from "react"

interface Layer {
  key: number
  url: string
}

let nextLayerKey = 0

/**
 * Crossfades via opacity instead of swapping `background-image`, so the browser
 * animates a compositor-cheap property instead of re-rasterizing the blur every change.
 */
export function CarouselBackdrop({ imageUrl }: { imageUrl: string | undefined }) {
  const [layers, setLayers] = useState<Layer[]>(() => (imageUrl ? [{ key: nextLayerKey++, url: imageUrl }] : []))

  useEffect(() => {
    if (!imageUrl) return
    setLayers((prev) => {
      if (prev.at(-1)?.url === imageUrl) return prev
      return [...prev, { key: nextLayerKey++, url: imageUrl }].slice(-2)
    })
  }, [imageUrl])

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {layers.map((layer, i) => (
        <div
          key={layer.key}
          className="absolute inset-0 bg-cover bg-center opacity-0 blur-xl transition-opacity duration-500 will-change-[opacity]"
          style={{
            backgroundImage: `url(${layer.url})`,
            opacity: i === layers.length - 1 ? 0.3 : 0,
          }}
        />
      ))}
    </div>
  )
}
