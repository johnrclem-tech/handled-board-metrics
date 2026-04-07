'use client'

import { Cell, Label as ChartLabel, Pie, PieChart } from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

const chartConfig = {
  count: { label: 'Count' }
} satisfies ChartConfig

export interface DonutSegment {
  name: string
  count: number
}

interface DonutBreakdownChartProps {
  title: string
  segments: DonutSegment[]
  centerLabel?: string
  colLabel?: string
  className?: string
}

const DonutBreakdownChart = ({
  title,
  segments,
  centerLabel = 'total',
  colLabel = 'Status',
  className,
}: DonutBreakdownChartProps) => {
  const total = segments.reduce((s, d) => s + d.count, 0)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>

      <CardContent className='space-y-6'>
        <ChartContainer config={chartConfig} className='mx-auto h-56 w-full max-w-xs'>
          <PieChart margin={{ top: 0, bottom: 0, left: 0, right: 0 }}>
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={segments}
              dataKey='count'
              nameKey='name'
              innerRadius={60}
              outerRadius={88}
              paddingAngle={2}
              strokeWidth={0}
            >
              {segments.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
              <ChartLabel
                content={({ viewBox }) => {
                  if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor='middle' dominantBaseline='middle'>
                        <tspan x={viewBox.cx} y={viewBox.cy} className='fill-foreground text-xl font-semibold'>
                          {total.toLocaleString()}
                        </tspan>
                        <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className='fill-muted-foreground text-xs'>
                          {centerLabel}
                        </tspan>
                      </text>
                    )
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>

        <div>
          <div className='mb-2 flex items-center justify-between px-1'>
            <span className='text-muted-foreground text-sm font-semibold uppercase'>{colLabel}</span>
            <span className='text-muted-foreground text-sm font-semibold uppercase'>Count / Share</span>
          </div>

          <div className='divide-y'>
            {segments.map((item, i) => {
              const share = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0.0'

              return (
                <div key={i} className='flex items-center justify-between py-3'>
                  <div className='flex items-center gap-3'>
                    <div
                      className='h-4 w-1 rounded-full'
                      style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className='text-sm font-medium'>{item.name}</span>
                  </div>
                  <span className='flex items-center gap-2 text-sm font-semibold tabular-nums'>
                    {item.count.toLocaleString()}{' '}
                    <Badge variant='secondary' className='text-muted-foreground rounded-md font-semibold'>
                      {share}%
                    </Badge>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default DonutBreakdownChart
