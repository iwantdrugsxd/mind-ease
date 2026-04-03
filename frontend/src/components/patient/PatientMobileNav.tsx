import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, MessageCircle, Heart, ClipboardList, Shield } from 'lucide-react';

const tabs = [
  { to: '/dashboard', label: 'Home', icon: Home },
  { to: '/chatbot', label: 'Chat', icon: MessageCircle },
  { to: '/selfcare', label: 'Self-Care', icon: Heart },
  { to: '/care-team', label: 'Care', icon: Shield },
  { to: '/screening', label: 'Progress', icon: ClipboardList },
];

export default function PatientMobileNav({
  careBadgeCount = 0,
}: {
  careBadgeCount?: number;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_-20px_rgba(15,23,42,0.35)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid max-w-2xl grid-cols-5 gap-1">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) =>
              [
                'relative flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-semibold transition-all',
                isActive ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={['h-[1.15rem] w-[1.15rem]', isActive ? 'opacity-100' : 'opacity-80'].join(' ')} />
                <span className="leading-none">{label}</span>
                {to === '/care-team' && careBadgeCount > 0 ? (
                  <span className="absolute right-3 top-2 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary-600 px-1 text-[9px] font-bold text-white">
                    {careBadgeCount}
                  </span>
                ) : null}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
