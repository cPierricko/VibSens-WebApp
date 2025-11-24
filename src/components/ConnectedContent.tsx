import { UnifiedAnalyzer } from './UnifiedAnalyzer';
import { Settings } from './Settings';

interface ConnectedContentProps {
    activeTab: string;
}

export function ConnectedContent({ activeTab }: ConnectedContentProps) {
    return (
        <main className="flex-1 p-6 overflow-y-auto h-[calc(100vh-64px)]">
            <div className="max-w-7xl mx-auto h-full">
                {activeTab === 'analysis' && <UnifiedAnalyzer />}
                {activeTab === 'settings' && <Settings />}
            </div>
        </main>
    );
}
