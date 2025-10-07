"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

// Workaround for https://github.com/recharts/recharts/issues/3615
const CartesianAxis = RechartsPrimitive.CartesianAxis

// Define a custom type for the chart config
type ChartConfig = {
  [k: string]: {
    label?: string
    color?: string
    icon?: React.ComponentType<{ className?: string }>
  }
}

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <Chart />")
  }

  return context
}

type ChartProps = React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer> & {
  config: ChartConfig
  id?: string
}

const Chart = React.forwardRef<
  HTMLDivElement,
  ChartProps
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn("flex aspect-video w-full", className)}
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
Chart.displayName = "Chart"

type ChartStyleProps = {
  id: string
  config: ChartConfig
}

const ChartStyle = ({ id, config }: ChartStyleProps) => {
  const colorConfig = Object.entries(config).filter(
    ([_, item]) => item.color !== undefined
  )

  if (!colorConfig.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          ${colorConfig
            .map(([key, item]) => {
              const color = item.color || "black"
              return `
                .recharts-tooltip-item-${key} {
                  color: ${color};
                }
                .recharts-dot.${key}-dot {
                  fill: ${color};
                }
                .recharts-active-dot.${key}-active-dot {
                  fill: ${color};
                  stroke: ${color};
                }
                .recharts-legend-item-${key} text {
                  color: ${color} !important;
                }
                .recharts-cartesian-axis-tick-value.${key}-tick .recharts-cartesian-axis-tick-value-text {
                  fill: ${color};
                }
              `
            })
            .join("")}
        `,
      }}
    />
  )
}

type ChartTooltipProps = React.ComponentProps<typeof RechartsPrimitive.Tooltip> & {
  indicator?: "dot" | "line"
  hideIndicator?: boolean
  labelFormatter?: (value: string | number, payload: any[]) => React.ReactNode
  labelClassName?: string
  formatter?: (value: string | number, name: string, item: any, index: number) => React.ReactNode
  color?: string
  nameKey?: string
  labelKey?: string
}

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
      if (labelKey && payload && payload.length) {
        return payload[0].payload[labelKey]
      }
      return label
    }, [label, labelKey, payload])

    const valueFormatter = React.useCallback(
      (value: string | number, name: string, item: any, index: number) => {
        if (formatter) {
          return formatter(value, name, item, index)
        }
        if (config[item.dataKey || item.name]?.formatter) {
          return config[item.dataKey || item.name].formatter?.(value, name, item, index)
        }
        return value.toLocaleString()
      },
      [formatter, config]
    )

    const itemContent = React.useCallback(
      (item: any, index: number) => {
        const itemConfig = item.dataKey ? config[item.dataKey] : config[item.name]
        const hide = itemConfig?.hide
        const color = itemConfig?.color || item.color || color

        if (hide) {
          return null
        }

        return (
          <div
            key={item.dataKey || item.name || index}
            className="flex w-full items-center justify-between gap-4"
          >
            <div className="flex items-center gap-2">
              {!hideIndicator && (
                <div
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-[2px]",
                    indicator === "dot" && "rounded-full",
                    color && `bg-[${color}]`
                  )}
                  style={{ backgroundColor: color }}
                />
              )}
              {itemConfig?.icon && (
                <itemConfig.icon
                  className={cn("h-4 w-4", color && `text-[${color}]`)}
                  style={{ color: color }}
                />
              )}
              <span className="text-muted-foreground">
                {itemConfig?.label || item.name}
              </span>
            </div>
            <span className="font-mono font-medium tabular-nums text-foreground">
              {valueFormatter(item.value, item.name, item, index)}
            </span>
          </div>
        )
      },
      [hideIndicator, indicator, valueFormatter, config, color]
    )

    if (!active || !payload || !payload.length) {
      return null
    }

    const nestLabel = payload[0].name === labelKey

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[130px] items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs shadow-md",
          className
        )}
      >
        {!nestLabel && (labelFormatter?.(tooltipLabel, payload) || (
          <div className={cn("font-medium", labelClassName)}>
            {tooltipLabel}
          </div>
        ))}
        <div className="grid gap-1.5">
          {payload.map((item, index) => itemContent(item, index))}
        </div>
      </div>
    )
  }
)
ChartTooltip.displayName = "ChartTooltip"

type ChartLegendProps = React.ComponentProps<typeof RechartsPrimitive.Legend> & {
  hideIcon?: boolean
  verticalAlign?: "top" | "middle" | "bottom"
  nameKey?: string
}

const ChartLegend = React.forwardRef<
  HTMLDivElement,
  ChartLegendProps
>(
  (
    { className, hideIcon = false, payload, verticalAlign = "bottom", nameKey },
    ref
  ) => {
    const { config } = useChart()

    if (!payload || !payload.length) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center gap-4",
          verticalAlign === "top" && "pb-3",
          verticalAlign === "bottom" && "pt-3",
          className
        )}
      >
        {payload.map((item: any, index: number) => { // Explicitly type item and index
          const itemConfig = item.dataKey ? config[item.dataKey] : config[item.name]
          const hide = itemConfig?.hide
          const color = itemConfig?.color || item.color || "gray"

          if (hide) {
            return null
          }

          return (
            <div
              key={item.value || index}
              className="flex items-center gap-1.5"
            >
              {!hideIcon && (itemConfig?.icon ? (
                <itemConfig.icon
                  className={cn("h-3 w-3", color && `text-[${color}]`)}
                  style={{ color: color }}
                />
              ) : (
                <div
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: color }}
                />
              ))}
              <span className="text-xs text-muted-foreground">
                {itemConfig?.label || item.name}
              </span>
            </div>
          )
        })}
      </div>
    )
  }
)
ChartLegend.displayName = "ChartLegend"

export { Chart, ChartTooltip, ChartLegend, CartesianAxis }