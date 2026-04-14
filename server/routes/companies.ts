import { Router, Request, Response } from 'express';
import { 
  addCompany, 
  getAllCompanies, 
  getCompanyById, 
  updateCompany, 
  deleteCompany,
  getCompanyByName,
  getCompanyLogo,
} from '../db';
import { authenticateToken, requireRole } from '../middleware';

const router = Router();

// Get all companies (accessible to logged-in users)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const companies = await getAllCompanies();
    res.json(companies);
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Get company by ID
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const company = await getCompanyById(Number(req.params.id));
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(company);
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// Get public company info (no auth required - used for company-branded login)
router.get('/:id/public', async (req: Request, res: Response) => {
  try {
    const company = await getCompanyById(Number(req.params.id));
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    // Return public-safe fields including contact details for product pages
    res.json({ id: company.id, name: company.name, phone: company.phone, email: company.email, website: company.website, address: company.address, scanAnalyticsEnabled: company.scanAnalyticsEnabled });
  } catch (error) {
    console.error('Error fetching public company info:', error);
    res.status(500).json({ error: 'Failed to fetch company info' });
  }
});

// Get company logo image (no auth required - can be accessed by public)
router.get('/:id/logo', async (req: Request, res: Response) => {
  try {
    const logoBuffer = await getCompanyLogo(Number(req.params.id));
    if (!logoBuffer || logoBuffer.length < 100) {
      return res.status(404).json({ error: 'Logo not found' });
    }
    
    // Detect content type based on buffer signature
    let contentType = 'image/png'; // default
    if (logoBuffer.length > 4) {
      const header = logoBuffer.subarray(0, 4);
      if (header[0] === 0xff && header[1] === 0xd8) contentType = 'image/jpeg';
      else if (header[0] === 0x89 && header[1] === 0x50) contentType = 'image/png';
      else if (header[0] === 0x52 && header[1] === 0x49) contentType = 'image/webp';
      else if (header.toString('utf8', 0, 4) === '<svg') contentType = 'image/svg+xml';
    }
    
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(logoBuffer);
  } catch (error) {
    console.error('Error fetching company logo:', error);
    res.status(500).json({ error: 'Failed to fetch logo' });
  }
});

// Create new company (admin only)
router.post('/', authenticateToken, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, logo, address, phone, email, website, scanAnalyticsEnabled } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    // Check if company already exists
    const existing = await getCompanyByName(name);
    if (existing) {
      return res.status(400).json({ error: 'Company with this name already exists' });
    }

    const company = await addCompany({
      name,
      logo: logo || undefined,
      address: address || undefined,
      phone: phone || undefined,
      email: email || undefined,
      website: website || undefined,
      scanAnalyticsEnabled: scanAnalyticsEnabled !== false,
    });

    res.status(201).json(company);
  } catch (error) {
    console.error('Error creating company:', error);
    res.status(500).json({ error: 'Failed to create company' });
  }
});

// Update company (admin only)
router.put('/:id', authenticateToken, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const company = await updateCompany(Number(req.params.id), req.body);
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json(company);
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

// Delete company (admin only)
router.delete('/:id', authenticateToken, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const success = await deleteCompany(Number(req.params.id));
    
    if (!success) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({ error: 'Failed to delete company' });
  }
});

export default router;
