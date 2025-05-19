
"use client";

import { useState, useCallback, useRef, ChangeEvent, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import type { MediaItem, UserPreferences } from '@/types'; // Assuming UserPreferences is in types
import { CloudUpload, Loader2, X, Camera, Video, RefreshCcw, Image as ImageIcon, Radio, Settings2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateUserPreferences } from '@/app/actions/settingsActions'; // Assuming this exists

const MAX_FILE_SIZE = 6 * 1024 * 1024 * 1024; // 6GB
const MAX_FILE_SIZE_READABLE = "6 GB";

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mov', 'video/x-matroska', 'video/x-msvideo', 'video/x-flv'];


const uploadSchema = z.object({
  adultContent: z.boolean().default(false),
});

type UploadFormValues = z.infer<typeof uploadSchema>;

interface UploadFormProps {
  onUploadSuccess: (newItems: MediaItem[]) => void;
}

export default function UploadForm({ onUploadSuccess }: UploadFormProps) {
  const { toast } = useToast();
  const { user, updateUserInContext } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCameraView, setShowCameraView] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [captureMode, setCaptureMode] = useState<'photo' | 'video'>('photo');
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | undefined>(user?.preferences.cameraDeviceId);


  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      adultContent: false,
    },
  });

  useEffect(() => {
    if (user && user.preferences && user.preferences.cameraDeviceId) {
      setSelectedCameraId(user.preferences.cameraDeviceId);
    }
  }, [user]);


  const getCameraDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(videoDevices);
      if (videoDevices.length > 0 && !selectedCameraId) {
        // If no preferred camera is set, use the first available one by default
        // Or, if preferred is not found, also default to first.
        const currentPref = user?.preferences?.cameraDeviceId;
        if (!currentPref || !videoDevices.find(d => d.deviceId === currentPref)) {
            setSelectedCameraId(videoDevices[0].deviceId);
        }
      }
    } catch (err) {
      console.error("Error enumerating devices:", err);
    }
  };

  const startCamera = async (deviceId?: string) => {
    try {
      if (cameraStream) { // Stop existing stream if any
        cameraStream.getTracks().forEach(track => track.stop());
      }
      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: true // Request audio for video recording
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
      setShowCameraView(true);
      await getCameraDevices(); // Refresh device list on starting camera
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast({ title: "Error de Cámara", description: "No se pudo acceder a la cámara. Asegúrate de tener los permisos necesarios.", variant: "destructive" });
      setShowCameraView(false);
    }
  };

  const handleCameraChange = async (deviceId: string) => {
    setSelectedCameraId(deviceId);
    if (user) { // Save preference
      const newPrefs: UserPreferences = { ...user.preferences, cameraDeviceId: deviceId };
      const result = await updateUserPreferences(user.id, { cameraDeviceId: deviceId });
      if (result.success && result.preferences) {
        updateUserInContext({ preferences: result.preferences });
      }
    }
    await startCamera(deviceId); // Restart camera with new device
  };


  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    setCameraStream(null);
    setShowCameraView(false);
    setIsRecording(false);
    if(mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
    setMediaRecorder(null);
    setRecordedChunks([]);
  };

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) return `El archivo ${file.name} excede el tamaño máximo de ${MAX_FILE_SIZE_READABLE}.`;
    const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type);
    const isVideo = ACCEPTED_VIDEO_TYPES.includes(file.type);
    if (!isImage && !isVideo) {
      return `El archivo ${file.name} tiene un tipo no soportado (${file.type}). Solo se permiten imágenes y videos.`;
    }
    return null;
  };

  const handleFilesSelected = (newFiles: FileList | null) => {
    if (newFiles) {
      const filesArray = Array.from(newFiles);
      const validFilesToAdd: File[] = [];
      const errors: string[] = [];

      filesArray.forEach(file => {
        const error = validateFile(file);
        if (error) {
          errors.push(error);
        } else {
          if (!selectedFiles.some(sf => sf.name === file.name && sf.size === file.size && sf.type === file.type && sf.lastModified === file.lastModified)) {
            validFilesToAdd.push(file);
          }
        }
      });

      if (errors.length > 0) {
        toast({ title: "Archivos Inválidos", description: errors.join("\n"), variant: "destructive", duration: 7000 });
      }
      setSelectedFiles(prev => [...prev, ...validFilesToAdd]);
    }
  };
  
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFilesSelected(event.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    handleFilesSelected(event.dataTransfer.files);
  }, [selectedFiles]);

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => event.preventDefault();
  
  const removeFile = (fileToRemove: File) => {
    setSelectedFiles(prevFiles => prevFiles.filter(file =>
      !(file.name === fileToRemove.name && file.size === fileToRemove.size && file.lastModified === fileToRemove.lastModified)
    ));
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context?.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (blob) {
          const photoFile = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
          setSelectedFiles(prev => [...prev, photoFile]);
          // Don't stop camera immediately, allow more captures or switch to file view
          // stopCamera(); 
          setShowCameraView(false); // Return to file selection view
        }
      }, 'image/jpeg');
    }
  };

  const startRecording = () => {
    if (cameraStream) {
      const options = { mimeType: 'video/webm; codecs=vp9' }; 
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(cameraStream, options);
      } catch (e) {
        console.warn("VP9 mimeType not supported, trying default");
        try {
            recorder = new MediaRecorder(cameraStream); 
        } catch (e2) {
            toast({title: "Error de Grabación", description: "No se pudo iniciar la grabación. El formato de video no es soportado por tu navegador.", variant: "destructive"})
            console.error("MediaRecorder failed:", e2);
            return;
        }
      }
      
      setMediaRecorder(recorder);
      setRecordedChunks([]); // Clear previous chunks
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setRecordedChunks(prev => [...prev, event.data]);
        }
      };
      recorder.onstop = () => {
        const videoBlob = new Blob(recordedChunks, { type: recorder.mimeType || 'video/webm' });
        const videoFile = new File([videoBlob], `video_${Date.now()}.${videoBlob.type.split('/')[1] || 'webm'}`, { type: videoBlob.type });
        setSelectedFiles(prev => [...prev, videoFile]);
        setRecordedChunks([]); 
        setShowCameraView(false); // Return to file selection view
      };
      recorder.start();
      setIsRecording(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const onSubmit = async (data: UploadFormValues) => {
    if (!user) {
      toast({ title: "Error de Autenticación", description: "Debes iniciar sesión para subir archivos.", variant: "destructive" });
      return;
    }
    if (selectedFiles.length === 0) {
      toast({ title: "Sin Archivos", description: "Por favor, selecciona archivos para subir.", variant: "destructive" });
      return;
    }
    setIsUploading(true);

    const formData = new FormData();
    selectedFiles.forEach(file => formData.append('files', file));
    formData.append('adultContent', String(data.adultContent));
    formData.append('ownerUserId', user.id); // Add ownerUserId

    try {
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      const result = await response.json();

      if (response.ok) {
        if (result.items && result.items.length > 0) {
          onUploadSuccess(result.items);
          toast({ title: "Subida Completa", description: `${result.items.length} archivo(s) subido(s) exitosamente.` });
        } else {
           toast({ title: "Nota de Subida", description: result.message || "Archivos procesados, pero no se reportaron nuevos ítems." });
        }
        setSelectedFiles([]);
        form.reset();
      } else {
        toast({ title: "Subida Fallida", description: result.error || "No se pudieron subir los archivos.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "Error", description: "Ocurrió un error inesperado durante la subida.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  if (showCameraView) {
    return (
      <div className="space-y-4 p-1">
        <div className="relative aspect-video bg-black rounded-md overflow-hidden">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          {isRecording && <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 text-xs rounded animate-pulse">GRABANDO</div>}
        </div>

        {availableCameras.length > 1 && (
          <div className="flex flex-col items-start space-y-1">
            <Label htmlFor="camera-select" className="text-xs text-muted-foreground">Seleccionar Cámara:</Label>
            <Select value={selectedCameraId} onValueChange={handleCameraChange}>
              <SelectTrigger id="camera-select" className="w-full h-9 text-sm">
                <SelectValue placeholder="Seleccionar cámara" />
              </SelectTrigger>
              <SelectContent>
                {availableCameras.map(camera => (
                  <SelectItem key={camera.deviceId} value={camera.deviceId}>
                    {camera.label || `Cámara ${availableCameras.indexOf(camera) + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        <div className="flex justify-center items-center space-x-2">
            <Button type="button" variant={captureMode === 'photo' ? 'default' : 'outline'} size="sm" onClick={() => setCaptureMode('photo')} disabled={isRecording} >
                <ImageIcon className="mr-1 h-4 w-4"/> Foto
            </Button>
            <Button type="button" variant={captureMode === 'video' ? 'default' : 'outline'} size="sm" onClick={() => setCaptureMode('video')} disabled={isRecording} >
                <Video className="mr-1 h-4 w-4"/> Video
            </Button>
        </div>

        <div className="flex justify-center space-x-3 mt-2">
          {captureMode === 'photo' ? (
            <Button type="button" onClick={takePhoto} disabled={isRecording} size="lg" className="rounded-full w-16 h-16 p-0">
              <Camera className="h-8 w-8" />
            </Button>
          ) : (
            isRecording ? (
              <Button type="button" onClick={stopRecording} variant="destructive" size="lg" className="rounded-full w-16 h-16 p-0">
                <Radio className="h-8 w-8 fill-destructive-foreground" /> 
              </Button>
            ) : (
              <Button type="button" onClick={startRecording} size="lg" className="rounded-full w-16 h-16 p-0">
                 <Video className="h-8 w-8" />
              </Button>
            )
          )}
        </div>
        <canvas ref={canvasRef} className="hidden"></canvas>
        <Button type="button" variant="outline" onClick={stopCamera} className="w-full">Volver a selección de archivos</Button>
      </div>
    );
  }


  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-1">
      <div
        className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-muted-foreground/50 rounded-lg cursor-pointer hover:border-primary transition-colors h-32"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onClick={() => fileInputRef.current?.click()}
      >
        <CloudUpload className="w-8 h-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground text-center">
          <span className="font-semibold text-primary">Haz clic para subir</span> o arrastra y suelta
        </p>
        <p className="text-xs text-muted-foreground">
          Max {MAX_FILE_SIZE_READABLE} por archivo.
        </p>
        <Input
          id="file-upload-input-staged"
          type="file"
          multiple
          className="hidden"
          onChange={handleInputChange}
          ref={fileInputRef}
          accept={[...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES].join(',')}
        />
      </div>

      <Button type="button" variant="outline" onClick={() => startCamera(selectedCameraId)} className="w-full flex items-center justify-center gap-2">
        <Camera className="h-5 w-5" /> Tomar Foto / Grabar Video
      </Button>

      {selectedFiles.length > 0 && (
        <div className="space-y-2 mt-3 max-h-36 overflow-y-auto border border-border p-3 rounded-md bg-muted/20">
          <p className="text-sm font-medium text-foreground mb-2">Archivos seleccionados ({selectedFiles.length}):</p>
          {selectedFiles.map((file, index) => (
            <div
              key={`${file.name}-${file.lastModified}-${index}`}
              className="flex items-center justify-between text-sm p-1.5 bg-background rounded-md shadow-sm hover:bg-muted/50"
            >
              <span className="truncate flex-grow mr-2" title={file.name}>{file.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => removeFile(file)}
                aria-label={`Quitar ${file.name}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center space-x-2 pt-2">
        <Controller
          control={form.control}
          name="adultContent"
          render={({ field }) => (
            <Switch
              id="adultContent"
              checked={field.value}
              onCheckedChange={field.onChange}
              aria-label="Marcar como contenido para adultos (+18)"
            />
          )}
        />
        <Label htmlFor="adultContent">Marcar como contenido para adultos (+18)</Label>
      </div>

      <Button type="submit" className="w-full font-semibold" disabled={isUploading || selectedFiles.length === 0}>
        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Subir {selectedFiles.length > 0 ? `${selectedFiles.length} Archivo(s)` : 'Archivo(s)'}
      </Button>
    </form>
  );
}

