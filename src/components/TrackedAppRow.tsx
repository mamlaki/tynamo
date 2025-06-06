import { TrackedApp } from "./TrackedAppList";

type Props = {
  app: TrackedApp
  usage: number | undefined
  paused: boolean
  running: boolean
  onPause: (app: TrackedApp) => void
  onEdit: (app: TrackedApp) => void
  onDelete: (app: TrackedApp) => void
  formatTime: (secs: number) => string
}

const TrackedAppRow: React.FC<Props> = ({
  app, usage, paused, running, onPause, onEdit, onDelete, formatTime
}) => (
  <div
  key={app.id}
  className='p-3 bg-gray-100 rounded-md flex justify-between items-center'
  > 
    <div className='flex items-center space-x-3'>
      {app.icon ? (
        <img 
          src={`data:image/png;base64,${app.icon}`} 
          alt={app.name} 
          className='w-8 h-8' 
        />
      ) : (
        <div className='w-8 h-8 bg-gray-300 rounded' />
      )}
      <span className='font-medium'>{app.display_name || app.name}</span>
      {running ? (
        <span className='px-2 py-0.5 text-xs font-semibold text-white bg-emerald-500 rounded-full'>
          Running
        </span>
      ) : (
        <span className='px-2 py-0.5 text-xs font-semi-bold text-white bg-gray-400 rounded-full'>
          Stopped
        </span>
      )}
      {paused && (
        <span className='px-2 py-0.5 text-xs font-semi-bold text-white bg-yellow-400 rounded-full'>
          Paused
        </span>
      )}
    </div>
    <div className='flex items-center space-x-3'> 

      {/* USAGE TIME */}
      {usage !== undefined && (
        <span className='ml-2 text-sm text-blue-500'>
          {formatTime(usage)}
        </span>
      )}

      {/* PAUSE TOGGLE BUTTON */}
      <button
        onClick={() => onPause(app)}
        className={`px-3 py-1 text-white rounded-md transition text-xs cursor-pointer ${
          paused 
          ? 'bg-blue-500 hover:bg-blue-600' 
          : 'bg-yellow-500 hover:bg-yellow-600'
        }`}
      > 
        {paused ? 'Resume' : 'Pause'}
      </button>

      {/* EDIT BUTTON */}
      <button
        onClick={() => onEdit(app)}
        className='px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition text-xs cursor-pointer'
      > 
        Edit
      </button>

      {/* DELETE BUTTON */}
      <button
        onClick={() => onDelete(app)}  
        className='px-3 py-1 bg-rose-500 text-white rounded-md hover:bg-rose-600 transition text-xs cursor-pointer'
      > 
        Remove
      </button>  
    </div>
  </div>
)

export default TrackedAppRow