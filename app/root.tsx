import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from "react-router"

import type { Route } from "./+types/root"
import "./app.css"
import { ExternalLinkGuard } from "./components/external-link-guard"
import { DebugPanel } from "./components/debug-panel"
import { Toaster } from "./components/ui/sonner"
import { GamepadHintBar } from "./lib/gamepad/gamepad-hint-bar"
import { GamepadNavigationProvider } from "./lib/gamepad/gamepad-navigation-provider"
import { VirtualKeyboard } from "./lib/gamepad/virtual-keyboard"
import { RunningGamesProvider } from "./lib/tauri/running-games"
import { SplashScreen } from "./components/splash-screen"
import { ApplyLaunchFullscreen } from "./lib/settings/apply-launch-fullscreen"
import { UpdateChecker } from "./features/settings/components/update-checker"
import { themeInitScript } from "./lib/settings/theme"
import { uiScaleInitScript } from "./lib/settings/ui-scale"

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: uiScaleInitScript }} />
      </head>
      <body>
        <SplashScreen />
        <ExternalLinkGuard />
        {import.meta.env.DEV ? <DebugPanel /> : null}
        <RunningGamesProvider>
          <GamepadNavigationProvider>
            {children}
            <GamepadHintBar />
            <VirtualKeyboard />
          </GamepadNavigationProvider>
        </RunningGamesProvider>
        <Toaster position="bottom-right" />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return (
    <main data-ui-scroll-container>
      <ApplyLaunchFullscreen />
      <UpdateChecker />
      <Outlet />
    </main>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!"
  let details = "An unexpected error occurred."
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error"
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message
    stack = error.stack
  }

  return (
    <main className="container mx-auto p-4 pt-16">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full overflow-x-auto p-4">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  )
}
