import { useEffect, useState, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'

type ProcessInfo = {
  pid: number
  name: string
  exe_path: string
}

export type TrackedApp = {
  id: number
  name: string
  icon: string | null
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
  const [modalProcesses, setModalProcesses] = useState<ProcessInfo[]>([])
  const [selectedName, setSelectedName] = useState<string>('')
  const [appToDelete, setAppToDelete] = useState<TrackedApp | null>(null)
  const [runningApps, setRunningApps] = useState<string[]>([])

  const dbSyncInterval = useRef<number>()
  const runningAppsInterval = useRef<number>()
  const addModalRef = useRef<HTMLDivElement>(null)
  const deleteModalRef = useRef<HTMLDivElement>(null)

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

  // Load running apps
  const loadRunningApps = async () => {
    try {
      const procs = await invoke<ProcessInfo[]>('list_processes')
      const runningNames = new Set(procs.map((p) => p.name))
      setRunningApps(Array.from(runningNames))
    } catch (error) {
      console.error('Failed to load running process: ', error)
    }
  }

  useEffect(() => {
    loadApps()
    loadUsage()
    loadRunningApps()
    
    dbSyncInterval.current = window.setInterval(() => {
      loadUsage()
    }, 1000)

    runningAppsInterval.current = window.setInterval(() => {
      loadRunningApps()
    }, 1000)
    
    return () => {
      if (dbSyncInterval.current !== undefined) {
        clearInterval(dbSyncInterval.current)
      }

      if (runningAppsInterval.current !== undefined) {
        clearInterval(runningAppsInterval.current)
      }
    }
  }, [])

  // Handle modal close
  useEffect(() => {
    // Handle key presses (escape to close modals)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowModal(false)
        setAppToDelete(null)
      }
    }

    // Handle clicking outside of modals
    const handleClickOutside = (e: MouseEvent) => {
      // Add App Modal
      if (addModalRef.current && !addModalRef.current.contains(e.target as Node)) {
        setShowModal(false)
      }

      // Delete/Remove App Modal
      if (deleteModalRef.current && !deleteModalRef.current.contains(e.target as Node)) {
        setAppToDelete(null)
      }
    } 

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Add app handler
  const handleAdd = async () => {
    try {
      // Fetch running processes
      const procs = await invoke<ProcessInfo[]>('list_processes')
      // Get the unique process names (since there will probably be duplicates)
      const processMap = new Map<string, ProcessInfo>()
      for (const p of procs) {
        if (!processMap.has(p.name)) {
          processMap.set(p.name, p)
        }
      }

      const uniqueProcs = Array.from(processMap.values()).sort((a, b) => a.name.localeCompare(b.name))
      setModalProcesses(uniqueProcs)

      if (uniqueProcs.length > 0) {
        setSelectedName(uniqueProcs[0].name)
      }

      setShowModal(true)

    } catch (error) {
      console.error('Failed to fetch processes: ', error)
    }
  }

  // Remove app handler
  const handleRemove = async (deleteUsage: boolean) => {
    if (!appToDelete) return

    try {
      await invoke('remove_app', { name: appToDelete.name, deleteUsage })
      setAppToDelete(null)
      await loadApps()
      await loadUsage()
    } catch (error) {
      console.error('Failed to remove app: ', error)
    }
  }

  // Modal handler
  const handleModalAdd = async () => {
    if (!selectedName) return
    const process = modalProcesses.find(p => p.name == selectedName)
    if (!process) return
    try {
      await invoke('add_app', { name: selectedName, exePath: process.exe_path })
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
      { apps.length > 0 && (
        <h2 className='mb-3 text-lg font-semibold text-gray-700'>Apps being tracked:</h2>
      )}
      {apps.length === 0 ? (
        <p className='text-gray-500'>You are not tracking any apps.</p>
      ) : (
        apps.map((app) => (
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
              <span className='font-medium'>{app.name}</span>
              {runningApps.includes(app.name) ? (
                <span className='px-2 py-0.5 text-xs font-semibold text-white bg-green-500 rounded-full'>
                  Running
                </span>
              ) : (
                <span className='px-2 py-0.5 text-xs font-semi-bold text-white bg-gray-400 rounded-full'>
                  Stopped
                </span>
              )}
            </div>
            {usage[app.name] !== undefined && (
              <span className='ml-2 text-sm text-blue-600'>
                {formatTime(usage[app.name])}
              </span>
            )}
            <button
              onClick={() => setAppToDelete(app)}  
              className='px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition text-xs'
            > 
              Remove
            </button>
          </div>
        ))
      )}

      {/* Add App Modal */}
      {showModal && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-999'>
          <div ref={addModalRef} className='bg-white p-6 rounded-lg w-80'>
            <h2 className='text-lg font-semibold mb-4'>
              Select an App
            </h2>
            <select
              value={selectedName}
              onChange={(e) => setSelectedName(e.currentTarget.value)}
              className='w-full border-gray-300 rounded-md mb-4 p-2'
            >
              {modalProcesses.map((proc) => (
                <option key={proc.name} value={proc.name}>
                  {proc.name}
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

      {/* Delete Modal */}
      {appToDelete && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-999'>
          <div ref={deleteModalRef} className='bg-white p-6 rounded-lg w-96 shadow-lg'>
            <h2 className='text-lg font-semibold mb-2'>
              Remove '{appToDelete.name}'
            </h2>
            <p className='mb-6 text-gray-700'>
              Do you want to delete the tracked time for {appToDelete.name} as well?
            </p>
            <div className='flex justify-end space-x-3'>
              <button
                onClick={() => handleRemove(false)}
                className='px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition'
              >
                No
              </button>
              <button
                onClick={() => handleRemove(true)}
                className='px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition'
              >
                Yes
              </button>
              <button
                onClick={() => setAppToDelete(null)}
                className='px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition'
              >
                Cancel
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}