import dynamic from 'next/dynamic'
const BuildPartClient = dynamic(() => import('./BuildPartClient'), { ssr: false })
export default function BuildPartPage({ params }) {
  return <BuildPartClient projectId={params.projectId} partId={params.partId} />
}
