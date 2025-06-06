import { ProcessInfo } from "./TrackedAppList"

type Props = {
  show: boolean
  processes: ProcessInfo[]
  selectedName: string
  setSelectedName: (name: string) => void
  onAdd: () => void
  onClose: () => void
  modalRef: React.RefObject<HTMLDivElement>
}

const AddAppModal: React.FC<Props> = ({
  show,
  processes,
  selectedName,
  setSelectedName,
  onAdd,
  onClose,
  modalRef
}) => {
  if (!show) return null
  return (
    <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-999'>
      <div ref={modalRef} className='bg-white p-6 rounded-lg w-80'>
        <h2 className='text-lg font-semibold mb-4'>
          Select an App
        </h2>
        <select
          value={selectedName}
          onChange={(e) => setSelectedName(e.currentTarget.value)}
          className='w-full border-gray-300 rounded-md mb-4 p-2'
        >
          {processes.map((proc) => (
            <option key={proc.name} value={proc.name}>
              {proc.name}
            </option>
          ))}
        </select>
        <div className='flex jusity-end space-x-2'>
          <button
            onClick={onClose}
            className='px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition cursor-pointer'
          >
            Cancel
          </button>
          <button
            onClick={onAdd}
            className='px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition cursor-pointer'
          >   
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddAppModal