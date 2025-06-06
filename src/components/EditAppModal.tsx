import { TrackedApp } from "./TrackedAppList";

type Props = {
  show: boolean
  app: TrackedApp | null
  editTimeValue: string
  setEditTimeValue: (val: string) => void
  editDisplayName: string
  setEditDisplayName: (val: string) => void
  onReset: () => void
  onCancel: () => void
  onSave: () => void
  modalRef: React.RefObject<HTMLDivElement>
}

const EditAppModal: React.FC<Props> = ({
  show,
  app,
  editTimeValue,
  editDisplayName,
  setEditTimeValue,
  setEditDisplayName,
  onReset,
  onCancel,
  onSave,
  modalRef
}) => {
  if (!show || !app) return null
  return (
    <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-999'>
      <div ref={modalRef} className='bg-white p-6 rounded-lg w-96 shadow-lg'>
        <h2 className='text-lg font-semibold mb-2'>
          Edit '{app.name}'
        </h2>
        <div className='mb-6'>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Time (hh:mm:ss):
          </label>
          <input 
            type="text" 
            value={editTimeValue}
            onChange={(e) => setEditTimeValue(e.target.value)}
            placeholder='00:00:00'
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
          <p className='text-xs text-gray-500 mt-1'>
            (e.g., 01:30:15 for 1 hour, 30 minutes, 15 seconds)
          </p>
        </div>
        <div className="mb-4">
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Edit Display Name:
          </label>
          <input 
            type="text" 
            value={editDisplayName}
            onChange={(e) => setEditDisplayName(e.target.value)}
            placeholder={app.name}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        </div>
        <div className='flex items-center space-x-3'>
          <button
            onClick={onReset}
            className='px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition cursor-pointer'
          > 
            Reset Time
          </button>
          <button
            onClick={onCancel}
            className='px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition cursor-pointer'
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className='px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition cursor-pointer'
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default EditAppModal