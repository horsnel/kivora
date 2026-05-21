export default function HomeLoading() {
  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      {/* Hero skeleton */}
      <section className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-12 sm:pb-16 text-center">
        <div className="skeleton-3d w-40 h-7 rounded-full mx-auto mb-5" />
        <div className="skeleton-3d w-72 h-12 rounded mx-auto mb-3" />
        <div className="skeleton-3d w-56 h-12 rounded mx-auto mb-5" />
        <div className="skeleton-3d w-64 h-4 rounded mx-auto mb-8" />
        <div className="flex flex-col sm:flex-row gap-2 max-w-lg mx-auto">
          <div className="skeleton-3d flex-1 h-12 rounded-xl" />
          <div className="skeleton-3d w-28 h-12 rounded-xl" />
        </div>
        <div className="flex flex-wrap justify-center gap-2 mt-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="skeleton-3d w-20 h-7 rounded-full" />
          ))}
        </div>
      </section>
      {/* Trending skeleton */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-8 sm:pb-12">
        <div className="flex items-center gap-2 mb-3">
          <div className="skeleton-3d w-3 h-3 rounded-sm" />
          <div className="skeleton-3d w-24 h-3 rounded" />
        </div>
        <div className="space-y-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-3d rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="skeleton-3d w-4 h-3 rounded" />
                <div className="skeleton-3d flex-1 h-3 rounded" style={{ maxWidth: `${60 + i * 8}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>
      {/* Cards skeleton */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-12 sm:pb-16">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="skeleton-3d w-3 h-3 rounded-sm" />
            <div className="skeleton-3d w-28 h-3 rounded" />
          </div>
          <div className="skeleton-3d w-16 h-3 rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-3d rounded-xl p-5 h-32" />
          ))}
        </div>
      </section>
    </main>
  )
}
