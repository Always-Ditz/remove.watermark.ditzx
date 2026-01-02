import formidable from 'formidable';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function ezremove(filePath) {
  const form = new FormData();
  form.append('image_file', fs.createReadStream(filePath), path.basename(filePath));

  const create = await axios.post(
    'https://api.ezremove.ai/api/ez-remove/watermark-remove/create-job',
    form,
    {
      headers: {
        ...form.getHeaders(),
        'User-Agent': 'Mozilla/5.0',
        origin: 'https://ezremove.ai',
        'product-serial': 'sr-' + Date.now()
      }
    }
  ).then(v => v.data).catch(() => null);

  if (!create || !create.result || !create.result.job_id) {
    return { status: 'error' };
  }

  const job = create.result.job_id;

  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000));

    const check = await axios.get(
      `https://api.ezremove.ai/api/ez-remove/watermark-remove/get-job/${job}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          origin: 'https://ezremove.ai',
          'product-serial': 'sr-' + Date.now()
        }
      }
    ).then(v => v.data).catch(() => null);

    if (check && check.code === 100000 && check.result && check.result.output) {
      return { job, result: check.result.output[0] };
    }

    if (!check || !check.code || check.code !== 300001) break;
  }

  return { status: 'processing', job };
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB
      keepExtensions: true,
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    const imageFile = files.image?.[0] || files.image;
    
    if (!imageFile) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const result = await ezremove(imageFile.filepath);

    // Clean up temp file
    try {
      fs.unlinkSync(imageFile.filepath);
    } catch (e) {
      console.error('Failed to delete temp file:', e);
    }

    if (result.status === 'error') {
      return res.status(500).json({
        success: false,
        error: 'Failed to process image'
      });
    }

    if (result.status === 'processing') {
      return res.status(202).json({
        success: false,
        error: 'Processing timeout',
        jobId: result.job
      });
    }

    if (result.result) {
      return res.status(200).json({
        success: true,
        jobId: result.job,
        resultUrl: result.result
      });
    }

    return res.status(500).json({
      success: false,
      error: 'No result from processing'
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}