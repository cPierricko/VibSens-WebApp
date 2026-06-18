import { useState } from 'react';
import { BLEProvider } from './context/BLEContext';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { ConnectedContent } from './components/ConnectedContent';


import logo from './assets/logo.png';

function App() {
  const [activeTab, setActiveTab] = useState('analysis');

  return (
    <BLEProvider>
      <div className="flex h-screen bg-background text-text-primary overflow-hidden font-sans relative">
        {/* Background Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.03]">
          <img src={logo} alt="Watermark" className="w-[800px] h-[800px] object-contain grayscale" />
        </div>

        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <div className="flex-1 flex flex-col min-w-0 relative z-10">
          <TopBar />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            {/* Only show content if connected, otherwise show placeholder */}
            <ConnectedContent activeTab={activeTab} />
          </main>
        </div>
      </div>
    </BLEProvider>
  );
}

export default App;
