// State
let currentFile = null;
let resultUrl = null;

// Elements
const bgImage = document.getElementById('bgImage');
const mainContent = document.getElementById('mainContent');
const fileInput = document.getElementById('fileInput');
const uploadSection = document.getElementById('uploadSection');
const previewSection = document.getElementById('previewSection');
const resultSection = document.getElementById('resultSection');
const loadingSection = document.getElementById('loadingSection');
const previewImage = document.getElementById('previewImage');
const beforeImage = document.getElementById('beforeImage');
const afterImage = document.getElementById('afterImage');
const removeBtn = document.getElementById('removeBtn');
const resetBtn = document.getElementById('resetBtn');
const downloadBtn = document.getElementById('downloadBtn');

// Wait for background to load before showing content
bgImage.onload = () => {
    mainContent.classList.add('fade-in');
};

// If image already cached/loaded
if (bgImage.complete) {
    mainContent.classList.add('fade-in');
}

// File input handler
fileInput.addEventListener('change', handleFileSelect);

// Upload area drag and drop
const uploadArea = document.querySelector('.upload-area');
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'rgba(255, 182, 193, 0.8)';
    uploadArea.style.background = 'rgba(255, 255, 255, 0.08)';
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = 'rgba(255, 182, 193, 0.5)';
    uploadArea.style.background = 'rgba(255, 255, 255, 0.05)';
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'rgba(255, 182, 193, 0.5)';
    uploadArea.style.background = 'rgba(255, 255, 255, 0.05)';
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
        handleFile(files[0]);
    }
});

// Button handlers
removeBtn.addEventListener('click', removeWatermark);
resetBtn.addEventListener('click', reset);
downloadBtn.addEventListener('click', downloadImage);

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        handleFile(file);
    }
}

function handleFile(file) {
    // Check file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
        alert('File terlalu besar! Maksimal 10MB');
        return;
    }

    currentFile = file;
    const reader = new FileReader();
    
    reader.onload = (e) => {
        previewImage.src = e.target.result;
        previewImage.style.opacity = '0';
        
        // Fade in image
        setTimeout(() => {
            previewImage.style.transition = 'opacity 0.5s ease-in';
            previewImage.style.opacity = '1';
        }, 50);
        
        uploadSection.classList.add('hidden');
        previewSection.classList.remove('hidden');
        resultSection.classList.add('hidden');
    };
    
    reader.readAsDataURL(file);
}

async function removeWatermark() {
    if (!currentFile) return;
    
    removeBtn.disabled = true;
    previewSection.classList.add('hidden');
    loadingSection.classList.remove('hidden');
    
    try {
        const formData = new FormData();
        formData.append('image', currentFile);
        
        const response = await fetch('/api/remove', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success && data.resultUrl) {
            resultUrl = data.resultUrl;
            
            // Set before image
            beforeImage.src = URL.createObjectURL(currentFile);
            beforeImage.style.opacity = '0';
            
            // Download result image to avoid CORS
            const downloadResponse = await fetch('/api/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url: resultUrl })
            });
            
            const blob = await downloadResponse.blob();
            const imageUrl = URL.createObjectURL(blob);
            
            afterImage.src = imageUrl;
            afterImage.style.opacity = '0';
            
            // Fade in images
            setTimeout(() => {
                beforeImage.style.transition = 'opacity 0.5s ease-in';
                beforeImage.style.opacity = '1';
                
                setTimeout(() => {
                    afterImage.style.transition = 'opacity 0.5s ease-in';
                    afterImage.style.opacity = '1';
                }, 200);
            }, 50);
            
            loadingSection.classList.add('hidden');
            resultSection.classList.remove('hidden');
        } else {
            throw new Error(data.error || 'Gagal memproses gambar');
        }
    } catch (error) {
        console.error('Error:', error);
        alert(`Error: ${error.message}\n\nSilakan coba lagi.`);
        loadingSection.classList.add('hidden');
        previewSection.classList.remove('hidden');
    } finally {
        removeBtn.disabled = false;
    }
}

function reset() {
    currentFile = null;
    resultUrl = null;
    fileInput.value = '';
    
    uploadSection.classList.remove('hidden');
    previewSection.classList.add('hidden');
    resultSection.classList.add('hidden');
    loadingSection.classList.add('hidden');
    
    // Clear images
    previewImage.src = '';
    beforeImage.src = '';
    afterImage.src = '';
}

async function downloadImage() {
    if (!afterImage.src) return;
    
    try {
        downloadBtn.disabled = true;
        
        // Get the blob from the image
        const response = await fetch(afterImage.src);
        const blob = await response.blob();
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `watermark-removed-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Download error:', error);
        alert('Gagal mendownload gambar');
    } finally {
        downloadBtn.disabled = false;
    }
}