// The login greeting, by the phone's local time.
export const greeting = (now = new Date()) => {
  const hour = now.getHours();
  if (hour >= 5 && hour < 11) return "Dobro jutro.";
  if (hour >= 11 && hour < 18) return "Dobar dan.";
  return "Dobro veče.";
};
