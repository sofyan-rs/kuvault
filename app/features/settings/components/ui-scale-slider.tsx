import { useState } from "react"

import { Label } from "~/components/ui/label"
import { Slider } from "~/components/ui/slider"
import { useIsGamepadSliderAdjusting } from "~/lib/gamepad/gamepad-navigation-provider"
import { getStoredUiScale, MAX_SCALE, MIN_SCALE, setUiScale } from "~/lib/ui-scale"

export function UiScaleSlider() {
  const [scale, setScale] = useState<number>(() => getStoredUiScale())
  const adjusting = useIsGamepadSliderAdjusting()

  function handleChange(value: number | readonly number[]) {
    const next = Array.isArray(value) ? value[0] : value
    setScale(next)
    setUiScale(next)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor="ui-scale">UI scale</Label>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {adjusting ? (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-xs font-medium text-primary">
              Adjusting
            </span>
          ) : null}
          {scale}%
        </span>
      </div>
      <Slider
        id="ui-scale"
        value={scale}
        onValueChange={handleChange}
        min={MIN_SCALE}
        max={MAX_SCALE}
        step={5}
      />
    </div>
  )
}
