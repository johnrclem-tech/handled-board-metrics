'use client'

import { Area, AreaChart } from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

import { cn } from '@/lib/utils'

export type AreaCardFormat = 'number' | 'compact' | 'currency'

export interface StatisticsAreaCardProps<T extends Record<string, unknown> = Record<string, unknown>> {
  title: string
  data: T[]
  dataKey: keyof T
  format?: AreaCardFormat
  className?: string
}

function fmt(v: number, format: AreaCardFormat = 'number'): string {
  const abs = Math.abs(v)
  if (format === 'currency') {
    if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
    return `$${v.toLocaleString()}`
  }
  if (format === 'compact') {
    if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}K`
    return v.toLocaleString()
  }
  return v.toLocaleString()
}

const StatisticsAreaCard = <T extends Record<string, unknown>>({
  title,
  data,
  dataKey,
  format = 'number',
  className,
}: StatisticsAreaCardProps<T>) => {
  if (!data || data.length === 0) {
    return (
      <Card className={cn(className)}>
        <CardContent className='flex flex-1 items-center justify-between gap-4'>
          <div className='flex shrink-0 flex-col justify-between gap-6'>
            <div className='flex flex-col gap-1'>
              <span className='text-muted-foreground text-sm'>{title}</span>
              <span className='text-3xl font-semibold'>0</span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const currVal = data[data.length - 1][dataKey] as number
  const firstVal = data[0][dataKey] as number
  const changePct = firstVal !== 0 ? ((currVal - firstVal) / firstVal) * 100 : 0
  const isPositive = changePct >= 0

  const gradientId = `fill-area-${String(dataKey)}`

  const chartConfig = {
    [dataKey as string]: { label: title }
  } satisfies ChartConfig

  return (
    <Card className={cn(className)}>
      <CardContent className='flex flex-1 items-center justify-between gap-4 pr-0'>
        <div className='flex shrink-0 flex-col justify-between gap-6'>
          <div className='flex flex-col gap-1'>
            <span className='text-muted-foreground text-sm'>{title}</span>
            <span className='text-3xl font-semibold'>{fmt(currVal, format)}</span>
          </div>
          <div className='flex gap-3'>
            <Badge className='bg-primary/10 text-primary rounded-sm'>
              {isPositive ? '+' : ''}{changePct.toFixed(1)}%
            </Badge>
            <span className='text-muted-foreground text-sm'>vs first period</span>
          </div>
        </div>
        <ChartContainer config={chartConfig} className='max-h-26.5 w-full max-w-70 flex-1 max-sm:max-w-35'>
          <AreaChart
            data={data}
            margin={{ left: 4, right: 0 }}
            className='stroke-2'
          >
            <defs>
              <linearGradient id={gradientId} x1='0' y1='0' x2='0' y2='1'>
                <stop offset='10%' stopColor='var(--primary)' stopOpacity={1} />
                <stop offset='90%' stopColor='var(--primary)' stopOpacity={0} />
              </linearGradient>
            </defs>
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Area
              dataKey={dataKey as string}
              type='natural'
              fill={`url(#${gradientId})`}
              stroke='var(--primary)'
              stackId='a'
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export default StatisticsAreaCard
