export default function DevToolsLoading() {
  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="mb-8">
          <div className="skeleton w-36 h-8 rounded mb-2" />
          <div className="skeleton w-72 h-3 rounded" />
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton w-24 h-9 rounded-full" />
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton w-28 h-7 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="skeleton rounded-xl p-6 h-96" />
          <div className="skeleton rounded-xl p-6 min-h-[560px]" />
        </div>
      </div>
    </main>
  )
}
