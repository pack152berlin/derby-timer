import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle,
  CheckSquare,
  ImagePlus,
  Loader2,
  Plus,
  Search,
  Trash2,
  Users,
  XSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

  const filteredRacers = racers.filter(r => {
    const nameMatch = (r.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const carMatch = (r.car_number || '').includes(searchTerm);
    return nameMatch || carMatch;
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">
          Registration
        </h1>
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-3 text-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <Users size={18} className="text-orange-500" />
            <span className="font-semibold">{racers.length} Racers</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <CheckCircle size={18} className="text-emerald-500" />
            <span className="font-semibold">{inspectedCount} Inspected ({inspectionPercent}%)</span>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
          <TabsTrigger value="racers" className="font-semibold">Racers</TabsTrigger>
          <TabsTrigger value="inspection" className="font-semibold">Inspection</TabsTrigger>
        </TabsList>
        
        <TabsContent value="racers">
          <RacersTab racers={filteredRacers} searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
        </TabsContent>
        
        <TabsContent value="inspection">
          <InspectionTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RacersTab({ racers, searchTerm, setSearchTerm }: { racers: Racer[], searchTerm: string, setSearchTerm: (s: string) => void }) {
  const { currentEvent, racers: allRacers, refreshData } = useApp();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRacerName, setNewRacerName] = useState('');
  const [newRacerDen, setNewRacerDen] = useState('');
  const [newRacerInspected, setNewRacerInspected] = useState(true);
  const [newRacerPhoto, setNewRacerPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoStatus, setPhotoStatus] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [activePhotoRacerId, setActivePhotoRacerId] = useState<string | null>(null);
  const [pendingCardPhotoRacerId, setPendingCardPhotoRacerId] = useState<string | null>(null);
  const cardPhotoInputRef = useRef<HTMLInputElement | null>(null);

  const denSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const suggestions: string[] = [];

    for (const racer of allRacers) {
      const den = racer.den?.trim();
      if (!den) {
        continue;
      }

      const normalizedDen = den.toLowerCase();
      if (seen.has(normalizedDen)) {
        continue;
      }

      seen.add(normalizedDen);
      suggestions.push(den);
    }

    return suggestions.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [allRacers]);

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
    setNewRacerInspected(true);
    clearPhotoSelection();
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

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this racer and their saved car photo?')) return;
    await api.deleteRacer(id);
    refreshData();
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

  const handleRemoveRacerPhoto = async (racer: Racer) => {
    if (!racer.car_photo_filename) {
      return;
    }

    if (!confirm(`Remove car photo for ${racer.name}?`)) {
      return;
    }

    setNotice(null);
    setActivePhotoRacerId(racer.id);

    try {
      await api.deleteRacerPhoto(racer.id);
      setNotice(`Removed ${racer.name} photo.`);
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
        <Card className="mb-4 border-orange-200 bg-orange-50">
          <CardContent className="p-3 text-sm font-semibold text-orange-700">{notice}</CardContent>
        </Card>
      )}

      {showAddForm ? (
        <Card className="mb-6 border-2 border-orange-200">
          <CardHeader>
            <CardTitle className="text-lg">Add New Racer</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 items-end">
              <div className="md:col-span-2 xl:col-span-2">
                <label className="block text-xs font-bold mb-2 text-slate-600 uppercase tracking-wider">
                  Full Name *
                </label>
                <Input 
                  value={newRacerName}
                  onChange={(e) => setNewRacerName(e.target.value)}
                  required 
                  placeholder="Johnny Smith"
                  className="h-12"
                />
              </div>
              <div className="xl:col-span-1">
                <label className="block text-xs font-bold mb-2 text-slate-600 uppercase tracking-wider">
                  Den
                </label>
                <Input 
                  value={newRacerDen}
                  onChange={(e) => setNewRacerDen(e.target.value)}
                  placeholder="Wolf"
                  list="den-suggestions"
                  className="h-12"
                />
                {denSuggestions.length > 0 && (
                  <datalist id="den-suggestions">
                    {denSuggestions.map((den) => (
                      <option key={den} value={den} />
                    ))}
                  </datalist>
                )}
              </div>

              <p className="md:col-span-2 xl:col-span-3 text-sm font-semibold text-slate-600">
                Car numbers are assigned automatically when you save.
              </p>

              <div className="md:col-span-2 xl:col-span-4">
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
                      Preparing photo for fast local upload...
                    </p>
                  )}

                  {photoError && (
                    <p className="mt-2 text-sm font-semibold text-red-600">{photoError}</p>
                  )}

                  {photoStatus && !photoError && (
                    <p className="mt-2 text-sm font-semibold text-emerald-700">{photoStatus}</p>
                  )}

                  {!photoError && (
                    <p className="mt-2 text-xs font-medium text-slate-500">
                      Accepts common mobile formats, auto-resized to keep files manageable on your local network.
                    </p>
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

              <div className="md:col-span-2 xl:col-span-4 flex items-center gap-3 py-2">
                <Checkbox 
                  id="inspected" 
                  checked={newRacerInspected}
                  onCheckedChange={(checked) => setNewRacerInspected(checked === true)}
                />
                <Label htmlFor="inspected" className="font-semibold cursor-pointer text-slate-700">
                  Inspected (ready to race)
                </Label>
              </div>
              <div className="md:col-span-2 xl:col-span-4 flex flex-col sm:flex-row gap-2">
                <Button
                  type="submit"
                  disabled={isSubmitting || isProcessingPhoto}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12"
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
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <Input
              type="text"
              placeholder="Search racers or car numbers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 bg-white border-slate-300"
            />
          </div>
          <Button 
            onClick={() => setShowAddForm(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold h-12 w-full sm:w-auto"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Racer
          </Button>
        </div>
      )}

      <div className="grid gap-3">
        {racers.map(racer => (
          <Card 
            key={racer.id} 
            className="group hover:border-orange-300 transition-all"
          >
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
                  <img
                    src={api.getRacerPhotoUrl(racer.id, racer.updated_at)}
                    alt={`${racer.name} car photo`}
                    className="w-14 h-14 rounded-lg border-2 border-slate-300 object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 flex flex-col items-center justify-center bg-slate-50">
                    <Camera className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase">No Pic</span>
                  </div>
                )}

                <div className="min-w-0">
                  <p className="font-bold text-lg text-slate-900 truncate">{racer.name}</p>
                  <div className="flex gap-2 text-sm text-slate-500 mt-1">
                    {racer.den && (
                      <Badge variant="secondary" className="font-medium">{racer.den}</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                {racer.weight_ok ? (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Inspected
                  </Badge>
                ) : (
                  <span className="text-slate-400 text-sm mr-auto sm:mr-0">Pending</span>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={activePhotoRacerId === racer.id}
                  onClick={() => beginCardPhotoUpload(racer.id)}
                  className="h-10 px-3"
                >
                  {activePhotoRacerId === racer.id ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ImagePlus className="w-4 h-4 mr-2" />
                  )}
                  {racer.car_photo_filename ? 'Change Photo' : 'Add Photo'}
                </Button>

                {racer.car_photo_filename && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={activePhotoRacerId === racer.id}
                    onClick={() => handleRemoveRacerPhoto(racer)}
                    className="h-10 px-3 border-slate-300"
                  >
                    Remove Photo
                  </Button>
                )}

                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleDelete(racer.id)} 
                  disabled={activePhotoRacerId === racer.id}
                  className="text-slate-500 hover:text-red-600 hover:bg-red-50 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all h-10 px-3"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="ml-2 text-sm font-semibold">Delete</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
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
    </div>
  );
}

function InspectionTab() {
  const { racers, refreshData } = useApp();

  const handleInspect = async (racerId: string, pass: boolean) => {
    await api.inspectRacer(racerId, pass);
    refreshData();
  };

  if (racers.length === 0) {
    return (
      <Card className="border-2 border-dashed border-slate-300">
        <CardContent className="text-center py-12 text-slate-500">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p>No racers to inspect yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {racers.map(racer => (
        <Card 
          key={racer.id} 
          className={cn(
            "border-2",
            racer.weight_ok 
              ? "bg-emerald-50 border-emerald-300" 
              : "border-slate-200"
          )}
        >
          <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className={cn(
                "w-14 h-14 rounded-lg flex items-center justify-center font-black text-xl border-2",
                racer.weight_ok 
                  ? "bg-emerald-100 text-emerald-700 border-emerald-300" 
                  : "bg-slate-100 text-slate-500 border-slate-300"
              )}>
                #{racer.car_number}
              </div>
              {racer.car_photo_filename ? (
                <img
                  src={api.getRacerPhotoUrl(racer.id, racer.updated_at)}
                  alt={`${racer.name} car photo`}
                  className="w-12 h-12 rounded-lg border-2 border-slate-300 object-cover"
                  loading="lazy"
                />
              ) : null}
              <div>
                <p className="font-bold text-lg text-slate-900">{racer.name}</p>
                {racer.den && (
                  <Badge variant="secondary" className="mt-1">{racer.den}</Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {racer.weight_ok ? (
                <>
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 mr-auto sm:mr-4">
                    <CheckSquare className="w-3 h-3 mr-1" />
                    PASSED
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleInspect(racer.id, false)}
                    className="h-11 px-4"
                  >
                    Reset
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    onClick={() => handleInspect(racer.id, true)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold h-11 flex-1 sm:flex-none"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    PASS
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => handleInspect(racer.id, false)}
                    className="border-red-300 text-red-500 hover:bg-red-50 h-11 flex-1 sm:flex-none"
                  >
                    <XSquare className="w-4 h-4 mr-1" />
                    FAIL
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
