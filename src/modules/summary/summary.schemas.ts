import { z } from 'zod';
import { daysBetween, isValidTimeZone } from './local-dates.js';

export const MAX_SUMMARY_DAYS = 92;

// IANA timezone name of the user's device, e.g. "Africa/Lagos" (the default).
const timezone = z
  .string()
  .default('Africa/Lagos')
  .refine(isValidTimeZone, 'Unknown timezone; use an IANA name such as "Africa/Lagos"');

export const dailySummarySchema = z.object({
  date: z.iso.date(),
  timezone,
});

export const rangeSummarySchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    timezone,
  })
  .refine((q) => q.from <= q.to, { message: '"from" must not be after "to"', path: ['from'] })
  .refine((q) => daysBetween(q.from, q.to) < MAX_SUMMARY_DAYS, {
    message: `A summary can cover at most ${MAX_SUMMARY_DAYS} days`,
    path: ['to'],
  });

export type DailySummaryQuery = z.infer<typeof dailySummarySchema>;
export type RangeSummaryQuery = z.infer<typeof rangeSummarySchema>;
