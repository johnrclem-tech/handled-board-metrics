'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarList } from '@/components/ui/bar-list'

import { cn } from '@/lib/utils'

const weeklyTrafficChartData = [
  { name: 'Organic', value: 18500 },
  { name: 'Direct', value: 12400 },
  { name: 'Social', value: 9800 },
  { name: 'Referral', value: 7200 },
  { name: 'Paid', value: 5300 },
  { name: 'Email', value: 3100 }
]

const monthlyTrafficChartData = [
  { name: 'Organic', value: 82000 },
  { name: 'Direct', value: 54200 },
  { name: 'Social', value: 41800 },
  { name: 'Referral', value: 31500 },
  { name: 'Paid', value: 24700 },
  { name: 'Email', value: 13900 }
]

const valueFormatter = (number: number) => `${Intl.NumberFormat('us').format(number).toString()}`

const TrafficSourcesCard = ({ className }: { className?: string }) => {
  return (
    <Card className={cn('gap-4', className)}>
      <Tabs defaultValue='weekly' className='gap-6'>
        <CardHeader className='flex flex-wrap items-center justify-between border-b'>
          <span className='text-lg font-semibold'>Traffic Sources</span>

          <TabsList className='bg-muted h-9.5 max-sm:w-full'>
            <TabsTrigger value='weekly' className='px-5'>
              This Week
            </TabsTrigger>
            <TabsTrigger value='monthly' className='px-5'>
              This Month
            </TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent className='flex flex-col gap-4'>
          <TabsContent value='weekly' className='flex flex-col gap-6'>
            <BarList
              data={weeklyTrafficChartData}
              valueFormatter={valueFormatter}
              barClassName='bg-chart-4'
              barGap={8}
              barHeight={35}
            />
          </TabsContent>

          <TabsContent value='monthly' className='flex flex-col gap-6'>
            <BarList
              data={monthlyTrafficChartData}
              valueFormatter={valueFormatter}
              barClassName='bg-chart-2'
              barGap={8}
              barHeight={35}
            />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  )
}

export default TrafficSourcesCard
