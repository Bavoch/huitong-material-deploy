import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Correctly define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables based on NODE_ENV
const NODE_ENV = process.env.NODE_ENV || 'development';
const envFile = NODE_ENV === 'production' ? '.env.production' : '.env.development';

// Load environment-specific file first, then fallback to default .env
dotenv.config({ path: path.resolve(__dirname, `../${envFile}`) });
dotenv.config(); // Load default .env file as fallback

const prisma = new PrismaClient();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});
const upload = multer({ storage });

// Helper function to safely delete a file
const deleteFile = (filePath) => {
    if (!filePath) return;
    const fullPath = path.join(__dirname, filePath);
    if (fs.existsSync(fullPath)) {
        try {
            fs.unlinkSync(fullPath);
            console.log(`Successfully deleted file: ${fullPath}`);
        } catch (err) {
            console.error(`Error deleting file ${fullPath}:`, err);
        }
    }
};

// --- API Routes ---

// Endpoint to handle file uploads
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }
    const filePath = `/uploads/${req.file.filename}`;
    res.status(200).json({
        url: filePath,
        pathname: filePath,
        filePath: filePath,
        size: req.file.size // Add file size to the response
    });
});

// --- Model CRUD ---

// GET all models
app.get('/api/models', async (req, res) => {
    try {
        const models = await prisma.model.findMany({
            orderBy: { createdAt: 'desc' },
        });
        res.json(models);
    } catch (error) {
        console.error('Failed to fetch models:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET a single model by ID
app.get('/api/models/:id', async (req, res) => {
    const modelId = parseInt(req.params.id, 10);
    if (isNaN(modelId)) {
        return res.status(400).json({ error: 'Invalid model ID.' });
    }
    try {
        const model = await prisma.model.findUnique({ where: { id: modelId } });
        if (!model) {
            return res.status(404).json({ error: 'Model not found' });
        }
        res.json(model);
    } catch (error) {
        console.error(`Failed to fetch model with id: ${req.params.id}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST a new model
app.post('/api/models', async (req, res) => {
    const { name, filePath, thumbnailPath, size } = req.body;
    if (!name || !filePath) {
        return res.status(400).json({ error: 'Name and filePath are required.' });
    }
    try {
        const fileType = path.extname(filePath).slice(1).toUpperCase();
        const newModel = await prisma.model.create({
            data: {
                name,
                filePath,
                thumbnailPath: thumbnailPath || null,
                size: size ? String(size) : null, // Save size as a string
                fileType, // Save the file type
            },
        });
        res.status(201).json(newModel);
    } catch (error) {
        console.error('Failed to create model record:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT to update a model
app.put('/api/models/:id', async (req, res) => {
    const modelId = parseInt(req.params.id, 10);
    if (isNaN(modelId)) {
        return res.status(400).json({ error: 'Invalid model ID.' });
    }
    const { name, filePath, thumbnailPath, size } = req.body;

    const dataToUpdate = {};

    if (name !== undefined) dataToUpdate.name = name;
    if (thumbnailPath !== undefined) dataToUpdate.thumbnailPath = thumbnailPath;
    if (size !== undefined) dataToUpdate.size = String(size);

    if (filePath) {
        dataToUpdate.filePath = filePath;
        dataToUpdate.fileType = path.extname(filePath).slice(1).toUpperCase();
    }

    if (Object.keys(dataToUpdate).length === 0) {
        return res.status(400).json({ error: 'No update data provided.' });
    }

    try {
        const updatedModel = await prisma.model.update({
            where: { id: modelId },
            data: dataToUpdate,
        });
        res.json(updatedModel);
    } catch (error) {
        console.error(`Failed to update model ${modelId}:`, error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Model not found' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE a model
app.delete('/api/models/:id', async (req, res) => {
    const modelId = parseInt(req.params.id, 10);
    if (isNaN(modelId)) {
        return res.status(400).json({ error: 'Invalid model ID.' });
    }
    try {
        const model = await prisma.model.findUnique({ where: { id: modelId } });
        if (model) {
            deleteFile(model.filePath);
            deleteFile(model.thumbnailPath);
        }
        await prisma.model.delete({ where: { id: modelId } });
        res.status(204).send();
    } catch (error) {
        console.error(`Failed to delete model ${req.params.id}:`, error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Model not found' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Material CRUD ---

// GET all materials
app.get('/api/materials', async (req, res) => {
    try {
        const materials = await prisma.material.findMany({
            orderBy: { createdAt: 'desc' },
        });
        res.json(materials);
    } catch (error) {
        console.error('Failed to fetch materials:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET all materials for a specific model
app.get('/api/models/:model_id/materials', async (req, res) => {
    const modelId = parseInt(req.params.model_id, 10);
    if (isNaN(modelId)) {
        return res.status(400).json({ error: 'Invalid model ID.' });
    }
    try {
        const materials = await prisma.material.findMany({
            where: { modelId: modelId },
            orderBy: { createdAt: 'desc' },
        });
        res.json(materials);
    } catch (error) {
        console.error(`Failed to fetch materials for model ${modelId}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST a new material
app.post('/api/materials', async (req, res) => {
    const { model_id, name, data, thumbnailPath } = req.body;
    const modelId = parseInt(model_id, 10);

    if (!modelId || !name) {
        return res.status(400).json({ error: 'model_id and name are required.' });
    }
    if (isNaN(modelId)) {
        return res.status(400).json({ error: 'Invalid model_id.' });
    }

    try {
        const newMaterial = await prisma.material.create({
            data: {
                modelId: modelId,
                name: name,
                data: data || {},
                thumbnailPath: thumbnailPath || null,
            },
        });
        res.status(201).json(newMaterial);
    } catch (error) {
        console.error('Failed to add material:', error);
        res.status(500).json({ error: 'Failed to add material.', details: error.message });
    }
});

// DELETE a material
app.delete('/api/materials/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const material = await prisma.material.findUnique({ where: { id: id } });
        if (material) {
            deleteFile(material.thumbnailPath);
        }
        await prisma.material.delete({ where: { id: id } });
        res.status(204).send();
    } catch (error) {
        console.error(`Failed to delete material ${id}:`, error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Material not found' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// --- Server Start ---

export default app;

// 始终启动服务器（移除Vercel检查）
const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
    console.log(`🚀 Backend server is running on http://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️  Database: ${process.env.POSTGRES_PRISMA_URL ? 'Connected' : 'Not configured'}`);
});

process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Process terminated');
        process.exit(0);
    });
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use.`);
        process.exit(1);
    } else {
        console.error('❌ Server error:', err);
        process.exit(1);
    }
});