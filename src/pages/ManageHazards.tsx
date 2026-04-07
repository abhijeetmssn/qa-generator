import React, { useState, useEffect, useRef } from 'react';
import { apiGetHazards, apiCreateHazard, apiUpdateHazard, apiDeleteHazard } from '../services/api';
import type { Hazard } from '../services/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const ManageHazards: React.FC = () => {
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadHazards = async () => {
    try {
      const data = await apiGetHazards();
      setHazards(data);
    } catch (err) {
      console.error('Failed to load hazards:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadHazards(); }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setName('');
    setImageFile(null);
    setImagePreview(null);
    setEditingId(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await apiUpdateHazard(editingId, name.trim(), imageFile || undefined);
      } else {
        await apiCreateHazard(name.trim(), imageFile || undefined);
      }
      resetForm();
      await loadHazards();
    } catch (err: any) {
      alert(err.message || 'Failed to save hazard');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (hazard: Hazard) => {
    setEditingId(hazard.id!);
    setName(hazard.name);
    setImageFile(null);
    setImagePreview(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this hazard?')) return;
    try {
      await apiDeleteHazard(id);
      await loadHazards();
    } catch (err: any) {
      alert(err.message || 'Failed to delete hazard');
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '4px', color: '#1e293b' }}>Manage Hazards</h2>
      <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '14px' }}>
        Upload hazard symbols and images. These will appear in the product dropdown.
      </p>

      {/* Add / Edit Form */}
      <form onSubmit={handleSubmit} style={{
        background: '#f8fafb', border: '1px solid #e2e8f0', borderRadius: '10px',
        padding: '20px', marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap'
      }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            Hazard Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Toxic, Flammable, Corrosive"
            required
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
          />
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            Hazard Image
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ fontSize: '13px' }}
          />
        </div>
        {imagePreview && (
          <img src={imagePreview} alt="Preview" style={{ width: '50px', height: '50px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #e2e8f0' }} />
        )}
        <button type="submit" disabled={saving} style={{
          padding: '8px 20px', background: editingId ? '#f59e0b' : '#3b82f6', color: 'white',
          border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '14px'
        }}>
          {saving ? '...' : editingId ? 'Update' : '+ Add'}
        </button>
        {editingId && (
          <button type="button" onClick={resetForm} style={{
            padding: '8px 16px', background: '#94a3b8', color: 'white',
            border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
          }}>
            Cancel
          </button>
        )}
      </form>

      {/* Hazards List */}
      {loading ? (
        <p style={{ color: '#64748b' }}>Loading...</p>
      ) : hazards.length === 0 ? (
        <p style={{ color: '#64748b', textAlign: 'center', padding: '40px 0' }}>No hazards added yet.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          {hazards.map((h) => (
            <div key={h.id} style={{
              background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px',
              padding: '16px', textAlign: 'center', position: 'relative'
            }}>
              {h.hasImage ? (
                <img
                  src={`${API_BASE}/hazards/${h.id}/image`}
                  alt={h.name}
                  style={{ width: '80px', height: '80px', objectFit: 'contain', marginBottom: '8px' }}
                />
              ) : (
                <div style={{
                  width: '80px', height: '80px', margin: '0 auto 8px', background: '#fef3c7',
                  borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2rem'
                }}>⚠️</div>
              )}
              <p style={{ fontWeight: 600, color: '#1e293b', margin: '0 0 8px' }}>{h.name}</p>
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                <button onClick={() => handleEdit(h)} style={{
                  padding: '4px 10px', background: '#f59e0b', color: 'white',
                  border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer'
                }}>Edit</button>
                <button onClick={() => handleDelete(h.id!)} style={{
                  padding: '4px 10px', background: '#ef4444', color: 'white',
                  border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer'
                }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManageHazards;
