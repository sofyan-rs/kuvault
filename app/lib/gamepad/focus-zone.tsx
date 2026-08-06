import { useEffect, useRef } from "react"

import { useGamepadZoneRegistry } from "./gamepad-navigation-provider"
import type { ZoneId } from "./types"

export function FocusZone({
  id,
  className,
  style,
  children,
}: {
  id: ZoneId
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const registry = useGamepadZoneRegistry()

  useEffect(() => {
    const element = ref.current
    if (!element) return
    registry.register(id, element)
    return () => registry.unregister(id)
  }, [id, registry])

  return (
    <div ref={ref} className={className} style={style} data-gamepad-zone={id}>
      {children}
    </div>
  )
}
