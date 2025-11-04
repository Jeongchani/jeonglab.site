import LaunchGrid from '@/components/LaunchGrid'
import { LAUNCHERS } from '@/app/data/links'

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-3xl font-bold">jeonglab Hub</h1>
        <p className="opacity-80 mt-1 text-sm">
          내가 운영/학습 중인 서비스들을 한 곳에서 관리하고 바로 들어가기.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Quick Launch</h2>
        <LaunchGrid items={LAUNCHERS} />
      </section>
    </div>
  )
}
