import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
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
const CUB_SCOUT_DENS = [
  'Lions',
  'Tigers',
  'Wolves',
  'Bears',
  'Webelos',
  'AOLs'
];
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { Racer } from '../types';
import { api } from '../api';
import { useApp } from '../context';

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
  const [activeTab, setActiveTab] = useState('racers');
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
      <div className="mb-6">
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
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-3 text-sm">
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
  const { currentEvent, racers: allRacers, refreshData } = useApp();
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

      {showAddForm ? (
        <Card className="mb-6 border-2 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg">Add New Racer</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-3 items-start">
              <div className="md:col-span-3">
                <label className="block text-xs font-bold mb-2 text-slate-600 uppercase tracking-wider">
                  Full Name *
                </label>
                <Input 
                  value={newRacerName}
                  onChange={(e) => setNewRacerName(e.target.value)}
                  required 
                  data-testid="input-racer-name"
                  placeholder="Johnny Smith"
                  className="h-12"
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-xs font-bold mb-2 text-slate-600 uppercase tracking-wider">
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

              <div className="md:col-span-2">
                <label className="block text-xs font-bold mb-2 text-slate-600 uppercase tracking-wider">
                  Car Photo (optional)
                </label>
                <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoSelected}
                      className="h-12 bg-white file:h-9 file:px-3 file:text-sm"
                    />
                    {newRacerPhoto && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={clearPhotoSelection}
                        className="h-12 w-full sm:w-auto"
                      >
                        Remove Photo
                      </Button>
                    )}
                  </div>

                  {isProcessingPhoto && (
                    <p className="mt-2 flex items-center gap-2 text-sm text-slate-600 font-semibold">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Preparing photo...
                    </p>
                  )}

                  {photoError && (
                    <p className="mt-2 text-sm font-semibold text-red-600">{photoError}</p>
                  )}

                  {photoStatus && !photoError && (
                    <p className="mt-2 text-sm font-semibold text-emerald-700">{photoStatus}</p>
                  )}

                  {photoPreviewUrl && (
                    <div className="mt-3">
                      <img
                        src={photoPreviewUrl}
                        alt="Selected car preview"
                        className="h-36 w-full max-w-xs rounded-lg border-2 border-slate-300 object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="md:col-span-3 flex items-center gap-3 py-2">
                <Checkbox 
                  id="inspected" 
                  checked={newRacerInspected}
                  onCheckedChange={(checked) => setNewRacerInspected(checked === true)}
                  className="size-5 border-slate-400"
                />
                <Label htmlFor="inspected" className="font-semibold cursor-pointer text-slate-700">
                  Inspected (ready to race)
                </Label>
              </div>
              <div className="md:col-span-3 flex flex-col sm:flex-row gap-2">
                <Button
                  type="submit"
                  data-testid="btn-submit-racer"
                  disabled={isSubmitting || isProcessingPhoto}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest h-12"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-5 h-5 mr-2" />
                  )}
                  {isSubmitting ? 'Saving...' : 'Add Racer'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setShowAddForm(false);
                  }}
                  className="h-12 px-6"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="relative sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <Input
              type="text"
              placeholder="Search racers or car numbers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 bg-white border-slate-300"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filter:</span>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-xs font-bold uppercase transition-colors",
                  activeTab === 'racers' ? "text-slate-900" : "text-slate-400"
                )}>
                  Register
                </span>
                <Switch 
                  data-testid="switch-inspection"
                  checked={activeTab === 'inspection'} 
                  onCheckedChange={(checked) => setActiveTab(checked ? 'inspection' : 'racers')}
                  className="data-[size=default]:h-5 data-[size=default]:w-9"
                />
                <span className={cn(
                  "text-xs font-bold uppercase transition-colors",
                  activeTab === 'inspection' ? "text-emerald-600" : "text-slate-400"
                )}>
                  Inspect
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100" data-testid="sort-toggle">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sort:</span>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-xs font-bold uppercase transition-colors",
                  sortBy === 'newest' ? "text-slate-900" : "text-slate-400"
                )}>
                  New
                </span>
                <Switch 
                  checked={sortBy === 'car'} 
                  onCheckedChange={(checked) => setSortBy(checked ? 'car' : 'newest')}
                  className="data-[size=default]:h-5 data-[size=default]:w-9"
                />
                <span className={cn(
                  "text-xs font-bold uppercase transition-colors",
                  sortBy === 'car' ? "text-slate-900" : "text-slate-400"
                )}>
                  #
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1"></div>

          <Button 
            onClick={() => setShowAddForm(true)}
            data-testid="btn-add-racer"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest h-12 w-full sm:w-auto"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Racer
          </Button>
        </div>
      )}

      <div className={cn(
        "grid gap-3 p-1 rounded-2xl transition-colors",
        activeTab === 'inspection' && "bg-slate-100/50"
      )} data-testid="racer-list">
        {racers.map((racer) => {
          const isEditing = editingRacerId === racer.id;

          return (
          <Card 
            key={racer.id}
            data-testid="racer-card"
            className={cn(
              "group relative transition-all duration-200 border-2",
              activeTab === 'inspection' 
                ? (racer.weight_ok ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200 shadow-sm")
                : "hover:border-blue-300"
            )}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRacerToDelete(racer)}
              className="absolute -top-2 -right-2 h-8 px-2 rounded-full bg-white border shadow-sm text-slate-400 hover:text-white hover:bg-red-600 transition-all z-10 flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100"
              title="Delete Racer"
            >
              <X className="h-3 w-3" />
              <span className="text-[10px] font-bold uppercase">Delete</span>
            </Button>
            <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className={cn(
                  "w-14 h-14 rounded-lg flex items-center justify-center font-black text-xl border-2",
                  racer.weight_ok 
                    ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                    : "bg-slate-100 text-slate-500 border-slate-300"
                )}>
                  #{racer.car_number}
                </div>

                {racer.car_photo_filename ? (
                  <div className="relative group/photo shrink-0">
                    <img
                      src={api.getRacerPhotoUrl(racer.id, racer.updated_at)}
                      alt={`${racer.name} car photo`}
                      className="w-14 h-14 rounded-lg border-2 border-slate-300 object-cover"
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
                    className="w-14 h-14 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 hover:border-slate-400 transition-colors cursor-pointer shrink-0"
                    title="Add Photo"
                  >
                    <Camera className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase">No Pic</span>
                  </button>
                )}

                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <div className="flex flex-wrap items-center gap-2 sm:min-w-[400px]">
                      <Input
                        value={editRacerName}
                        onChange={(event) => setEditRacerName(event.target.value)}
                        placeholder="Racer name"
                        className="h-10 bg-white flex-1 min-w-[150px]"
                        autoFocus
                      />
                      <div className="w-[140px]">
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
                      <p className="font-bold text-lg text-slate-900 truncate">{racer.name}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {racer.den && (
                          <Badge variant="secondary" className="font-medium">{racer.den}</Badge>
                        )}
                        {racer.weight_ok ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Inspected
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 font-bold uppercase tracking-tighter">
                            Pending
                          </Badge>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                {activeTab === 'inspection' ? (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {racer.weight_ok ? (
                      <>
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 mr-auto sm:mr-4">
                          <CheckSquare className="w-3 h-3 mr-1" />
                          PASSED
                        </Badge>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => api.inspectRacer(racer.id, false).then(refreshData)}
                          className="h-11 px-4"
                        >
                          Reset
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button 
                          onClick={() => api.inspectRacer(racer.id, true).then(refreshData)}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold h-11 flex-1 sm:flex-none"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          PASS
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => api.inspectRacer(racer.id, false).then(refreshData)}
                          className="border-red-300 text-red-500 hover:bg-red-50 h-11 flex-1 sm:flex-none"
                        >
                          <XSquare className="w-4 h-4 mr-1" />
                          FAIL
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    {isEditing ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSaveEdit(racer)}
                          disabled={isSavingEdit || !editRacerName.trim()}
                          className="h-10 px-3 bg-[#003F87] hover:bg-[#002f66] text-white"
                        >
                          {isSavingEdit ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : null}
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={resetEditForm}
                          disabled={isSavingEdit}
                          className="h-10 px-3"
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
                          disabled={activePhotoRacerId === racer.id || isSavingEdit}
                          onClick={() => beginEdit(racer)}
                          className="h-10 px-3"
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={activePhotoRacerId === racer.id || isSavingEdit}
                          onClick={() => beginCardPhotoUpload(racer.id)}
                          className="h-10 px-3"
                        >
                          {activePhotoRacerId === racer.id ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <ImagePlus className="w-4 h-4 mr-2" />
                          )}
                          {racer.car_photo_filename ? 'New Photo' : 'Add Photo'}
                        </Button>

                        {racer.car_photo_filename && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={activePhotoRacerId === racer.id || isSavingEdit}
                            onClick={() => setPhotoToRemoveRacer(racer)}
                            className="h-10 px-3 border-slate-300 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Photo
                          </Button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
          );
        })}
      </div>

      {racers.length === 0 && !showAddForm && (
        <Card className="border-2 border-dashed border-slate-300">
          <CardContent className="text-center py-12">
            <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-lg text-slate-500 font-medium">No racers registered yet</p>
            <p className="text-slate-400 mt-1">Tap "Add Racer" to get started</p>
          </CardContent>
        </Card>
      )}

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
