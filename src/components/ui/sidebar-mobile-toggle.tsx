"use client"

import * as React from "react"
import { PanelLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSidebar } from "./sidebar" // Import useSidebar from the main sidebar file

interface SidebarMobileToggleProps extends React.ComponentProps<"button"> {}

const SidebarMobileToggle = React.forwardRef<HTMLButtonElement, SidebarMobileToggleProps>(
  ({ className, ...props }, ref) => {
    const { toggleSidebar } = useSidebar()

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 w-9",
          className
        )}
        onClick={toggleSidebar}
        {...props}
      >
        <PanelLeft className="h-4 w-4" />
        <span className="sr-only">Toggle Sidebar</span>
      </button>
    )
  }
)
SidebarMobileToggle.displayName = "SidebarMobileToggle"

export { SidebarMobileToggle }