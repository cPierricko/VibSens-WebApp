import { Activity, Settings, BarChart2 } from 'lucide-react';

import logo from '../assets/logo.png';

interface SidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
    const menuItems = [
        { id: 'analysis', icon: Activity, label: 'Analysis' },
        { id: 'settings', icon: Settings, label: 'Settings' },
    ];

    return (
        <aside className="w-64 h-full glass-panel border-r border-white/10 flex flex-col z-20 relative transition-all duration-300">
            <div className="p-6 flex items-center justify-center border-b border-white/5 bg-white/5">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary blur-lg opacity-40 animate-pulse"></div>
                        <img src={logo} alt="VibeSens Logo" className="w-10 h-10 relative z-10 object-contain" />
                    </div>
                    <span className="font-bold text-lg tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                        VibeSens
                    </span>
                </div>
            </div>

            <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto">
                <div className="px-3 mb-2 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Analytics
                </div>
                {menuItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${isActive
                                ? 'bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                                : 'text-text-secondary hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {isActive && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full shadow-[0_0_10px_var(--color-primary)]"></div>
                            )}
                            <item.icon
                                size={20}
                                className={`transition-transform duration-300 ${isActive ? 'scale-110 drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]' : 'group-hover:scale-110'
                                    }`}
                            />
                            <span className="font-medium">{item.label}</span>

                            {/* Hover Glow Effect */}
                            <div className={`absolute inset-0 rounded-xl bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 transition-opacity duration-500 ${!isActive && 'group-hover:opacity-100'}`} />
                        </button>
                    );
                })}
            </nav>
        </aside>
    );
}
