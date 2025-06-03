export type TrackedApp = {
  id: string
  name: string
  totalSeconds: number
}

type AppListProps = {
  apps: TrackedApp[]
}

export default function AppList( { apps }: AppListProps) {
  return (
    <div className='space-y-4'>
      {apps.length === 0 ? (
        <p className='text-gray-500'>No apps are being tracked.</p>
      ) : (
        apps.map((app) => (
          <div
            key={app.id}
            className='p-4 bg-gray-100 rounded-md flex justify-between items-center'
          >
            <span className="font-medium">{app.name}</span>
            <span className="font-medium">
              {Math.floor(app.totalSeconds / 3600)}h{' '}
              {Math.floor((app.totalSeconds % 3600) / 60)}m
            </span>
          </div>
        ))
      )}
    </div>
  )
}