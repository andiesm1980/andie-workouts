'use client'

import { useState } from 'react'
import type { Workout } from '@/types/workout'
import { StepInput } from './StepInput'

interface Props {
  workout: Workout
  onChange: (updates: Partial<Workout>) => void
}

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ paddingTop: 18, paddingBottom: 18, borderBottom: '1px solid rgba(255,255,255,0.07)' }}
    >
      <span className="text-white text-base">{label}</span>
      {children}
    </div>
  )
}

export function TimerSettingsTab({ workout, onChange }: Props) {
  const [setsEnabled, setSetsEnabled] = useState(
    (workout.rounds || 1) > 1 || (workout.cycleBreak || 0) > 0
  )
  const [warmCoolOpen, setWarmCoolOpen] = useState((workout.cooldown || 0) > 0)

  const ACCENT_COLORS = ['#f0407a', '#4e8fff', '#ff6b2b', '#84cc16', '#a87dff']
  const activeAccent = workout.accentColor ?? '#f0407a'

  return (
    <div className="px-5 pb-8">
      {/* Colour */}
      <div className="flex items-center justify-between py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <span className="text-white text-base">Colour</span>
        <div className="flex gap-2.5">
          {ACCENT_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onChange({ accentColor: c })}
              className="rounded-full transition-all active:scale-90"
              style={{
                width: 22, height: 22,
                backgroundColor: c,
                outline: activeAccent === c ? '2.5px solid rgba(255,255,255,0.9)' : '2.5px solid transparent',
                outlineOffset: 2,
                opacity: activeAccent === c ? 1 : 0.55,
                transform: activeAccent === c ? 'scale(1.15)' : 'scale(1)',
              }}
              aria-label={`Accent colour ${c}`}
            />
          ))}
        </div>
      </div>

      <Row label="Work">
        <StepInput value={workout.workTime} onChange={(v) => onChange({ workTime: v })}
          min={5} max={3600} step={5} format="time" />
      </Row>

      <Row label="Rest">
        <StepInput value={workout.restTime} onChange={(v) => onChange({ restTime: v })}
          min={0} max={3600} step={5} format="time" />
      </Row>

      {workout.type === 'hiit' && (
        <Row label="Intervals">
          <StepInput value={workout.intervals || 1} onChange={(v) => onChange({ intervals: v })}
            min={1} max={20} step={1} format="count" />
        </Row>
      )}

      <Row label="Get ready">
        <StepInput value={workout.warmup} onChange={(v) => onChange({ warmup: v })}
          min={0} max={300} step={5} format="time" />
      </Row>

      {/* Sets + Break with connector */}
      <div className="relative">
        {/* Vertical connector line */}
        {setsEnabled && (
          <div
            className="absolute rounded-full"
            style={{
              left: 11,
              top: 56,
              width: 1.5,
              height: 52,
              backgroundColor: 'rgba(255,255,255,0.18)',
            }}
          />
        )}

        {/* Sets row */}
        <div
          className="flex items-center justify-between"
          style={{ paddingTop: 18, paddingBottom: 18, borderBottom: setsEnabled ? 'none' : '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const next = !setsEnabled
                setSetsEnabled(next)
                if (!next) onChange({ rounds: 1, cycleBreak: 0 })
              }}
              className="flex items-center justify-center rounded-full transition-colors shrink-0"
              style={{
                width: 24,
                height: 24,
                border: '1.5px solid rgba(255,255,255,0.3)',
                backgroundColor: 'transparent',
              }}
              aria-label="Toggle sets"
            >
              {setsEnabled && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
            </button>
            <span className="text-white text-base">Sets</span>
          </div>
          <StepInput
            value={workout.rounds}
            onChange={(v) => { setSetsEnabled(true); onChange({ rounds: v }) }}
            min={1} max={99} step={1} format="count"
          />
        </div>

        {/* Break row */}
        {setsEnabled && (
          <div
            className="flex items-center justify-between"
            style={{ paddingTop: 18, paddingBottom: 18, borderBottom: '1px solid rgba(255,255,255,0.07)', paddingLeft: 0 }}
          >
            <div className="flex items-center gap-3" style={{ paddingLeft: 0 }}>
              {/* L-connector */}
              <div className="flex items-center shrink-0" style={{ width: 24, paddingLeft: 10 }}>
                <svg width="14" height="20" viewBox="0 0 14 20" fill="none">
                  <path d="M4 0 L4 10 Q4 16 10 16" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                </svg>
              </div>
              <span className="text-white text-base">Break</span>
            </div>
            <StepInput
              value={workout.cycleBreak || 0}
              onChange={(v) => onChange({ cycleBreak: v })}
              min={0} max={600} step={5} format="time"
            />
          </div>
        )}
      </div>

      {/* Add warm up and cool down */}
      <button
        onClick={() => setWarmCoolOpen((o) => !o)}
        className="flex items-center gap-3 w-full transition-opacity hover:opacity-80"
        style={{ paddingTop: 22, paddingBottom: warmCoolOpen ? 4 : 22 }}
      >
        <div
          className="flex items-center justify-center rounded-full shrink-0"
          style={{ width: 28, height: 28, border: '1.5px solid rgba(255,255,255,0.25)' }}
        >
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 18, lineHeight: 1 }}>
            {warmCoolOpen ? '−' : '+'}
          </span>
        </div>
        <span className="text-base" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Add warm up and cool down
        </span>
      </button>

      {warmCoolOpen && (
        <Row label="Cool down">
          <StepInput value={workout.cooldown || 0} onChange={(v) => onChange({ cooldown: v })}
            min={0} max={600} step={5} format="time" />
        </Row>
      )}

      {/* Auto-start */}
      <Row label={
        <span>
          Auto-start
          <span className="block text-xs font-normal mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Begin immediately when opened
          </span>
        </span>
      }>
        <button
          onClick={() => onChange({ autoStart: !workout.autoStart })}
          className="relative shrink-0 transition-colors"
          style={{ width: 44, height: 26 }}
          role="switch"
          aria-checked={!!workout.autoStart}
        >
          <div
            className="absolute inset-0 rounded-full transition-colors duration-200"
            style={{ backgroundColor: workout.autoStart ? activeAccent : 'rgba(255,255,255,0.12)' }}
          />
          <div
            className="absolute top-[3px] rounded-full transition-transform duration-200"
            style={{
              width: 20, height: 20,
              backgroundColor: '#fff',
              left: workout.autoStart ? 21 : 3,
            }}
          />
        </button>
      </Row>
    </div>
  )
}
