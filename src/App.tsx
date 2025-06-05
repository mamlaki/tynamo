import TrackedAppList from './components/TrackedAppList';

function App() {
  return (
    <div className='min-h-screen bg-white p-8'>
      <header className='max-w-4xl mx-auto mb-8'>
        <h1 className='text-3xl font-bold mb-2'>Tynamo</h1>
        <p className='text-gray-600'>
          Track how much time you've spent in your apps!
        </p>
      </header>
      <main className='max-w-4xl mx-auto'>
        <TrackedAppList />
      </main>
    </div>
  )
}

export default App;
