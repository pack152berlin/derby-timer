import React from 'react';
import { Users, Smartphone, Scale, ClipboardCheck } from 'lucide-react';
import { SectionHeading, Callout } from './components';

export function RegistrationPage() {
  return (
    <div className="space-y-8">
      <SectionHeading id="how-registration">How Registration Works</SectionHeading>
      <div className="space-y-3 text-slate-700">
        <p>
          Registration is the first step on race day. Every car needs a name, car number, and den
          assignment before it can race. DerbyTimer is designed so{' '}
          <strong>multiple volunteers can register cars simultaneously</strong> from their own phones
          or tablets — no single bottleneck at a laptop.
        </p>
        <p>
          Just open the app on any device, tap <strong>Registration</strong>, and start adding
          racers. All devices see updates in real time.
        </p>
      </div>

      <SectionHeading id="parallel-stations">Parallel Registration Stations</SectionHeading>
      <div className="space-y-3 text-slate-700">
        <p>
          For packs with 30+ cars, a single registration line creates a long wait. The fastest
          approach is to set up <strong>2–4 registration stations</strong>, each staffed by a
          volunteer with their own phone.
        </p>
        <div className="grid gap-3 sm:grid-cols-3 my-3">
          {[
            {
              icon: <Smartphone className="w-5 h-5" />,
              title: '2–3 stations',
              desc: 'Each volunteer opens DerbyTimer on their phone and adds racers independently.',
            },
            {
              icon: <Users className="w-5 h-5" />,
              title: 'No conflicts',
              desc: 'Car numbers are validated on save — duplicates are caught automatically.',
            },
            {
              icon: <ClipboardCheck className="w-5 h-5" />,
              title: 'Real-time sync',
              desc: 'Every device sees the full racer list as entries are added.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-slate-200 bg-white p-4 space-y-2"
            >
              <div className="w-9 h-9 rounded-lg bg-[#003F87]/10 flex items-center justify-center text-[#003F87]">
                {item.icon}
              </div>
              <p className="font-bold text-slate-900 text-sm">{item.title}</p>
              <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <SectionHeading id="inspection">Separate Inspection Station</SectionHeading>
      <div className="space-y-3 text-slate-700">
        <p>
          Inspection (weight check) should be a <strong>separate station</strong> from registration.
          Combining the two into one line slows everything down — the scale becomes the bottleneck
          while registration volunteers wait.
        </p>
        <Callout>
          Recommended setup: volunteers register cars at their phones, then direct families to a
          dedicated inspection table with a scale. The inspection volunteer opens the Inspect tab and
          marks each car as it passes.
        </Callout>
        <p>
          This separation lets registration and inspection run in parallel. A car can be registered
          at station A while a different car is being weighed at the inspection table — no one waits
          for the other.
        </p>
      </div>

      <SectionHeading id="car-photos">Car Photos</SectionHeading>
      <div className="space-y-3 text-slate-700">
        <p>
          Each racer entry supports an optional car photo. Volunteers can snap a photo during
          registration or inspection — it shows up on the race display and certificates.
        </p>
        <p>
          Photos are not required to race. If your pack skips photos to save time, everything still
          works — cars are identified by number and name.
        </p>
      </div>

      <SectionHeading id="tips">Tips for a Smooth Check-In</SectionHeading>
      <div className="space-y-3 text-slate-700">
        <ul className="space-y-2">
          <li className="flex gap-2">
            <Scale className="w-4 h-4 text-[#003F87] shrink-0 mt-1" />
            <span>
              <strong>Pre-print car numbers</strong> — hand them out at registration so families
              don&apos;t have to pick on the spot.
            </span>
          </li>
          <li className="flex gap-2">
            <Scale className="w-4 h-4 text-[#003F87] shrink-0 mt-1" />
            <span>
              <strong>Have a fix-it station</strong> near inspection with a scale, sandpaper, and
              weights for cars that don&apos;t pass.
            </span>
          </li>
          <li className="flex gap-2">
            <Scale className="w-4 h-4 text-[#003F87] shrink-0 mt-1" />
            <span>
              <strong>Start registration 30+ minutes before racing</strong> — late arrivals are the
              #1 cause of delayed starts.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
