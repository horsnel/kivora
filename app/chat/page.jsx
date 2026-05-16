'use client'
import dynamic from 'next/dynamic'

const ChatClient = dynamic(() => import('./ChatClient'), {
  loading: () => (
    <main className="h-full -mt-12 sm:-mt-14 flex bg-[#0a0a0a]">
      <aside className="hidden md:flex w-56 bg-[#0f0f0f] border-r border-[#181818] flex-col">
        <div className="h-12 sm:h-14 flex items-center px-3 border-b border-[#181818] shrink-0">
          <div className="flex items-center gap-2">
            <div className="skeleton w-6 h-6 rounded-md" />
            <div className="skeleton w-12 h-3 rounded" />
          </div>
        </div>
        <div className="p-2.5">
          <div className="skeleton h-8 rounded-lg" />
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b border-[#141414] px-4 py-2.5 shrink-0 flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="skeleton w-6 h-6 rounded-md" />
            <div>
              <div className="skeleton w-14 h-3 rounded mb-1" />
              <div className="skeleton w-24 h-2 rounded" />
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="skeleton w-12 h-12 rounded-xl mx-auto mb-4" />
            <div className="skeleton w-32 h-5 rounded mx-auto" />
          </div>
        </div>
        <div className="border-t border-[#141414] px-4 py-3.5 shrink-0">
          <div className="max-w-3xl mx-auto flex gap-2 items-end">
            <div className="skeleton flex-1 h-10 rounded-xl" />
            <div className="skeleton w-10 h-10 rounded-xl" />
          </div>
        </div>
      </div>
    </main>
  ),
})

export default function ChatPage() {
  return <ChatClient />
}
