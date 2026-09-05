import React, { useState } from 'react';
import { Send, Clock, AlertCircle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Textarea } from '../common/Textarea';
import { Select } from '../common/Select';
import { Button } from '../common/Button';
import { FileUpload } from '../common/FileUpload';
import { Sender } from '../../types';
import { emailApi } from '../../services/api';

export interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  senders: Sender[];
  onSuccess: () => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  senders,
  onSuccess,
  onToast,
}) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedSenderId, setSelectedSenderId] = useState(senders[0]?.id || '');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [startTime, setStartTime] = useState(
    new Date(Date.now() + 60000).toISOString().slice(0, 16)
  );
  const [delayMs, setDelayMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Sync selectedSenderId if senders array changes
  React.useEffect(() => {
    if (!selectedSenderId && senders.length > 0) {
      setSelectedSenderId(senders[0].id);
    }
  }, [senders, selectedSenderId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!subject.trim()) {
      setFormError('Subject cannot be empty');
      return;
    }

    if (!body.trim()) {
      setFormError('Email body cannot be empty');
      return;
    }

    if (!selectedSenderId) {
      setFormError('Please select a sender');
      return;
    }

    if (recipients.length === 0) {
      setFormError('Please upload at least one valid recipient in CSV/TXT');
      return;
    }

    setIsSubmitting(true);

    try {
      const scheduledIso = new Date(startTime).toISOString();
      const res = await emailApi.scheduleCampaign({
        subject,
        body,
        recipients,
        senderId: selectedSenderId,
        startTime: scheduledIso,
        delayMs: Number(delayMs),
        hourlyLimit: Number(hourlyLimit),
      });

      if (res.success) {
        onToast('success', `Successfully scheduled ${recipients.length} emails!`);
        onSuccess();
        onClose();
        // Reset form
        setSubject('');
        setBody('');
        setRecipients([]);
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to schedule campaign';
      setFormError(message);
      onToast('error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const setSendNow = () => {
    setStartTime(new Date().toISOString().slice(0, 16));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Compose Email Campaign"
      subtitle="Schedule delayed email jobs with distributed rate limiting"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Sender Selection */}
        <Select
          label="Sender Account"
          options={senders.map((s) => ({
            value: s.id,
            label: `${s.email} (${s.etherealUsername})`,
          }))}
          value={selectedSenderId}
          onChange={(e) => setSelectedSenderId(e.target.value)}
        />

        {/* Subject */}
        <Input
          label="Subject"
          placeholder="e.g. Exciting announcement from our team"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />

        {/* Body */}
        <Textarea
          label="Email Body"
          placeholder="Write your email content here. HTML is automatically rendered for preview."
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        {/* CSV / TXT Upload */}
        <FileUpload
          onLeadsDetected={(emails) => setRecipients(emails)}
          onClear={() => setRecipients([])}
        />

        {/* Scheduling Parameters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          {/* Start Time */}
          <div className="space-y-1.5 text-left">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Start Time
              </label>
              <button
                type="button"
                onClick={setSendNow}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                Send Now
              </button>
            </div>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="block w-full rounded-xl bg-slate-900 border border-slate-700/80 text-slate-100 text-xs py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Delay Between Emails */}
          <Input
            label="Delay (ms)"
            type="number"
            min={0}
            step={100}
            value={delayMs}
            onChange={(e) => setDelayMs(Number(e.target.value))}
            helperText="Min send delay between jobs"
          />

          {/* Hourly Limit */}
          <Input
            label="Hourly Limit"
            type="number"
            min={1}
            value={hourlyLimit}
            onChange={(e) => setHourlyLimit(Number(e.target.value))}
            helperText="Rescheduled if exceeded"
          />
        </div>

        {/* Live Stagger Estimate */}
        {recipients.length > 0 && (
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>
                {recipients.length} emails staggered by {delayMs}ms
              </span>
            </div>
            <span className="font-mono text-indigo-300">
              Est. span: {Math.round((recipients.length * delayMs) / 1000)}s
            </span>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="outline" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="md"
            isLoading={isSubmitting}
            leftIcon={<Send className="w-4 h-4" />}
          >
            Schedule Campaign
          </Button>
        </div>
      </form>
    </Modal>
  );
};
