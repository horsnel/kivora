export default function OpportunitiesLoading() {
  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="mb-8">
          <div className="skeleton-3d w-52 h-8 rounded mb-2" />
          <div className="skeleton-3d w-40 h-3 rounded" />
        </div>
        <div className="skeleton-3d rounded-xl p-5 mb-7 h-20" />
        <div className="skeleton-3d w-64 h-10 rounded-xl mb-4" />
        <div className="flex flex-wrap gap-1.5 mb-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton-3d w-20 h-7 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-3d rounded-xl h-32" />
          ))}
        </div>
      </div>
    </main>
  )
}
