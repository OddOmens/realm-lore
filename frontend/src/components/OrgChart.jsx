import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Network, ChevronDown } from 'lucide-react';
import { useWorldStore } from '../store/useWorldStore';
import { assetUrl } from '../lib/api';

export default function OrgChart({ membership }) {
  const characters = useWorldStore(s => s.characters);
  const navigate = useNavigate();

  if (!membership || membership.length === 0) {
    return (
      <div className="mt-6 flex flex-col items-center justify-center h-64 px-6 text-center text-muted-foreground border border-dashed border-border rounded-lg">
        <span className="mb-3 grid size-10 place-items-center rounded-lg bg-muted"><Network size={18} /></span>
        <p className="text-sm font-semibold text-foreground">No membership hierarchy defined</p>
        <p className="text-sm mt-1">Add membership levels to this faction to build an org chart.</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto py-8 px-4 flex justify-center min-h-[500px]">
      <div className="flex flex-col items-center">
        {membership.map((level, idx) => {
          const levelMembers = characters.filter(c => (level.members || []).includes(c.id));
          const hasNext = idx < membership.length - 1;

          return (
            <div key={level.id || idx} className="flex flex-col items-center">
              {/* Level Title */}
              <div className="mb-4 text-center">
                <span className="inline-block px-2.5 py-1 rounded-md bg-muted text-xs font-semibold text-foreground">
                  {level.title || 'Untitled Rank'}
                </span>
              </div>

              {/* Members Grid */}
              {levelMembers.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-4 mb-6 max-w-4xl">
                  {levelMembers.map(member => (
                    <div
                      key={member.id}
                      onClick={() => navigate(`/characters/${member.id}`)}
                      className="group card card-hover flex flex-col items-center gap-2 p-3 cursor-pointer w-40"
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0">
                        {member.image ? (
                          <img src={assetUrl(member.image)} alt={member.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-base font-semibold text-muted-foreground">
                            {member.name ? member.name.charAt(0).toUpperCase() : '?'}
                          </span>
                        )}
                      </div>
                      <div className="text-center w-full">
                        <p className="text-sm font-semibold text-foreground truncate w-full" title={member.name || 'Unnamed'}>
                          {member.name || 'Unnamed'}
                        </p>
                        {member.alias && (
                          <p className="text-xs text-muted-foreground truncate w-full" title={member.alias}>
                            {member.alias}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-3 mb-6 rounded-lg border border-dashed border-border w-40 h-[106px]">
                  <p className="text-xs text-muted-foreground">No members assigned</p>
                </div>
              )}

              {/* Connecting Line to next level */}
              {hasNext && (
                <div className="flex flex-col items-center mb-4">
                  <div className="w-px h-8 bg-border" />
                  <ChevronDown size={16} className="text-muted-foreground/50 -mt-2" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
