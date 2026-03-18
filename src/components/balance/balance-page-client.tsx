'use client'

import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

export function RefreshButton() {
  return (
    <Button
      onClick={() => window.location.reload()}
      variant="outline"
      className="flex items-center space-x-2"
    >
      <RefreshCw className="h-4 w-4" />
      <span>Atualizar</span>
    </Button>
  )
}
