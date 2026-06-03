import { z } from "zod";

export const joinBodySchema = z.object({
  meetingUrl: z.string().min(1, "meetingUrl is required"),
  botName: z.string().min(1).optional(),
  force: z.boolean().optional(),
});

export const leaveBodySchema = z.union([
  z.object({
    meetingUrl: z.string().min(1),
  }),
  z.object({
    platform: z.enum(["google_meet", "teams"]),
    nativeMeetingId: z.string().min(1),
    passcode: z.string().optional(),
  }),
]);

export const platformParamSchema = z.enum(["google_meet", "teams"]);

export type JoinBody = z.infer<typeof joinBodySchema>;
export type LeaveBody = z.infer<typeof leaveBodySchema>;
