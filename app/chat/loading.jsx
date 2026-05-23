export default function ChatLoading() {
  return (
    <main className="h-dvh flex bg-[#0a0a0a] overflow-hidden">
      {/* Main area skeleton */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b border-[#141414] px-4 py-2.5 shrink-0 flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="skeleton-3d w-6 h-6 rounded-md" />
            <div>
              <div className="skeleton-3d w-14 h-3 rounded mb-1" />
              <div className="skeleton-3d w-24 h-2 rounded" />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-behavior-contain">
          <div className="max-w-3xl mx-auto px-4 py-6">
            <div className="text-center py-10">
              <div className="skeleton-3d w-12 h-12 rounded-xl mx-auto mb-4" />
              <div className="skeleton-3d w-32 h-5 rounded mx-auto mb-2" />
              <div className="skeleton-3d w-48 h-3 rounded mx-auto mb-7" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg mx-auto">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton-3d h-12 rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-[#141414] px-4 py-3.5 shrink-0">
          <div className="max-w-3xl mx-auto flex gap-2 items-end">
            <div className="skeleton-3d flex-1 h-10 rounded-xl" />
            <div className="skeleton-3d w-10 h-10 rounded-xl" />
          </div>
        </div>
      </div>
    </main>
  )
}
