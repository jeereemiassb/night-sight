import { useState, useCallback } from "react";
import { Upload, ImageIcon, X, ScanFace } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { dictionary } from "@/config/dictionary";

interface ImageDropZoneProps {
  onImageDrop: (imageUrl: string) => void;
  isSearching: boolean;
  compact?: boolean;
}

export function ImageDropZone({ onImageDrop, isSearching, compact = false }: ImageDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        setPreviewUrl(url);
        onImageDrop(url);
      };
      reader.readAsDataURL(files[0]);
    }
  }, [onImageDrop]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        setPreviewUrl(url);
        onImageDrop(url);
      };
      reader.readAsDataURL(files[0]);
    }
  }, [onImageDrop]);

  const clearImage = useCallback(() => {
    setPreviewUrl(null);
  }, []);

  const height = compact ? "h-32" : "h-48";

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!previewUrl ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <label
              htmlFor="image-upload"
              className={`
                relative flex flex-col items-center justify-center 
                w-full ${height} border-2 border-dashed rounded-lg 
                cursor-pointer transition-all duration-300 overflow-hidden
                ${isDragging 
                  ? "border-primary bg-primary/5 shadow-[0_0_20px_rgba(34,197,94,0.3)]" 
                  : "border-border hover:border-primary/50 bg-card/50"
                }
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {isDragging && (
                <div className="absolute inset-0 overflow-hidden">
                  <div className="scan-line absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
                </div>
              )}
              
              <motion.div 
                className="relative flex flex-col items-center gap-2 p-4"
                animate={isDragging ? { scale: 1.05 } : { scale: 1 }}
              >
                <div className={`
                  p-3 rounded transition-all duration-300
                  ${isDragging 
                    ? "bg-primary/20 text-primary shadow-[0_0_15px_rgba(34,197,94,0.5)]" 
                    : "bg-muted/50 text-muted-foreground"
                  }
                `}>
                  {isDragging ? (
                    <ImageIcon className="w-8 h-8" />
                  ) : (
                    <Upload className="w-8 h-8" />
                  )}
                </div>
                <div className="text-center">
                  <p className={`font-medium ${compact ? "text-sm" : "text-base"} text-foreground font-mono`}>
                    {isDragging ? dictionary.upload.uploadReady : dictionary.upload.dragImage}
                  </p>
                  {!compact && (
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      {dictionary.upload.helper}
                    </p>
                  )}
                </div>
              </motion.div>
              <input
                id="image-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileInput}
              />
            </label>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`relative flex items-center justify-center ${height} border-2 border-border rounded-lg bg-card/50 p-4`}
          >
            <div className="relative">
              <div className={`relative ${compact ? 'w-20 h-20' : 'w-32 h-32'} overflow-hidden border-2 border-primary shadow-[0_0_15px_rgba(34,197,94,0.4)]`}>
                <img
                  src={previewUrl}
                  alt={dictionary.upload.previewAlt}
                  className="w-full h-full object-cover"
                />
                {isSearching && (
                  <motion.div 
                    className="absolute inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="relative">
                        <motion.div
                          className="w-10 h-10 border-2 border-primary rounded"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        />
                        <ScanFace className="absolute inset-0 m-auto w-5 h-5 text-primary" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
              
              {!isSearching && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 bg-card border border-border hover:bg-muted rounded-full"
                  onClick={clearImage}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
            
            {isSearching && (
              <div className="absolute bottom-3 left-0 right-0 text-center">
                <p className="text-xs font-medium text-primary font-mono">
                  {dictionary.upload.scanning}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
