import dynamic from 'next/dynamic'
const BuildRoomClient = dynamic(() => import('./BuildRoomClient'), { ssr: false })
export default function BuildRoomPage({ params }) {
  return <BuildRoomClient projectId={params.projectId} />
}
