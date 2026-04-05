import FollowersGrowthCard from '@/components/shadcn-studio/blocks/chart-followers-growth'

const ChartCardPreview = () => {
  return (
    <div className='py-8 sm:py-16 lg:py-24'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-center'>
          <FollowersGrowthCard className='md:w-full md:max-w-250' />
        </div>
      </div>
    </div>
  )
}

export default ChartCardPreview
