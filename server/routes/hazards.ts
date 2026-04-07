import { Router, Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { authenticateToken, requireRole } from '../middleware';
import { getHazards, getHazardById, addHazard, updateHazard, deleteHazard, getHazardImage } from '../db';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/hazards — list all hazards (authenticated)
router.get('/', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const hazards = await getHazards();
    return res.json({ hazards });
  } catch (err) {
    console.error('Error fetching hazards:', err);
    return res.status(500).json({ error: 'Failed to fetch hazards' });
  }
});

// GET /api/hazards/:id/image — serve hazard image (public)
router.get('/:id/image', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const image = await getHazardImage(id);
    if (!image) return res.status(404).json({ error: 'Image not found' });
    // Flatten PNG transparency onto white background using sharp
    try {
      const flattened = await sharp(image)
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .png()
        .toBuffer();
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=86400');
      return res.send(flattened);
    } catch {
      // Fallback: serve original image if sharp fails
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=86400');
      return res.send(image);
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch hazard image' });
  }
});

// POST /api/hazards — create hazard (admin only)
router.post('/', authenticateToken, requireRole('admin'), upload.single('image'), async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const image = req.file?.buffer;
    const hazard = await addHazard(name, image);
    return res.json(hazard);
  } catch (err) {
    console.error('Error creating hazard:', err);
    return res.status(500).json({ error: 'Failed to create hazard' });
  }
});

// PUT /api/hazards/:id — update hazard (admin only)
router.put('/:id', authenticateToken, requireRole('admin'), upload.single('image'), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const image = req.file?.buffer ?? undefined;
    const hazard = await updateHazard(id, name, image);
    if (!hazard) return res.status(404).json({ error: 'Hazard not found' });
    return res.json(hazard);
  } catch (err) {
    console.error('Error updating hazard:', err);
    return res.status(500).json({ error: 'Failed to update hazard' });
  }
});

// DELETE /api/hazards/:id — delete hazard (admin only)
router.delete('/:id', authenticateToken, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await deleteHazard(id);
    if (!deleted) return res.status(404).json({ error: 'Hazard not found' });
    return res.json({ message: 'Hazard deleted' });
  } catch (err) {
    console.error('Error deleting hazard:', err);
    return res.status(500).json({ error: 'Failed to delete hazard' });
  }
});

export default router;
