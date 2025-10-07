"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { VariantProps, cva } from "class-variance-authority"
import { PanelLeft } from "lucide-react"

import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { Button } from "./button"
import { Input } from "./input"
import { Separator } from "./separator"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./sheet"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "./tooltip" // Assuming TooltipProvider is available

const SidebarContext = React.createContext<{
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  toggleSidebar: () => void
  collapsible: "always" | "never" | "offcanvas"
  isMobile: boolean
}>({
  open: true,
  setOpen: () => {},
  toggleSidebar: () => {},
  collapsible: "offcanvas",
  isMobile: false,
})

const SIDEBAR_COOKIE_NAME = "sidebar-open"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

export function Sidebar({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  collapsible = "offcanvas",
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  collapsible?: "always" | "never" | "offcanvas"
}) {
  const isMobile = useIsMobile()
  const [openState, setOpenState] = React.useState(
    defaultOpen &&
      (typeof document !== "undefined"
        ? document.cookie.includes(`${SIDEBAR_COOKIE_NAME}=true`)
        : true)
  )

  const open = openProp ?? openState
  const setOpen = React.useCallback(
    (value: boolean) => {
      if (setOpenProp) {
        setOpenProp(value)
      }
      setOpenState(value)
      if (typeof document !== "undefined") {
        // This sets the cookie to keep the sidebar state.
        document.cookie = `${SIDEBAR_COOKIE_NAME}=${value}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
      }
    },
    [setOpenProp]
  )

  const [openMobile, setOpenMobile] = React.useState(false)

  const toggleSidebar = React.useCallback(() => {
    return isMobile
      ? setOpenMobile((open: boolean) => !open)
      : setOpen((open: boolean) => !open)
  }, [isMobile, setOpen, setOpenMobile])

  React.useEffect(() => {
    if (typeof window === 'undefined') return; // Safely check for window

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault()
        toggleSidebar()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [toggleSidebar])

  const sidebarContextValue = React.useMemo(
    () => ({
      open,
      setOpen,
      toggleSidebar,
      collapsible,
      isMobile,
    }),
    [open, setOpen, toggleSidebar, collapsible, isMobile]
  )

  const SIDEBAR_KEYBOARD_SHORTCUT = "b"

  if (isMobile && collapsible === "offcanvas") {
    return (
      <SidebarContext.Provider value={sidebarContextValue}>
        <Sheet open={openMobile} onOpenChange={setOpenMobile}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="fixed left-2 top-2 z-50"
            >
              <PanelLeft className="h-5 w-5" />
              <span className="sr-only">Toggle Sidebar</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-64 flex-col p-0">
            <SheetHeader className="p-4">
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="flex h-full w-full flex-col">{children}</div>
          </SheetContent>
        </Sheet>
      </SidebarContext.Provider>
    )
  }

  return (
    <SidebarContext.Provider value={sidebarContextValue}>
      <TooltipProvider delayDuration={0}>
        <div
          ref={ref}
          className={cn(
            "flex h-screen",
            collapsible === "offcanvas" && "relative",
            className
          )}
          style={style}
          {...props}
        >
          {/* This is what handles the sidebar gap on desktop */}
          <div
            className={cn(
              "transition-all duration-300",
              open ? "w-64" : "w-14",
              collapsible === "offcanvas" && "hidden md:block"
            )}
          />
          <div
            data-sidebar="sidebar"
            className={cn(
              "fixed inset-y-0 left-0 z-30 flex h-full flex-col border-r bg-sidebar transition-all duration-300",
              open ? "w-64" : "w-14",
              collapsible === "offcanvas" && "hidden md:flex"
            )}
          >
            {children}
          </div>
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a <Sidebar />")
  }
  return context
}

export const SidebarToggle = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      className={cn("h-7 w-7", className)}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => { // Explicitly type event
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeft />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
})
SidebarToggle.displayName = "SidebarToggle"

export const SidebarButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button">
>(({ className, ...props }, ref) => {
  const { toggleSidebar } = useSidebar()

  return (
    <button
      ref={ref}
      className={cn(
        "flex h-9 w-9 items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      onClick={toggleSidebar}
      {...props}
    />
  )
})
SidebarButton.displayName = "SidebarButton"

export const SidebarMain = React.forwardRef<
  HTMLElement,
  React.ComponentProps<"main">
>(({ className, ...props }, ref) => {
  const { open, collapsible } = useSidebar()
  return (
    <main
      ref={ref}
      className={cn(
        "flex-1 transition-all duration-300",
        collapsible === "offcanvas" && "md:ml-0",
        collapsible !== "offcanvas" && (open ? "ml-64" : "ml-14"),
        className
      )}
      {...props}
    />
  )
})
SidebarMain.displayName = "SidebarMain"

export const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("flex h-14 items-center justify-between p-4", className)}
      {...props}
    />
  )
})
SidebarHeader.displayName = "SidebarHeader"

export const SidebarHeaderTitle = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  const { open } = useSidebar()
  if (!open) return null
  return (
    <div
      ref={ref}
      className={cn("flex items-center gap-2 text-lg font-semibold", className)}
      {...props}
    />
  )
})
SidebarHeaderTitle.displayName = "SidebarHeaderTitle"

export const SidebarHeaderSeparator = React.forwardRef<
  HTMLHRElement,
  React.ComponentProps<typeof Separator>
>(({ className, ...props }, ref) => {
  const { open } = useSidebar()
  if (!open) return null
  return (
    <Separator
      ref={ref}
      className={cn("my-4", className)}
      orientation="horizontal"
      {...props}
    />
  )
})
SidebarHeaderSeparator.displayName = "SidebarHeaderSeparator"

export const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("mt-auto flex items-center justify-between p-4", className)}
      {...props}
    />
  )
})
SidebarFooter.displayName = "SidebarFooter"

export const SidebarFooterDescription = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  const { open } = useSidebar()
  if (!open) return null
  return (
    <div
      ref={ref}
      className={cn("flex flex-col", className)}
      {...props}
    />
  )
})
SidebarFooterDescription.displayName = "SidebarFooterDescription"

export const SidebarNav = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const { open } = useSidebar()
  const Comp = asChild ? Slot : "div"
  if (!open) return null
  return (
    <Comp
      ref={ref}
      className={cn("flex flex-col gap-2 px-4", className)}
      {...props}
    />
  )
})
SidebarNav.displayName = "SidebarNav"

export const SidebarNavList = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => {
  return (
    <ul
      ref={ref}
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
})
SidebarNavList.displayName = "SidebarNavList"

export const SidebarNavListItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => {
  return (
    <li
      ref={ref}
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
})
SidebarNavListItem.displayName = "SidebarNavListItem"

export const SidebarNavLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<"a"> & {
    isActive?: boolean
    size?: "default" | "sm" | "lg" | "icon"
    tooltip?: React.ReactNode
    showOnHover?: boolean
  }
>(({ className, children, isActive, size = "default", tooltip, showOnHover = false, ...props }, ref) => {
  const { open } = useSidebar()
  const Comp = props.asChild ? Slot : "a"

  const content = (
    <Comp
      ref={ref}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        isActive && "bg-sidebar-primary text-sidebar-primary-foreground",
        size === "sm" && "h-8 px-2",
        size === "lg" && "h-10 px-4",
        size === "icon" && "h-9 w-9 items-center justify-center p-0",
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  )

  if (open || !tooltip) {
    return content
  }

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
})
SidebarNavLink.displayName = "SidebarNavLink"

export const SidebarNavLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const { open } = useSidebar()
  const Comp = asChild ? Slot : "div"
  if (!open) return null
  return (
    <Comp
      ref={ref}
      className={cn("text-xs font-semibold uppercase text-muted-foreground", className)}
      {...props}
    />
  )
})
SidebarNavLabel.displayName = "SidebarNavLabel"

export const SidebarNavSeparator = React.forwardRef<
  HTMLHRElement,
  React.ComponentProps<typeof Separator>
>(({ className, ...props }, ref) => {
  const { open } = useSidebar()
  if (!open) return null
  return (
    <Separator
      ref={ref}
      className={cn("my-4", className)}
      orientation="horizontal"
      {...props}
    />
  )
})
SidebarNavSeparator.displayName = "SidebarNavSeparator"

export const SidebarNavContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  const { open } = useSidebar()
  if (!open) return null
  return (
    <div
      ref={ref}
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
})
SidebarNavContent.displayName = "SidebarNavContent"

export const SidebarNavSubList = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => {
  const { open } = useSidebar()
  if (!open) return null
  return (
    <ul
      ref={ref}
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
})
SidebarNavSubList.displayName = "SidebarNavSubList"

export const SidebarNavSubItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ ...props }, ref) => <li ref={ref} {...props} />)
SidebarNavSubItem.displayName = "SidebarNavSubItem"

export const SidebarNavSubLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<"a"> & {
    isActive?: boolean
    size?: "default" | "sm" | "lg" | "icon"
    tooltip?: React.ReactNode
    showOnHover?: boolean
  }
>(({ className, children, isActive, size = "default", tooltip, showOnHover = false, ...props }, ref) => {
  const { open } = useSidebar()
  const Comp = props.asChild ? Slot : "a"

  const content = (
    <Comp
      ref={ref}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        isActive && "bg-sidebar-primary text-sidebar-primary-foreground",
        size === "sm" && "h-8 px-2",
        size === "lg" && "h-10 px-4",
        size === "icon" && "h-9 w-9 items-center justify-center p-0",
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  )

  if (open || !tooltip) {
    return content
  }

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
})
SidebarNavSubLink.displayName = "SidebarNavSubLink"

export const SidebarNavSubLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const { open } = useSidebar()
  const Comp = asChild ? Slot : "div"
  if (!open) return null
  return (
    <Comp
      ref={ref}
      className={cn("text-xs font-semibold uppercase text-muted-foreground", className)}
      {...props}
    />
  )
})
SidebarNavSubLabel.displayName = "SidebarNavSubLabel"

export const SidebarNavSubSeparator = React.forwardRef<
  HTMLHRElement,
  React.ComponentProps<typeof Separator>
>(({ className, ...props }, ref) => {
  const { open } = useSidebar()
  if (!open) return null
  return (
    <Separator
      ref={ref}
      className={cn("my-4", className)}
      orientation="horizontal"
      {...props}
    />
  )
})
SidebarNavSubSeparator.displayName = "SidebarNavSubSeparator"

export const SidebarNavSubContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  const { open } = useSidebar()
  if (!open) return null
  return (
    <div
      ref={ref}
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
})
SidebarNavSubContent.displayName = "SidebarNavSubContent"

export const SidebarNavSubItemSkeleton = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & { showIcon?: boolean }
>(({ className, showIcon = false, ...props }, ref) => {
  const { open } = useSidebar()
  if (!open) return null
  // Random width between 50 to 90%.
  const width = Math.floor(Math.random() * (90 - 50 + 1) + 50)
  return (
    <div
      ref={ref}
      className={cn("flex items-center gap-2", className)}
      {...props}
    >
      {showIcon && <div className="h-4 w-4 rounded-full bg-muted" />}
      <div
        className="h-4 rounded-md bg-muted"
        style={{ width: `${width}%` }}
      />
    </div>
  )
})
SidebarNavSubItemSkeleton.displayName = "SidebarNavSubItemSkeleton"

export const SidebarNavSubListSkeleton = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => {
  const { open } = useSidebar()
  if (!open) return null
  return (
    <ul
      ref={ref}
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
})
SidebarNavSubListSkeleton.displayName = "SidebarNavSubListSkeleton"