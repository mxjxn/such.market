import React from 'react';
import { User, ExternalLink } from 'lucide-react';

interface ProfileHeaderProps {
  pfp_url?: string;
  username?: string;
  display_name?: string;
  fid: number;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ pfp_url, username, display_name, fid }) => (
  <div className="flex items-center gap-4 p-2 bg-white dark:bg-gray-800 rounded-lg shadow">
    <div className="flex-shrink-0">
      {pfp_url ? (
        <img
          src={pfp_url}
          alt="Profile"
          className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
          <User className="w-6 h-6 text-gray-400" />
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="font-bold text-gray-900 dark:text-white truncate">
          {display_name || username || 'Anonymous'}
        </span>
        {username && (
          <span className="text-sm text-gray-500 dark:text-gray-400 truncate">@{username}</span>
        )}
        <span className="text-xs text-gray-600 dark:text-gray-400">FID: {fid}</span>
      </div>
    </div>
    <a
      href={`https://warpcast.com/${username || fid}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 px-2 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded transition-colors text-xs"
    >
      <ExternalLink className="w-3 h-3" />
      Warpcast
    </a>
  </div>
);

export default ProfileHeader; 