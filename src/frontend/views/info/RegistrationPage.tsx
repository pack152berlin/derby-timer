import React from 'react';
import { Users, Smartphone, Scale, ClipboardCheck, Zap, Upload, FileSpreadsheet } from 'lucide-react';
import { SectionHeading, Callout, StepList } from './components';

export function RegistrationPage() {
  return (
    <div className="space-y-8">
      <SectionHeading id="how-registration">How Registration Works</SectionHeading>
      <div className="space-y-3 text-slate-700">
        <p>
          Registration is the first step on race day. DerbyTimer is built around three
          principles that keep check-in fast and stress-free:
        </p>
        <div className="grid gap-3 sm:grid-cols-3 my-3">
          {[
            {
              icon: <Users className="w-5 h-5" />,
              title: 'Parallel check-in',
              desc: 'Any number of volunteers register racers simultaneously from their own phones. No single bottleneck.',
            },
            {
              icon: <Zap className="w-5 h-5" />,
              title: 'Fast & conflict-free',
              desc: 'Car numbers are validated on save. Duplicates are caught automatically — multiple stations never clash.',
            },
            {
              icon: <FileSpreadsheet className="w-5 h-5" />,
              title: 'Pre-filled roster',
              desc: 'Upload your pack roster ahead of time so volunteers just confirm attendance instead of typing names.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border-2 border-[#003F87]/15 bg-[#003F87]/[0.03] p-4 space-y-2"
            >
              <div className="w-9 h-9 rounded-lg bg-[#003F87] flex items-center justify-center text-white">
                {item.icon}
              </div>
              <p className="font-bold text-slate-900 text-sm">{item.title}</p>
              <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <SectionHeading id="check-in-flow">Check-in Flow</SectionHeading>
      <div className="space-y-3 text-slate-700">
        <p>
          Each racer goes through these steps — they can happen at one table or be
          split across stations depending on your pack&apos;s size.
        </p>
        <StepList
          steps={[
            {
              title: 'Open DerbyTimer on any device',
              desc: 'Volunteers navigate to the app on their phone, tablet, or laptop and tap Registration.',
            },
            {
              title: 'Enter racer details',
              desc: 'Name, den, and car number for each racer. If a roster was uploaded, just confirm the entry.',
            },
            {
              title: 'Inspect and weigh',
              desc: 'Mark cars as passing the weight check — at the same table or a separate inspection station.',
            },
            {
              title: 'Snap a photo (optional)',
              desc: 'Take a car photo for the race display and certificates. Not required — skip to save time.',
            },
          ]}
        />
      </div>

      <SectionHeading id="parallel-stations">Parallel Stations</SectionHeading>
      <div className="space-y-3 text-slate-700">
        <p>
          There&apos;s no limit to how many volunteers can register at once. For packs with 30+ cars,
          put <strong>as many volunteers as you have</strong> on their phones — every extra person
          shortens the line.
        </p>
        <div className="grid gap-3 sm:grid-cols-3 my-3">
          {[
            {
              icon: <Smartphone className="w-5 h-5" />,
              title: 'Any number of devices',
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
          Inspection can happen at the same table as registration or at a{' '}
          <strong>separate dedicated station</strong> — whatever fits your pack&apos;s setup.
        </p>
        <p>
          For larger events, a separate inspection table helps. Registration volunteers stay focused
          on entering data while a dedicated inspector handles the scale. Both workflows happen in
          parallel so no one waits for the other.
        </p>
        <Callout>
          Either way, any volunteer can open the <strong>Inspect</strong> tab and mark cars as they
          pass the weight check.
        </Callout>
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
