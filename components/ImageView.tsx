
import React, { useState, useCallback, useRef } from 'react';
import { generateImages, editImage } from '../services/geminiService';
import { Spinner } from './ui/Spinner';

type ImageObject = {
    data: string;
    mimeType: string;
};

const ImageView: React.FC = () => {
    const [prompt, setPrompt] = useState('A photorealistic image of a cat wearing a tiny wizard hat, sitting on a pile of ancient books.');
    const [images, setImages] = useState<ImageObject[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- State for the editing modal ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingState, setEditingState] = useState<{
        index: number;
        originalImage: ImageObject | null;
        prompt: string;
        editedImage: ImageObject | null;
        isLoading: boolean;
        error: string | null;
    }>({
        index: -1,
        originalImage: null,
        prompt: 'Add a small, friendly robot companion next to the cat.',
        editedImage: null,
        isLoading: false,
        error: null,
    });

    const handleGenerate = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim() || isLoading) return;

        setIsLoading(true);
        setError(null);
        setImages([]);

        try {
            const generated = await generateImages(prompt);
            setImages(generated.map(imgData => ({ data: imgData, mimeType: 'image/jpeg' })));
        } catch (err) {
            console.error(err);
            let errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            if (errorMessage.includes("billed users") || errorMessage.includes("API key not valid")) {
                errorMessage = "The Image Generation API is not available for this API key. This may be a billing issue or an invalid key. Please check your Google AI Studio account.";
            }
            setError(`Failed to generate images: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    }, [prompt, isLoading]);

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
            prompt: 'Make the wizard hat blue.',
            editedImage: null,
            isLoading: false,
            error: null,
        });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => setIsModalOpen(false);

    const handleStartEdit = async () => {
        if (!editingState.prompt.trim() || editingState.isLoading || !editingState.originalImage) return;
        setEditingState(prev => ({ ...prev, isLoading: true, error: null, editedImage: null }));
        try {
            const result = await editImage(editingState.originalImage.data, editingState.originalImage.mimeType, editingState.prompt);
            setEditingState(prev => ({ ...prev, editedImage: { data: result.image, mimeType: result.mimeType }, isLoading: false }));
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setEditingState(prev => ({ ...prev, error: `Edit failed: ${errorMessage}`, isLoading: false }));
        }
    };
    
    const handleAcceptEdit = () => {
        if (editingState.editedImage) {
            setImages(currentImages => 
                currentImages.map((img, i) => i === editingState.index ? editingState.editedImage! : img)
            );
        }
        handleCloseModal();
    };


    return (
        <div className="p-4 sm:p-6 md:p-8 h-full flex flex-col">
            <div className="text-center mb-6">
                <h2 className="text-3xl font-bold text-white">Image Generation & Editing</h2>
                <p className="text-gray-400 mt-2">Describe an image to create it, or upload your own to edit with AI.</p>
            </div>
            
            <form onSubmit={handleGenerate} className="w-full max-w-3xl mx-auto mb-6">
                <div className="flex flex-col sm:flex-row items-center gap-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., A robot holding a red skateboard"
                        disabled={isLoading}
                        className="flex-1 w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                    />
                    <button
                        type="button"
                        onClick={handleUploadClick}
                        disabled={isLoading}
                        title="Upload an image to edit"
                        className="w-full sm:w-auto px-4 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors flex justify-center items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                        <span>Upload</span>
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading || !prompt.trim()}
                        className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex justify-center items-center"
                    >
                        {isLoading ? <Spinner /> : 'Generate'}
                    </button>
                </div>
            </form>
            
            {error && (
                <div className="text-center p-4 my-4 text-sm text-red-400 bg-red-900/50 rounded-md max-w-2xl mx-auto">
                    {error}
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
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
                                <h3 className="text-lg font-semibold text-gray-300 mb-2 text-center">Edited</h3>
                                <div className="w-full aspect-square bg-gray-900 rounded-md flex justify-center items-center">
                                    {editingState.isLoading && <Spinner size="lg" />}
                                    {!editingState.isLoading && editingState.editedImage && (
                                        <img src={`data:${editingState.editedImage.mimeType};base64,${editingState.editedImage.data}`} alt="Edited result" className="w-full h-auto object-contain rounded-md"/>
                                    )}
                                    {!editingState.isLoading && !editingState.editedImage && (
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
                                    value={editingState.prompt}
                                    onChange={(e) => setEditingState(p => ({...p, prompt: e.target.value}))}
                                    placeholder="e.g., Add a red scarf"
                                    disabled={editingState.isLoading}
                                    className="flex-1 w-full p-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                                />
                                <button
                                    onClick={handleStartEdit}
                                    disabled={editingState.isLoading || !editingState.prompt.trim()}
                                    className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-600 flex items-center justify-center gap-2"
                                >
                                    {editingState.isLoading ? <Spinner /> : null}
                                    Generate Edit
                                </button>
                            </div>
                             <div className="flex justify-end gap-2">
                                <button onClick={handleCloseModal} className="px-4 py-2 bg-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-700">Close</button>
                                <button onClick={handleAcceptEdit} disabled={!editingState.editedImage} className="px-4 py-2 bg-green-600 text-sm font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-600/50">Accept & Close</button>
                             </div>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImageView;