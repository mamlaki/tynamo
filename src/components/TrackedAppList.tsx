import { useEffect, useState, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import TrackedAppRow from './TrackedAppRow'

type ProcessInfo = {
  pid: number
  name: string
  exe_path: string
}

export type TrackedApp = {
  id: number
  name: string
  icon: string | null
  display_name?: string | null
}

type AppUsage = {
  name: string
  total_seconds: number
  paused: boolean
}

// Format time for ui utility
const formatTime = (secs: number): string => {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const timeStringToSeconds = (timeStr: string): number => {
  const parts = timeStr.split(':').map(p => parseInt(p, 10))
  if (parts.length !== 3 || parts.some(isNaN)) return 0
  const [h, m, s] = parts
  return h * 3600 + m * 60 + s 
}

export default function TrackedAppList() {
  const [apps, setApps] = useState<TrackedApp[]>([])
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [pausedApps, setPausedApps] = useState<Record<string, boolean>>({});

  const [showModal, setShowModal] = useState(false)
  const [modalProcesses, setModalProcesses] = useState<ProcessInfo[]>([])
  const [selectedName, setSelectedName] = useState<string>('')
  const [appToDelete, setAppToDelete] = useState<TrackedApp | null>(null)
  const [appToEdit, setAppToEdit] = useState<TrackedApp | null> (null)
  const [editDisplayName, setEditDisplayName] = useState<string>('')
  const [editTimeValue, setEditTimeValue] = useState<string>('')
  const [runningApps, setRunningApps] = useState<string[]>([])

  const dbSyncInterval = useRef<number>()
  const runningAppsInterval = useRef<number>()
  const addModalRef = useRef<HTMLDivElement>(null)
  const deleteModalRef = useRef<HTMLDivElement>(null)
  const editModalRef = useRef<HTMLDivElement>(null)

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
      const pausedLookup: Record<string, boolean> = {}
      result.forEach((u) => {
        lookup[u.name] = u.total_seconds
        pausedLookup[u.name] = u.paused
      })
      setUsage(lookup)
      setPausedApps(pausedLookup)
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
        setAppToEdit(null)
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

      // Edit App Modal
      if (editModalRef.current && !editModalRef.current.contains(e.target as Node)) {
        setAppToEdit(null)
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

  // Edit app handler
  const handleEdit = (app: TrackedApp) => {
    setAppToEdit(app)
    const currentUsage = usage[app.name]
    setEditTimeValue(formatTime(currentUsage))
    setEditDisplayName(app.display_name || '')
  }

  // Save edit app handler
  const handleSaveEdit = async () => {
    if (!appToEdit) return

    const newSeconds = timeStringToSeconds(editTimeValue)
    // future Melek do not forget to add invalid format handling

    try {
      await invoke('update_app', { name: appToEdit.name, totalSeconds: newSeconds })
      await invoke('update_display_name', { name: appToEdit.name, displayName: editDisplayName })
      setAppToEdit(null)
      await loadApps()
      await loadUsage()
    } catch(error) {
      console.error('Failed to update app time: ', error)
    }
  }

  // Reset app usage time handler
  const handleReset = () => {
    setEditTimeValue('00:00:00')
  }

  // Pause time handler
  const handlePause = async (app: TrackedApp) => {
    try {
      const newPausedState = await invoke<boolean>('pause_app', { name: app.name })
      setPausedApps(prev => ({ ...prev, [app.name]: newPausedState}))
    } catch (error) {
      console.error('Failed to toggle pause: ', error)
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
          className='px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition cursor-pointer'
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
          <TrackedAppRow 
            key={app.id}
            app ={app}
            usage={usage[app.name]}
            paused={pausedApps[app.name]}
            running={runningApps.includes(app.name)}
            onPause={handlePause}
            onEdit={handleEdit}
            onDelete={setAppToDelete}
            formatTime={formatTime}
          />
        ))  
      )}

      {/* ADD APP MODAL */}
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
                className='px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition cursor-pointer'
              >
                Cancel
              </button>
              <button
                onClick={handleModalAdd}
                className='px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition cursor-pointer'
              >   
                Add
              </button>
            </div>
          </div>
        </div>
      )}


      {/* EDIT MODAL */}
      {appToEdit && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-999'>
          <div ref={editModalRef} className='bg-white p-6 rounded-lg w-96 shadow-lg'>
            <h2 className='text-lg font-semibold mb-2'>
              Edit '{appToEdit.name}'
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
                placeholder={appToEdit.name}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>
            <div className='flex items-center space-x-3'>
              <button
                onClick={handleReset}
                className='px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition cursor-pointer'
              > 
                Reset Time
              </button>
              <button
                onClick={() => setAppToEdit(null)}
                className='px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition cursor-pointer'
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className='px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition cursor-pointer'
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}


      {/* DELETE MODAL */}
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
                className='px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition cursor-pointer'
              >
                No
              </button>
              <button
                onClick={() => handleRemove(true)}
                className='px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition cursor-pointer'
              >
                Yes
              </button>
              <button
                onClick={() => setAppToDelete(null)}
                className='px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition cursor-pointer'
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