import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { activityApi, type ActivityItem } from '../api/activity';
import { EmptyState } from '../components/ui/EmptyState';
import {
  Activity as ActivityIcon,
  UploadCloud,
  Trash2,
  BotMessageSquare,
  RefreshCw,
  ThumbsUp,
  Clock,
  Filter,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

export const Activity: React.FC = () => {
  const [eventType, setEventType] = useState('all');

  const { data: activities, isLoading } = useQuery({
    queryKey: ['activity', eventType],
    queryFn: () =>
      activityApi.list({
        event_type: eventType !== 'all' ? eventType : undefined,
        limit: 100,
      }),
    refetchInterval: 15000,
  });

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'document_uploaded':
        return <UploadCloud className="w-4 h-4 text-emerald-400" />;
      case 'document_deleted':
        return <Trash2 className="w-4 h-4 text-rose-400" />;
      case 'document_reindexed':
        return <RefreshCw className="w-4 h-4 text-blue-400" />;
      case 'ai_question':
        return <BotMessageSquare className="w-4 h-4 text-purple-400" />;
      case 'feedback_submitted':
        return <ThumbsUp className="w-4 h-4 text-amber-400" />;
      default:
        return <ActivityIcon className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">System Activity Audit Log</h1>
          <p className="text-sm text-slate-400 mt-1">
            Chronological audit trail of document uploads, deletions, vector indexing, and AI query logs.
          </p>
        </div>

        {/* Event Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Events</option>
            <option value="document_uploaded">Uploads</option>
            <option value="document_deleted">Deletions</option>
            <option value="document_reindexed">Re-indexing</option>
            <option value="ai_question">AI Questions</option>
            <option value="feedback_submitted">Feedback</option>
          </select>
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xs">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
            <p className="text-sm">Fetching audit logs...</p>
          </div>
        ) : activities && activities.length > 0 ? (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
            {activities.map((item: ActivityItem) => (
              <div key={item.id} className="relative group flex items-start gap-4">
                <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center group-hover:border-blue-500 transition-colors">
                  {getEventIcon(item.event_type)}
                </div>
                <div className="flex-1 bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {item.event_type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(item.created_at), 'MMM d, yyyy HH:mm:ss')} (
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })})
                    </span>
                  </div>
                  <p className="text-sm text-slate-200 font-medium leading-relaxed">{item.message}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ActivityIcon}
            title="No activity recorded"
            description="As users upload documents, ask AI questions, and manage collections, audit records will be logged here."
          />
        )}
      </div>
    </div>
  );
};
