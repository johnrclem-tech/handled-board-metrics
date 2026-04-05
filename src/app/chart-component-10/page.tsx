import CountrySalesCard from '@/components/shadcn-studio/blocks/chart-country-sales'

// Chart data
const countrySalesChartData = [
  { country: 'IN', sales: 20000 },
  { country: 'US', sales: 18988 },
  { country: 'CA', sales: 15473 },
  { country: 'JA', sales: 13042 },
  { country: 'AU', sales: 9933 },
  { country: 'NZ', sales: 7297 }
]

const WidgetCardPreview = () => {
  return (
    <div className='py-8 sm:py-16 lg:py-24'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-center'>
          <CountrySalesCard
            title='Sale Country'
            subTitle='until your daily purchase target'
            chartData={countrySalesChartData}
            className='w-full max-w-100'
          />
        </div>
      </div>
    </div>
  )
}

export default WidgetCardPreview
