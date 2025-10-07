"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useIsMobile } from "@/hooks/use-mobile"
import { SidebarContent } from "./sidebar-content"
import { SidebarToggle } from "./sidebar-toggle"
import { SidebarMobileToggle } from "./sidebar-mobile-toggle"

const SIDEBAR_COOKIE_NAME = "sidebar-open"
const SIDEBAR_COOKIE_MAX_AGE = 31536000 // 1 year

type SidebarContextProps = {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  openMobile: boolean
  setOpenMobile: React.Dispatch<React.SetStateAction<boolean>>
  toggleSidebar: () => void
  isMobile: boolean
}

const SidebarContext = React.createContext<SidebarContextProps | undefined>(
  undefined
)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a <Sidebar />")
  }
  return context
}

type SidebarProps = {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
} & React.ComponentPropsWithoutRef<"div">

const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(
  (
    {
      defaultOpen = true,
      open: openProp,
      onOpenChange: setOpenProp,
      className,
      style,
      children,
      ...props
    },
    ref
  ) => {
    const isMobile = useIsMobile()
    const [openState, setOpenState] = React.useState(defaultOpen)
    const [openMobileState, setOpenMobileState] = React.useState(false)

    const open = openProp ?? openState
    const setOpen = setOpenProp ?? setOpenState

    React.useEffect(() => {
      if (typeof document !== "undefined") {
        const cookieValue = document.cookie
          .split("; ")
          .find((row) => row.startsWith(`${SIDEBAR_COOKIE_NAME}=`))
          ?.split("=")[1]
        if (cookieValue) {
          setOpenState(cookieValue === "true")
        }
      }
    }, [])

    React.useEffect(() => {
      if (typeof document !== "undefined") {
        // This sets the cookie to keep the sidebar state.
        document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
      }
    }, [openState])

    const toggleSidebar = React.useCallback(() => {
      return isMobile
        ? setOpenMobileState((open) => !open)
        : setOpen((open) => !open)
    }, [isMobile, setOpen, setOpenMobileState])

    const SIDEBAR_KEYBOARD_SHORTCUT = "b"

    React.useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (
          event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
          (event.metaKey || event.ctrlKey)
        ) {
          event.preventDefault()
          toggleSidebar()
        }
      }

      if (typeof window !== "undefined") {
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
      }
    }, [toggleSidebar])

    return (
      <SidebarContext.Provider
        value={{
          open,
          setOpen,
          openMobile: openMobileState,
          setOpenMobile: setOpenMobileState,
          toggleSidebar,
          isMobile,
        }}
      >
        <TooltipProvider delayDuration={0}>
          <div
            ref={ref}
            className={cn(
              "flex h-full",
              isMobile && "flex-col",
              className
            )}
            style={style}
            {...props}
          >
            {children}
          </div>
        </TooltipProvider>
      </SidebarContext.Provider>
    )
  }
)
Sidebar.displayName = "Sidebar"

const SidebarMain = React.forwardRef<
  HTMLElement,
  React.ComponentProps<"main">
>(({ className, ...props }, ref) => {
  return (
    <main
      ref={ref}
      className={cn("flex flex-1 flex-col overflow-hidden", className)}
      {...props}
    />
  )
})
SidebarMain.displayName = "SidebarMain"

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("flex h-16 items-center px-6", className)}
      {...props}
    />
  )
})
SidebarHeader.displayName = "SidebarHeader"

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("mt-auto flex items-center px-6 py-4", className)}
      {...props}
    />
  )
})
SidebarFooter.displayName = "SidebarFooter"

const SidebarSeparator = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof Separator>
>(({ className, ...props }, ref) => {
  return (
    <Separator
      ref={ref}
      className={cn("my-4", className)}
      {...props}
    />
  )
})
SidebarSeparator.displayName = "SidebarSeparator"

const SidebarNav = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("flex flex-col gap-2 px-6 py-2", className)}
      {...props}
    />
  )
})
SidebarNav.displayName = "SidebarNav"

const SidebarNavList = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => {
  return (
    <ul
      ref={ref}
      className={cn("flex flex-col", className)}
      {...props}
    />
  )
})
SidebarNavList.displayName = "SidebarNavList"

const SidebarNavListItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => {
  return (
    <li
      ref={ref}
      className={cn("flex", className)}
      {...props}
    />
  )
})
SidebarNavListItem.displayName = "SidebarNavListItem"

type SidebarNavLinkProps = {
  asChild?: boolean
  size?: "default" | "sm" | "lg" | "icon" | null
  tooltip?: React.ReactNode
  showOnHover?: boolean
  isActive?: boolean
} & React.ComponentProps<typeof Button>

const SidebarNavLink = React.forwardRef<
  HTMLAnchorElement | HTMLButtonElement,
  SidebarNavLinkProps
>(({ asChild = false, size = "default", tooltip, showOnHover = false, isActive, className, ...props }, ref) => {
  const Comp = asChild ? Slot : "a"
  const { open } = useSidebar()

  return (
    <Comp
      ref={ref}
      className={cn(
        buttonVariants({ variant: isActive ? "secondary" : "ghost", size }),
        "justify-start",
        !open && "h-9 w-9",
        className
      )}
      {...props}
    >
      {tooltip ? (
        <div className="flex items-center">
          {React.Children.map(props.children, (child) =>
            React.isValidElement(child) && child.type === "svg"
              ? React.cloneElement(child as React.ReactElement, {
                  className: cn("h-4 w-4", !open && "mr-0"),
                })
              : child
          )}
          {open && <span className="ml-2">{tooltip}</span>}
        </div>
      ) : (
        props.children
      )}
    </Comp>
  )
})
SidebarNavLink.displayName = "SidebarNavLink"

const SidebarMenu = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-1", className)}
    {...props}
  />
))
SidebarMenu.displayName = "SidebarMenu"

const SidebarMenuItem = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button> & { asChild?: boolean; showOnHover?: boolean }
>(({ className, asChild = false, showOnHover = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  const { open } = useSidebar()

  return (
    <Comp
      ref={ref}
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "justify-start",
        !open && "h-9 w-9",
        className
      )}
      {...props}
    />
  )
})
SidebarMenuItem.displayName = "SidebarMenuItem"

const SidebarMenuTitle = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-3 py-2 text-xs font-semibold text-muted-foreground", className)}
    {...props}
  />
))
SidebarMenuTitle.displayName = "SidebarMenuTitle"

const SidebarMenuLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<typeof SidebarNavLink> & { showIcon?: boolean }
>(({ className, showIcon = false, ...props }, ref) => {
  // Random width between 50 to 90%.
  const randomWidth = React.useMemo(() => Math.floor(Math.random() * 40) + 50, []);
  const { open } = useSidebar();

  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center",
        !open && "justify-center",
        className
      )}
    >
      {showIcon && (
        <div
          className={cn(
            "h-4 w-4 rounded-full bg-muted-foreground",
            !open && "mr-0"
          )}
          style={{ width: open ? `${randomWidth}%` : "1rem" }}
        />
      )}
      <SidebarNavLink
        className={cn(
          "w-full",
          !open && "justify-center",
          className
        )}
        {...props}
      />
    </div>
  )
})
SidebarMenuLink.displayName = "SidebarMenuLink"

const SidebarMenuSub = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex flex-col gap-1 pl-6", className)}
    {...props}
  />
))
SidebarMenuSub.displayName = "SidebarMenuSub"

const SidebarMenuSubItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ ...props }, ref) => <li ref={ref} {...props} />)
SidebarMenuSubItem.displayName = "SidebarMenuSubItem"

export {
  Sidebar,
  SidebarContent,
  SidebarToggle,
  SidebarMobileToggle,
  SidebarMain,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
  SidebarNav,
  SidebarNavList,
  SidebarNavListItem,
  SidebarNavLink,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuTitle,
  SidebarMenuLink,
  SidebarMenuSub,
  SidebarMenuSubItem,
  useSidebar, // Export useSidebar for other components to consume the context
}