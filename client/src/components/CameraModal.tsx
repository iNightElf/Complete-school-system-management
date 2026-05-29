import React, { useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
}

const CameraModal: React.FC<Props> = ({ open, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (open) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch((err) => {
          alert('Camera denied: ' + err.message);
          onClose();
        });
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [open, onClose]);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const MAX = 400;
    let w = video.videoWidth;
    let h = video.videoHeight;
    if (w > MAX || h > MAX) {
      if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
      else { w = Math.round((w * MAX) / h); h = MAX; }
    }
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')?.drawImage(video, 0, 0, w, h);
    onCapture(canvas.toDataURL('image/jpeg', 0.6));
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-school-primary rounded-2xl overflow-hidden max-w-md w-full">
        <div className="flex items-center justify-between p-3 text-white">
          <h3 className="font-medium text-sm">📷 Take Photo</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full"><X size={20} /></button>
        </div>
        <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-video object-cover" />
        <canvas ref={canvasRef} className="hidden" />
        <div className="flex gap-2 p-3">
          <button onClick={capture} className="flex-1 py-2 bg-school-accent text-white rounded-xl font-bold text-sm hover:opacity-90">
            📸 Capture
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-white/30 text-white rounded-xl text-sm hover:bg-white/10">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default CameraModal;
