import { useEffect, useRef, useState } from "react"

import type { Direction } from "./types"

const DEADZONE = 0.35
const REPEAT_INITIAL_DELAY_MS = 400
const REPEAT_RATE_MS = 150

const DPAD_BUTTON_DIRECTIONS: Record<number, Direction> = {
  12: "up",
  13: "down",
  14: "left",
  15: "right",
}

const BUTTON_A = 0
const BUTTON_B = 1
const BUTTON_X = 2
const BUTTON_Y = 3
const BUTTON_LB = 4
const BUTTON_RB = 5
const BUTTON_HOME = 16

interface GamepadPollHandlers {
  onDirection: (direction: Direction) => void
  onButtonA: () => void
  onButtonB: () => void
  onButtonX: () => void
  onButtonY: () => void
  onBumperLeft: () => void
  onBumperRight: () => void
  onButtonHome: () => void
}

function readStickDirection(gamepad: Gamepad): Direction | null {
  const [x, y] = gamepad.axes
  if (Math.abs(x) > Math.abs(y)) {
    if (Math.abs(x) > DEADZONE) return x > 0 ? "right" : "left"
  } else if (Math.abs(y) > DEADZONE) {
    return y > 0 ? "down" : "up"
  }
  return null
}

export function useGamepadPoll(handlers: GamepadPollHandlers) {
  const [isConnected, setIsConnected] = useState(false)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    let frameId: number | null = null
    let prevA = false
    let prevB = false
    let prevX = false
    let prevY = false
    let prevLB = false
    let prevRB = false
    let prevHome = false
    let activeDirection: Direction | null = null
    let directionStartedAt = 0
    let lastRepeatAt = 0

    function tick() {
      const gamepads = navigator.getGamepads()
      const gamepad = gamepads.find((g) => g && g.mapping === "standard") ?? null

      if (!gamepad) {
        frameId = requestAnimationFrame(tick)
        return
      }

      const now = performance.now()

      let direction: Direction | null = null
      for (const [index, dir] of Object.entries(DPAD_BUTTON_DIRECTIONS)) {
        if (gamepad.buttons[Number(index)]?.pressed) {
          direction = dir
          break
        }
      }
      if (!direction) direction = readStickDirection(gamepad)

      if (direction) {
        if (direction !== activeDirection) {
          activeDirection = direction
          directionStartedAt = now
          lastRepeatAt = now
          handlersRef.current.onDirection(direction)
        } else if (
          now - directionStartedAt > REPEAT_INITIAL_DELAY_MS &&
          now - lastRepeatAt > REPEAT_RATE_MS
        ) {
          lastRepeatAt = now
          handlersRef.current.onDirection(direction)
        }
      } else {
        activeDirection = null
      }

      const aPressed = gamepad.buttons[BUTTON_A]?.pressed ?? false
      if (aPressed && !prevA) handlersRef.current.onButtonA()
      prevA = aPressed

      const bPressed = gamepad.buttons[BUTTON_B]?.pressed ?? false
      if (bPressed && !prevB) handlersRef.current.onButtonB()
      prevB = bPressed

      const xPressed = gamepad.buttons[BUTTON_X]?.pressed ?? false
      if (xPressed && !prevX) handlersRef.current.onButtonX()
      prevX = xPressed

      const yPressed = gamepad.buttons[BUTTON_Y]?.pressed ?? false
      if (yPressed && !prevY) handlersRef.current.onButtonY()
      prevY = yPressed

      const lbPressed = gamepad.buttons[BUTTON_LB]?.pressed ?? false
      if (lbPressed && !prevLB) handlersRef.current.onBumperLeft()
      prevLB = lbPressed

      const rbPressed = gamepad.buttons[BUTTON_RB]?.pressed ?? false
      if (rbPressed && !prevRB) handlersRef.current.onBumperRight()
      prevRB = rbPressed

      const homePressed = gamepad.buttons[BUTTON_HOME]?.pressed ?? false
      if (homePressed && !prevHome) handlersRef.current.onButtonHome()
      prevHome = homePressed

      frameId = requestAnimationFrame(tick)
    }

    function handleConnected() {
      setIsConnected(true)
      if (frameId === null) frameId = requestAnimationFrame(tick)
    }

    function handleDisconnected() {
      const stillConnected = navigator.getGamepads().some((g) => g !== null)
      if (!stillConnected) {
        setIsConnected(false)
        if (frameId !== null) {
          cancelAnimationFrame(frameId)
          frameId = null
        }
      }
    }

    window.addEventListener("gamepadconnected", handleConnected)
    window.addEventListener("gamepaddisconnected", handleDisconnected)

    if (navigator.getGamepads().some((g) => g !== null)) handleConnected()

    return () => {
      window.removeEventListener("gamepadconnected", handleConnected)
      window.removeEventListener("gamepaddisconnected", handleDisconnected)
      if (frameId !== null) cancelAnimationFrame(frameId)
    }
  }, [])

  return { isConnected }
}
