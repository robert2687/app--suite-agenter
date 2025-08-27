import React, { useState, useCallback, useRef } from 'react';
import { generateImages, editImage, generateVideo, VIDEO_GENERATION_STEPS } from '../services/geminiService';
import { Spinner } from './ui/Spinner';

type ImageObject = {
    data: string;
    mimeType: string;
};

const examplePrompts = [
    'A majestic lion wearing a crown, studio lighting, photorealistic',
    'A synthwave style cityscape with neon lights and a flying car',
    'An oil painting of a bowl of fruit on a wooden table, chiaroscuro',
    'Minimalist logo for a coffee shop named "Cosmic Bean"'
];

const ProgressStepIcon: React.FC<{ status: 'current' | 'completed' | 'pending' }> = ({ status }) => {
    switch (status) {
        case 'current':
            return <Spinner size="sm" />;
        case 'completed':
            return (
                <div className="h-5 w-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
            );
        case 'pending':
            return <div className="h-5 w-5 bg-gray-600 rounded-full border-2 border-gray-500 flex-shrink-0"></div>;
    }
};

/**
 * Extracts a user-friendly error message from various error formats.
 * @param error The error object.
 * @returns A string representing the error message.
 */
function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    if (typeof error === 'object' && error !== null) {
        // Handle nested error structure like { error: { message: '...' } }
        if ('error' in error &&
            typeof (error as any).error === 'object' &&
            (error as any).error !== null &&
            'message' in (error as any).error &&
            typeof (error as any).error.message === 'string') {
            return (error as any).error.message;
        }
        // Handle simple error structure like { message: '...' }
        if ('message' in error && typeof (error as any).message === 'string') {
            return (error as any).message;
        }
    }
    return 'An unknown error occurred.';
}

const ImageView: React.FC = () => {
    const [prompt, setPrompt] = useState('A photorealistic image of a cat wearing a tiny wizard hat, sitting on a pile of ancient books.');
    const [images, setImages] = useState<ImageObject[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- State for video generation ---
    const [isVideoLoading, setIsVideoLoading] = useState(false);
    const [videoError, setVideoError] = useState<string | null>(null);
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
    const [videoProgress, setVideoProgress] = useState<{ step: number, totalSteps: number }>({ step: 0, totalSteps: 0 });

    // --- State for the editing modal ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editPrompt, setEditPrompt] = useState('');
    const [editingState, setEditingState] = useState<{
        index: number;
        originalImage: ImageObject | null;
        history: ImageObject[];
        promptHistory: string[];
        historyIndex: number;
        isLoading: boolean;
        error: string | null;
    }>({
        index: -1,
        originalImage: null,
        history: [],
        promptHistory: [],
        historyIndex: 0,
        isLoading: false,
        error: null,
    });

    const runImageGeneration = useCallback(async (generationPrompt: string) => {
        if (!generationPrompt.trim() || isLoading || isVideoLoading) return;

        setPrompt(generationPrompt);
        setIsLoading(true);
        setError(null);
        setImages([]);
        setGeneratedVideoUrl(null);

        try {
            const generated = await generateImages(generationPrompt);
            setImages(generated.map(imgData => ({ data: imgData, mimeType: 'image/jpeg' })));
        } catch (err) {
            console.error(err);
            let errorMessage = getErrorMessage(err);

            if (errorMessage.includes("billed users") || errorMessage.includes("API key not valid")) {
                errorMessage = "The Image Generation API is only available for API keys associated with a billed Google Cloud project. Please ensure your API key is valid and billing is enabled for your project.";
            }
            setError(`Failed to generate images: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, isVideoLoading]);

    const handleGenerate = (e: React.FormEvent) => {
        e.preventDefault();
        runImageGeneration(prompt);
    };

    const handleGenerateVideo = useCallback(async () => {
        if (!prompt.trim() || isVideoLoading || isLoading) return;

        setIsVideoLoading(true);
        setVideoError(null);
        setGeneratedVideoUrl(null);
        setImages([]); // Clear images to show video UI
        setVideoProgress({ step: 0, totalSteps: VIDEO_GENERATION_STEPS.length });

        try {
            const url = await generateVideo(prompt, (update) => {
                setVideoProgress(update);
            });
            setGeneratedVideoUrl(url);
        } catch (err) {
            console.error(err);
            let errorMessage = getErrorMessage(err);

            if (errorMessage.includes("billed users") || errorMessage.includes("API key not valid")) {
                 errorMessage = "The Video Generation API is only available for API keys associated with a billed Google Cloud project. Please ensure your API key is valid and billing is enabled for your project.";
            }

            setVideoError(`Failed to generate video: ${errorMessage}`);
        } finally {
            setIsVideoLoading(false);
            setVideoProgress({ step: 0, totalSteps: 0 });
        }
    }, [prompt, isVideoLoading, isLoading]);

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setError('Please upload a valid image file.');
            return;
        }
        
        setGeneratedVideoUrl(null);

        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            const [, base64Data] = result.split(',');
            if (base64Data) {
                setImages(prev => [...prev, { data: base64Data, mimeType: file.type }]);
                setError(null);
            }
        };
        reader.onerror = () => {
            setError('Failed to read the image file.');
        };
        reader.readAsDataURL(file);
        event.target.value = ''; // Allow uploading the same file again
    };


    // --- Handlers for editing logic ---
    const handleOpenModal = (index: number, image: ImageObject) => {
        setEditingState({
            index,
            originalImage: image,
            history: [image],
            promptHistory: [],
            historyIndex: 0,
            isLoading: false,
            error: null,
        });
        setEditPrompt('Make the wizard hat blue.');
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        if (editingState.historyIndex > 0) {
            if (window.confirm('You have unsaved changes. Are you sure you want to discard them?')) {
                setIsModalOpen(false);
            }
        } else {
            setIsModalOpen(false);
        }
    };

    const handleStartEdit = async () => {
        if (!editPrompt.trim() || editingState.isLoading || !editingState.originalImage) return;

        const currentImage = editingState.history[editingState.historyIndex];
        if (!currentImage) return;

        setEditingState(prev => ({ ...prev, isLoading: true, error: null }));
        try {
            const result = await editImage(currentImage.data, currentImage.mimeType, editPrompt);
            const newImage = { data: result.image, mimeType: result.mimeType };

            setEditingState(prev => {
                const newHistory = prev.history.slice(0, prev.historyIndex + 1);
                const newPromptHistory = prev.promptHistory.slice(0, prev.historyIndex);

                return {
                    ...prev,
                    history: [...newHistory, newImage],
                    promptHistory: [...newPromptHistory, editPrompt],
                    historyIndex: newHistory.length,
                    isLoading: false,
                };
            });
            setEditPrompt('Add some glowing runes to the books.'); // Suggest next prompt
        } catch (err) {
            console.error(err);
            let errorMessage = getErrorMessage(err);

            if (errorMessage.includes("billed users") || errorMessage.includes("API key not valid")) {
                 errorMessage = "The Image Editing API is only available for API keys associated with a billed Google Cloud project. Please ensure your API key is valid and billing is enabled.";
            }

            setEditingState(prev => ({ ...prev, error: `Edit failed: ${errorMessage}`, isLoading: false }));
        }
    };
    
    const handleAcceptEdit = () => {
        const currentImage = editingState.history[editingState.historyIndex];
        if (currentImage) {
            setImages(currentImages => 
                currentImages.map((img, i) => i === editingState.index ? currentImage : img)
            );
        }
        setIsModalOpen(false); // Directly close without confirmation
    };
    
    const handleUndo = () => {
        setEditingState(prev => {
            if (prev.historyIndex <= 0) return prev;
            const newIndex = prev.historyIndex - 1;
            setEditPrompt(prev.promptHistory[newIndex]);
            return { ...prev, historyIndex: newIndex, error: null };
        });
    };
    
    const handleRedo = () => {
        setEditingState(prev => {
            if (prev.historyIndex >= prev.history.length - 1) return prev;
            const newIndex = prev.historyIndex + 1;
            setEditPrompt(prev.promptHistory[newIndex - 1]);
            return { ...prev, historyIndex: newIndex, error: null };
        });
    };
    
    const handleResetEdits = () => {
        setEditingState(prev => {
            if (!prev.originalImage) return prev;
            return {
                ...prev,
                history: [prev.originalImage],
                promptHistory: [],
                historyIndex: 0,
                error: null,
            };
        });
        setEditPrompt('Make the wizard hat blue.');
    };


    return (
        <div className="p-4 sm:p-6 md:p-8 h-full flex flex-col">
            <div className="text-center mb-6">
                <h2 className="text-3xl font-bold text-white">Image & Video Generation</h2>
                <p className="text-gray-400 mt-2">Describe a scene to create an image or video, or upload your own image to edit with AI.</p>
            </div>
            
            <form onSubmit={handleGenerate} className="w-full max-w-4xl mx-auto mb-6">
                <div className="flex flex-col sm:flex-row items-center gap-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., A robot holding a red skateboard"
                        disabled={isLoading || isVideoLoading}
                        className="flex-1 w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                    />
                    <div className="flex w-full sm:w-auto items-center gap-2">
                        <button
                            type="button"
                            onClick={handleUploadClick}
                            disabled={isLoading || isVideoLoading}
                            title="Upload an image to edit"
                            className="flex-1 sm:flex-none px-4 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors flex justify-center items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || isVideoLoading || !prompt.trim()}
                            className="flex-1 sm:flex-none px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex justify-center items-center"
                        >
                            {isLoading ? <Spinner /> : 'Generate Images'}
                        </button>
                        <button
                            type="button"
                            onClick={handleGenerateVideo}
                            disabled={isVideoLoading || isLoading || !prompt.trim()}
                            className="flex-1 sm:flex-none px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex justify-center items-center"
                        >
                            {isVideoLoading ? <Spinner /> : 'Generate Video'}
                        </button>
                    </div>
                </div>
            </form>

            <div className="w-full max-w-4xl mx-auto mb-6">
                <h3 className="text-center text-lg font-semibold text-gray-300 mb-4">Or try an example prompt</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {examplePrompts.map((p, i) => (
                        <button
                            key={i}
                            onClick={() => runImageGeneration(p)}
                            disabled={isLoading || isVideoLoading}
                            className="p-4 text-left text-sm bg-gray-700/60 text-gray-200 hover:bg-gray-700 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>
            
            {(error || videoError) && (
                <div className="text-center p-4 my-4 text-sm text-red-400 bg-red-900/50 rounded-md max-w-2xl mx-auto">
                    {error || videoError}
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
                {isVideoLoading && (
                     <div className="flex justify-center items-center h-full p-4">
                        <div className="text-center p-6 sm:p-8 bg-gray-800/60 rounded-xl shadow-2xl max-w-lg w-full animate-fade-in">
                           <h3 className="text-white text-2xl font-bold tracking-tight">Crafting Your Video</h3>
                           <p className="mt-2 text-gray-400">This process can take a few minutes. Please stay on this page.</p>
                           
                           <div className="w-full bg-gray-700 rounded-full h-2.5 my-6">
                               <div 
                                 className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out" 
                                 style={{ width: `${videoProgress.totalSteps > 0 ? ((videoProgress.step + 1) / videoProgress.totalSteps) * 100 : 0}%` }}
                               ></div>
                           </div>

                           <div className="text-left space-y-3 max-h-64 overflow-y-auto pr-2">
                               {VIDEO_GENERATION_STEPS.map((message, index) => {
                                   const status = index < videoProgress.step 
                                     ? 'completed' 
                                     : index === videoProgress.step 
                                       ? 'current' 
                                       : 'pending';
                                   const textClass = status === 'completed' 
                                     ? 'text-gray-500 line-through' 
                                     : status === 'current' 
                                       ? 'text-indigo-300 font-semibold' 
                                       : 'text-gray-400';

                                   return (
                                     <div key={index} className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                                       <ProgressStepIcon status={status} />
                                       <span className={`text-sm ${textClass}`}>{message}</span>
                                     </div>
                                   );
                               })}
                           </div>
                        </div>
                    </div>
                )}
                
                {!isVideoLoading && generatedVideoUrl && (
                     <div className="p-4 flex flex-col items-center">
                        <h3 className="text-2xl font-bold text-white mb-4">Generated Video</h3>
                        <video
                            controls
                            src={generatedVideoUrl}
                            className="max-w-full lg:max-w-3xl rounded-lg shadow-lg bg-black"
                        >
                            Your browser does not support the video tag.
                        </video>
                        <button 
                            onClick={() => setGeneratedVideoUrl(null)}
                            className="mt-4 px-6 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition-colors"
                        >
                            Clear Video & Go Back
                        </button>
                    </div>
                )}
                
                {!isVideoLoading && !generatedVideoUrl && (
                    <>
                        {isLoading && images.length === 0 && (
                            <div className="flex justify-center items-center h-full">
                                <div className="text-center">
                                   <Spinner size="lg"/>
                                   <p className="mt-4 text-gray-400">Generating your masterpiece... this may take a moment.</p>
                                </div>
                            </div>
                        )}
                        
                        {!isLoading && images.length === 0 && (
                            <div className="flex justify-center items-center h-full">
                                <div className="text-center text-gray-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <p className="mt-4">Your generated or uploaded images will appear here.</p>
                                     <p className="mt-2 text-sm">Use the controls above to start.</p>
                                </div>
                            </div>
                        )}

                        {images.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
                                {images.map((image, index) => (
                                    <div 
                                        key={index} 
                                        className="aspect-square bg-gray-800 rounded-lg overflow-hidden shadow-lg transform hover:scale-105 transition-transform duration-300 cursor-pointer group relative"
                                        onClick={() => handleOpenModal(index, image)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => e.key === 'Enter' && handleOpenModal(index, image)}
                                    >
                                        <img
                                            src={`data:${image.mimeType};base64,${image.data}`}
                                            alt={`Generated or uploaded image ${index + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center">
                                            <p className="text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity">Edit</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
            
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="edit-image-title">
                    <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                        <header className="p-4 border-b border-gray-700 flex justify-between items-center">
                            <h2 id="edit-image-title" className="text-xl font-bold text-white">Edit Image</h2>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-white">&times;</button>
                        </header>

                        <main className="p-4 flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                           {/* Original Image */}
                           <div>
                                <h3 className="text-lg font-semibold text-gray-300 mb-2 text-center">Original</h3>
                                {editingState.originalImage && <img src={`data:${editingState.originalImage.mimeType};base64,${editingState.originalImage.data}`} alt="Original for editing" className="w-full h-auto object-contain rounded-md aspect-square bg-gray-900"/>}
                           </div>
                           {/* Edited Image */}
                           <div className="flex flex-col justify-center items-center">
                                <h3 className="text-lg font-semibold text-gray-300 mb-2 text-center">
                                    Edited {editingState.historyIndex > 0 ? `(Step ${editingState.historyIndex})` : ''}
                                </h3>
                                <div className="w-full aspect-square bg-gray-900 rounded-md flex justify-center items-center">
                                    {editingState.isLoading && <Spinner size="lg" />}
                                    {!editingState.isLoading && editingState.history[editingState.historyIndex] && (
                                        <img src={`data:${editingState.history[editingState.historyIndex].mimeType};base64,${editingState.history[editingState.historyIndex].data}`} alt="Edited result" className="w-full h-auto object-contain rounded-md"/>
                                    )}
                                    {!editingState.isLoading && !editingState.history[editingState.historyIndex] && (
                                        <p className="text-gray-500">Your edit will appear here.</p>
                                    )}
                                </div>
                           </div>
                        </main>

                        <footer className="p-4 border-t border-gray-700 space-y-3">
                            {editingState.error && <p className="text-red-400 text-sm text-center">{editingState.error}</p>}
                            <div className="flex flex-col sm:flex-row items-center gap-2">
                                <input
                                    type="text"
                                    value={editPrompt}
                                    onChange={(e) => setEditPrompt(e.target.value)}
                                    placeholder="e.g., Add a red scarf"
                                    disabled={editingState.isLoading}
                                    className="flex-1 w-full p-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                                />
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleUndo}
                                        disabled={editingState.historyIndex <= 0 || editingState.isLoading}
                                        title="Undo"
                                        className="p-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a.75.75 0 01.75.75v6.19l1.72-1.72a.75.75 0 111.06 1.06l-3 3a.75.75 0 01-1.06 0l-3-3a.75.75 0 111.06-1.06l1.72 1.72V2.75A.75.75 0 0110 2zM5.155 5.823a.75.75 0 01-1.06 0L1.11 2.838a.75.75 0 011.06-1.06L4.5 4.106l2.323-2.334a.75.75 0 011.062 1.06l-2.73 2.73zM14.845 5.823a.75.75 0 011.06 0l2.985-2.985a.75.75 0 111.06 1.06L17.5 4.106l2.333 2.323a.75.75 0 11-1.06 1.062l-2.73-2.73z" transform="rotate(90 10 10) scale(-1, 1) translate(-1, -1)"/></svg>
                                    </button>
                                    <button
                                        onClick={handleRedo}
                                        disabled={editingState.historyIndex >= editingState.history.length - 1 || editingState.isLoading}
                                        title="Redo"
                                        className="p-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                       <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a.75.75 0 01.75.75v6.19l1.72-1.72a.75.75 0 111.06 1.06l-3 3a.75.75 0 01-1.06 0l-3-3a.75.75 0 111.06-1.06l1.72 1.72V2.75A.75.75 0 0110 2zM5.155 5.823a.75.75 0 01-1.06 0L1.11 2.838a.75.75 0 011.06-1.06L4.5 4.106l2.323-2.334a.75.75 0 011.062 1.06l-2.73 2.73zM14.845 5.823a.75.75 0 011.06 0l2.985-2.985a.75.75 0 111.06 1.06L17.5 4.106l2.333 2.323a.75.75 0 11-1.06 1.062l-2.73-2.73z" transform="rotate(-90 10 10) scale(-1, 1) translate(-1, 0)"/></svg>
                                    </button>
                                    <button
                                        onClick={handleStartEdit}
                                        disabled={editingState.isLoading || !editPrompt.trim()}
                                        className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-600 flex items-center justify-center gap-2"
                                    >
                                        {editingState.isLoading ? <Spinner /> : null}
                                        Generate Edit
                                    </button>
                                </div>
                            </div>
                             <div className="flex justify-end gap-2 pt-2 mt-2 border-t border-gray-700/50">
                                <button onClick={handleCloseModal} className="px-4 py-2 bg-gray-600 text-white text-sm font-semibold rounded-lg hover:bg-gray-700 transition-colors">Cancel</button>
                                <button 
                                  onClick={handleResetEdits} 
                                  disabled={editingState.historyIndex === 0 || editingState.isLoading}
                                  className="px-4 py-2 bg-yellow-600 text-white text-sm font-semibold rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  Reset Changes
                                </button>
                                <button 
                                  onClick={handleAcceptEdit} 
                                  disabled={editingState.isLoading} 
                                  className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  Accept & Close
                                </button>
                             </div>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImageView;