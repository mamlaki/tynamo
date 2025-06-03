import { useState } from 'react'
import AppList, { TrackedApp } from './components/AppList'

function App() {
  // Placeholder
  const [apps, setApps] = useState<TrackedApp[]>([])

  return (
    <div className='min-h-screen bg-white p-8'>
      <header className='max-w-4xl mx-auto mb-8'>
        <h1 className='text-3xl font-bold mb-2'>Tynamo</h1>
        <p className='text-gray-600'>
          Track how much time you've spent in your apps!
        </p>
      </header>
      <main className='max-w-4xl mx-auto'>
        <div className='flex justify-end mb-4'>
          <button
            className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition'
          > 
            + Add App
          </button>
        </div>
        <AppList apps={apps} />
      </main>
    </div>
  )
}

export default App;
