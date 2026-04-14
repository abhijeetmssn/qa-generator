import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import { findUserByEmail, addUser, getCompanyById, updateCompanyLogo } from '../db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'qa-generator-secret-key-2026';

// Logo upload setup — Store in memory, will be saved to DB
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only image files are allowed (png, jpg, svg, webp)'));
  },
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Fetch company details
    let companyName: string | undefined = undefined;
    let companyAddress: string | undefined = undefined;
    if (user.companyId) {
      const company = await getCompanyById(user.companyId);
      if (company) {
        companyName = company.name;
        companyAddress = company.address;

        // Block non-admin users if subscription has expired
        if (user.role !== 'admin' && company.subscriptionExpiresAt) {
          const expired = new Date(company.subscriptionExpiresAt).getTime() < Date.now();
          if (expired) {
            return res.status(403).json({ error: 'Monthly subscription has expired. Please contact your administrator to renew.' });
          }
        }
      }
    }

    const token = jwt.sign(
      { uid: user.uid, email: user.email, companyName },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        uid: user.uid,
        email: user.email,
        companyName,
        companyId: user.companyId,
        companyAddress,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/signup — [DISABLED] Regular signup not allowed
router.post('/signup', async (req, res) => {
  try {
    return res.status(403).json({
      error: 'Self-registration is disabled. Contact your administrator to create an account.',
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/create-user — Admin only endpoint to create new users
router.post('/create-user', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify admin token
    const token = authHeader.split(' ')[1];
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { uid: string; email: string };
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Check if user is admin
    const adminUser = await findUserByEmail(decoded.email);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create users' });
    }

    // Create new user
    const { email, password, companyId, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Validate role
    const validRoles = ['admin', 'editor', 'viewer'];
    const assignedRole = validRoles.includes(role) ? role : 'viewer';

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // If companyId provided, validate company exists
    let finalCompanyId = companyId || undefined;
    if (finalCompanyId) {
      const company = await getCompanyById(finalCompanyId);
      if (!company) {
        return res.status(400).json({ error: `Company with ID ${finalCompanyId} does not exist` });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      uid: uuidv4(),
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      companyId: finalCompanyId,
      role: assignedRole as 'admin' | 'editor' | 'viewer',
    };

    await addUser(newUser);

    // Fetch company details for response
    let companyName: string | undefined = undefined;
    let companyAddress: string | undefined = undefined;
    if (finalCompanyId) {
      const company = await getCompanyById(finalCompanyId);
      if (company) {
        companyName = company.name;
        companyAddress = company.address;
      }
    }

    return res.status(201).json({
      message: 'User created successfully',
      user: {
        uid: newUser.uid,
        email: newUser.email,
        companyId: finalCompanyId,
        companyName,
        companyAddress,
        role: newUser.role,
      },
    });
  } catch (err: any) {
    console.error('Create user error:', err.message || err);
    console.error('Stack:', err.stack);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// GET /api/auth/me — verify token and return user info
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { uid: string; email: string };
    const user = await findUserByEmail(decoded.email);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Fetch company details from company table
    let companyName: string | undefined = undefined;
    let companyAddress: string | undefined = undefined;
    if (user.companyId) {
      const company = await getCompanyById(user.companyId);
      if (company) {
        companyName = company.name;
        companyAddress = company.address;
      }
    }

    return res.json({
      user: {
        uid: user.uid,
        email: user.email,
        companyName,
        companyId: user.companyId,
        companyAddress,
        role: user.role,
      },
    });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// POST /api/auth/upload-logo — upload and store a company logo image in database
router.post('/upload-logo', logoUpload.single('logo'), async (req, res) => {
  try {
    console.log('[UPLOAD-LOGO] File received:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'NO FILE');
    console.log('[UPLOAD-LOGO] Body:', req.body);

    // Verify JWT token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[UPLOAD-LOGO] Error: No authorization token provided');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { uid: string; email: string };
    } catch {
      console.error('[UPLOAD-LOGO] Error: Invalid or expired token');
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Verify user exists and get their company
    const user = await findUserByEmail(decoded.email);
    if (!user) {
      console.error('[UPLOAD-LOGO] Error: User not found');
      return res.status(401).json({ error: 'User not found' });
    }

    if (!req.file) {
      console.error('[UPLOAD-LOGO] Error: No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Extract company ID from request body or query
    const companyId = req.body.companyId || req.query.companyId;
    console.log('[UPLOAD-LOGO] Company ID:', companyId);

    if (!companyId) {
      console.error('[UPLOAD-LOGO] Error: Company ID is required');
      return res.status(400).json({ error: 'Company ID is required' });
    }

    // Authorization check: user can only upload for their own company or if they're an admin
    const targetCompanyId = Number(companyId);
    if (user.company_id !== targetCompanyId && user.role !== 'admin') {
      console.error('[UPLOAD-LOGO] Error: User not authorized for this company');
      return res.status(403).json({ error: 'You do not have permission to upload a logo for this company' });
    }

    // Verify company exists
    const company = await getCompanyById(targetCompanyId);
    console.log('[UPLOAD-LOGO] Company exists:', !!company);

    if (!company) {
      console.error('[UPLOAD-LOGO] Error: Company not found');
      return res.status(404).json({ error: 'Company not found' });
    }

    // Store the image buffer in the database
    console.log('[UPLOAD-LOGO] Storing logo buffer... size:', req.file.buffer.length);
    const success = await updateCompanyLogo(targetCompanyId, req.file.buffer);
    console.log('[UPLOAD-LOGO] Update success:', success);

    if (!success) {
      console.error('[UPLOAD-LOGO] Error: Failed to save logo to database');
      return res.status(500).json({ error: 'Failed to save logo to database' });
    }

    console.log('[UPLOAD-LOGO] Success! Logo uploaded for company:', company.name);
    return res.json({ 
      message: 'Logo uploaded successfully',
      companyId: company.id,
      companyName: company.name,
    });
  } catch (err: any) {
    console.error('[UPLOAD-LOGO] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to upload logo' });
  }
});

export default router;
