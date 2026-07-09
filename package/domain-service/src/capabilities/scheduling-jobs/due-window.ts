export function isInJobNotificationWindow(
  deliverAfter: Date,
  eventAt: Date,
  asOf: Date,
): boolean {
  return deliverAfter.getTime() <= asOf.getTime() && eventAt.getTime() >= asOf.getTime()
}
