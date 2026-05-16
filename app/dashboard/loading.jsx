export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="skeleton w-9 h-9 rounded-xl" />
            <div>
              <div className="skeleton w-24 h-5 rounded mb-1.5" />
              <div className="skeleton w-36 h-3 rounded" />
            </div>
          </div>
          <div className="skeleton w-20 h-7 rounded-lg" />
        </div>
        <div className="grid grid-cols-4 gap-3 mb-7">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton border border-[#262626] rounded-xl px-4 py-3 text-center">
              <div className="skeleton w-8 h-5 rounded mx-auto mb-1.5" />
              <div className="skeleton w-12 h-3 rounded mx-auto" />
            </div>
          ))}
        </div>
        <div className="skeleton border border-[#262626] p-1 rounded-xl mb-6 h-10" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton border border-[#262626] rounded-xl h-16" />
          ))}
        </div>
      </div>
    </div>
  )
}
