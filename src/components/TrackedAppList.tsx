import { useEffect, useState, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'

type ProcessInfo = {
  pid: number
  name: string
}

export type TrackedApp = {
  id: number
  name: string
}

type AppUsage = {
  name: string;
  total_seconds: number;
}

// Format time for ui utility
const formatTime = (secs: number): string => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function TrackedAppList() {
  const [apps, setApps] = useState<TrackedApp[]>([])
  const [usage, setUsage] = useState<Record<string, number>>({});

  const [showModal, setShowModal] = useState(false)
  const [uniqueNames, setUniqueNames] = useState<string[]>([])
  const [selectedName, setSelectedName] = useState<string>('')

  const dbSyncInterval = useRef<number>()


  // Load apps
  const loadApps = async () => {
    try {
      const result = await invoke<TrackedApp[]>('get_tracked_apps')
      setApps(result)
    } catch (error) {
      console.error('Failed to load tracked apps: ', error)
    }
  }

  // Load usage data
  const loadUsage = async () => {
    try {
      const result = await invoke<AppUsage[]>('get_app_usage')
      const lookup: Record<string, number> = {}
      result.forEach((u) => {
        lookup[u.name] = u.total_seconds
      })
      setUsage(lookup)
    } catch (error) {
      console.error('Failed to load usage: ', error)
    }
  }

  useEffect(() => {
    loadApps()
    loadUsage()
    
    dbSyncInterval.current = window.setInterval(() => {
      loadUsage()
    }, 1000)
    
    return () => {
      if (dbSyncInterval.current !== undefined) {
        clearInterval(dbSyncInterval.current)
      }
    }
  }, [])

  // Add app handler
  const handleAdd = async () => {
    try {
      // Fetch running processes
      const procs = await invoke<ProcessInfo[]>('list_processes')
      // Get the unique process names (since there will probably be duplicates)
      const names = Array.from(new Set(procs.map((p) => p.name))).sort()
      setUniqueNames(names)

      if (names.length > 0) {
        setSelectedName(names[0])
      }

      setShowModal(true)

    } catch (error) {
      console.error('Failed to fetch processes: ', error)
    }
  }

  // Modal handler
  const handleModalAdd = async () => {
    if (!selectedName) return
    try {
      await invoke('add_app', { name: selectedName })
      setShowModal(false)
      await loadApps()
      await loadUsage()
    } catch (error) {
      console.error('Failed to add app: ', error)
    }
  }


  return (
    <div className='space-y-4'>
      <div className='flex justify-end'>
        <button
          onClick={handleAdd}
          className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition'
        > 
          Add App
        </button>
      </div>
      {/* App List */}
      {apps.length === 0 ? (
        <p className='text-gray-500'>You are not tracking any apps.</p>
      ) : (
        apps.map((app) => (
          <div
            key={app.id}
            className='p-3 bg-gray-100 rounded-md flex justify-between items-center'
          >
            <span className='font-medium'>{app.name}</span>
            {usage[app.name] !== undefined && (
              <span className='ml-2 text-sm text-blue-600'>
                {formatTime(usage[app.name])}
              </span>
            )}
            
          </div>
        ))
      )}

      {/* Modal */}
      {showModal && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-999'>
          <div className='bg-white p-6 rounded-lg w-80'>
            <h2 className='text-lg font-semibold mb-4'>
              Select an App
            </h2>
            <select
              value={selectedName}
              onChange={(e) => setSelectedName(e.currentTarget.value)}
              className='w-full border-gray-300 rounded-md mb-4 p-2'
            >
              {uniqueNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <div className='flex jusity-end space-x-2'>
              <button
                onClick={() => setShowModal(false)}
                className='px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition'
              >
                Cancel
              </button>
              <button
                onClick={handleModalAdd}
                className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition'
              >   
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}