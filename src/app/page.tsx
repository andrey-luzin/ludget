"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"

export default function Home() {
  const [date, setDate] = React.useState<Date | undefined>(new Date())
  const [checked, setChecked] = React.useState<boolean>(false)

  return (
    <div className="min-h-screen w-full py-12 px-6 sm:px-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">shadcn/ui demo</h1>
        <p className="text-muted-foreground mt-1">Button, Input, Checkbox, Calendar</p>

        <div className="mt-8 grid gap-8">
          {/* Buttons */}
          <section>
            <h2 className="text-lg font-medium mb-3">Buttons</h2>
            <div className="flex flex-wrap items-center gap-3">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
            </div>
          </section>

          {/* Inputs */}
          <section>
            <h2 className="text-lg font-medium mb-3">Input</h2>
            <div className="grid gap-3 max-w-md">
              <div className="grid gap-1.5">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input id="email" type="email" placeholder="you@example.com" />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Input id="password" type="password" placeholder="••••••••" />
              </div>
            </div>
          </section>

          {/* Checkbox */}
          <section>
            <h2 className="text-lg font-medium mb-3">Checkbox</h2>
            <div className="flex items-center gap-2">
              <Checkbox
                id="terms"
                checked={checked}
                onCheckedChange={(v) => setChecked(Boolean(v))}
              />
              <label htmlFor="terms" className="text-sm select-none">
                I agree to the terms and conditions
              </label>
            </div>
          </section>

          {/* Calendar */}
          <section>
            <h2 className="text-lg font-medium mb-3">Calendar</h2>
            <div className="grid gap-3">
              <div className="text-sm text-muted-foreground">
                Selected: {date ? date.toDateString() : "—"}
              </div>
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="rounded-md border p-2"
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
