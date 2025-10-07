"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

// Workaround for https://github.com/recharts/recharts/issues/3615
const CartesianAxis = RechartsPrimitive.CartesianAxis as any

const ChartContext = React.createContext<
  { config?: ChartConfig } | undefined
>(undefined)

type ChartConfig = {
  [k: string]: {
    label?: string
    icon?: React.ComponentType
    color?: string
  }
}

type ChartContainerProps = {
  config: ChartConfig
  children: React.ReactNode
} & React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  ChartContainerProps
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          "flex aspect-video justify-center text-foreground [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-dot]:fill-primary [&_.recharts-active-dot]:fill-background [&_.recharts-active-dot]:stroke-primary [&_.recharts-tooltip-content]:rounded-md [&_.recharts-tooltip-content]:border-border [&_.recharts-tooltip-content]:bg-background [&_.recharts-tooltip-content]:text-foreground [&_[data-value='total']_svg]:size-4 [&_[data-value='total']_svg]:shrink-0 [&_[data-value='total']_svg]:fill-foreground [&_.recharts-tooltip-item]:flex",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer {...props}>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = "ChartContainer"

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(([, { color }]) => color)

  if (!colorConfig.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          ${colorConfig
            .map(([key, { color }]) => `
            .data-\\[color\\=var\\(--chart-${key}\\)\\] {
              --color: ${color};
            }
          `)
            .join("\n")}

          ${colorConfig
            .map(([key, { color }]) => `
            .data-\\[color\\=var\\(--chart-${key}\\)\\] path {
              fill: var(--chart-${key});
              stroke: var(--chart-${key});
            }
          `)
            .join("\n")}
        `,
      }}
    />
  )
}

type ChartTooltipProps = {
  hideIndicator?: boolean
  indicator?: "dot" | "line"
  labelFormatter?: (value: string, payload: any[]) => React.ReactNode
  formatter?: (
    value: string | number,
    name: string,
    item: any,
    index: number
  ) => React.ReactNode
  labelClassName?: string
  color?: string
  nameKey?: string
  labelKey?: string
} & React.ComponentProps<typeof RechartsPrimitive.Tooltip>

const ChartTooltip = React.forwardRef<
  HTMLDivElement,
  ChartTooltipProps
>(
  (
    {
      active,
      payload,
      className,
      indicator = "dot",
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey,
    },
    ref
  ) => {
    const { config } = useChart()
    const tooltipLabel = React.useMemo(() => {
      if (labelKey && payload?.[0]) {
        return payload[0].payload[labelKey]
      }
      return label
    }, [label, labelKey, payload])

    const valueFormatter = React.useCallback(
      (value: string | number, name: string, item: any, index: number) => {
        if (formatter) {
          return formatter(value, name, item, index)
        }
        if (item.payload?.name && config?.[item.payload.name]?.label) {
          return config[item.payload.name].label
        }
        return value
      },
      [formatter, config]
    )

    if (active && payload && payload.length) {
      const nestLabel = payload.length === 1 && config?.[payload[0].dataKey as keyof ChartConfig]?.label
      return (
        <div
          ref={ref}
          className={cn(
            "grid min-w-[130px] items-center rounded-lg border border-border bg-background px-2 py-1 text-xs shadow-md",
            className
          )}
        >
          {!nestLabel ? (
            <div className={cn("font-medium", labelClassName)}>
              {labelFormatter ? labelFormatter(tooltipLabel as string, payload) : tooltipLabel}
            </div>
          ) : null}
          <div className="grid gap-1.5">
            {payload.map((item: any, index: number) => {
              const key = `${nameKey || item.name || item.dataKey || "value"}`
              const itemConfig = item.dataKey && config?.[item.dataKey as keyof ChartConfig]

              return (
                <div
                  key={key}
                  className={cn(
                    "flex w-full items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:shrink-0"
                  )}
                >
                  {item.color && !hideIndicator ? (
                    indicator === "dot" ? (
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                    ) : (
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                    )
                  ) : null}
                  {itemConfig?.icon ? (
                    <itemConfig.icon
                      className={cn(
                        "data-[color=var(--color)]",
                        item.color && `fill-[--color] text-[--color]`
                      )}
                    />
                  ) : (
                    <div
                      className={cn(
                        "flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full",
                        item.color && `bg-[--color]`,
                        item.entryType === "tooltip" && "bg-muted"
                      )}
                    >
                      {item.color && !hideIndicator && (
                        <div
                          className={cn(
                            "h-2 w-2 rounded-full",
                            item.color && `bg-[--color]`
                          )}
                          style={{ backgroundColor: item.color }}
                        />
                      )}
                    </div>
                  )}
                  <div
                    className={cn(
                      "flex flex-1 justify-between",
                      item.color && `data-[color=var(--color)]`
                    )}
                  >
                    <div className="grid gap-1.5">
                      {nestLabel ? tooltipLabel : null}
                      <span className="text-muted-foreground">
                        {itemConfig?.label || item.name}
                      </span>
                    </div>
                    {item.value && (
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {item.value.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    return null
  }
)
ChartTooltip.displayName = "ChartTooltip"

const ChartLegend = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof RechartsPrimitive.Legend> & {
    hideIcon?: boolean
    indicator?: "dot" | "line"
    nameKey?: string
  }
>(
  (
    { className, hideIcon = false, payload, verticalAlign = "bottom", nameKey },
    ref
  ) => {
    const { config } = useChart()

    if (!payload?.length) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center gap-4",
          verticalAlign === "top" ? "pb-3" : "pt-3",
          className
        )}
      >
        {payload.map((item: any) => {
          const key = `${nameKey || item.dataKey || "value"}`
          const itemConfig = item.dataKey && config?.[item.dataKey as keyof ChartConfig]

          return (
            <div
              key={key}
              className={cn(
                "flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:shrink-0",
                item.inactive && "opacity-50"
              )}
            >
              {!hideIcon ? (
                itemConfig?.icon ? (
                  <itemConfig.icon
                    className={cn(
                      "data-[color=var(--color)]",
                      item.color && `fill-[--color] text-[--color]`
                    )}
                  />
                ) : (
                  <div
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-[2px]",
                      item.color && `bg-[--color]`,
                      item.entryType === "tooltip" && "bg-muted"
                    )}
                    style={{ backgroundColor: item.color }}
                  />
                )
              ) : null}
              {itemConfig?.label}
            </div>
          )
        })}
      </div>
    )
  }
)
ChartLegend.displayName = "ChartLegend"

const ChartTooltipContent = ChartTooltip
const ChartLegendContent = ChartLegend

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
}

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }
  return context
}