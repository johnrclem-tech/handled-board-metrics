'use client'

import { EllipsisVerticalIcon } from 'lucide-react'

import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { cn } from '@/lib/utils'

const listItems = ['Share', 'Refresh']

const followerData = [
  { day: 'Feb 01', gain: 50, loss: 0 },
  { day: 'Feb 02', gain: 65, loss: 0 },
  { day: 'Feb 03', gain: 35, loss: 0 },
  { day: 'Feb 04', gain: 55, loss: 50 },
  { day: 'Feb 05', gain: 100, loss: 0 },
  { day: 'Feb 06', gain: 150, loss: 0 },
  { day: 'Feb 07', gain: 150, loss: 30 },
  { day: 'Feb 08', gain: 20, loss: 35 },
  { day: 'Feb 09', gain: 60, loss: 20 },
  { day: 'Feb 10', gain: 70, loss: 25 },
  { day: 'Feb 11', gain: 68, loss: 21 },
  { day: 'Feb 12', gain: 82, loss: 33 },
  { day: 'Feb 13', gain: 75, loss: 24 },
  { day: 'Feb 14', gain: 153, loss: 0 },
  { day: 'Feb 15', gain: 69, loss: 0 },
  { day: 'Feb 16', gain: 89, loss: 12 },
  { day: 'Feb 17', gain: 111, loss: 18 },
  { day: 'Feb 18', gain: 99, loss: 25 },
  { day: 'Feb 19', gain: 100, loss: 30 },
  { day: 'Feb 20', gain: 79, loss: 35 },
  { day: 'Feb 21', gain: 101, loss: 28 },
  { day: 'Feb 22', gain: 105, loss: 0 },
  { day: 'Feb 23', gain: 110, loss: 6 },
  { day: 'Feb 24', gain: 115, loss: 19 },
  { day: 'Feb 25', gain: 100, loss: 24 },
  { day: 'Feb 26', gain: 89, loss: 30 },
  { day: 'Feb 27', gain: 97, loss: 36 },
  { day: 'Feb 28', gain: 81, loss: 42 }
]

const followersDataConfig = {
  gain: {
    label: 'Gain',
    color: 'var(--chart-2)'
  },
  loss: {
    label: 'Loss',
    color: 'var(--chart-1)'
  }
} satisfies ChartConfig

const tabs = [
  {
    name: '1w',
    data: followerData.slice(0, 7)
  },
  {
    name: '2w',
    data: followerData.slice(0, 14)
  },
  {
    name: '3w',
    data: followerData.slice(0, 21)
  },
  {
    name: 'All',
    data: followerData
  }
]

const FollowersGrowthCard = ({ className }: { className?: string }) => {
  return (
    <Card className={cn('gap-4', className)}>
      <CardHeader className='flex justify-between border-b'>
        <div className='flex flex-col gap-1'>
          <span className='text-lg font-semibold'>Followers Growth</span>
          <span className='text-muted-foreground text-sm'>Monitor your follower gains and losses over month</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='icon' className='text-muted-foreground size-6 rounded-full'>
              <EllipsisVerticalIcon />
              <span className='sr-only'>Menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuGroup>
              {listItems.map((item, index) => (
                <DropdownMenuItem key={index}>{item}</DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className='flex flex-col gap-4'>
        <Tabs defaultValue='1w' className='gap-6'>
          <div className='flex justify-between gap-4 max-sm:flex-col sm:items-center'>
            <div className='flex items-center gap-4'>
              <div className='flex items-center gap-2'>
                <span className='bg-chart-2 h-12 w-1 rounded-sm' />
                <div className='flex flex-col'>
                  <span className='text-xl font-medium'>2478</span>
                  <span className='text-muted-foreground text-sm'>Followers Gain</span>
                </div>
              </div>
              <div className='flex items-center gap-2'>
                <span className='bg-chart-1 h-12 w-1 rounded-sm' />
                <div className='flex flex-col'>
                  <span className='text-xl font-medium'>543</span>
                  <span className='text-muted-foreground text-sm'>Followers Loss</span>
                </div>
              </div>
            </div>
            <TabsList className='bg-muted max-sm:w-full'>
              {tabs.map(tab => (
                <TabsTrigger key={tab.name} value={tab.name}>
                  {tab.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {tabs.map(tab => (
            <TabsContent key={tab.name} value={tab.name}>
              <ChartContainer config={followersDataConfig} className='aspect-auto h-81.25 w-full min-w-70'>
                <AreaChart
                  margin={{
                    left: 20,
                    right: 20,
                    top: 20,
                    bottom: 5
                  }}
                  data={tab.data}
                  className='stroke-2'
                >
                  <defs>
                    <linearGradient id='fillGain' x1='0' y1='0' x2='0' y2='1'>
                      <stop offset='5%' stopColor='var(--color-gain)' stopOpacity={0.8} />
                      <stop offset='95%' stopColor='var(--color-gain)' stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id='fillLoss' x1='0' y1='0' x2='0' y2='1'>
                      <stop offset='5%' stopColor='var(--color-loss)' stopOpacity={0.8} />
                      <stop offset='95%' stopColor='var(--color-loss)' stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray='5 4' vertical={false} />
                  <XAxis dataKey='day' tickLine={false} axisLine={false} minTickGap={20} />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        className='w-45'
                        labelFormatter={label => label}
                        formatter={(value, name, item, index) => {
                          // Only render once for the first item
                          if (index !== 0) return null

                          return (
                            <>
                              {/* Gain */}
                              <div className='flex w-full items-center gap-2'>
                                <div
                                  className='h-2.5 w-2.5 shrink-0 rounded-[2px]'
                                  style={{ backgroundColor: 'var(--color-gain)' }}
                                />
                                <span className='flex-1'>{followersDataConfig.gain.label}</span>
                                <span className='text-foreground font-mono font-medium tabular-nums'>
                                  {(item as Record<string, Record<string, unknown>>).payload.gain as number}
                                </span>
                              </div>
                              {/* Loss */}
                              <div className='flex w-full items-center gap-2'>
                                <div
                                  className='h-2.5 w-2.5 shrink-0 rounded-[2px]'
                                  style={{ backgroundColor: 'var(--color-loss)' }}
                                />
                                <span className='flex-1'>{followersDataConfig.loss.label}</span>
                                <span className='text-foreground font-mono font-medium tabular-nums'>
                                  {(item as Record<string, Record<string, unknown>>).payload.loss as number}
                                </span>
                              </div>
                            </>
                          )
                        }}
                      />
                    }
                  />
                  <Area dataKey='loss' type='bump' fill='url(#fillLoss)' stroke='var(--color-loss)' stackId='a' />
                  <Area dataKey='gain' type='bump' fill='url(#fillGain)' stroke='var(--color-gain)' stackId='a' />
                </AreaChart>
              </ChartContainer>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}

export default FollowersGrowthCard
