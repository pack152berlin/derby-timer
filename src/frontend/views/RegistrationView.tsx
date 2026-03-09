import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  Car,
  CheckCircle,
  CheckSquare,
  HelpCircle,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  X,
  XSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CUB_SCOUT_DENS } from '../constants';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { Racer } from '../types';
import { api } from '../api';
import { useApp } from '../context';
import { SearchInput } from '../components/SearchInput';
import { AppTabs } from '../components/AppTabs';

const CLIENT_MAX_PHOTO_BYTES = 1_200_000;
const CLIENT_MAX_PHOTO_DIMENSION = 1600;
const PHOTO_QUALITY_STEPS = [0.82, 0.72, 0.62];

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const loadImageFromFile = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unable to decode image file'));
    };
    image.src = objectUrl;
  });
};

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> => {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/jpeg', quality);
  });
};

async function optimizePhotoForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }

  if (typeof document === 'undefined') {
    return file;
  }

  let image: HTMLImageElement;
  try {
    image = await loadImageFromFile(file);
  } catch {
    return file;
  }

  const largestDimension = Math.max(image.width, image.height);
  if (largestDimension <= 0) {
    return file;
  }

  const scale = Math.min(1, CLIENT_MAX_PHOTO_DIMENSION / largestDimension);
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    return file;
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  let bestBlob: Blob | null = null;
  for (const quality of PHOTO_QUALITY_STEPS) {
    const blob = await canvasToBlob(canvas, quality);
    if (!blob) {
      continue;
    }

    if (!bestBlob || blob.size < bestBlob.size) {
      bestBlob = blob;
    }

    if (blob.size <= CLIENT_MAX_PHOTO_BYTES) {
      bestBlob = blob;
      break;
    }
  }

  if (!bestBlob) {
    return file;
  }

  if (bestBlob.size >= file.size && file.size <= CLIENT_MAX_PHOTO_BYTES && scale === 1) {
    return file;
  }

  const baseName = file.name.replace(/\.[^/.]+$/, '') || 'car-photo';
  return new File([bestBlob], `${baseName}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

export function RegistrationView() {
  const { currentEvent, racers, refreshData } = useApp();
  const [activeTab, setActiveTab] = useState('registerTab');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'car'>('newest');
  const [showHelp, setShowHelp] = useState(false);

  if (!currentEvent) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
        <p className="text-xl text-slate-500 font-semibold">Please select an event first</p>
      </div>
    );
  }

  const inspectedCount = racers.filter(r => r.weight_ok).length;
  const inspectionPercent = racers.length > 0 ? Math.round((inspectedCount / racers.length) * 100) : 0;

  const sortedRacers = useMemo(() => {
    return [...racers].sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return Number(a.car_number) - Number(b.car_number);
    });
  }, [racers, sortBy]);

  const filteredRacers = sortedRacers.filter(r => {
    const nameMatch = (r.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const carMatch = (r.car_number || '').includes(searchTerm);
    return nameMatch || carMatch;
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-3 sm:mb-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">
            Registration
          </h1>
          <Button
            variant="outline"
            size="sm"
            data-testid="btn-help"
            onClick={() => setShowHelp(true)}
            className="h-10 gap-2 text-slate-600 border-slate-300 hover:text-[#003F87] hover:bg-blue-50 font-bold uppercase text-xs tracking-wider shadow-sm shrink-0"
          >
            <HelpCircle className="h-4 w-4" />
            <span>Help</span>
          </Button>
        </div>
        <div className="hidden sm:flex flex-wrap items-center gap-4 sm:gap-6 mt-3 text-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <Users size={18} className="text-[#003F87]" />
            <span className="font-semibold">{racers.length} Racers</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <CheckCircle size={18} className="text-emerald-500" />
            <span className="font-semibold">{inspectedCount} Inspected ({inspectionPercent}%)</span>
          </div>
        </div>
      </div>

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
              <HelpCircle className="h-6 w-6 text-[#003F87]" />
              Registration Instructions
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-1.5">
              <h3 className="font-bold text-[#003F87] uppercase text-sm tracking-wider">Automated Car Numbers</h3>
              <p className="text-slate-900 font-medium leading-snug">
                Car numbers are **assigned automatically** when you save. The system skips numbers with repeated digits (like 11, 22) to ensure they are easy for everyone to read during the race.
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="font-bold text-[#003F87] uppercase text-sm tracking-wider">Real-Time Updates</h3>
              <p className="text-slate-900 font-medium leading-snug">
                Multiple people can register racers at the same time. The list will update automatically on every screen as soon as someone hits save.
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="font-bold text-[#003F87] uppercase text-sm tracking-wider">Bulk Import</h3>
              <p className="text-slate-900 font-medium leading-snug">
                Have a large list? You can upload a CSV file to add everyone at once. Look for the import tool in the **Race Format** tab.
              </p>
            </div>

            <div className="mt-2 p-4 rounded-xl bg-blue-100 border-2 border-blue-200 text-blue-950 font-bold text-sm leading-tight">
              PRO TIP: Use the "Newest" sort toggle to keep your most recent entries at the top of the list for quick verification.
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowHelp(false)} className="bg-[#003F87] text-white w-full sm:w-auto font-black uppercase tracking-widest h-12">
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="w-full">
        <RacersTab 
          racers={filteredRacers} 
          searchTerm={searchTerm} 
          setSearchTerm={setSearchTerm}
          sortBy={sortBy}
          setSortBy={setSortBy}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      </div>
    </div>
  );
}

function RacersTab({ 
  racers, 
  searchTerm, 
  setSearchTerm,
  sortBy,
  setSortBy,
  activeTab,
  setActiveTab
}: { 
  racers: Racer[], 
  searchTerm: string, 
  setSearchTerm: (s: string) => void,
  sortBy: 'newest' | 'car',
  setSortBy: (s: 'newest' | 'car') => void,
  activeTab: string,
  setActiveTab: (s: string) => void
}) {
  const { currentEvent, racers: allRacers, refreshData, refreshDataSilent, setCurrentRacerId } = useApp();
  const inspectedCount = allRacers.filter(r => r.weight_ok).length;
  const allInspected = allRacers.length > 0 && inspectedCount === allRacers.length;

  const inspectRacers = useMemo(() =>
    [...allRacers].sort((a, b) => {
      if (!!a.weight_ok !== !!b.weight_ok) return a.weight_ok ? 1 : -1; // uninspected first
      return Number(a.car_number) - Number(b.car_number);
    }),
    [allRacers],
  );

  const [inspectSearch, setInspectSearch] = useState('');

  const filteredInspectRacers = useMemo(() => {
    if (!inspectSearch.trim()) return inspectRacers;
    const q = inspectSearch.toLowerCase();
    return inspectRacers.filter(r =>
      r.name.toLowerCase().includes(q) ||
      String(r.car_number ?? '').includes(q)
    );
  }, [inspectRacers, inspectSearch]);

  const displayRacers = activeTab === 'inspectionTab' ? filteredInspectRacers : racers;

  const inspectStatusIcon = allRacers.length === 0 ? null : allInspected
    ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
    : <AlertTriangle className="w-5 h-5 text-amber-500" />;
  const [inspectingIds, setInspectingIds] = useState<Set<string>>(new Set());
  const addInspecting = (id: string) => setInspectingIds(prev => new Set(prev).add(id));
  const removeInspecting = (id: string) => setInspectingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRacerName, setNewRacerName] = useState('');
  const [newRacerDen, setNewRacerDen] = useState('');
  const [newRacerInspected, setNewRacerInspected] = useState(false);
  const [newRacerPhoto, setNewRacerPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoStatus, setPhotoStatus] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [activePhotoRacerId, setActivePhotoRacerId] = useState<string | null>(null);
  const [pendingCardPhotoRacerId, setPendingCardPhotoRacerId] = useState<string | null>(null);
  const [editingRacerId, setEditingRacerId] = useState<string | null>(null);
  const [editRacerName, setEditRacerName] = useState('');
  const [editRacerDen, setEditRacerDen] = useState('');
  const [editRacerInspected, setEditRacerInspected] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [racerToDelete, setRacerToDelete] = useState<Racer | null>(null);
  const [photoToRemoveRacer, setPhotoToRemoveRacer] = useState<Racer | null>(null);
  const [lastAddedRacer, setLastAddedRacer] = useState<Racer | null>(null);
  const cardPhotoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  const clearPhotoSelection = () => {
    setPhotoPreviewUrl((previousUrl) => {
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }
      return null;
    });
    setNewRacerPhoto(null);
    setPhotoStatus(null);
    setPhotoError(null);
  };

  const resetForm = () => {
    setNewRacerName('');
    setNewRacerDen('');
    setNewRacerInspected(false);
    clearPhotoSelection();
  };

  const resetEditForm = () => {
    setEditingRacerId(null);
    setEditRacerName('');
    setEditRacerDen('');
  };

  const handlePhotoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const selectedFile = input.files?.[0] ?? null;
    input.value = '';

    if (!selectedFile) {
      return;
    }

    setPhotoError(null);
    setPhotoStatus(null);
    setIsProcessingPhoto(true);

    try {
      const optimizedPhoto = await optimizePhotoForUpload(selectedFile);

      if (optimizedPhoto.size > CLIENT_MAX_PHOTO_BYTES) {
        setPhotoError(`Photo is still too large (${formatBytes(optimizedPhoto.size)}). Please pick a smaller image.`);
        clearPhotoSelection();
        return;
      }

      setPhotoPreviewUrl((previousUrl) => {
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
        }
        return URL.createObjectURL(optimizedPhoto);
      });
      setNewRacerPhoto(optimizedPhoto);

      if (optimizedPhoto !== selectedFile) {
        setPhotoStatus(
          `Optimized from ${formatBytes(selectedFile.size)} to ${formatBytes(optimizedPhoto.size)}`
        );
      } else {
        setPhotoStatus(`Ready to upload (${formatBytes(optimizedPhoto.size)})`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to prepare that photo.';
      setPhotoError(message);
      clearPhotoSelection();
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newRacerName.trim() || isSubmitting || isProcessingPhoto) return;

    setNotice(null);
    setIsSubmitting(true);

    try {
      const racer = await api.createRacer(currentEvent!.id, {
        name: newRacerName.trim(),
        den: newRacerDen || null,
      });

      let warning: string | null = null;

      if (newRacerPhoto) {
        try {
          await api.uploadRacerPhoto(racer.id, newRacerPhoto);
        } catch (error) {
          warning = error instanceof Error ? error.message : 'Photo upload failed.';
        }
      }

      if (newRacerInspected) {
        await api.inspectRacer(racer.id, true);
      }

      resetForm();
      setShowAddForm(false);
      setLastAddedRacer(racer);

      if (warning) {
        setNotice(`Racer was added, but photo upload failed: ${warning}`);
      }

      await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to add racer.';
      setNotice(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!racerToDelete) return;
    if (editingRacerId === racerToDelete.id) {
      resetEditForm();
    }
    await api.deleteRacer(racerToDelete.id);
    setRacerToDelete(null);
    refreshData();
  };

  const beginEdit = (racer: Racer) => {
    setNotice(null);
    setEditingRacerId(racer.id);
    setEditRacerName(racer.name);
    setEditRacerDen(racer.den ?? '');
    setEditRacerInspected(!!racer.weight_ok);
  };

  const handleSaveEdit = async (racer: Racer) => {
    const name = editRacerName.trim();
    if (!name || isSavingEdit) {
      return;
    }

    setNotice(null);
    setIsSavingEdit(true);

    try {
      await api.updateRacer(racer.id, {
        name,
        den: editRacerDen.trim() || null,
        weight_ok: editRacerInspected,
      });
      setNotice(`Updated ${name}.`);
      resetEditForm();
      await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update racer.';
      setNotice(message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const beginCardPhotoUpload = (racerId: string) => {
    setPendingCardPhotoRacerId(racerId);
    cardPhotoInputRef.current?.click();
  };

  const handleCardPhotoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const selectedFile = input.files?.[0] ?? null;
    input.value = '';

    const racerId = pendingCardPhotoRacerId;
    setPendingCardPhotoRacerId(null);

    if (!selectedFile || !racerId) {
      return;
    }

    const racer = racers.find((candidate) => candidate.id === racerId);
    setNotice(null);
    setActivePhotoRacerId(racerId);

    try {
      const optimizedPhoto = await optimizePhotoForUpload(selectedFile);
      if (optimizedPhoto.size > CLIENT_MAX_PHOTO_BYTES) {
        throw new Error(`Photo is still too large (${formatBytes(optimizedPhoto.size)}). Please pick a smaller image.`);
      }

      await api.uploadRacerPhoto(racerId, optimizedPhoto);
      setNotice(`Updated ${racer?.name ?? 'racer'} photo.`);
      await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Photo upload failed.';
      setNotice(`Could not update photo: ${message}`);
    } finally {
      setActivePhotoRacerId(null);
    }
  };

  const confirmRemovePhoto = async () => {
    if (!photoToRemoveRacer?.car_photo_filename) {
      return;
    }

    setNotice(null);
    setActivePhotoRacerId(photoToRemoveRacer.id);

    try {
      await api.deleteRacerPhoto(photoToRemoveRacer.id);
      setNotice(`Removed ${photoToRemoveRacer.name} photo.`);
      setPhotoToRemoveRacer(null);
      await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not remove photo.';
      setNotice(message);
    } finally {
      setActivePhotoRacerId(null);
    }
  };

  return (
    <div>
      <input
        ref={cardPhotoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCardPhotoSelected}
        className="hidden"
      />

      {notice && (
        <Card className="mb-4 border-blue-200 bg-blue-50">
          <CardContent className="p-3 text-sm font-semibold text-blue-800">{notice}</CardContent>
        </Card>
      )}

      {showAddForm && (
        <Card className="mb-4 border-2 border-blue-200">
          <CardHeader className="lg:py-2 px-4">
            <CardTitle className="text-lg">Add New Racer</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold mb-1.5 text-slate-600 uppercase tracking-wider">
                  Full Name *
                </label>
                <Input
                  value={newRacerName}
                  onChange={(e) => setNewRacerName(e.target.value)}
                  required
                  data-testid="input-racer-name"
                  placeholder="Johnny Smith"
                  className="h-12"
                  autoFocus
                />
              </div>

              {/* Den */}
              <div>
                <label className="block text-xs font-bold mb-1.5 text-slate-600 uppercase tracking-wider">
                  Den
                </label>
                <Select value={newRacerDen} onValueChange={setNewRacerDen}>
                  <SelectTrigger className="h-12 bg-white border-slate-300 w-full">
                    <SelectValue placeholder="Select Den" />
                  </SelectTrigger>
                  <SelectContent>
                    {CUB_SCOUT_DENS.map(den => (
                      <SelectItem key={den} value={den}>{den}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Car Photo */}
              <div>
                <label className="block text-xs font-bold mb-1.5 text-slate-600 uppercase tracking-wider">
                  Car Photo (optional)
                </label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoSelected}
                    className="h-12 bg-white file:h-9 file:px-3 file:text-sm flex-1 min-w-0"
                  />
                  {newRacerPhoto && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearPhotoSelection}
                      className="h-12 px-3 shrink-0"
                      title="Remove photo"
                    >
                      ✕
                    </Button>
                  )}
                </div>
                {isProcessingPhoto && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Preparing photo...
                  </p>
                )}
                {photoError && (
                  <p className="mt-1.5 text-xs font-semibold text-red-600">{photoError}</p>
                )}
                {photoStatus && !photoError && (
                  <p className="mt-1.5 text-xs font-semibold text-emerald-700">{photoStatus}</p>
                )}
                {photoPreviewUrl && (
                  <img
                    src={photoPreviewUrl}
                    alt="Selected car preview"
                    className="mt-2 h-28 w-full rounded-lg border-2 border-slate-300 object-cover"
                  />
                )}
              </div>

              {/* Inspected */}
              <div className="flex items-center gap-3">
                <Checkbox
                  id="inspected"
                  checked={newRacerInspected}
                  onCheckedChange={(checked) => setNewRacerInspected(checked === true)}
                  className="size-5 border-slate-400"
                />
                <Label htmlFor="inspected" className="font-semibold cursor-pointer text-slate-700">
                  Inspected
                </Label>
              </div>

              {/* Buttons */}
              <div className="flex flex-row-reverse sm:flex-row gap-2 pt-1">
                <Button
                  type="submit"
                  data-testid="btn-submit-racer"
                  disabled={isSubmitting || isProcessingPhoto}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest h-11 px-5"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  {isSubmitting ? 'Saving...' : 'Submit Racer'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setShowAddForm(false);
                  }}
                  className="h-11 px-5"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <AppTabs
        tabs={[
          { id: 'registerTab',   label: 'Register', count: allRacers.length },
          { id: 'inspectionTab', label: 'Inspect',  count: inspectedCount, statusIcon: inspectStatusIcon },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
        contentClassName="p-0"
      >
        {/* Register tab: filter bar + Add Racer CTA */}
        {activeTab === 'registerTab' && !showAddForm && (
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 px-4 py-3 border-b border-slate-200">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search racers or car numbers..."
              className="sm:flex-1 sm:min-w-[180px]"
            />
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 h-9 rounded-lg bg-slate-100 border border-slate-300 shrink-0" data-testid="sort-toggle">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Sort:</span>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-bold uppercase transition-colors", sortBy === 'newest' ? "text-slate-900" : "text-slate-500")}>New</span>
                  <Switch
                    checked={sortBy === 'car'}
                    onCheckedChange={(checked) => setSortBy(checked ? 'car' : 'newest')}
                    className="data-[size=default]:h-5 data-[size=default]:w-9"
                  />
                  <span className={cn("text-xs font-bold uppercase transition-colors", sortBy === 'car' ? "text-slate-900" : "text-slate-500")}>#</span>
                </div>
              </div>
              <Button
                onClick={() => setShowAddForm(true)}
                data-testid="btn-add-racer"
                className="bg-[#003F87] hover:bg-[#002f66] text-white font-black uppercase tracking-widest h-9 flex-1 sm:flex-none"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Racer
              </Button>
            </div>
          </div>
        )}

        {/* Inspect tab: search bar */}
        {activeTab === 'inspectionTab' && (
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
            <SearchInput
              value={inspectSearch}
              onChange={setInspectSearch}
              placeholder="Search by name or car number..."
              className="flex-1"
            />
          </div>
        )}

        <div className="grid gap-3 p-4" data-testid="racer-list">
        {displayRacers.map((racer, idx) => {
          const isEditing = editingRacerId === racer.id;

          // Section headers for inspection tab
          const prevRacer = displayRacers[idx - 1];
          const sectionHeader = activeTab === 'inspectionTab' && (
            idx === 0 && !racer.weight_ok ? (
              <div className="col-span-full pt-1 pb-2">
                <p className="text-lg text-amber-600 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Pending Inspection - Please Review
                </p>
              </div>
            ) : idx === 0 && racer.weight_ok ? (
              <div className="col-span-full pt-1 pb-2">
                <p className="text-lg text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Already Passing Inspection
                </p>
              </div>
            ) : prevRacer && !prevRacer.weight_ok && racer.weight_ok ? (
              <div className="col-span-full pt-3 pb-2">
                <p className="text-lg text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Already Passing Inspection
                </p>
              </div>
            ) : null
          );

          return (
          <React.Fragment key={racer.id}>
          {sectionHeader}
          <Card
            data-testid="racer-card"
            className={cn(
              "relative group transition-all duration-200 py-1 border-2",
              activeTab === 'inspectionTab' && !racer.weight_ok
                ? "bg-amber-50 border-amber-200 [box-shadow:inset_0_1px_4px_rgba(255,255,255,0.95),0_1px_3px_rgba(120,60,0,0.09)]"
                : "border-slate-200 hover:border-blue-300 [box-shadow:inset_0_1px_3px_rgba(255,255,255,0.8),0_1px_3px_rgba(0,0,0,0.07)]"
            )}
          >
            {/* Desktop delete — floating pill, hover-reveal */}
            {!isEditing && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setRacerToDelete(racer)}
                className="hidden sm:flex absolute -top-2 -right-2 h-8 px-2 rounded-full bg-white border shadow-sm text-slate-400 hover:text-white hover:bg-red-600 transition-all z-10 items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100"
                title="Delete Racer"
              >
                <X className="h-3 w-3" />
                <span className="text-xs font-bold uppercase">Delete</span>
              </Button>
            )}
            <CardContent className="p-3 sm:p-4">
              {/* flex-row always: [car#+photo stacked] [name top-aligned] [actions] */}
              <div className="flex items-start gap-3 sm:gap-4">

                {/* LEFT: car# on top, photo below (mobile); side-by-side (desktop) */}
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 shrink-0">
                  <div
                    data-testid={`car-number-${racer.car_number}`}
                    onClick={() => {
                      if (!racer.weight_ok && activeTab === 'registerTab') setActiveTab('inspectionTab');
                      else setCurrentRacerId(racer.id);
                    }}
                    className={cn(
                      "w-12 h-12 sm:w-14 sm:h-14 rounded-lg flex flex-col items-center justify-center border-2 cursor-pointer hover:scale-110 transition-transform active:scale-90",
                      !racer.weight_ok && activeTab === 'registerTab'
                        ? "bg-amber-50 text-amber-600 border-amber-300"
                        : "bg-slate-100 text-slate-500 border-slate-200 font-black text-xl"
                    )}
                  >
                    {!racer.weight_ok && activeTab === 'registerTab' ? (
                      <>
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <span className="text-xs font-bold leading-none mt-0.5">#{racer.car_number}</span>
                      </>
                    ) : (
                      `#${racer.car_number}`
                    )}
                  </div>

                  {racer.car_photo_filename ? (
                    <div className="relative group/photo">
                      <img
                        src={api.getRacerPhotoUrl(racer.id, racer.updated_at)}
                        alt={`${racer.name} car photo`}
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg border-2 border-slate-300 object-cover"
                        loading="lazy"
                      />
                      <button
                        onClick={() => setPhotoToRemoveRacer(racer)}
                        className="hidden sm:flex absolute inset-0 rounded-lg items-center justify-center bg-black/50 text-white opacity-0 group-hover/photo:opacity-100 transition-opacity"
                        title="Remove Photo"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => beginCardPhotoUpload(racer.id)}
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 hover:border-slate-400 transition-colors cursor-pointer"
                      title="Add Photo"
                    >
                      <Camera className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase">No Pic</span>
                    </button>
                  )}
                </div>

                {/* MIDDLE: name top-aligned, fills remaining width */}
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <div className="flex flex-wrap items-center gap-2 sm:min-w-[400px]">
                      <Input
                        value={editRacerName}
                        onChange={(event) => setEditRacerName(event.target.value)}
                        placeholder="Racer name"
                        className="h-10 bg-white flex-1 min-w-[130px]"
                        autoFocus
                      />
                      <div className="w-[130px]">
                        <Select value={editRacerDen} onValueChange={setEditRacerDen}>
                          <SelectTrigger className="h-10 bg-white border-slate-300 w-full">
                            <SelectValue placeholder="Select Den" />
                          </SelectTrigger>
                          <SelectContent>
                            {CUB_SCOUT_DENS.map(den => (
                              <SelectItem key={den} value={den}>{den}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2 px-2 h-10 rounded-md border border-slate-200 bg-slate-50">
                        <Checkbox
                          id={`edit-inspect-${racer.id}`}
                          checked={editRacerInspected}
                          onCheckedChange={(checked) => setEditRacerInspected(checked === true)}
                          className="size-4 border-slate-400"
                        />
                        <Label htmlFor={`edit-inspect-${racer.id}`} className="text-xs font-bold uppercase text-slate-500 cursor-pointer select-none">
                          Inspected
                        </Label>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="font-bold text-base sm:text-lg text-slate-900 truncate">{racer.name}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        {racer.den && (
                          <Badge variant="secondary" className="font-medium text-xs">{racer.den}</Badge>
                        )}
                        {activeTab === 'inspectionTab' && !!racer.weight_ok && (
                          <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-xs">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Inspected
                          </Badge>
                        )}
                        {!racer.weight_ok && (
                          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 font-bold uppercase tracking-tighter text-xs">
                            Pending
                          </Badge>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* RIGHT: actions stacked (mobile), row (desktop), vertically centered */}
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 sm:gap-2 shrink-0 self-center">
                  {activeTab === 'inspectionTab' ? (
                    <>
                      {racer.weight_ok ? (
                        <>
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 whitespace-nowrap">
                            <CheckSquare className="w-3 h-3 mr-1" />
                            PASSED
                          </Badge>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={inspectingIds.has(racer.id)}
                            onClick={async () => {
                              addInspecting(racer.id);
                              await api.inspectRacer(racer.id, false);
                              await refreshDataSilent();
                              removeInspecting(racer.id);
                            }}
                            className="h-9 px-3 min-w-[4.5rem]"
                          >
                            {inspectingIds.has(racer.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset'}
                          </Button>
                        </>
                      ) : (
                        <Button
                          disabled={inspectingIds.has(racer.id)}
                          onClick={async () => {
                            addInspecting(racer.id);
                            await api.inspectRacer(racer.id, true);
                            await refreshDataSilent();
                            removeInspecting(racer.id);
                          }}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold h-12 min-w-[5rem]"
                        >
                          {inspectingIds.has(racer.id)
                            ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />PASS</>
                            : <><CheckCircle className="w-4 h-4 mr-1" />PASS</>}
                        </Button>
                      )}
                    </>
                  ) : isEditing ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleSaveEdit(racer)}
                        disabled={isSavingEdit || !editRacerName.trim()}
                        className="h-9 px-3 bg-[#003F87] hover:bg-[#002f66] text-white"
                      >
                        {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={resetEditForm}
                        disabled={isSavingEdit}
                        className="h-9 px-3"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={activePhotoRacerId === racer.id}
                        onClick={() => beginEdit(racer)}
                        className="h-9 px-2 sm:px-3"
                      >
                        <Pencil className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Edit</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={activePhotoRacerId === racer.id}
                        onClick={() => beginCardPhotoUpload(racer.id)}
                        className="h-9 px-2 sm:px-3"
                      >
                        {activePhotoRacerId === racer.id ? (
                          <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
                        ) : (
                          <ImagePlus className="w-4 h-4 sm:mr-2" />
                        )}
                        <span className="hidden sm:inline">{racer.car_photo_filename ? 'New Photo' : 'Add Photo'}</span>
                      </Button>
                      {racer.car_photo_filename && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={activePhotoRacerId === racer.id}
                          onClick={() => setPhotoToRemoveRacer(racer)}
                          className="hidden sm:flex h-9 px-3 border-slate-300 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Photo
                        </Button>
                      )}
                    </>
                  )}

                  {/* Delete racer — inline on mobile only */}
                  {!isEditing && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setRacerToDelete(racer)}
                      className="sm:hidden h-9 w-9 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                      title="Delete Racer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

              </div>
            </CardContent>
          </Card>
          </React.Fragment>
          );
        })}
      </div>

        {racers.length === 0 && !showAddForm && (
          <Card className="border-2 border-dashed border-slate-300 m-4">
            <CardContent className="text-center py-12">
              <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-lg text-slate-500 font-medium">No racers registered yet</p>
              <p className="text-slate-400 mt-1">Tap "Add Racer" to get started</p>
            </CardContent>
          </Card>
        )}
      </AppTabs>

      <Dialog open={!!racerToDelete} onOpenChange={(open) => !open && setRacerToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{racerToDelete?.name}</strong>? This will also remove their saved car photo. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setRacerToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete Racer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!photoToRemoveRacer} onOpenChange={(open) => !open && setPhotoToRemoveRacer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Photo</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove the car photo for <strong>{photoToRemoveRacer?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setPhotoToRemoveRacer(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmRemovePhoto}>
              Remove Photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!lastAddedRacer} onOpenChange={(open) => !open && setLastAddedRacer(null)}>
        <DialogContent className="max-w-md border-emerald-200 p-4 sm:p-6">
          <DialogHeader className="text-center sm:text-center items-center pb-2">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-2 [animation-iteration-count:3] animate-bounce">
              <span className="text-3xl">🎈</span>
            </div>
            <DialogTitle className="text-xl font-black uppercase text-emerald-700 tracking-tight">Racer Registered!</DialogTitle>
          </DialogHeader>
          
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border-2 border-slate-200">
            <div className="text-5xl font-black text-[#003F87] leading-none">
              #{lastAddedRacer?.car_number}
            </div>
            <div className="flex-1 min-w-0 border-l-2 border-slate-200 pl-4">
              <p className="font-bold text-lg text-slate-900 truncate leading-tight">
                {lastAddedRacer?.name}
              </p>
              {lastAddedRacer?.den && (
                <p className="text-xs font-black uppercase tracking-widest text-[#CE1126] mt-1">
                  {lastAddedRacer.den}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="flex flex-col items-center gap-2 mt-4 sm:flex-col sm:items-center">
            <Button 
              onClick={() => {
                setLastAddedRacer(null);
                setShowAddForm(true);
              }} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest h-14 text-base w-full"
            >
              Next Racer
            </Button>
            <Button 
              variant="ghost" 
              data-testid="btn-close-success"
              onClick={() => setLastAddedRacer(null)}
              className="text-slate-400 hover:text-white hover:bg-slate-600 font-bold uppercase text-xs tracking-wider h-10 w-full transition-colors"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
