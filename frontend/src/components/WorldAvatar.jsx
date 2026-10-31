import { worldColor, worldInitials } from '../lib/worlds';

// A world's coloured square with its initials.
export default function WorldAvatar({ name, className = 'size-6 text-[0.65rem]' }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-md font-semibold tracking-wide text-white select-none ${className}`}
      style={{ background: worldColor(name) }}
    >
      {worldInitials(name)}
    </span>
  );
}
