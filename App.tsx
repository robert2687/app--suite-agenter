import React, { useState } from 'react';
import AgentBuilderView from './components/AgentBuilderView';
import ChatView from './components/ChatView';
import ImageView from './components/ImageView';
import DataAnalysisView from './components/DataAnalysisView';
import AgentView from './components/AgentView';
import CodeEditorView from './components/CodeEditorView';
import DigitalTwinView from './components/DigitalTwinView';

type View = 'builder' | 'chat' | 'image' | 'data' | 'agent' | 'code' | 'twin';

const TABS: { id: View, name: string, icon: JSX.Element }[] = [
    { id: 'twin', name: 'Digital Twin', icon: <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" /><path fillRule="evenodd" d="M2.046 9.315a11.332 11.332 0 015.24-4.832 1.5 1.5 0 011.82.235l1.625 1.801a4.5 4.5 0 005.53 0l1.625-1.8a1.5 1.5 0 011.82-.236c2.32.993 4.155 2.827 5.24 5.24a1.5 1.5 0 01-.236 1.82l-1.8 1.625a4.5 4.5 0 000 5.53l1.8 1.625a1.5 1.5 0 01.236 1.82c-.993 2.32-2.827 4.155-5.24 5.24a1.5 1.5 0 01-1.82-.236l-1.625-1.8a4.5 4.5 0 00-5.53 0l-1.625 1.8a1.5 1.5 0 01-1.82.236A11.332 11.332 0 012.046 14.685a1.5 1.5 0 01.236-1.82l1.8-1.625a4.5 4.5 0 000-5.53l-1.8-1.625a1.5 1.5 0 01-.236-1.82zM12 12a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /> },
    { id: 'builder', name: 'Agent Builder', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /> },
    { id: 'chat', name: 'Chat', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /> },
    { id: 'image', name: 'Image Gen', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /> },
    { id: 'data', name: 'Data Analysis', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
    { id: 'agent', name: 'Task Agent', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /> },
    { id: 'code', name: 'Code Assistant', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /> },
];

const App: React.FC = () => {
    const [activeView, setActiveView] = useState<View>('twin');

    const renderView = () => {
        switch (activeView) {
            case 'builder': return <AgentBuilderView />;
            case 'chat': return <ChatView />;
            case 'image': return <ImageView />;
            case 'data': return <DataAnalysisView />;
            case 'agent': return <AgentView />;
            case 'code': return <CodeEditorView />;
            case 'twin': return <DigitalTwinView />;
            default: return <AgentBuilderView />;
        }
    };
    
    return (
        <div className="flex h-screen bg-gray-900 text-gray-100 font-sans">
            <nav className="flex flex-col items-center w-20 bg-gray-800 border-r border-gray-700 py-4 space-y-2">
                <div className="text-indigo-400 font-bold text-lg mb-4">AI</div>
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveView(tab.id)}
                        title={tab.name}
                        className={`w-16 h-16 flex flex-col items-center justify-center rounded-lg transition-colors focus:outline-none ${
                            activeView === tab.id
                                ? 'bg-indigo-600 text-white'
                                : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                        }`}
                        aria-current={activeView === tab.id ? 'page' : undefined}
                    >
                        <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={activeView === tab.id ? "currentColor" : "none"} stroke="currentColor">
                           {tab.icon}
                        </svg>
                        <span className="text-xs mt-1">{tab.name.split(' ')[0]}</span>
                    </button>
                ))}
            </nav>
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-gray-800 shadow-md px-6 py-3 flex items-center border-b border-gray-700 z-10">
                    <h1 className="text-2xl font-bold text-white tracking-wide">
                        AI <span className="text-indigo-400">App Suite</span>
                    </h1>
                </header>
                <main className="flex-1 overflow-y-auto">
                    {renderView()}
                </main>
                <footer className="text-center p-2 bg-gray-800 border-t border-gray-700">
                    <p className="text-xs text-gray-500">Powered by Google Gemini API</p>
                </footer>
            </div>
        </div>
    );
};

export default App;
