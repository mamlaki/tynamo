import TrackedAppList from './components/TrackedAppList';

function App() {
  return (
    <div className='flex flex-col items-center justify-center min-h-screen p-8'>
      <header className='max-w-3xl mb-8'>
        <h1 className='text-3xl text-center font-bold mb-2'>Tynamo</h1>
        <p className='text-gray-600'>
          Track how much time you've spent in your apps!
        </p>
      </header>
      <main className='max-w-3xl w-full'>
        <TrackedAppList />
      </main>
    </div>
  )
}

export default App;
