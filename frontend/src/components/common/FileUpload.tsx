import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertTriangle, FileText, Trash2 } from 'lucide-react';
import { emailApi } from '../../services/api';
import { LeadParseResult } from '../../types';
import { Spinner } from './Spinner';

export interface FileUploadProps {
  onLeadsDetected: (emails: string[]) => void;
  onClear: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onLeadsDetected, onClear }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<LeadParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;

    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      setError('Please upload a valid .csv or .txt file');
      return;
    }

    setError(null);
    setIsLoading(true);
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await emailApi.parseLeads(formData);
      if (res.success) {
        setParseResult(res);
        onLeadsDetected(res.validEmails);
      } else {
        setError('Failed to parse recipients from file');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'File upload error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleClear = () => {
    setFileName(null);
    setParseResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
    onClear();
  };

  return (
    <div className="w-full space-y-2 text-left">
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
        Recipients (CSV or TXT Leads)
      </label>

      {!fileName ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-indigo-500 bg-indigo-950/20'
              : 'border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/60'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
              }
            }}
          />
          <div className="p-3 bg-slate-800/80 rounded-xl text-indigo-400 mb-2">
            <UploadCloud className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-slate-200">
            Click to upload leads or drag and drop
          </p>
          <p className="text-xs text-slate-500 mt-1">Accepts .CSV or .TXT files with email lists</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-950/60 border border-indigo-800/40 text-indigo-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">{fileName}</p>
                {isLoading && <p className="text-xs text-slate-400">Parsing email leads...</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-indigo-400 py-1">
              <Spinner size="sm" />
              <span>Validating and deduplicating email addresses...</span>
            </div>
          )}

          {parseResult && (
            <div className="space-y-2 pt-1 border-t border-slate-800/80">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>✓ {parseResult.validEmails.length} email addresses detected</span>
              </div>

              {parseResult.duplicatesRemoved > 0 && (
                <p className="text-xs text-slate-400">
                  {parseResult.duplicatesRemoved} duplicate address(es) automatically removed.
                </p>
              )}

              {parseResult.invalidEmails.length > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-800/30 space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{parseResult.invalidEmails.length} invalid recipient(s) ignored:</span>
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                    {parseResult.invalidEmails.slice(0, 5).map((inv, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300 text-[10px] font-mono"
                      >
                        {inv}
                      </span>
                    ))}
                    {parseResult.invalidEmails.length > 5 && (
                      <span className="text-[10px] text-amber-400 self-center">
                        +{parseResult.invalidEmails.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
    </div>
  );
};
