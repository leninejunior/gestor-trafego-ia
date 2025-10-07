"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet"
import { useSidebar } from "./sidebar" // Import useSidebar from the main sidebar file

interface SidebarContentProps extends React.ComponentPropsWithoutRef<"div"> {
  collapsible?: "oncanvas" | "offcanvas"
}

const SidebarContent = React.forwardRef<HTMLDivElement, SidebarContentProps>(
  (
    { collapsible = "offcanvas", className, children, ...props },
    ref
  ) => {
    const { open, openMobile, setOpenMobile, isMobile } = useSidebar()

    if (isMobile) {
      return (
        <Sheet open={openMobile} onOpenChange={setOpenMobile}>
          <SheetContent side="left" className="flex flex-col">
            <SheetHeader>
              {/* You can add a title or logo here if needed */}
            </SheetHeader>
            <div className="flex h-full w-full flex-col">{children}</div>
          </SheetContent>
        </Sheet>
      )
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex h-full",
          collapsible === "offcanvas" && "relative",
          className
        )}
        {...props}
      >
        {/* This is what handles the sidebar gap on desktop */}
        <div
          className={cn(
            "h-full shrink-0 transition-all duration-300 ease-in-out",
            collapsible === "oncanvas" && "w-full",
            collapsible === "offcanvas" && (open ? "w-64" : "w-0")
          )}
        />
        <div
          data-sidebar="sidebar"
          className={cn(
            "flex h-full flex-col",
            collapsible === "oncanvas" && "w-full",
            collapsible === "offcanvas" &&
              "absolute left-0 top-0 z-20 h-full w-64 border-r bg-sidebar transition-transform duration-300 ease-in-out",
            collapsible === "offcanvas" && (open ? "translate-x-0" : "-translate-x-full"),
            className
          )}
        >
          <div
            data-sidebar="sidebar"
            className={cn(
              "flex h-full flex-col",
              collapsible === "oncanvas" && "w-full",
              collapsible === "offcanvas" && "w-64"
            )}
          >
            {children}
          </div>
        </div>
      </div>
    )
  }
)
SidebarContent.displayName = "SidebarContent"

export { SidebarContent }