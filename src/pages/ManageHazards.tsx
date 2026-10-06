import React, { useState, useEffect, useRef } from 'react';
import { apiGetHazards, apiCreateHazard, apiUpdateHazard, apiDeleteHazard } from '../services/api';
import Icon from '../components/Icon';
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
    <div className="narrow-page">
      <div className="page-header">
        <div>
          <h1>Manage Hazards</h1>
          <p className="page-subtitle">Upload hazard symbols and images. These will appear in the product dropdown.</p>
        </div>
      </div>

      {/* Add / Edit Form */}
      <form onSubmit={handleSubmit} className="panel">
        <div className="panel-header">
          <h2 className="panel-title">{editingId ? 'Edit Hazard' : 'Add a Hazard'}</h2>
        </div>
        <div className="panel-body hazard-form-body">
          <div className="form-group">
            <label>Hazard Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Toxic, Flammable, Corrosive"
              required
            />
          </div>
          <div className="form-group">
            <label>Hazard Image</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>
          {imagePreview && (
            <img src={imagePreview} alt="Preview" className="hazard-preview" />
          )}
          <div className="hazard-form-actions">
            {editingId && (
              <button type="button" className="secondary-btn" onClick={resetForm}>
                Cancel
              </button>
            )}
            <button type="submit" className="primary-btn" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update' : <><Icon name="plus" size={16} /> Add Hazard</>}
            </button>
          </div>
        </div>
      </form>

      {/* Hazards List */}
      {loading ? (
        <p className="muted-text">Loading...</p>
      ) : hazards.length === 0 ? (
        <div className="empty-state">No hazards added yet.</div>
      ) : (
        <div className="hazard-grid">
          {hazards.map((h) => (
            <div key={h.id} className="hazard-card">
              {h.hasImage ? (
                <img
                  src={`${API_BASE}/hazards/${h.id}/image`}
                  alt={h.name}
                  className="hazard-card-image"
                />
              ) : (
                <div className="hazard-card-image is-empty"><Icon name="alert" size={30} /></div>
              )}
              <p className="hazard-card-name">{h.name}</p>
              <div className="hazard-card-actions">
                <button className="icon-btn edit" onClick={() => handleEdit(h)}>Edit</button>
                <button className="icon-btn delete" onClick={() => handleDelete(h.id!)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManageHazards;
