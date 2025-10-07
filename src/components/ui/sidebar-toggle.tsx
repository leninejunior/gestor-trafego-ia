"use client"

import * as React from "react"
import { PanelLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useSidebar } from "./sidebar" // Import useSidebar from the main sidebar file

interface SidebarToggleProps extends React.ComponentProps<typeof Button> {}

const SidebarToggle = React.forwardRef<HTMLButtonElement, SidebarToggleProps>(
  ({ className, onClick, ...props }, ref) => {
    const { toggleSidebar } = useSidebar()

    const handleClick = React.useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        toggleSidebar()
        onClick?.(event)
      },
      [toggleSidebar, onClick]
    )

    return (
      <Button
        ref={ref}
        variant="ghost"
        size="icon"
        className={cn("h-7 w-7", className)}
        onClick={handleClick}
        {...props}
      >
        <PanelLeft />
        <span className="sr-only">Toggle Sidebar</span>
      </Button>
    )
  }
)
SidebarToggle.displayName = "SidebarToggle"

export { SidebarToggle }